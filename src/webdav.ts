/**
 * Lightweight WebDAV handler serving files from /data.
 * Supports the core methods needed to mount as a network drive:
 * OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY.
 *
 * Mount path: /webdav → serves /data on the NVMe volume.
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { resolve, join, relative, basename, dirname } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import {
  readFile,
  readdir,
  writeFile,
  mkdir,
  unlink,
  rm,
  stat,
  rename,
} from 'fs/promises'

const DATA_DIR = resolve('/data')
const WEBDAV_PREFIX = '/webdav'

/** Map a WebDAV URL path to the filesystem path under /data. */
function toFsPath(urlPath: string): string {
  const rel = relative(WEBDAV_PREFIX, urlPath)
  const sanitized = rel.replace(/\.\./g, '') // block traversal
  return resolve(
    DATA_DIR,
    sanitized.startsWith('/') ? sanitized.slice(1) : sanitized
  )
}

/** Guard: ensure resolved path stays under /data. */
function isUnderData(fsPath: string): boolean {
  return fsPath.startsWith(DATA_DIR)
}

/** Strip /webdav prefix for XML href values. */
function toHref(urlPath: string): string {
  return urlPath.startsWith(WEBDAV_PREFIX)
    ? urlPath.slice(WEBDAV_PREFIX.length) || '/'
    : urlPath
}

/** Escape XML special characters. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a minimal PROPFIND XML response for a directory listing. */
async function buildPropfindResponse(
  dirFsPath: string,
  dirHref: string,
  depth: string
): Promise<string> {
  const entries = await readdir(dirFsPath, { withFileTypes: true })
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n'
  xml += '<D:multistatus xmlns:D="DAV:">\n'

  // Include the directory itself
  const dirStat = await stat(dirFsPath)
  xml += '<D:response>\n'
  xml += `<D:href>${xmlEscape(dirHref)}</D:href>\n`
  xml += '<D:propstat>\n<D:prop>\n'
  xml += `<D:displayname>${xmlEscape(basename(dirFsPath))}</D:displayname>\n`
  xml += `<D:getcontentlength>${dirStat.size}</D:getcontentlength>\n`
  xml += `<D:getlastmodified>${dirStat.mtime.toISOString()}</D:getlastmodified>\n`
  xml += `<D:resourcetype><D:collection/></D:resourcetype>\n`
  xml += '</D:prop>\n<D:status>HTTP/1.1 200 OK</D:status>\n'
  xml += '</D:propstat>\n</D:response>\n'

  for (const entry of entries) {
    const entryPath = join(dirFsPath, entry.name)
    const entryStat = await stat(entryPath)
    const href = dirHref === '/' ? `/${entry.name}` : `${dirHref}/${entry.name}`

    xml += '<D:response>\n'
    xml += `<D:href>${xmlEscape(href)}</D:href>\n`
    xml += '<D:propstat>\n<D:prop>\n'
    xml += `<D:displayname>${xmlEscape(entry.name)}</D:displayname>\n`
    xml += `<D:getcontentlength>${entryStat.size}</D:getcontentlength>\n`
    xml += `<D:getlastmodified>${entryStat.mtime.toISOString()}</D:getlastmodified>\n`
    if (entry.isDirectory()) {
      xml += '<D:resourcetype><D:collection/></D:resourcetype>\n'
    } else {
      xml += '<D:resourcetype/>\n'
    }
    xml += '</D:prop>\n<D:status>HTTP/1.1 200 OK</D:status>\n'
    xml += '</D:propstat>\n</D:response>\n'

    if (depth === '1' && entry.isDirectory()) {
      // Shallow recursion: include immediate children of subdirectories
      try {
        const subEntries = await readdir(entryPath, {
          withFileTypes: true,
        })
        for (const sub of subEntries) {
          const subPath = join(entryPath, sub.name)
          const subStat = await stat(subPath)
          const subHref = `${href}/${sub.name}`
          xml += '<D:response>\n'
          xml += `<D:href>${xmlEscape(subHref)}</D:href>\n`
          xml += '<D:propstat>\n<D:prop>\n'
          xml += `<D:displayname>${xmlEscape(sub.name)}</D:displayname>\n`
          xml += `<D:getcontentlength>${subStat.size}</D:getcontentlength>\n`
          xml += `<D:getlastmodified>${subStat.mtime.toISOString()}</D:getlastmodified>\n`
          if (sub.isDirectory()) {
            xml += '<D:resourcetype><D:collection/></D:resourcetype>\n'
          } else {
            xml += '<D:resourcetype/>\n'
          }
          xml += '</D:prop>\n<D:status>HTTP/1.1 200 OK</D:status>\n'
          xml += '</D:propstat>\n</D:response>\n'
        }
      } catch {
        // Skip if we can't read a subdirectory
      }
    }
  }

  xml += '</D:multistatus>\n'
  return xml
}

function extractApiKey(req: IncomingMessage): string | undefined {
  const headerKey = req.headers['x-api-key']
  if (typeof headerKey === 'string' && headerKey) return headerKey
  return undefined
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

async function parseBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  const MAX = 500 * 1024 * 1024 // 500MB limit for file uploads
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX) throw new Error('File too large (max 500MB)')
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Handle a WebDAV request. Returns true if the request was handled,
 * false if the path doesn't match the WebDAV prefix.
 */
