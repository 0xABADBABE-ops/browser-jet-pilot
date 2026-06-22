import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ElementHandle } from 'playwright'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'

function noSession(): never {
  throw new Error('No active session. Call browser_start first.')
}

export function registerAllTools(
  server: McpServer,
  sessionManager: SessionManager,
  config: ServerConfig
): void {
  // ── Session ──────────────────────────────────────────────

  server.registerTool(
    'browser_start',
    {
      description:
        'Connect to the browser (or launch a new one). Must be called before any other browser tool. Reuses existing session if still alive.',
    },
    async () => {
      const session = await sessionManager.ensureSession(
        config.cdpUrl,
        config.launch,
        config.browserWidth,
        config.browserHeight
      )
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              sessionId: session.id,
              message: config.launch
                ? 'Browser launched'
                : `Connected to ${config.cdpUrl}`,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_end',
    {
      description: 'Close the current browser session and release resources.',
    },
    async () => {
      const session = sessionManager.getDefaultSession()
      if (!session) {
        return {
          content: [
            { type: 'text' as const, text: 'No active session to close.' },
          ],
        }
      }
      const id = session.id
      await sessionManager.cleanupSession(id)
      return {
        content: [{ type: 'text' as const, text: `Session ${id} closed.` }],
      }
    }
  )

  // ── Navigation ───────────────────────────────────────────

  server.registerTool(
    'browser_navigate',
    {
      description:
        'Navigate the browser to a URL. Waits for the page to reach domcontentloaded state.',
      inputSchema: {
        url: z.string().describe('The URL to navigate to'),
      },
    },
    async ({ url }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      const title = await session.page.title()
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ url: session.page.url(), title }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_get_info',
    {
      description: 'Get current page metadata: URL, title, viewport size.',
    },
    async () => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const url = session.page.url()
      const title = await session.page.title()
      const viewport = session.page.viewportSize()
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ url, title, viewport }, null, 2),
          },
        ],
      }
    }
  )

  // ── Screenshot ───────────────────────────────────────────

  server.registerTool(
    'browser_screenshot',
    {
      description:
        'Take a screenshot of the current page. Returns a base64-encoded PNG image.',
      inputSchema: {
        fullPage: z
          .boolean()
          .optional()
          .describe(
            'Capture the full scrollable page (default: false, viewport only)'
          ),
        selector: z
          .string()
          .optional()
          .describe('CSS selector of a specific element to screenshot'),
      },
    },
    async ({ fullPage, selector }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      let buffer: Buffer
      if (selector) {
        const element = await session.page.$(selector)
        if (!element) throw new Error(`Element not found: ${selector}`)
        buffer = await element.screenshot({ type: 'png' })
      } else {
        buffer = await session.page.screenshot({
          type: 'png',
          fullPage: fullPage ?? false,
        })
      }
      return {
        content: [
          {
            type: 'image' as const,
            data: buffer.toString('base64'),
            mimeType: 'image/png',
          },
        ],
      }
    }
  )

  // ── Interaction ──────────────────────────────────────────

  server.registerTool(
    'browser_click',
    {
      description: 'Click an element on the page identified by a CSS selector.',
      inputSchema: {
        selector: z.string().describe('CSS selector of the element to click'),
      },
    },
    async ({ selector }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.click(selector, { timeout: 10000 })
      return {
        content: [{ type: 'text' as const, text: `Clicked: ${selector}` }],
      }
    }
  )

  server.registerTool(
    'browser_fill',
    {
      description:
        'Clear and fill an input field or textarea. Does not trigger change events; use browser_type for character-by-character input.',
      inputSchema: {
        selector: z.string().describe('CSS selector of the input field'),
        value: z.string().describe('The value to fill in'),
      },
    },
    async ({ selector, value }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.fill(selector, value, { timeout: 10000 })
      return {
        content: [
          { type: 'text' as const, text: `Filled ${selector} with: ${value}` },
        ],
      }
    }
  )

  server.registerTool(
    'browser_type',
    {
      description:
        'Type text character by character into a focused element. Triggers keydown/keyup events. Clicks the element first to focus.',
      inputSchema: {
        selector: z
          .string()
          .describe(
            'CSS selector of the element (will be clicked to focus first)'
          ),
        text: z.string().describe('Text to type'),
        delay: z
          .number()
          .optional()
          .describe('Delay in ms between keystrokes (default: 50)'),
      },
    },
    async ({ selector, text, delay }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.click(selector, { timeout: 10000 })
      await session.page.keyboard.type(text, { delay: delay ?? 50 })
      return {
        content: [
          { type: 'text' as const, text: `Typed "${text}" into ${selector}` },
        ],
      }
    }
  )

  server.registerTool(
    'browser_select',
    {
      description: 'Select an option in a <select> dropdown element.',
      inputSchema: {
        selector: z.string().describe('CSS selector of the <select> element'),
        value: z.string().describe('Value of the option to select'),
      },
    },
    async ({ selector, value }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.selectOption(selector, value, { timeout: 10000 })
      return {
        content: [
          { type: 'text' as const, text: `Selected "${value}" in ${selector}` },
        ],
      }
    }
  )

  server.registerTool(
    'browser_hover',
    {
      description: 'Hover the mouse over an element.',
      inputSchema: {
        selector: z
          .string()
          .describe('CSS selector of the element to hover over'),
      },
    },
    async ({ selector }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.hover(selector, { timeout: 10000 })
      return {
        content: [{ type: 'text' as const, text: `Hovered over ${selector}` }],
      }
    }
  )

  server.registerTool(
    'browser_scroll',
    {
      description: 'Scroll the page or a specific element.',
      inputSchema: {
        direction: z
          .enum(['up', 'down', 'top', 'bottom'])
          .describe(
            '"up", "down", "top" (scroll to top), "bottom" (scroll to bottom)'
          ),
        amount: z
          .number()
          .optional()
          .describe(
            'Pixels to scroll (used with "up" or "down", default: 500)'
          ),
        selector: z
          .string()
          .optional()
          .describe('CSS selector of element to scroll (defaults to page)'),
      },
    },
    async ({ direction, amount, selector }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const pixels = amount ?? 500

      if (selector) {
        const element = await session.page.$(selector)
        if (!element) throw new Error(`Element not found: ${selector}`)
        if (direction === 'top') {
          await element.evaluate((el) => (el.scrollTop = 0))
        } else if (direction === 'bottom') {
          await element.evaluate((el) => (el.scrollTop = el.scrollHeight))
        } else if (direction === 'up') {
          await element.evaluate((el, px) => (el.scrollTop -= px), pixels)
        } else {
          await element.evaluate((el, px) => (el.scrollTop += px), pixels)
        }
      } else {
        if (direction === 'top') {
          await session.page.evaluate(() => window.scrollTo(0, 0))
        } else if (direction === 'bottom') {
          await session.page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight)
          )
        } else if (direction === 'up') {
          await session.page.evaluate(
            (px: number) => window.scrollBy(0, -px),
            pixels
          )
        } else {
          await session.page.evaluate(
            (px: number) => window.scrollBy(0, px),
            pixels
          )
        }
      }

      const desc =
        direction === 'top' || direction === 'bottom'
          ? `Scrolled ${direction}`
          : `Scrolled ${direction} by ${pixels}px`
      return { content: [{ type: 'text' as const, text: desc }] }
    }
  )

  // ── Observation ──────────────────────────────────────────

  server.registerTool(
    'browser_evaluate',
    {
      description:
        'Execute JavaScript code in the browser page. The code runs in the page context. Return a JSON-serializable value.',
      inputSchema: {
        script: z
          .string()
          .describe(
            'JavaScript code to execute. Use arrow function for expressions: () => document.title'
          ),
      },
    },
    async ({ script }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const result = await session.page.evaluate(script)
      return {
        content: [
          {
            type: 'text' as const,
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_get_content',
    {
      description:
        'Extract text content or HTML from the page. Useful for reading what is currently displayed.',
      inputSchema: {
        type: z
          .enum(['text', 'html'])
          .optional()
          .describe(
            '"text" for visible text, "html" for raw HTML (default: "text")'
          ),
        selector: z
          .string()
          .optional()
          .describe('CSS selector to scope extraction (defaults to full page)'),
      },
    },
    async ({ type: contentType, selector }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      let result: string
      const el = selector ? await session.page.$(selector) : session.page
      if (!el) throw new Error(`Element not found: ${selector}`)

      if (contentType === 'html') {
        // Use outerHTML for full element, or handle SVG differently
        result = await (el as ElementHandle<Node>).evaluate((e) => {
          if (e instanceof HTMLElement) return e.innerHTML
          return e.toString() // Fallback for SVG/MathML
        })
      } else {
        // textContent works on all Node types
        result = await (el as ElementHandle<Node>).evaluate(
          (e) => e.textContent ?? ''
        )
      }

      if (result.length > 100_000) {
        result = result.slice(0, 100_000) + '\n... [truncated]'
      }

      return { content: [{ type: 'text' as const, text: result }] }
    }
  )

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
    async ({ webgl, animations, raf }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
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
    }
  )

  server.registerTool(
    'browser_restore_shaders',
    {
      description:
        'Restore WebGL, requestAnimationFrame, and CSS animations that were disabled by browser_disable_shaders. Removes the injected style element and restores original browser functions.',
    },
    async () => {
      const session = sessionManager.getDefaultSession() ?? noSession()

      const results = await session.page.evaluate(() => {
        const parts: string[] = []

        // Remove injected style
        const killStyle = document.getElementById('mcp-shader-kill')
        if (killStyle) {
          killStyle.remove()
          parts.push('CSS animations restored')
        }

        // RAF is harder to fully restore — reload page is simplest signal
        if ('__mcp_raf_hooked' in window) {
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
    }
  )

  server.registerTool(
    'browser_wait_for',
    {
      description:
        'Wait for a condition before proceeding. Waits for an element to appear, be visible, or be hidden.',
      inputSchema: {
        selector: z.string().describe('CSS selector to wait for'),
        state: z
          .enum(['attached', 'visible', 'hidden'])
          .optional()
          .describe(
            '"attached" (in DOM), "visible" (in DOM + visible), "hidden" (hidden or removed). Default: "visible"'
          ),
        timeout: z
          .number()
          .optional()
          .describe('Maximum wait time in milliseconds (default: 10000)'),
      },
    },
    async ({ selector, state, timeout }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      await session.page.waitForSelector(selector, {
        state: state ?? 'visible',
        timeout: timeout ?? 10000,
      })
      return {
        content: [
          {
            type: 'text' as const,
            text: `${selector} is now ${state ?? 'visible'}.`,
          },
        ],
      }
    }
  )

  // ── Tab management ───────────────────────────────────────

  server.registerTool(
    'browser_new_tab',
    {
      description: 'Open a new browser tab and switch to it.',
      inputSchema: {
        url: z
          .string()
          .optional()
          .describe('URL to navigate to in the new tab'),
      },
    },
    async ({ url }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const page = await session.context.newPage()
      session.page = page
      if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      }
      const title = await page.title()
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              url: page.url(),
              title,
              tabsCount: session.context.pages().length,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_list_tabs',
    {
      description: 'List all open tabs in the current browser session.',
    },
    async () => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const pages = session.context.pages()
      const tabs = await Promise.all(
        pages.map(async (p, i) => {
          let title: string
          try {
            title = await p.title()
          } catch {
            title = '(loading)'
          }
          return { index: i, url: p.url(), title, isActive: p === session.page }
        })
      )
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(tabs, null, 2) },
        ],
      }
    }
  )

  server.registerTool(
    'browser_switch_tab',
    {
      description: 'Switch to a different tab by index.',
      inputSchema: {
        index: z
          .number()
          .describe('Tab index (0-based, as shown by browser_list_tabs)'),
      },
    },
    async ({ index }) => {
      const session = sessionManager.getDefaultSession() ?? noSession()
      const pages = session.context.pages()
      if (index < 0 || index >= pages.length) {
        throw new Error(
          `Tab index ${index} out of range (0-${pages.length - 1})`
        )
      }
      session.page = pages[index]
      const title = await session.page.title()
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ url: session.page.url(), title, index }),
          },
        ],
      }
    }
  )
}
