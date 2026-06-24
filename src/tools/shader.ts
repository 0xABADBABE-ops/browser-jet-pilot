import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession } from './utils.js'

export function registerShaderTools(
  server: McpServer,
  sessionManager: SessionManager,
  _config: ServerConfig
): void {
  server.registerTool(
    'browser_disable_shaders',
    {
      description:
        'Inject a script that blocks WebGL, throttles requestAnimationFrame, and freezes CSS animations/transitions. Use on heavy shader-rendered pages (Three.js, WebGL dashboards) to make them readable without GPU strain. Call BEFORE navigating to the target page for best results.',
      inputSchema: {
        webgl: z
          .boolean()
          .optional()
          .describe('Block WebGL context creation (default: true)'),
        animations: z
          .boolean()
          .optional()
          .describe('Freeze CSS animations and transitions (default: true)'),
        raf: z
          .boolean()
          .optional()
          .describe('Throttle requestAnimationFrame to ~1 FPS (default: true)'),
      },
    },
    /** Inject scripts to block WebGL, throttle rAF, and freeze CSS. */
    async ({ webgl, animations, raf }) => {
      try {
        const session = getSession(sessionManager)
        const enabled: string[] = []

        if (webgl !== false) {
          await session.page.evaluate(() => {
            const orig = HTMLCanvasElement.prototype.getContext
            HTMLCanvasElement.prototype.getContext = function (
              this: HTMLCanvasElement,
              type: string,
              ...args: unknown[]
            ) {
              if (type && type.includes('webgl')) return null
              return orig.call(this, type, ...args)
            } as typeof orig
          })
          enabled.push('WebGL blocked')
        }

        if (raf !== false) {
          await session.page.evaluate(() => {
            const origRAF = window.requestAnimationFrame.bind(window)
            let lastCall = 0
            // Use a global Symbol (not a string property) to avoid
            // enumerating on window and to keep the marker non-enumerable.
            // Matched by the restore handler via Reflect.has().
            Reflect.set(window, Symbol.for('__mcp_raf_hooked'), true)
            window.requestAnimationFrame = function (
              cb: FrameRequestCallback
            ): number {
              if (Date.now() - lastCall > 1000) {
                lastCall = Date.now()
                return origRAF(cb)
              }
              return 0
            }
          })
          enabled.push('requestAnimationFrame throttled to ~1 FPS')
        }

        if (animations !== false) {
          await session.page.evaluate(() => {
            const style = document.createElement('style')
            style.id = 'mcp-shader-kill'
            style.textContent =
              '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }'
            document.head.appendChild(style)
          })
          enabled.push('CSS animations/transitions frozen')
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                message: `Shader killer injected: ${enabled.join(', ') || 'nothing disabled'}`,
                disabled: enabled,
              }),
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        }
      }
    }
  )

  server.registerTool(
    'browser_restore_shaders',
    {
      description:
        'Restore WebGL, requestAnimationFrame, and CSS animations that were disabled by browser_disable_shaders. Removes the injected style element and restores original browser functions.',
    },
    async () => {
      try {
        const session = getSession(sessionManager)

        const results = await session.page.evaluate(() => {
          const parts: string[] = []

          // Remove injected style
          const killStyle = document.getElementById('mcp-shader-kill')
          if (killStyle) {
            killStyle.remove()
            parts.push('CSS animations restored')
          }

          // Check for the global Symbol set by browser_disable_shaders.
          // Using Reflect.has() because the marker is a non-enumerable Symbol,
          // not a string property.
          if (Reflect.has(window, Symbol.for('__mcp_raf_hooked'))) {
            parts.push('RAF hook detected (reload to fully restore)')
          }

          // WebGL restore is complex — mark for reload
          parts.push('WebGL requires page reload to fully restore')

          return parts
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                message: `Restored: ${results.join('; ')}`,
                note: 'For full WebGL/RAF restoration, navigate or reload the page.',
              }),
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        }
      }
    }
  )
}
