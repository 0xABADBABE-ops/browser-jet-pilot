import { readFile, readdir, mkdir, unlink, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SessionManager } from '../session.js'
import type { ServerConfig } from '../types.js'
import { getSession, DATA_DIR, DOWNLOADS_DIR } from './utils.js'

export function registerPersistenceTools(
  server: McpServer,
  sessionManager: SessionManager,
  _config: ServerConfig
): void {
  server.registerTool(
    'browser_save_cookies',
    {
      description:
        'Save all browser cookies for the current domain to persistent storage at /data/cookies.json. Use for session persistence across browser restarts.',
      inputSchema: {
        filename: z
          .string()
          .optional()
          .describe(
            'Filename under /data/ (default: "cookies.json"). Use different names to maintain multiple cookie jars.'
          ),
      },
    },
    async ({ filename }) => {
      const session = getSession(sessionManager)
      const ctx = session.context
      const cookies = await ctx.cookies()
      const path = join(DATA_DIR, filename ?? 'cookies.json')
      await writeFile(path, JSON.stringify(cookies, null, 2), 'utf-8')
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              saved: cookies.length,
              path,
              message: `${cookies.length} cookies saved to ${path}`,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_load_cookies',
    {
      description:
        'Load cookies from persistent storage (/data/cookies.json) and inject them into the current browser context. Useful for restoring authenticated sessions.',
      inputSchema: {
        filename: z
          .string()
          .optional()
          .describe(
            'Filename under /data/ (default: "cookies.json"). Must have been previously saved with browser_save_cookies.'
          ),
      },
    },
    async ({ filename }) => {
      const session = getSession(sessionManager)
      const path = join(DATA_DIR, filename ?? 'cookies.json')
      const raw = await readFile(path, 'utf-8')
      const cookies = JSON.parse(raw) as Array<{
        name: string
        value: string
        domain: string
        path: string
      }>
      await session.context.addCookies(cookies)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              loaded: cookies.length,
              path,
              message: `${cookies.length} cookies loaded from ${path}`,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_download',
    {
      description:
        'Download a file from a URL to the persistent /data/downloads/ directory on the NVMe volume. Returns the local file path.',
      inputSchema: {
        url: z.string().describe('URL of the file to download'),
        filename: z
          .string()
          .optional()
          .describe(
            'Name to save the file as (default: derived from URL). Saved under /data/downloads/.'
          ),
      },
    },
    async ({ url, filename }) => {
      const session = getSession(sessionManager)
      await mkdir(DOWNLOADS_DIR, { recursive: true })

      const name = filename ?? url.split('/').pop() ?? 'download'
      const dest = join(DOWNLOADS_DIR, name)

      // Fetch the file bytes in the page context, return as base64
      const result = await session.page.evaluate(
        async ({ url: fetchUrl }: { url: string }) => {
          const resp = await fetch(fetchUrl)
          if (!resp.ok)
            return {
              error: `HTTP ${resp.status}: ${resp.statusText}`,
            } as const
          const blob = await resp.blob()
          const reader = new FileReader()
          return new Promise<
            { error: string } | { data: string; size: number; type: string }
          >((resolve) => {
            reader.onloadend = () =>
              resolve({
                data: reader.result as string,
                size: blob.size,
                type: blob.type,
              })
            reader.readAsDataURL(blob)
          })
        },
        { url }
      )

      if ('error' in result) {
        throw new Error(result.error)
      }

      const base64 = result.data.split(',')[1]
      const buf = Buffer.from(base64, 'base64')
      await writeFile(dest, buf)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              path: dest,
              size: result.size,
              type: result.type,
              message: `Downloaded ${result.size} bytes to ${dest}`,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_list_data_files',
    {
      description:
        'List all files and directories on the persistent NVMe volume at /data/. Useful for inspecting previously saved cookies, downloads, and written files.',
      inputSchema: {
        subdir: z
          .string()
          .optional()
          .describe(
            'Subdirectory under /data/ to list (default: root of /data/)'
          ),
      },
    },
    async ({ subdir }) => {
      const dir = subdir ? join(DATA_DIR, subdir) : DATA_DIR
      let entries: import('fs').Dirent[]
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ path: dir, entries: [] }),
            },
          ],
        }
      }
      const listing = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }))
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ path: dir, entries: listing }, null, 2),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_read_data_file',
    {
      description:
        'Read a text file from the persistent /data/ directory on the NVMe volume. Returns the content as a string.',
      inputSchema: {
        path: z
          .string()
          .describe(
            'Path to the file relative to /data/. E.g. "downloads/report.pdf" reads /data/downloads/report.pdf.'
          ),
        encoding: z
          .enum(['utf-8', 'base64'])
          .optional()
          .describe(
            'Encoding to read the file as (default: "utf-8" for text, use "base64" for binary)'
          ),
      },
    },
    async ({ path: relPath, encoding }) => {
      const fullPath = resolve(DATA_DIR, relPath)
      // Prevent path traversal outside /data
      if (!fullPath.startsWith(DATA_DIR)) {
        throw new Error(`Path traversal detected: ${relPath}`)
      }
      const content: string = await readFile(fullPath, encoding ?? 'utf-8')
      return {
        content: [
          {
            type: 'text' as const,
            text: content.slice(0, 100_000),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_write_data_file',
    {
      description:
        'Write text content to a file in the persistent /data/ directory on the NVMe volume. Creates parent directories as needed.',
      inputSchema: {
        path: z
          .string()
          .describe(
            'Path relative to /data/ where the file should be written. E.g. "notes/scrape.txt".'
          ),
        content: z.string().describe('Text content to write to the file.'),
        encoding: z
          .enum(['utf-8', 'base64'])
          .optional()
          .describe(
            'Encoding for the content (default: "utf-8"). Use "base64" if content is base64-encoded binary data.'
          ),
      },
    },
    async ({ path: relPath, content, encoding }) => {
      const fullPath = resolve(DATA_DIR, relPath)
      if (!fullPath.startsWith(DATA_DIR)) {
        throw new Error(`Path traversal detected: ${relPath}`)
      }
      await mkdir(join(fullPath, '..'), { recursive: true })

      if (encoding === 'base64') {
        await writeFile(fullPath, Buffer.from(content, 'base64'))
      } else {
        await writeFile(fullPath, content, 'utf-8')
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              path: fullPath,
              size: content.length,
              message: `Written ${content.length} chars to ${fullPath}`,
            }),
          },
        ],
      }
    }
  )

  server.registerTool(
    'browser_delete_data_file',
    {
      description:
        'Delete a file from the persistent /data/ directory on the NVMe volume.',
      inputSchema: {
        path: z
          .string()
          .describe(
            'Path to the file relative to /data/. E.g. "cookies.json" or "downloads/old.zip".'
          ),
      },
    },
    async ({ path: relPath }) => {
      const fullPath = resolve(DATA_DIR, relPath)
      if (!fullPath.startsWith(DATA_DIR)) {
        throw new Error(`Path traversal detected: ${relPath}`)
      }
      await unlink(fullPath)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              deleted: fullPath,
              message: `Deleted ${fullPath}`,
            }),
          },
        ],
      }
    }
  )
}
