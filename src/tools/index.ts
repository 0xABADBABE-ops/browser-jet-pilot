import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { registerSessionTools } from './session.js'
import { registerNavigationTools } from './navigation.js'
import { registerInteractionTools } from './interaction.js'
import { registerObservationTools } from './observation.js'
import { registerPersistenceTools } from './persistence.js'
import { registerTabTools } from './tabs.js'
import { registerShaderTools } from './shader.js'
import { adaptSessionForEx } from './ex-adapter.js'
import { registerCdpTools } from 'browser-jet-pilot-ex/mcp/cdp-tools'
import { registerDesktopTools } from 'browser-jet-pilot-ex/mcp/desktop-tools'
import type { McpServer as ExMcpServer } from 'browser-jet-pilot-ex/mcp/types'
import type { DesktopTransport } from 'browser-jet-pilot-ex/mcp/desktop-tools'

export function registerAllTools(
  server: McpServer,
  sessionManager: SessionManager,
  config: ServerConfig
): void {
  registerSessionTools(server, sessionManager, config)
  registerNavigationTools(server, sessionManager, config)
  registerInteractionTools(server, sessionManager, config)
  registerObservationTools(server, sessionManager, config)
  registerPersistenceTools(server, sessionManager, config)
  registerTabTools(server, sessionManager, config)
  registerShaderTools(server, sessionManager, config)

  const capabilities = new Set(
    config.capabilities?.split(',').map((c) => c.trim().toLowerCase()) ?? []
  )

  if (capabilities.has('cdp')) {
    registerCdpTools(server as unknown as ExMcpServer, {
      getSession: () => {
        const session = sessionManager.getDefaultSession()
        if (!session) throw new Error('No active browser session')
        return adaptSessionForEx(session)
      },
    })
  }

  if (capabilities.has('desktop')) {
    let transport: DesktopTransport | null = null
    let initPromise: Promise<DesktopTransport> | null = null

    const ensureTransport = (): DesktopTransport => {
      if (transport) return transport

      if (!initPromise) {
        initPromise = (async () => {
          const { SpawnDesktopTransport } =
            await import('browser-jet-pilot-ex/computer-use/transports')
          const helperPath = process.env.COMPUTER_USE_HELPER_PATH
          if (!helperPath) {
            throw new Error(
              'COMPUTER_USE_HELPER_PATH is not set. ' +
                'Set it to the path of codex-computer-use.exe or a compatible helper binary.'
            )
          }
          transport = await SpawnDesktopTransport.create({
            helperPath,
          })
          return transport
        })()
      }

      // If init is still in-flight, let the caller retry
      throw new Error('Desktop transport initializing — retry the tool call.')
    }

    registerDesktopTools(server as unknown as ExMcpServer, {
      getTransport: ensureTransport,
    })
  }
}
