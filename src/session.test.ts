import { describe, it, expect, beforeEach, vi } from 'vitest'
import { chromium } from 'playwright'
import { SessionManager } from './session.js'

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
    connectOverCDP: vi.fn(),
  },
}))

describe('SessionManager', () => {
  let sessionManager: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager = new SessionManager()
  })

  describe('ensureSession', () => {
    it('should create a new session when none exists', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test'),
        url: vi.fn().mockReturnValue('http://example.com'),
        setViewportSize: vi.fn(),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([]),
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn(),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      const session = await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )

      expect(session).toBeDefined()
      expect(session.id).toMatch(/^session_\d+_[a-z0-9]+$/)
      expect(chromium.launch).toHaveBeenCalledWith({
        channel: 'chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    })

    it('should reuse existing session when still alive', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Existing Page'),
        url: vi.fn().mockReturnValue('http://existing.com'),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([mockPage]),
        close: vi.fn(),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([mockContext]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      // First call
      await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )

      // Second call should reuse
      const session2 = await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )

      expect(chromium.launch).toHaveBeenCalledTimes(1)
      await expect(session2.page.title()).resolves.toBe('Existing Page')
    })
  })

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      const session = sessionManager.getSession('non-existent')
      expect(session).toBeUndefined()
    })

    it('should return existing session by ID', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test'),
        url: vi.fn().mockReturnValue('http://example.com'),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([mockPage]),
        close: vi.fn(),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([mockContext]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      const session = await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )
      const retrieved = sessionManager.getSession(session.id)

      expect(retrieved).toBe(session)
    })
  })

  describe('getDefaultSession', () => {
    it('should return undefined when no default session exists', () => {
      const session = sessionManager.getDefaultSession()
      expect(session).toBeUndefined()
    })

    it('should return the default session', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test'),
        url: vi.fn().mockReturnValue('http://example.com'),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([mockPage]),
        close: vi.fn(),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([mockContext]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )
      const defaultSession = sessionManager.getDefaultSession()

      expect(defaultSession).toBeDefined()
      expect(defaultSession).toHaveProperty('id')
      expect(defaultSession).toHaveProperty('page')
      expect(defaultSession).toHaveProperty('context')
      expect(defaultSession).toHaveProperty('browser')
    })
  })

  describe('cleanupSession', () => {
    it('should do nothing for non-existent session', async () => {
      await expect(
        sessionManager.cleanupSession('non-existent')
      ).resolves.not.toThrow()
    })

    it('should close session and clear default session ID', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test'),
        url: vi.fn().mockReturnValue('http://example.com'),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([mockPage]),
        close: vi.fn().mockResolvedValue(undefined),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([mockContext]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      const session = await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )
      await sessionManager.cleanupSession(session.id)

      expect(mockContext.close).toHaveBeenCalled()
      expect(mockBrowser.close).toHaveBeenCalled()
      expect(sessionManager.getSession(session.id)).toBeUndefined()
      expect(sessionManager.getDefaultSession()).toBeUndefined()
    })
  })

  describe('cleanupAll', () => {
    it('should close all sessions', async () => {
      const mockPage = {
        title: vi.fn().mockResolvedValue('Test'),
        url: vi.fn().mockReturnValue('http://example.com'),
      }
      const mockContext = {
        pages: vi.fn().mockReturnValue([mockPage]),
        close: vi.fn().mockResolvedValue(undefined),
      }
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        contexts: vi.fn().mockReturnValue([mockContext]),
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn(),
      }

      ;(chromium.launch as any).mockResolvedValue(mockBrowser)

      await sessionManager.ensureSession(
        'http://localhost:9222',
        true,
        1920,
        1080
      )
      await sessionManager.cleanupAll()

      expect(mockContext.close).toHaveBeenCalled()
      expect(mockBrowser.close).toHaveBeenCalled()
      expect(sessionManager.getDefaultSession()).toBeUndefined()
    })
  })
})
