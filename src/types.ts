import type { Browser, BrowserContext, Page } from 'playwright'

export interface BrowserSession {
  id: string
  browser: Browser
  context: BrowserContext
  page: Page
  createdAt: number
}

export interface ServerConfig {
  cdpUrl: string
  launch: boolean
  browserWidth: number
  browserHeight: number
  port: number | null
  host: string
  apiKey?: string
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image'
    text?: string
    data?: string
    mimeType?: string
  }>
}
