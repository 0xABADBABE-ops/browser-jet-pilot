import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession, NAVIGATION_TIMEOUT } from './utils.js'

export function registerTabTools(
  server: McpServer,
  sessionManager: SessionManager,
  _config: ServerConfig
): void {
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
    /** Open a new tab and optionally navigate to a URL. */
    async ({ url }) => {
      const session = getSession(sessionManager)
      const page = await session.context.newPage()
      session.currentPageIndex = session.context.pages().length - 1
      if (url) {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT,
        })
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
      const session = getSession(sessionManager)
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
    /** Switch to a different open tab by index. */
    async ({ index }) => {
      const session = getSession(sessionManager)
      const pages = session.context.pages()
      if (index < 0 || index >= pages.length) {
        throw new Error(
          `Tab index ${index} out of range (0-${pages.length - 1})`
        )
      }
      session.currentPageIndex = index
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
