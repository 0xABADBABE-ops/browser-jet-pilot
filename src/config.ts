import { z } from 'zod'
import type { ServerConfig } from './types.js'

const configSchema = z.object({
  cdpUrl: z.string().default('http://localhost:9222'),
  launch: z.boolean().default(false),
  browserWidth: z.coerce.number().default(1280),
  browserHeight: z.coerce.number().default(720),
  port: z.coerce.number().nullable().default(null),
  host: z.string().default('localhost'),
  apiKey: z.string().min(8, 'API key must be at least 8 characters').optional(),
  webdavApiKey: z
    .string()
    .min(8, 'WebDAV API key must be at least 8 characters')
    .optional(),
  allowEvaluate: z.coerce.boolean().default(false),
  ignoreHTTPSErrors: z.boolean().default(false),
  noSandbox: z.boolean().default(false),
  corsOrigin: z.string().optional(),
  capabilities: z.string().optional(),
})

export function resolveConfig(
  overrides: Partial<ServerConfig> = {}
): ServerConfig {
  const env = configSchema.parse({
    cdpUrl: process.env.CDP_URL,
    launch: process.env.LAUNCH === 'true',
    browserWidth: process.env.BROWSER_WIDTH,
    browserHeight: process.env.BROWSER_HEIGHT,
    port: process.env.PORT || null,
    host: process.env.HOST,
    apiKey: process.env.API_KEY,
    webdavApiKey: process.env.WEBDAV_API_KEY,
    allowEvaluate: process.env.ALLOW_EVALUATE === 'true',
    ignoreHTTPSErrors: process.env.BROWSER_IGNORE_HTTPS_ERRORS === 'true',
    noSandbox: process.env.BROWSER_NO_SANDBOX === 'true',
    corsOrigin: process.env.CORS_ORIGIN,
    capabilities: process.env.CAPABILITIES,
  })

  return { ...env, ...overrides }
}
