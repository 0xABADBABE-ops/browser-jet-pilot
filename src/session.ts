import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import type { BrowserSession } from './types.js'

export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map()
  private defaultSessionId: string | null = null

  /**
   * Ensure a default browser session exists. Reuses existing if valid.
   */
  async ensureSession(
    cdpUrl: string,
    launch: boolean,
    width: number,
    height: number
  ): Promise<BrowserSession> {
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
          return existing
        } catch {
          // Session is dead, clean it up
          await this.cleanupSession(this.defaultSessionId)
        }
      }
    }

    const session = await this.createSession(cdpUrl, launch, width, height)
    this.defaultSessionId = session.id
    return session
  }

  /**
   * Create a new browser session.
   */
  async createSession(
    cdpUrl: string,
    launch: boolean,
    width: number,
    height: number
  ): Promise<BrowserSession> {
    let browser: Browser
    let context: BrowserContext
    let page: Page

    if (launch) {
      // Launch a new Chromium instance
      browser = await chromium.launch({
        channel: 'chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      context = await browser.newContext({
        viewport: { width, height },
        // Ignore HTTPS errors to improve reliability in environments with
        // intercepting proxies or self-signed certs.
        ignoreHTTPSErrors: true,
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
          ignoreHTTPSErrors: true,
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
      } catch {
        // ignore if not supported by remote context
      }
    }

    const session: BrowserSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      browser,
      context,
      page,
      createdAt: Date.now(),
    }

    this.sessions.set(session.id, session)
    return session
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
