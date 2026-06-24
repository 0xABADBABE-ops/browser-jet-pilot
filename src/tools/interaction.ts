import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession, DEFAULT_TIMEOUT } from './utils.js'

export function registerInteractionTools(
  server: McpServer,
  sessionManager: SessionManager,
  _config: ServerConfig
): void {
  server.registerTool(
    'browser_click',
    {
      description: 'Click an element on the page identified by a CSS selector.',
      inputSchema: {
        selector: z.string().describe('CSS selector of the element to click'),
      },
    },
    /** Click an element identified by a CSS selector. */
    async ({ selector }) => {
      const session = getSession(sessionManager)
      await session.page.click(selector, { timeout: DEFAULT_TIMEOUT })
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
    /** Clear and fill an input field with a value. */
    async ({ selector, value }) => {
      const session = getSession(sessionManager)
      await session.page.fill(selector, value, { timeout: DEFAULT_TIMEOUT })
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
    /** Type text character by character into an element. */
    async ({ selector, text, delay }) => {
      const session = getSession(sessionManager)
      await session.page.click(selector, { timeout: DEFAULT_TIMEOUT })
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
    /** Select an option in a <select> dropdown. */
    async ({ selector, value }) => {
      const session = getSession(sessionManager)
      await session.page.selectOption(selector, value, {
        timeout: DEFAULT_TIMEOUT,
      })
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
    /** Hover the mouse over an element. */
    async ({ selector }) => {
      const session = getSession(sessionManager)
      await session.page.hover(selector, { timeout: DEFAULT_TIMEOUT })
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
    /** Scroll the page or a specific element in a direction. */
    async ({ direction, amount, selector }) => {
      const session = getSession(sessionManager)
      const pixels = amount ?? 500

      if (selector) {
        const locator = session.page.locator(selector)
        const count = await locator.count()
        if (count === 0) throw new Error(`Element not found: ${selector}`)
        if (direction === 'top') {
          await locator.evaluate((el) => (el.scrollTop = 0))
        } else if (direction === 'bottom') {
          await locator.evaluate((el) => (el.scrollTop = el.scrollHeight))
        } else if (direction === 'up') {
          await locator.evaluate((el, px) => (el.scrollTop -= px), pixels)
        } else {
          await locator.evaluate((el, px) => (el.scrollTop += px), pixels)
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
}