export async function handleWebdavRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey?: string
): Promise<boolean> {
  const url = req.url ?? '/'

  // Only handle /webdav prefix
  if (!url.startsWith(WEBDAV_PREFIX)) return false

  // Auth check
  if (apiKey) {
    const provided = extractApiKey(req)
    if (!provided || !constantTimeEqual(provided, apiKey)) {
      res.writeHead(401, { 'content-type': 'text/plain' })
      res.end('Unauthorized')
      return true
    }
  }

  const fsPath = toFsPath(url)

  // Path traversal guard
  if (!isUnderData(fsPath)) {
    res.writeHead(403, { 'content-type': 'text/plain' })
    res.end('Forbidden')
    return true
  }

  try {
    switch (req.method) {
      case 'OPTIONS': {
        res.writeHead(200, {
          Allow: 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY',
          DAV: '1,2',
          'content-length': '0',
        })
        res.end()
        return true
      }

      case 'PROPFIND': {
        const depth = req.headers['depth'] ?? '0'
        try {
          await stat(fsPath)
        } catch {
          res.writeHead(404)
          res.end('Not Found')
          return true
        }

        const href = toHref(url)
        const body = await buildPropfindResponse(
          fsPath,
          href,
          Array.isArray(depth) ? depth[0] : depth
        )

        res.writeHead(207, {
          'content-type': 'application/xml; charset=utf-8',
          'content-length': Buffer.byteLength(body),
        })
        res.end(body)
        return true
      }

      case 'GET': {
        let info: ReturnType<typeof stat> extends Promise<infer T> ? T : never
        try {
          info = await stat(fsPath)
        } catch {
          res.writeHead(404)
          res.end('Not Found')
          return true
        }

        if (info.isDirectory()) {
          // For directories, return a simple HTML listing
          const entries = await readdir(fsPath, {
            withFileTypes: true,
          })
          const href = toHref(url)
          let html = `<!DOCTYPE html><html><head><title>Index of ${xmlEscape(url)}</title></head><body>`
          html += `<h1>Index of ${xmlEscape(url)}</h1><ul>`
          if (href !== '/') {
            html += `<li><a href="${xmlEscape(join(href, '..'))}">..</a></li>`
          }
          for (const e of entries) {
            const eHref = href === '/' ? `/${e.name}` : `${href}/${e.name}`
            html += `<li><a href="${xmlEscape(eHref)}">${xmlEscape(e.name)}${e.isDirectory() ? '/' : ''}</a></li>`
          }
          html += '</ul></body></html>'

          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
          })
          res.end(html)
          return true
        }

        const content = await readFile(fsPath)
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': content.length,
        })
        res.end(content)
        return true
      }

      case 'PUT': {
        const body = await parseBody(req)
        await mkdir(dirname(fsPath), { recursive: true })
        await writeFile(fsPath, body)

        res.writeHead(201, { 'content-length': '0' })
        res.end()
        return true
      }

      case 'DELETE': {
        try {
          const info = await stat(fsPath)
          if (info.isDirectory()) {
            await rm(fsPath, { recursive: true })
          } else {
            await unlink(fsPath)
          }
          res.writeHead(204, { 'content-length': '0' })
          res.end()
        } catch {
          res.writeHead(404)
          res.end('Not Found')
        }
        return true
      }

      case 'MKCOL': {
        await mkdir(fsPath, { recursive: true })
        res.writeHead(201, { 'content-length': '0' })
        res.end()
        return true
      }

      case 'MOVE': {
        const destHeader = req.headers['destination']
        if (!destHeader) {
          res.writeHead(400)
          res.end('Destination header required')
          return true
        }
        const dest = Array.isArray(destHeader) ? destHeader[0] : destHeader
        // Parse destination URL
        const destUrl = new URL(dest, `http://${req.headers.host}`)
        const destPath = toFsPath(destUrl.pathname)
        if (!isUnderData(destPath)) {
          res.writeHead(403)
          res.end('Forbidden')
          return true
        }
        await mkdir(dirname(destPath), { recursive: true })
        await rename(fsPath, destPath)
        res.writeHead(201, { 'content-length': '0' })
        res.end()
        return true
      }

      case 'COPY': {
        const destHeader = req.headers['destination']
        if (!destHeader) {
          res.writeHead(400)
          res.end('Destination header required')
          return true
        }
        const dest = Array.isArray(destHeader) ? destHeader[0] : destHeader
        const destUrl = new URL(dest, `http://${req.headers.host}`)
        const destPath = toFsPath(destUrl.pathname)
        if (!isUnderData(destPath)) {
          res.writeHead(403)
          res.end('Forbidden')
          return true
        }

        const srcInfo = await stat(fsPath)
        await mkdir(dirname(destPath), { recursive: true })

        if (srcInfo.isDirectory()) {
          // Recursive copy for directories
          await copyDir(fsPath, destPath)
        } else {
          const data = await readFile(fsPath)
          await writeFile(destPath, data)
        }

        res.writeHead(201, { 'content-length': '0' })
        res.end()
        return true
      }

      case 'PROPPATCH':
      case 'LOCK':
      case 'UNLOCK': {
        // Return success for PROPPATCH/LOCK/UNLOCK so clients don't fail
        res.writeHead(200, { 'content-type': 'application/xml' })
        res.end(
          '<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:"></D:multistatus>'
        )
        return true
      }

      default: {
        res.writeHead(405)
        res.setHeader(
          'Allow',
          'OPTIONS,PROPFIND,GET,PUT,DELETE,MKCOL,MOVE,COPY'
        )
        res.end('Method Not Allowed')
        return true
      }
    }
  } catch (err) {
    console.error('[webdav] Error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain' })
      res.end('Internal Server Error')
    }
    return true
  }
}

/** Recursively copy a directory. */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      const data = await readFile(srcPath)
      await writeFile(destPath, data)
    }
  }
}
