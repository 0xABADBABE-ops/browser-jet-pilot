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
    registerDesktopTools(server as unknown as ExMcpServer, {
      getTransport: () => {
        throw new Error(
          'Desktop transport not configured. Set COMPUTER_USE_HELPER_PATH ' +
            'or implement DesktopTransport for your deployment.'
        )
      },
    })
  }
}
