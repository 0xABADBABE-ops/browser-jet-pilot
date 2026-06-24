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

describe('browser_start tool registration', () => {
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
      getDefaultSession: vi.fn(),
    }

    mockConfig = {
      cdpUrl: 'http://localhost:9222',
      launch: true,
      browserWidth: 1920,
      browserHeight: 1080,
      port: 3100,
      host: 'localhost',
    }
  })

  it('should register browser_start tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_start',
      expect.objectContaining({
        description: expect.stringContaining('Connect to the browser'),
      }),
      expect.any(Function)
    )
  })

  it('should return session info with launch message when launch=true', async () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const startCall = calls.find((call: any[]) => call[0] === 'browser_start')
    const handler = startCall[2]

    const result = await handler()

    expect(mockSessionManager.ensureSession).toHaveBeenCalledWith(
      'http://localhost:9222',
      true,
      1920,
      1080
    )
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.sessionId).toBe('test-session-id')
    expect(parsed.message).toBe('Browser launched')
  })

  it('should return connected message when launch=false', async () => {
    mockConfig.launch = false
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const startCall = calls.find((call: any[]) => call[0] === 'browser_start')
    const handler = startCall[2]
    const result = await handler()

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.message).toContain('Connected to http://localhost:9222')
  })
})

describe('browser_end tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
      cleanupSession: vi.fn().mockResolvedValue(undefined),
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

  it('should register browser_end tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_end',
      expect.objectContaining({
        description: expect.stringContaining('Close'),
      }),
      expect.any(Function)
    )
  })

  it('should close session when active session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      id: 'session-1',
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const endCall = calls.find((call: any[]) => call[0] === 'browser_end')
    const handler = endCall[2]

    const result = await handler()

    expect(mockSessionManager.cleanupSession).toHaveBeenCalledWith('session-1')
    expect(result.content[0].text).toContain('Session session-1 closed')
  })

  it('should return message when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const endCall = calls.find((call: any[]) => call[0] === 'browser_end')
    const handler = endCall[2]

    const result = await handler()

    expect(result.content[0].text).toContain('No active session')
  })
})

describe('browser_get_info tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_get_info tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_get_info',
      expect.objectContaining({
        description: expect.stringContaining('page metadata'),
      }),
      expect.any(Function)
    )
  })

  it('should return page metadata', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        url: vi.fn().mockReturnValue('https://example.com'),
        title: vi.fn().mockResolvedValue('Example Page'),
        viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const infoCall = calls.find((call: any[]) => call[0] === 'browser_get_info')
    const handler = infoCall[2]

    const result = await handler()
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.url).toBe('https://example.com')
    expect(parsed.title).toBe('Example Page')
    expect(parsed.viewport).toEqual({ width: 1920, height: 1080 })
  })

  it('should throw when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const infoCall = calls.find((call: any[]) => call[0] === 'browser_get_info')
    const handler = infoCall[2]

    await expect(handler()).rejects.toThrow('No active session')
  })
})

describe('browser_screenshot tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig
  let mockScreenshot: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockScreenshot = vi.fn().mockResolvedValue(Buffer.from('fake-png-data'))

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_screenshot tool with fullPage and selector params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_screenshot',
      expect.objectContaining({
        description: expect.stringContaining('screenshot'),
        inputSchema: expect.objectContaining({
          fullPage: expect.any(Object),
          selector: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should take a viewport screenshot', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        screenshot: mockScreenshot,
        $: vi.fn(),
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const ssCall = calls.find((call: any[]) => call[0] === 'browser_screenshot')
    const handler = ssCall[2]

    const result = await handler({})

    expect(mockScreenshot).toHaveBeenCalledWith({
      type: 'png',
      fullPage: false,
    })
    expect(result.content[0].type).toBe('image')
    expect(result.content[0].data).toBe('ZmFrZS1wbmctZGF0YQ==')
  })

  it('should take a fullPage screenshot', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        screenshot: mockScreenshot,
        $: vi.fn(),
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const ssCall = calls.find((call: any[]) => call[0] === 'browser_screenshot')
    const handler = ssCall[2]

    await handler({ fullPage: true })
    expect(mockScreenshot).toHaveBeenCalledWith({
      type: 'png',
      fullPage: true,
    })
  })

  it('should take a selector-specific screenshot', async () => {
    const mockElementScreenshot = vi
      .fn()
      .mockResolvedValue(Buffer.from('element-png'))
    const mockElement = { screenshot: mockElementScreenshot }
    const mockDollar = vi.fn().mockResolvedValue(mockElement)

    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { screenshot: mockScreenshot, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const ssCall = calls.find((call: any[]) => call[0] === 'browser_screenshot')
    const handler = ssCall[2]

    const result = await handler({ selector: '#header' })

    expect(mockDollar).toHaveBeenCalledWith('#header')
    expect(mockElementScreenshot).toHaveBeenCalledWith({ type: 'png' })
    expect(result.content[0].data).toBe('ZWxlbWVudC1wbmc=')
  })

  it('should throw when selector is not found', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        screenshot: mockScreenshot,
        $: vi.fn().mockResolvedValue(null),
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const ssCall = calls.find((call: any[]) => call[0] === 'browser_screenshot')
    const handler = ssCall[2]

    await expect(handler({ selector: '#missing' })).rejects.toThrow(
      'Element not found: #missing'
    )
  })

  it('should throw when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const ssCall = calls.find((call: any[]) => call[0] === 'browser_screenshot')
    const handler = ssCall[2]

    await expect(handler({})).rejects.toThrow('No active session')
  })
})

