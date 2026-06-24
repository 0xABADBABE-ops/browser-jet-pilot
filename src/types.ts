import type { Browser, BrowserContext, Page } from 'playwright'

/**
 * Represents an active browser session.
 *
 * The `page` getter always resolves the current page from the browser context,
 * eliminating TOCTOU race conditions when multiple clients switch tabs.
 */
export class BrowserSession {
  id: string
  browser: Browser
  context: BrowserContext
  currentPageIndex: number
  createdAt: number

  constructor(
    id: string,
    browser: Browser,
    context: BrowserContext,
    initialPageIndex: number,
    createdAt: number
  ) {
    this.id = id
    this.browser = browser
    this.context = context
    this.currentPageIndex = initialPageIndex
    this.createdAt = createdAt
  }

  /** The currently active page, always resolved fresh from the context. */
  get page(): Page {
    const pages = this.context.pages()
    if (pages.length === 0) {
      throw new Error('No open pages in browser context')
    }
    if (this.currentPageIndex >= pages.length) {
      this.currentPageIndex = pages.length - 1
    }
    return pages[this.currentPageIndex]
  }
}

export interface ServerConfig {
  cdpUrl: string
  launch: boolean
  browserWidth: number
  browserHeight: number
  port: number | null
  host: string
  apiKey?: string
  ignoreHTTPSErrors: boolean
  noSandbox: boolean
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}
