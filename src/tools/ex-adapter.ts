/**
 * @fileoverview Adapter — wraps Pilot's BrowserSession to satisfy
 * browser-jet-pilot-ex's BrowserSession interface.
 *
 * EX tools expect { page: { evaluate, url, context(), goto, ... } }.
 * Pilot's BrowserSession has a `page` getter returning a Playwright Page
 * which already implements all of those methods. This adapter creates
 * the CDP session lazily and delegates everything else directly.
 */

import type { Page } from 'playwright'
import type { BrowserSession as PilotSession } from '../types.js'
import type { BrowserSession as ExSession } from 'browser-jet-pilot-ex/mcp/types'

/**
 * Wrap a Pilot BrowserSession into the interface EX tools expect.
 *
 * The only bridge needed is `context().cdpSession.send()` — Playwright
 * CDP sessions are created with `page.context().newCDPSession(page)`.
 */
export function adaptSessionForEx(
  session: PilotSession
): ExSession {
  let cdpSessionPromise: Promise<{ send(method: string, params?: Record<string, unknown>): Promise<unknown> }> | null = null

  return {
    page: {
      evaluate<T>(fn: string, arg?: unknown): Promise<T> {
        return session.page.evaluate(fn, arg) as Promise<T>
      },
      url(): string {
        return session.page.url()
      },
      context() {
        if (!cdpSessionPromise) {
          cdpSessionPromise = session.page
            .context()
            .newCDPSession(session.page)
        }
        return {
          cdpSession: {
            send(method: string, params?: Record<string, unknown>) {
              return cdpSessionPromise!.then((cdp) =>
                cdp.send(method, params)
              )
            },
          },
        }
      },
      goto(url: string, options?: { timeout?: number }) {
        return session.page.goto(url, options)
      },
      content() {
        return session.page.content()
      },
      async newPage() {
        const page = await session.context.newPage()
        // Return in the same shape so EX tools can use it
        return adaptPageForEx(page)
      },
      close() {
        return session.page.close()
      },
      screenshot(options?: { type?: 'png' | 'jpeg'; fullPage?: boolean }) {
        return session.page.screenshot(options)
      },
    },
  }
}

/** Adapt a raw Playwright Page into the shape EX tools expect. */
function adaptPageForEx(page: Page): ExSession['page'] {
  let cdpSessionPromise: Promise<{
    send(
      method: string,
      params?: Record<string, unknown>
    ): Promise<unknown>
  }> | null = null

  return {
    evaluate<T>(fn: string, arg?: unknown): Promise<T> {
      return page.evaluate(fn, arg) as Promise<T>
    },
    url() {
      return page.url()
    },
    context() {
      if (!cdpSessionPromise) {
        cdpSessionPromise = page.context().newCDPSession(page)
      }
      return {
        cdpSession: {
          send(method: string, params?: Record<string, unknown>) {
            return cdpSessionPromise!.then((cdp) =>
              cdp.send(method, params)
            )
          },
        },
      }
    },
    goto(url: string, options?: { timeout?: number }) {
      return page.goto(url, options)
    },
    content() {
      return page.content()
    },
    async newPage() {
      const newPage = await page.context().newPage()
      return adaptPageForEx(newPage)
    },
    close() {
      return page.close()
    },
    screenshot(options?: { type?: 'png' | 'jpeg'; fullPage?: boolean }) {
      return page.screenshot(options) as Promise<Buffer>
    },
  }
}