describe('browser_fill tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_fill tool with selector and value params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_fill',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
          value: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should fill an input field', async () => {
    const mockFill = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { fill: mockFill },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const fillCall = calls.find((call: any[]) => call[0] === 'browser_fill')
    const handler = fillCall[2]

    const result = await handler({
      selector: '#username',
      value: 'testuser',
    })

    expect(mockFill).toHaveBeenCalledWith('#username', 'testuser', {
      timeout: 10000,
    })
    expect(result.content[0].text).toContain('Filled #username with: testuser')
  })

  it('should throw when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const fillCall = calls.find((call: any[]) => call[0] === 'browser_fill')
    const handler = fillCall[2]

    await expect(handler({ selector: '#x', value: 'y' })).rejects.toThrow(
      'No active session'
    )
  })
})

describe('browser_type tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_type tool with selector, text, delay params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_type',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
          text: expect.any(Object),
          delay: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should click and type text character by character', async () => {
    const mockClick = vi.fn().mockResolvedValue(undefined)
    const mockKeyboardType = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        click: mockClick,
        keyboard: { type: mockKeyboardType },
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const typeCall = calls.find((call: any[]) => call[0] === 'browser_type')
    const handler = typeCall[2]

    const result = await handler({
      selector: '#input',
      text: 'hello',
    })

    expect(mockClick).toHaveBeenCalledWith('#input', { timeout: 10000 })
    expect(mockKeyboardType).toHaveBeenCalledWith('hello', { delay: 50 })
    expect(result.content[0].text).toContain('Typed "hello" into #input')
  })

  it('should use custom delay when provided', async () => {
    const mockKeyboardType = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        click: vi.fn().mockResolvedValue(undefined),
        keyboard: { type: mockKeyboardType },
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const typeCall = calls.find((call: any[]) => call[0] === 'browser_type')
    const handler = typeCall[2]

    await handler({ selector: '#input', text: 'hi', delay: 100 })
    expect(mockKeyboardType).toHaveBeenCalledWith('hi', { delay: 100 })
  })
})

describe('browser_select tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_select tool with selector and value params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_select',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
          value: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should select an option in a dropdown', async () => {
    const mockSelectOption = vi.fn().mockResolvedValue([])
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { selectOption: mockSelectOption },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const selectCall = calls.find((call: any[]) => call[0] === 'browser_select')
    const handler = selectCall[2]

    const result = await handler({
      selector: '#country',
      value: 'us',
    })

    expect(mockSelectOption).toHaveBeenCalledWith('#country', 'us', {
      timeout: 10000,
    })
    expect(result.content[0].text).toContain('Selected "us" in #country')
  })
})

describe('browser_hover tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_hover tool with selector param', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_hover',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should hover over an element', async () => {
    const mockHover = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { hover: mockHover },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const hoverCall = calls.find((call: any[]) => call[0] === 'browser_hover')
    const handler = hoverCall[2]

    const result = await handler({ selector: '.menu-item' })

    expect(mockHover).toHaveBeenCalledWith('.menu-item', { timeout: 10000 })
    expect(result.content[0].text).toContain('Hovered over .menu-item')
  })
})

