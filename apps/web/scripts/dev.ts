/**
 * Development server for Babylon Web
 *
 * Features:
 * - Bun bundler with watch mode
 * - Tailwind CSS processing
 * - API proxy to backend
 * - Live reload on file changes
 */

import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'bun'

// Load manifest for port config
const manifest = await Bun.file('./jeju-manifest.json').json()
const PORT =
  Number(process.env.BABYLON_WEB_PORT) || manifest.ports?.frontend || 5008
const API_PORT =
  Number(process.env.BABYLON_API_PORT) || manifest.ports?.api || 5009
const API_URL =
  process.env.PUBLIC_API_BASE_URL || `http://localhost:${API_PORT}`

const DEV_DIR = './.dev'
const SRC_DIR = './src'

console.log(`📋 Loaded manifest: ${manifest.name} v${manifest.version}`)

// Track connected clients for live reload
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
let currentMainFileName = 'main.js'

// External packages that should not be bundled for browser
const BROWSER_EXTERNALS = [
  // Node.js builtins
  'bun',
  'bun:sqlite',
  'child_process',
  'http2',
  'tls',
  'dgram',
  'fs',
  'net',
  'dns',
  'stream',
  'crypto',
  'process',
  'node:url',
  'node:fs',
  'node:path',
  'node:crypto',
  'node:events',
  'node:process',
  // Packages with Node.js-specific code (server-only)
  '@babylon/agents',
  '@babylon/api',
  '@babylon/db',
  '@babylon/engine',
  '@babylon/training',
  '@babylon/testing',
  // Jeju packages with server-side code (server-only)
  '@jejunetwork/a2a',
  '@jejunetwork/db',
  '@jejunetwork/messaging',
  '@jejunetwork/mcp',
  '@jejunetwork/sdk',
  '@jejunetwork/training',
  // Server-only
  'swagger-ui-react',
  'swagger-jsdoc',
  '@swagger-api/apidom-reference',
  // Note: @jejunetwork/auth, @jejunetwork/kms, @jejunetwork/config, @jejunetwork/shared
  // are BUNDLED (not external) - they have browser-safe code
]

function notifyClients(): void {
  const message = new TextEncoder().encode('data: reload\n\n')
  for (const client of clients) {
    try {
      client.enqueue(message)
    } catch {
      clients.delete(client)
    }
  }
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

async function buildJS(): Promise<string> {
  // Note: splitting disabled due to Bun bundler bug causing duplicate exports
  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    outdir: DEV_DIR,
    target: 'browser',
    splitting: false,
    minify: false,
    sourcemap: 'inline',
    external: BROWSER_EXTERNALS,
    define: {
      // Full process polyfill for browser
      process: JSON.stringify({
        env: {
          NODE_ENV: 'development',
          NETWORK: 'localnet',
          PUBLIC_API_BASE_URL: API_URL,
          PUBLIC_WAITLIST_MODE: process.env.PUBLIC_WAITLIST_MODE || 'false',
        },
      }),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.NETWORK': JSON.stringify('localnet'),
      'process.env.PUBLIC_API_BASE_URL': JSON.stringify(API_URL),
      'process.env.PUBLIC_WAITLIST_MODE': JSON.stringify(
        process.env.PUBLIC_WAITLIST_MODE || 'false',
      ),
      // Global shims for Node.js compatibility
      global: 'globalThis',
    },
    naming: {
      entry: '[name]-[hash].js',
      chunk: 'chunks/[name]-[hash].js',
      asset: '[name]-[hash].[ext]',
    },
  })

  if (!result.success) {
    console.error('❌ Build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error('Build failed')
  }

  const mainEntry = result.outputs.find((o) => o.kind === 'entry-point')
  return mainEntry?.path.split('/').pop() || 'main.js'
}

