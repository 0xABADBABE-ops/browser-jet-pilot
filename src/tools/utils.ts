import { resolve, join } from 'path'
import type { SessionManager } from '../session.js'

/**
 * Shared constants and helpers for tool modules.
 */

export function noSession(): never {
  throw new Error('No active session. Call browser_start first.')
}

export const DEFAULT_TIMEOUT = 10000
export const NAVIGATION_TIMEOUT = 30000
export const DATA_DIR = resolve('/data')
export const DOWNLOADS_DIR = join(DATA_DIR, 'downloads')

/** Get the default session or throw if none exists. */
export function getSession(sessionManager: SessionManager) {
  const session = sessionManager.getDefaultSession()
  if (!session) noSession()
  return session
}