describe('browser_scroll tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig
  let mockEvaluate: any
  let mockDollar: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockEvaluate = vi.fn().mockResolvedValue(undefined)
    mockDollar = vi.fn()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_scroll tool with direction, amount, selector params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_scroll',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          direction: expect.any(Object),
          amount: expect.any(Object),
          selector: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should scroll page down by default amount', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    const result = await handler({ direction: 'down' })

    expect(mockEvaluate).toHaveBeenCalled()
    expect(result.content[0].text).toContain('Scrolled down by 500px')
  })

  it('should scroll page up', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    const result = await handler({ direction: 'up', amount: 300 })
    expect(result.content[0].text).toContain('Scrolled up by 300px')
  })

  it('should scroll page to top', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    const result = await handler({ direction: 'top' })
    expect(result.content[0].text).toContain('Scrolled top')
  })

  it('should scroll page to bottom', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    const result = await handler({ direction: 'bottom' })
    expect(result.content[0].text).toContain('Scrolled bottom')
  })

  it('should scroll element down', async () => {
    const mockElement = { evaluate: vi.fn().mockResolvedValue(undefined) }
    mockDollar.mockResolvedValue(mockElement)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    await handler({ direction: 'down', selector: '#list' })
    expect(mockElement.evaluate).toHaveBeenCalled()
  })

  it('should throw when scrolled element is not found', async () => {
    mockDollar.mockResolvedValue(null)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate, $: mockDollar },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    await expect(
      handler({ direction: 'down', selector: '#missing' })
    ).rejects.toThrow('Element not found: #missing')
  })

  it('should throw when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const scrollCall = calls.find((call: any[]) => call[0] === 'browser_scroll')
    const handler = scrollCall[2]

    await expect(handler({ direction: 'down' })).rejects.toThrow(
      'No active session'
    )
  })
})

describe('browser_evaluate tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_evaluate tool with script param', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_evaluate',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          script: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should execute JS and return string result', async () => {
    const mockEvaluate = vi.fn().mockResolvedValue('Hello World')
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const evalCall = calls.find((call: any[]) => call[0] === 'browser_evaluate')
    const handler = evalCall[2]

    const result = await handler({
      script: '() => document.title',
    })

    expect(mockEvaluate).toHaveBeenCalledWith('() => document.title')
    expect(result.content[0].text).toBe('Hello World')
  })

  it('should stringify object result', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: vi.fn().mockResolvedValue({ a: 1, b: 2 }) },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const evalCall = calls.find((call: any[]) => call[0] === 'browser_evaluate')
    const handler = evalCall[2]

    const result = await handler({ script: '() => ({ a: 1, b: 2 })' })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toEqual({ a: 1, b: 2 })
  })

  it('should throw when no session exists', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue(undefined)
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const evalCall = calls.find((call: any[]) => call[0] === 'browser_evaluate')
    const handler = evalCall[2]

    await expect(handler({ script: '() => 1' })).rejects.toThrow(
      'No active session'
    )
  })
})

describe('browser_get_content tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_get_content tool with type and selector params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_get_content',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          type: expect.any(Object),
          selector: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should get text content of full page', async () => {
    const mockEvaluate = vi.fn().mockResolvedValue('Page text content')
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { $: vi.fn(), evaluate: mockEvaluate },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const contentCall = calls.find(
      (call: any[]) => call[0] === 'browser_get_content'
    )
    const handler = contentCall[2]

    const result = await handler({})
    expect(result.content[0].text).toBe('Page text content')
  })

  it('should get text content of a selector element', async () => {
    const mockElement = {
      evaluate: vi.fn().mockResolvedValue('Selected text'),
    }
    const mockDollar = vi.fn().mockResolvedValue(mockElement)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { $: mockDollar, evaluate: vi.fn() },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const contentCall = calls.find(
      (call: any[]) => call[0] === 'browser_get_content'
    )
    const handler = contentCall[2]

    const result = await handler({ selector: '.content' })
    expect(result.content[0].text).toBe('Selected text')
  })

  it('should truncate content over 100k characters', async () => {
    const longText = 'x'.repeat(100_001)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: {
        $: vi.fn(),
        evaluate: vi.fn().mockResolvedValue(longText),
      },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const contentCall = calls.find(
      (call: any[]) => call[0] === 'browser_get_content'
    )
    const handler = contentCall[2]

    const result = await handler({})
    expect(result.content[0].text.length).toBeLessThanOrEqual(100_025)
    expect(result.content[0].text).toContain('[truncated]')
  })

  it('should throw when selector is not found', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { $: vi.fn().mockResolvedValue(null), evaluate: vi.fn() },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const contentCall = calls.find(
      (call: any[]) => call[0] === 'browser_get_content'
    )
    const handler = contentCall[2]

    await expect(handler({ selector: '#missing' })).rejects.toThrow(
      'Element not found: #missing'
    )
  })
})