async function buildCSS(): Promise<void> {
  const proc = spawn({
    cmd: [
      'bunx',
      '@tailwindcss/cli',
      '-i',
      './src/app/globals.css',
      '-o',
      `${DEV_DIR}/styles.css`,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await proc.exited
}

async function startTailwindWatch(): Promise<void> {
  console.log('🎨 Starting Tailwind CSS watcher...')

  // Initial build
  await buildCSS()

  // Start watch process in background
  spawn({
    cmd: [
      'bunx',
      '@tailwindcss/cli',
      '-i',
      './src/app/globals.css',
      '-o',
      `${DEV_DIR}/styles.css`,
      '--watch',
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  })
}

function startFileWatcher(): void {
  const debounceMap = new Map<string, NodeJS.Timeout>()

  watch(SRC_DIR, { recursive: true }, async (_, filename) => {
    if (!filename) return

    // Skip CSS files - Tailwind watcher handles those
    if (filename.endsWith('.css')) return

    // Debounce rapid changes
    const existing = debounceMap.get(filename)
    if (existing) clearTimeout(existing)

    debounceMap.set(
      filename,
      setTimeout(async () => {
        console.log(`📝 ${filename} changed, rebuilding...`)
        try {
          currentMainFileName = await buildJS()
          notifyClients()
        } catch (e) {
          console.error('Rebuild failed:', e)
        }
        debounceMap.delete(filename)
      }, 100),
    )
  })

  // Also watch for CSS changes to trigger reload
  watch(DEV_DIR, { recursive: false }, (_, filename) => {
    if (filename?.endsWith('.css')) {
      console.log('🎨 CSS updated')
      notifyClients()
    }
  })

  console.log('👀 Watching for file changes...')
}

function generateHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#0D0B14" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#FFFBF7" media="(prefers-color-scheme: light)">
  <title>Babylon - Development</title>
  <link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script>
    (function() {
      try {
        const savedTheme = localStorage.getItem('babylon-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme ? savedTheme === 'dark' : prefersDark;
        if (shouldBeDark) {
          document.documentElement.classList.add('dark');
        }
      } catch {}
    })();
  </script>
</head>
<body class="font-sans antialiased overscroll-none bg-background">
  <div id="root"></div>
  <script type="module" src="/${currentMainFileName}"></script>
  <script>
    // Live reload with reconnection handling
    (function() {
      let retries = 0;
      const maxRetries = 3;
      let wasConnected = false;
      
      function connect() {
        const es = new EventSource('/__live-reload');
        
        es.onopen = () => {
          retries = 0;
          wasConnected = true;
        };
        
        es.onmessage = () => location.reload();
        
        es.onerror = () => {
          es.close();
          // Only auto-reload if we were previously connected (actual file change)
          // and haven't exceeded retries
          if (wasConnected && retries < maxRetries) {
            retries++;
            console.log('[Live Reload] Reconnecting... (' + retries + '/' + maxRetries + ')');
            setTimeout(connect, 2000);
          } else if (!wasConnected) {
            // Never connected - just retry silently
            setTimeout(connect, 5000);
          }
          // If exceeded retries, stop trying (manual refresh needed)
        };
      }
      
      connect();
    })();
  </script>
</body>
</html>`
}

async function startServer(): Promise<void> {
  // Create dev directory
  await mkdir(DEV_DIR, { recursive: true })

  console.log('🔨 Initial build...')
  const [mainFileName] = await Promise.all([buildJS(), buildCSS()])
  currentMainFileName = mainFileName

  // Start Tailwind watcher
  await startTailwindWatch()

  // Start file watcher
  startFileWatcher()

  // Start HTTP server
  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // Live reload SSE endpoint
      if (pathname === '/__live-reload') {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            clients.add(controller)
          },
          cancel(controller) {
            clients.delete(controller)
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      // API proxy
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

      // Serve built JS files
      if (pathname.endsWith('.js') || pathname.endsWith('.js.map')) {
        const file = Bun.file(join(DEV_DIR, pathname))
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache',
            },
          })
        }
        // Return 404 for missing JS files instead of SPA fallback
        return new Response('Not Found', { status: 404 })
      }

      // Handle requests for source files (tsx, ts) - return 404
      if (
        pathname.endsWith('.tsx') ||
        pathname.endsWith('.ts') ||
        pathname.startsWith('/src/')
      ) {
        return new Response(
          'Source files are not served directly. Use the built JavaScript files.',
          { status: 404 },
        )
      }

      // Serve CSS
      if (pathname === '/styles.css') {
        const file = Bun.file(`${DEV_DIR}/styles.css`)
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'text/css',
              'Cache-Control': 'no-cache',
            },
          })
        }
        // Return 404 for missing CSS instead of SPA fallback
        return new Response('Not Found', { status: 404 })
      }

      // Serve public assets (both /public/ and root paths like /assets/)
      if (pathname.startsWith('/public/')) {
        const file = Bun.file(`.${pathname}`)
        if (await file.exists()) {
          return new Response(file)
        }
        // Return 404 for missing public assets instead of SPA fallback
        return new Response('Not Found', { status: 404 })
      }

      // Serve assets from public folder at root path (Next.js convention)
      // e.g., /assets/logos/logo.svg -> ./public/assets/logos/logo.svg
      if (pathname.startsWith('/assets/') || pathname.startsWith('/images/')) {
        const file = Bun.file(`./public${pathname}`)
        if (await file.exists()) {
          const contentType = getContentType(pathname)
          return new Response(file, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache',
            },
          })
        }
        // Return 404 for missing assets instead of SPA fallback
        return new Response('Not Found', { status: 404 })
      }

      // Serve chunks
      if (pathname.startsWith('/chunks/')) {
        const file = Bun.file(join(DEV_DIR, pathname))
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache',
            },
          })
        }
        // Return 404 for missing chunks instead of SPA fallback
        return new Response('Not Found', { status: 404 })
      }

      // SPA fallback - serve index.html for all other routes (HTML routes only)
      return new Response(generateHTML(), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        },
      })
    },
  })

  console.log(`\n🚀 Babylon Web dev server running at http://localhost:${PORT}`)
  console.log(`   📡 API proxy: ${API_URL}`)
  console.log('   🔄 Live reload enabled\n')
}

startServer().catch((error) => {
  console.error('Failed to start dev server:', error)
  process.exit(1)
})
