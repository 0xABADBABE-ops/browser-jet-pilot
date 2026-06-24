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
}