describe('browser_disable_shaders tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_disable_shaders tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_disable_shaders',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          webgl: expect.any(Object),
          animations: expect.any(Object),
          raf: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should enable all shader killers by default', async () => {
    const mockEvaluate = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const shaderCall = calls.find(
      (call: any[]) => call[0] === 'browser_disable_shaders'
    )
    const handler = shaderCall[2]

    const result = await handler({})

    expect(mockEvaluate).toHaveBeenCalledTimes(3)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.disabled).toContain('WebGL blocked')
    expect(parsed.disabled).toContain(
      'requestAnimationFrame throttled to ~1 FPS'
    )
    expect(parsed.disabled).toContain('CSS animations/transitions frozen')
  })

  it('should disable only webgl when raf and animations are false', async () => {
    const mockEvaluate = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const shaderCall = calls.find(
      (call: any[]) => call[0] === 'browser_disable_shaders'
    )
    const handler = shaderCall[2]

    const result = await handler({ raf: false, animations: false })

    expect(mockEvaluate).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.disabled).toHaveLength(1)
    expect(parsed.disabled[0]).toBe('WebGL blocked')
  })
})

describe('browser_restore_shaders tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_restore_shaders tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_restore_shaders',
      expect.objectContaining({
        description: expect.stringContaining('Restore'),
      }),
      expect.any(Function)
    )
  })

  it('should restore shader-related features', async () => {
    const mockEvaluate = vi
      .fn()
      .mockResolvedValue([
        'CSS animations restored',
        'RAF hook detected (reload to fully restore)',
        'WebGL requires page reload to fully restore',
      ])
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { evaluate: mockEvaluate },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const restoreCall = calls.find(
      (call: any[]) => call[0] === 'browser_restore_shaders'
    )
    const handler = restoreCall[2]

    const result = await handler()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.message).toContain('CSS animations restored')
    expect(parsed.note).toBeDefined()
  })
})

describe('browser_wait_for tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_wait_for tool with selector, state, timeout params', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_wait_for',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          selector: expect.any(Object),
          state: expect.any(Object),
          timeout: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should wait for selector with default state and timeout', async () => {
    const mockWaitForSelector = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { waitForSelector: mockWaitForSelector },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const waitCall = calls.find((call: any[]) => call[0] === 'browser_wait_for')
    const handler = waitCall[2]

    const result = await handler({ selector: '.loaded' })

    expect(mockWaitForSelector).toHaveBeenCalledWith('.loaded', {
      state: 'visible',
      timeout: 10000,
    })
    expect(result.content[0].text).toContain('.loaded is now visible')
  })

  it('should wait for hidden state with custom timeout', async () => {
    const mockWaitForSelector = vi.fn().mockResolvedValue(undefined)
    mockSessionManager.getDefaultSession.mockReturnValue({
      page: { waitForSelector: mockWaitForSelector },
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const waitCall = calls.find((call: any[]) => call[0] === 'browser_wait_for')
    const handler = waitCall[2]

    await handler({ selector: '.spinner', state: 'hidden', timeout: 5000 })

    expect(mockWaitForSelector).toHaveBeenCalledWith('.spinner', {
      state: 'hidden',
      timeout: 5000,
    })
  })
})

describe('browser_new_tab tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_new_tab tool with url param', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_new_tab',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          url: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should create a new tab and navigate to URL', async () => {
    const mockNewPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://newtab.com'),
      title: vi.fn().mockResolvedValue('New Tab'),
    }
    const mockSession = {
      context: {
        newPage: vi.fn().mockResolvedValue(mockNewPage),
        pages: vi.fn().mockReturnValue([{}]),
      },
      page: null,
    }
    mockSessionManager.getDefaultSession.mockReturnValue(mockSession)

    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const newTabCall = calls.find(
      (call: any[]) => call[0] === 'browser_new_tab'
    )
    const handler = newTabCall[2]

    const result = await handler({ url: 'https://newtab.com' })

    expect(mockNewPage.goto).toHaveBeenCalledWith('https://newtab.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    expect(mockSession.page).toBe(mockNewPage)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.url).toBe('https://newtab.com')
  })

  it('should create a new tab without navigating', async () => {
    const mockNewPage = {
      goto: vi.fn(),
      url: vi.fn().mockReturnValue('about:blank'),
      title: vi.fn().mockResolvedValue(''),
    }
    mockSessionManager.getDefaultSession.mockReturnValue({
      context: {
        newPage: vi.fn().mockResolvedValue(mockNewPage),
        pages: vi.fn().mockReturnValue([{}]),
      },
      page: null,
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const newTabCall = calls.find(
      (call: any[]) => call[0] === 'browser_new_tab'
    )
    const handler = newTabCall[2]

    await handler({})
    expect(mockNewPage.goto).not.toHaveBeenCalled()
  })
})

