import { describe, it, expect, beforeEach, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAllTools } from '../index.js'
import type { ServerConfig } from '../../types.js'

describe('browser_navigate tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create a minimal mock server
    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    // Create a mock SessionManager with required methods
    mockSessionManager = {
      ensureSession: vi.fn().mockResolvedValue({
        id: 'test-session-id',
        page: {
          goto: vi.fn().mockResolvedValue(undefined),
          url: vi.fn().mockReturnValue('https://example.com'),
          title: vi.fn().mockResolvedValue('Test Page'),
        },
      }),
      getDefaultSession: vi.fn().mockReturnValue({
        id: 'test-session-id',
        page: {
          goto: vi.fn().mockResolvedValue(undefined),
          url: vi.fn().mockReturnValue('https://example.com'),
          title: vi.fn().mockResolvedValue('Test Page'),
        },
      }),
    }

    mockConfig = {
      cdpUrl: 'http://localhost:9222',
      launch: false,
      browserWidth: 1920,
      browserHeight: 1080,
      port: 3100,
      host: 'localhost',
    }
  })

  it('should register browser_navigate tool with correct schema', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_navigate',
      expect.objectContaining({
        description: expect.stringContaining('Navigate'),
        inputSchema: expect.objectContaining({
          url: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should validate URL parameter schema structure', () => {
    // First register the tools
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    // Get the registration calls
    const calls = (mockServer.registerTool as any).mock.calls
    const navigateCall = calls.find(
      (call: any[]) => call[0] === 'browser_navigate'
    )

    expect(navigateCall).toBeDefined()
    expect(navigateCall[1].inputSchema).toHaveProperty('url')
  })

  it('should navigate to URL when handler is called', async () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    // Get the handler for browser_navigate
    const calls = (mockServer.registerTool as any).mock.calls
    const navigateCall = calls.find(
      (call: any[]) => call[0] === 'browser_navigate'
    )
    const handler = navigateCall[2]

    const session = mockSessionManager.getDefaultSession()
    const result = await handler({ url: 'https://example.com' })

    expect(session.page.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    expect(result.content[0].text).toContain('https://example.com')
  })

  it('should throw error when no session exists', async () => {
    // Mock no session scenario
    mockSessionManager.getDefaultSession = vi.fn().mockReturnValue(undefined)

    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const navigateCall = calls.find(
      (call: any[]) => call[0] === 'browser_navigate'
    )
    const handler = navigateCall[2]

    await expect(handler({ url: 'https://example.com' })).rejects.toThrow(
      'No active session'
    )
  })
})

describe('browser_click tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      ensureSession: vi.fn().mockResolvedValue({
        id: 'test-session-id',
      }),
      getDefaultSession: vi.fn().mockReturnValue({
        id: 'test-session-id',
      }),
    }

    mockConfig = {
      cdpUrl: 'http://localhost:9222',
      launch: false,
      browserWidth: 1920,
      browserHeight: 1080,
      port: 3100,
      host: 'localhost',
    }
  })

  it('should register browser_click tool with selector schema', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_click',
      expect.objectContaining({
        description: expect.stringContaining('Click'),
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should click element when handler is called', async () => {
    const mockClick = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession = vi.fn().mockReturnValue({
      page: { click: mockClick },
    })

    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const clickCall = calls.find((call: any[]) => call[0] === 'browser_click')
    const handler = clickCall[2]

    const result = await handler({ selector: '#submit-button' })

    expect(mockClick).toHaveBeenCalledWith('#submit-button', { timeout: 10000 })
    expect(result.content[0].text).toContain('Clicked: #submit-button')
  })
})
