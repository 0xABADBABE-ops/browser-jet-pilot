import http, { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAllTools } from './tools/index.js'
import { handleWebdavRequest } from './webdav.js'
import { resolveConfig } from './config.js'
import { SessionManager } from './session.js'
import type { ServerConfig } from './types.js'

interface HttpSessionContext {
  server: McpServer
  transport: StreamableHTTPServerTransport
}

function createServerInstance(
  sessionManager: SessionManager,
  config: ServerConfig
): McpServer {
  const server = new McpServer({
    name: 'Browser Jet Pilot',
    version: '1.0.0',
  })

  registerAllTools(server, sessionManager, config)
  return server
}

function getSessionId(req: IncomingMessage): string | null {
  const value = req.headers['mcp-session-id']
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function extractApiKey(req: IncomingMessage): string | undefined {
  // Only accept API key via X-API-Key header to prevent credential exposure
  // in server logs, browser history, and referer headers.
  const headerKey = req.headers['x-api-key']
  if (typeof headerKey === 'string' && headerKey) {
    return headerKey
  }

  return undefined
}

/**
 * Constant-time comparison to prevent timing attacks.
 * Returns true if both values are equal length and content.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

/**
 * Authenticate an incoming request.
 * Returns true if authenticated (or no auth required), false if authentication failed.
 * If authentication fails, sends a 401 response.
 */
function authenticateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
  skipIfInitialize: boolean = false,
  body?: unknown
): boolean {
  if (!config.apiKey) return true

  if (skipIfInitialize && body && isInitializeRequest(body)) return true

  const providedKey = extractApiKey(req)
  if (!providedKey || !constantTimeEqual(providedKey, config.apiKey)) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      })
    )
    return false
  }

  return true
}

function isInitializeRequest(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'method' in body &&
    (body as { method?: string }).method === 'initialize'
  )
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let totalSize = 0
  const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB limit to prevent DoS

  for await (const chunk of req) {
    totalSize += chunk.length
    if (totalSize > MAX_BODY_SIZE) {
      throw new Error('Request body too large (max 10MB)')
    }
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function writeJsonRpcError(
  res: ServerResponse,
  code: number,
  message: string,
  statusCode = 400
): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null })
  )
}

/**
 * Handle a single HTTP request for the MCP endpoint.
 * Manages session lifecycle, authentication, and transport routing.
 */
async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager,
  config: ServerConfig,
  sessions: Map<string, HttpSessionContext>
): Promise<void> {
  try {
    const requestUrl = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`
    )
    if (requestUrl.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'Browser Jet Pilot',
          transport: 'http',
        })
      )
      return
    }

    // WebDAV: serve /data over the /webdav mount point
    const webdavHandled = await handleWebdavRequest(req, res, config.apiKey)
    if (webdavHandled) return

    if (requestUrl.pathname !== '/mcp') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
      return
    }

    const sessionId = getSessionId(req)

    if (req.method === 'POST') {
      let body: unknown
      try {
        body = await parseJsonBody(req)
      } catch {
        writeJsonRpcError(res, -32700, 'Parse error: Invalid JSON body', 400)
        return
      }

      // API key authentication (skip for initialize requests)
      if (!authenticateRequest(req, res, config, true, body)) return

      let context = sessionId ? sessions.get(sessionId) : undefined

      if (!context) {
        if (sessionId) {
          writeJsonRpcError(
            res,
            -32000,
            'Bad Request: No valid session ID provided',
            400
          )
          return
        }

        if (!isInitializeRequest(body)) {
          writeJsonRpcError(
            res,
            -32000,
            'Bad Request: Missing session ID and request is not initialize',
            400
          )
          return
        }

        const server = createServerInstance(sessionManager, config)
        let transport: StreamableHTTPServerTransport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            sessions.set(newSessionId, { server, transport })
          },
        })

        transport.onclose = async () => {
          const closedSessionId = transport.sessionId
          if (!closedSessionId) return

          const closedContext = sessions.get(closedSessionId)
          if (!closedContext) return

          sessions.delete(closedSessionId)
          await closedContext.server.close()
        }

        await server.connect(transport)
        context = { server, transport }
      }

      await context.transport.handleRequest(req, res, body)
      return
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      // API key authentication for session management
      if (!authenticateRequest(req, res, config)) return

      if (!sessionId) {
        writeJsonRpcError(res, -32000, 'Invalid or missing session ID', 400)
        return
      }

      const context = sessions.get(sessionId)
      if (!context) {
        writeJsonRpcError(res, -32000, 'Invalid or missing session ID', 400)
        return
      }

      await context.transport.handleRequest(req, res)
      return
    }

    writeJsonRpcError(res, -32000, 'Method not allowed', 405)
  } catch (error) {
    console.error('[browser-jet-pilot] HTTP request error:', error)
    if (!res.headersSent) {
      writeJsonRpcError(res, -32603, 'Internal server error', 500)
    }
  }
}

/**
 * Start the HTTP transport with stateful Streamable HTTP sessions.
 * Returns a cleanup function that closes all sessions and the server.
 */
async function startHttpTransport(
  sessionManager: SessionManager,
  config: ServerConfig
): Promise<() => Promise<void>> {
  const sessions = new Map<string, HttpSessionContext>()

  const closeTransports = async () => {
    for (const [sessionId, session] of sessions) {
      try {
        await session.transport.close()
      } catch {
        // ignore close errors
      }
      try {
        await session.server.close()
      } catch {
        // ignore close errors
      }
      sessions.delete(sessionId)
    }
  }

  const httpServer = http.createServer((req, res) =>
    handleHttpRequest(req, res, sessionManager, config, sessions)
  )

  httpServer.timeout = 30000
  httpServer.on('listening', () => {
    console.error(
      `[browser-jet-pilot] HTTP mode: http://${config.host}:${config.port}`
    )
    console.error(
      `[browser-jet-pilot] CDP target: ${config.launch ? 'launch new browser' : config.cdpUrl}`
    )
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(config.port!, config.host, () => resolve())
  })

  return closeTransports
}

export async function startServer(
  overrides: Partial<ServerConfig> = {}
): Promise<void> {
  const config = resolveConfig(overrides)
  const sessionManager = new SessionManager()
  let closeTransports: (() => Promise<void>) | null = null

  // Graceful shutdown
  const cleanup = async () => {
    const shutdownTimeout = 10000
    const cleanupPromise = (async () => {
      try {
        console.error('[browser-jet-pilot] Starting graceful shutdown...')
        if (closeTransports) await closeTransports()
        await sessionManager.cleanupAll()
        console.error('[browser-jet-pilot] Cleanup complete')
      } catch (error) {
        console.error('[browser-jet-pilot] Cleanup error:', error)
      }
    })()

    const cleanupResult = await Promise.race([
      cleanupPromise.then(() => ({ success: true }) as const),
      new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true } as const), shutdownTimeout)
      ),
    ])

    if ('timeout' in cleanupResult) {
      console.error('[browser-jet-pilot] Shutdown timed out after 10s')
      // Exit 0: a timeout during graceful shutdown is expected under load,
      // not an error condition — the OS will reclaim any remaining resources.
      process.exit(0)
    }
    console.error('[browser-jet-pilot] Shutdown complete')
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  if (config.port) {
    closeTransports = await startHttpTransport(sessionManager, config)
  } else {
    // ── Stdio transport (default) ──
    const server = createServerInstance(sessionManager, config)
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[browser-jet-pilot] Stdio mode`)
    console.error(
      `[browser-jet-pilot] CDP target: ${config.launch ? 'launch new browser' : config.cdpUrl}`
    )
  }
}

// Run when executed directly
startServer()
