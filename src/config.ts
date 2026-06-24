import { z } from 'zod'
import dotenv from 'dotenv'
import { ServerConfig } from './types.js'

dotenv.config()

const configSchema = z.object({
  cdpUrl: z.string().default('http://localhost:9222'),
  launch: z.boolean().default(false),
  browserWidth: z.coerce.number().default(1280),
  browserHeight: z.coerce.number().default(720),
  port: z.coerce.number().nullable().default(null),
  host: z.string().default('localhost'),
  apiKey: z.string().optional(),
  ignoreHTTPSErrors: z.boolean().default(false),
  noSandbox: z.boolean().default(false),
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
    ignoreHTTPSErrors: process.env.BROWSER_IGNORE_HTTPS_ERRORS === 'true',
    noSandbox: process.env.BROWSER_NO_SANDBOX === 'true',
  })

  return { ...env, ...overrides }
}
