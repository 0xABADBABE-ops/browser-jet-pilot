import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession, NAVIGATION_TIMEOUT } from './utils.js'

export function registerNavigationTools(
  server: McpServer,
  sessionManager: SessionManager,
  _config: ServerConfig
): void {
  server.registerTool(
    'browser_navigate',
    {
      description:
        'Navigate the browser to a URL. Waits for the page to reach domcontentloaded state.',
      inputSchema: {
        url: z.string().describe('The URL to navigate to'),
      },
    },
    /**
     * Navigate to a URL and wait for domcontentloaded.
     *
     * @param url - The URL to navigate to
     */
    async ({ url }) => {
      const session = getSession(sessionManager)
      await session.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT,
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
      const session = getSession(sessionManager)
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
}