describe('browser_list_tabs tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_list_tabs tool', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_list_tabs',
      expect.objectContaining({
        description: expect.stringContaining('List all open tabs'),
      }),
      expect.any(Function)
    )
  })

  it('should list all open tabs', async () => {
    const page1 = {
      title: vi.fn().mockResolvedValue('Page 1'),
      url: vi.fn().mockReturnValue('https://page1.com'),
    }
    const page2 = {
      title: vi.fn().mockResolvedValue('Page 2'),
      url: vi.fn().mockReturnValue('https://page2.com'),
    }
    mockSessionManager.getDefaultSession.mockReturnValue({
      context: {
        pages: vi.fn().mockReturnValue([page1, page2]),
      },
      page: page1,
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const listCall = calls.find(
      (call: any[]) => call[0] === 'browser_list_tabs'
    )
    const handler = listCall[2]

    const result = await handler()
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveLength(2)
    expect(parsed[0].index).toBe(0)
    expect(parsed[0].url).toBe('https://page1.com')
    expect(parsed[0].isActive).toBe(true)
    expect(parsed[1].index).toBe(1)
    expect(parsed[1].isActive).toBe(false)
  })
})

describe('browser_switch_tab tool registration', () => {
  let mockServer: McpServer
  let mockSessionManager: any
  let mockConfig: ServerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as McpServer

    mockSessionManager = {
      getDefaultSession: vi.fn(),
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

  it('should register browser_switch_tab tool with index param', () => {
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'browser_switch_tab',
      expect.objectContaining({
        inputSchema: expect.objectContaining({
          index: expect.any(Object),
        }),
      }),
      expect.any(Function)
    )
  })

  it('should switch to a valid tab', async () => {
    const page1 = {
      title: vi.fn().mockResolvedValue('Tab 1'),
      url: vi.fn().mockReturnValue('https://tab1.com'),
    }
    const page2 = {
      title: vi.fn().mockResolvedValue('Tab 2'),
      url: vi.fn().mockReturnValue('https://tab2.com'),
    }
    const mockSession = {
      context: {
        pages: vi.fn().mockReturnValue([page1, page2]),
      },
      page: page1,
    }
    mockSessionManager.getDefaultSession.mockReturnValue(mockSession)

    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const switchCall = calls.find(
      (call: any[]) => call[0] === 'browser_switch_tab'
    )
    const handler = switchCall[2]

    const result = await handler({ index: 1 })
    const parsed = JSON.parse(result.content[0].text)

    expect(mockSession.page).toBe(page2)
    expect(parsed.url).toBe('https://tab2.com')
    expect(parsed.index).toBe(1)
  })

  it('should throw for out-of-range tab index', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      context: {
        pages: vi.fn().mockReturnValue([{ title: vi.fn(), url: vi.fn() }]),
      },
      page: {},
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const switchCall = calls.find(
      (call: any[]) => call[0] === 'browser_switch_tab'
    )
    const handler = switchCall[2]

    await expect(handler({ index: 5 })).rejects.toThrow(
      'Tab index 5 out of range (0-0)'
    )
  })

  it('should throw for negative tab index', async () => {
    mockSessionManager.getDefaultSession.mockReturnValue({
      context: {
        pages: vi.fn().mockReturnValue([]),
      },
      page: {},
    })
    registerAllTools(mockServer, mockSessionManager, mockConfig)

    const calls = (mockServer.registerTool as any).mock.calls
    const switchCall = calls.find(
      (call: any[]) => call[0] === 'browser_switch_tab'
    )
    const handler = switchCall[2]

    await expect(handler({ index: -1 })).rejects.toThrow(
      'Tab index -1 out of range'
    )
  })
})
