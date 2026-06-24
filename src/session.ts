import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import { BrowserSession } from './types.js'

/** Options for creating or ensuring a browser session. */
export interface CreateSessionOptions {
  cdpUrl: string
  launch: boolean
  width: number
  height: number
  ignoreHTTPSErrors: boolean
  noSandbox: boolean
}

export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map()
  private defaultSessionId: string | null = null
  private lruOrder: string[] = []
  private readonly maxSessions: number

  /**
   * @param maxSessions - Maximum concurrent sessions before LRU eviction (default: 10)
   */
  constructor(maxSessions = 10) {
    this.maxSessions = maxSessions
  }

  /**
   * Ensure a default browser session exists. Reuses existing if valid.
   *
   * @param opts - Session creation options
   * @returns The active or newly created session
   */
  async ensureSession(opts: CreateSessionOptions): Promise<BrowserSession> {
    // Reuse existing default session if still alive
    if (this.defaultSessionId) {
      const existing = this.sessions.get(this.defaultSessionId)
      if (existing) {
        try {
          // Check if browser is still connected and page is accessible
          if (!existing.browser.isConnected()) {
            throw new Error('Browser disconnected')
          }
          await existing.page.title()
          this.touchLRU(this.defaultSessionId)
          return existing
        } catch {
          // Session is dead, clean it up
          await this.cleanupSession(this.defaultSessionId)
        }
      }
    }

    await this.evictIfNeeded()
    const session = await this.createSession(opts)
    this.defaultSessionId = session.id
    return session
  }

  /**
   * Create a new browser session.
   *
   * @param opts - Session creation options
   * @returns The newly created session
   */
  async createSession(opts: CreateSessionOptions): Promise<BrowserSession> {
    const { cdpUrl, launch, width, height, ignoreHTTPSErrors, noSandbox } = opts
    let browser: Browser
    let context: BrowserContext
    let page: Page

    if (launch) {
      // Launch a new Chromium instance
      browser = await chromium.launch({
        channel: 'chromium',
        headless: true,
        args: noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
      })
      context = await browser.newContext({
        viewport: { width, height },
        ignoreHTTPSErrors,
      })
    } else {
      // Connect to existing Chromium via CDP
      browser = await chromium.connectOverCDP(cdpUrl)
      const contexts = browser.contexts()
      if (contexts.length > 0) {
        context = contexts[0]
      } else {
        context = await browser.newContext({
          viewport: { width, height },
          ignoreHTTPSErrors,
        })
      }
    }

    const pages = context.pages()
    if (pages.length > 0) {
      page = pages[0]
    } else {
      page = await context.newPage()
    }

    if (!launch) {
      // Set viewport on connected browser (best-effort)
      try {
        await page.setViewportSize({ width, height })
      } catch (err) {
        // Connected browser may not support viewport changes;
        // log a warning so operators are aware.
        console.error(
          '[browser-jet-pilot] Warning: could not set viewport on',
          `CDP browser: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const session = new BrowserSession(
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      browser,
      context,
      0, // initial page index
      Date.now()
    )

    this.sessions.set(session.id, session)
    this.lruOrder.push(session.id)
    return session
  }

  /**
   * Mark a session as recently used (move to end of LRU list).
   */
  private touchLRU(id: string): void {
    const idx = this.lruOrder.indexOf(id)
    if (idx !== -1) {
      this.lruOrder.splice(idx, 1)
      this.lruOrder.push(id)
    }
  }

  /**
   * Evict the least-recently-used session if at capacity.
   */
  private async evictIfNeeded(): Promise<void> {
    while (this.sessions.size >= this.maxSessions) {
      // Find the oldest session that isn't the default
      let evicted = false
      for (let i = 0; i < this.lruOrder.length && !evicted; i++) {
        const id = this.lruOrder[i]
        if (id !== this.defaultSessionId && this.sessions.has(id)) {
          await this.cleanupSession(id)
          evicted = true
        }
      }
      // If all sessions are the default (shouldn't happen with cap > 1),
      // evict the default anyway
      if (!evicted && this.lruOrder.length > 0) {
        await this.cleanupSession(this.lruOrder[0])
        evicted = true
      }
      // Safety: break if nothing was evictable
      if (!evicted) break
    }
  }

  /**
   * Get an active session by ID.
   */
  getSession(id: string): BrowserSession | undefined {
    return this.sessions.get(id)
  }

  /**
   * Get the default (current) session.
   */
  getDefaultSession(): BrowserSession | undefined {
    if (!this.defaultSessionId) return undefined
    return this.sessions.get(this.defaultSessionId)
  }

  /**
   * Close a specific session.
   */
  async cleanupSession(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return

    try {
      await session.context.close()
    } catch {
      // Context may already be closed
    }

    // Close the browser instance if we launched it
    // (for CDP connections, we only close the context)
    if (session.browser.isConnected()) {
      try {
        await session.browser.close()
      } catch {
        // Browser may already be closed
      }
    }

    this.sessions.delete(id)
    const lruIdx = this.lruOrder.indexOf(id)
    if (lruIdx !== -1) this.lruOrder.splice(lruIdx, 1)
    if (this.defaultSessionId === id) {
      this.defaultSessionId = null
    }
  }

  /**
   * Close all sessions.
   */
  async cleanupAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.cleanupSession(id)
    }
  }
}
