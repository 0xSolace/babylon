/**
 * Production server for Babylon Web
 *
 * Serves the built static files locally for testing.
 * In production, files are served via DWS CDN.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Load manifest for port config
const manifest = await Bun.file('./jeju-manifest.json').json()
const PORT =
  Number(process.env.BABYLON_WEB_PORT) || manifest.ports?.frontend || 5008
const API_PORT =
  Number(process.env.BABYLON_API_PORT) || manifest.ports?.api || 5009
const API_URL =
  process.env.PUBLIC_API_BASE_URL || `http://localhost:${API_PORT}`
const DIST_DIR = './dist'

if (!existsSync(DIST_DIR)) {
  console.error('❌ Build not found. Run `bun run build` first.')
  process.exit(1)
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    js: 'application/javascript',
    mjs: 'application/javascript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    map: 'application/json',
    ico: 'image/x-icon',
  }
  return types[ext || ''] || 'application/octet-stream'
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname

    // API proxy (for local testing)
    if (pathname.startsWith('/api')) {
      try {
        const targetUrl = `${API_URL}${pathname}${url.search}`
        const headers = new Headers(req.headers)
        headers.delete('host')

        const proxyReq = new Request(targetUrl, {
          method: req.method,
          headers,
          body: req.body,
        })

        const response = await fetch(proxyReq)
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      } catch (e) {
        console.error('Proxy error:', e)
        return new Response('API proxy error', { status: 502 })
      }
    }

    // Determine file path
    const filePath = pathname === '/' ? 'index.html' : pathname.slice(1)
    const fullPath = join(DIST_DIR, filePath)

    // Try to serve the exact file
    const file = Bun.file(fullPath)
    if (await file.exists()) {
      const contentType = getContentType(filePath)
      const isHashed = filePath.includes('-') && !filePath.includes('index')

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          // Cache hashed assets aggressively, others briefly
          'Cache-Control': isHashed
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=60',
        },
      })
    }

    // SPA fallback - serve index.html for all routes
    const indexFile = Bun.file(join(DIST_DIR, 'index.html'))
    return new Response(indexFile, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60',
      },
    })
  },
})

console.log(
  `🚀 Babylon Web production server running at http://localhost:${PORT}`,
)
console.log(`   📡 API proxy: ${API_URL}`)
