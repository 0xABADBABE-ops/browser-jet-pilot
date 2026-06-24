import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession } from './utils.js'

export function registerObservationTools(
  server: McpServer,
  sessionManager: SessionManager,
  config: ServerConfig
): void {
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
    /**
     * Take a screenshot of the viewport, full page, or a specific element.
     *
     * @param fullPage - Capture the full scrollable page
     * @param selector - CSS selector of element to screenshot
     */
    async ({ fullPage, selector }) => {
      const session = getSession(sessionManager)
      let buffer: Buffer
      if (selector) {
        const locator = session.page.locator(selector)
        const count = await locator.count()
        if (count === 0) throw new Error(`Element not found: ${selector}`)
        buffer = await locator.screenshot({ type: 'png' })
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

  server.registerTool(
    'browser_evaluate',
    {
      description:
        'Execute JavaScript code in the browser page. The code runs in the page context and has full access to the DOM, cookies, localStorage, and sessionStorage. Return a JSON-serializable value. Warning: this is an arbitrary code execution surface — only use with trusted scripts.',
      inputSchema: {
        script: z
          .string()
          .describe(
            'JavaScript code to execute. The script runs with full page privileges. Use arrow function for expressions: () => document.title'
          ),
      },
    },
    /** Execute JavaScript in the page context and return the result. */
    async ({ script }) => {
      if (!config.allowEvaluate) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error:
                  'browser_evaluate is disabled. Set ALLOW_EVALUATE=true to enable arbitrary JavaScript execution.',
              }),
            },
          ],
          isError: true,
        }
      }
      const session = getSession(sessionManager)
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
    /** Extract text or HTML content from the page or a selector. */
    async ({ type: contentType, selector }) => {
      const session = getSession(sessionManager)
      let result: string

      if (contentType === 'html') {
        if (selector) {
          const locator = session.page.locator(selector)
          const count = await locator.count()
          if (count === 0) throw new Error(`Element not found: ${selector}`)
          result = await locator.evaluate((e) => {
            if (e instanceof HTMLElement) return e.innerHTML
            return e.toString() // Fallback for SVG/MathML
          })
        } else {
          result = await session.page.evaluate(
            () => document.documentElement.innerHTML
          )
        }
      } else {
        if (selector) {
          const locator = session.page.locator(selector)
          const count = await locator.count()
          if (count === 0) throw new Error(`Element not found: ${selector}`)
          result = await locator.evaluate((e) => e.textContent ?? '')
        } else {
          result = await session.page.evaluate(
            () => document.body?.textContent ?? ''
          )
        }
      }

      if (result.length > 100_000) {
        result = result.slice(0, 100_000) + '\n... [truncated]'
      }

      return { content: [{ type: 'text' as const, text: result }] }
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
    /** Wait for an element to reach a visibility state. */
    async ({ selector, state, timeout }) => {
      const session = getSession(sessionManager)
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
}
