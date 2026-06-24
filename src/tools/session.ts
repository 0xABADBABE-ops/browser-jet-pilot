import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'

export function registerSessionTools(
  server: McpServer,
  sessionManager: SessionManager,
  config: ServerConfig
): void {
  server.registerTool(
    'browser_start',
    {
      description:
        'Connect to the browser (or launch a new one). Must be called before any other browser tool. Reuses existing session if still alive.',
    },
    async () => {
      try {
        const session = await sessionManager.ensureSession({
          cdpUrl: config.cdpUrl,
          launch: config.launch,
          width: config.browserWidth,
          height: config.browserHeight,
          ignoreHTTPSErrors: config.ignoreHTTPSErrors,
          noSandbox: config.noSandbox,
        })
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
    'browser_end',
    {
      description: 'Close the current browser session and release resources.',
    },
    async () => {
      try {
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
