/**
 * Production build script for Babylon Web
 *
 * Builds static frontend using Bun bundler + Tailwind CSS.
 * Uses jeju-manifest.json for environment configuration.
 *
 * Usage:
 *   bun run scripts/build.ts              # localnet config
 *   NETWORK=testnet bun run scripts/build.ts
 *   NETWORK=mainnet bun run scripts/build.ts
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { $ } from 'bun'

// Load manifest for deployment config
const manifest = await Bun.file('./jeju-manifest.json').json()

// Determine target environment
type NetworkEnv = 'localnet' | 'testnet' | 'mainnet'
const NETWORK = (process.env.NETWORK || 'localnet') as NetworkEnv
const envConfig = manifest.deployment?.environments?.[NETWORK]

if (!envConfig) {
  console.error(`Unknown network: ${NETWORK}`)
  console.error('Available: localnet, testnet, mainnet')
  process.exit(1)
}

console.log(`🌐 Building for: ${NETWORK}`)
console.log(`   API URL: ${envConfig.apiUrl}`)
console.log(`   Domain: ${envConfig.domain}`)

const DIST_DIR = './dist'

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
  // Packages with Node.js-specific code
  '@babylon/agents',
  '@babylon/api',
  '@babylon/db',
  '@babylon/engine',
  '@babylon/messaging',
  '@babylon/training',
  '@babylon/testing',
  // Jeju packages with server-side code
  '@jejunetwork/a2a',
  '@jejunetwork/config',
  '@jejunetwork/db',
  '@jejunetwork/messaging',
  '@jejunetwork/kms',
  '@jejunetwork/mcp',
  '@jejunetwork/messaging',
  '@jejunetwork/auth',
  '@jejunetwork/sdk',
  '@jejunetwork/training',
  // Server-only
  'swagger-ui-react',
  'swagger-jsdoc',
  '@swagger-api/apidom-reference',
]

async function buildCSS(): Promise<void> {
  console.log('\n🎨 Building Tailwind CSS...')

  // Use Tailwind CLI to process CSS
  const result =
    await $`bunx @tailwindcss/cli -i ./src/app/globals.css -o ${DIST_DIR}/assets/styles.css --minify`.quiet()

  if (result.exitCode !== 0) {
    console.error('❌ CSS build failed:')
    console.error(result.stderr.toString())
    throw new Error('CSS build failed')
  }

  console.log('✅ CSS built')
}

async function buildJS(): Promise<string> {
  console.log('\n📦 Building JavaScript...')

  // Note: splitting disabled due to Bun bundler bug causing duplicate exports
  // https://github.com/oven-sh/bun/issues - known issue with code splitting
  // Re-enable when fixed: splitting: true
  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    outdir: `${DIST_DIR}/assets`,
    target: 'browser',
    splitting: false,
    minify: true,
    sourcemap: 'external',
    external: BROWSER_EXTERNALS,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.NETWORK': JSON.stringify(NETWORK),
      'process.env.PUBLIC_API_BASE_URL': JSON.stringify(envConfig.apiUrl),
      'process.env.PUBLIC_WAITLIST_MODE': JSON.stringify(
        process.env.PUBLIC_WAITLIST_MODE || 'false',
      ),
    },
    naming: {
      entry: '[name]-[hash].js',
      chunk: 'chunks/[name]-[hash].js',
      asset: '[name]-[hash].[ext]',
    },
  })

  if (!result.success) {
    console.error('❌ JavaScript build failed:')
    for (const log of result.logs) {
      console.error('Full log:', JSON.stringify(log, null, 2))
    }
    throw new Error('JavaScript build failed')
  }

  // Find the main entry file
  const mainEntry = result.outputs.find((o) => o.kind === 'entry-point')
  const mainFileName = mainEntry ? mainEntry.path.split('/').pop() : 'main.js'

  console.log(`✅ JavaScript built (${result.outputs.length} files)`)
  return mainFileName as string
}

async function createHTML(mainFileName: string): Promise<void> {
  console.log('\n📄 Creating index.html...')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#0D0B14" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#FFFBF7" media="(prefers-color-scheme: light)">
  <title>Babylon - Social Prediction Platform</title>
  <meta name="description" content="Social prediction markets, AI agents, and decentralized social networking.">
  <link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/styles.css">
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
  <script type="module" src="/assets/${mainFileName}"></script>
</body>
</html>`

  await Bun.write(`${DIST_DIR}/index.html`, html)
  console.log('✅ index.html created')
}

async function copyPublicAssets(): Promise<void> {
  console.log('\n📁 Copying public assets...')

  if (existsSync('./public')) {
    // Copy public folder to dist/public (for /public/ paths)
    await cp('./public', `${DIST_DIR}/public`, { recursive: true })

    // Also copy public/assets to dist/assets (for /assets/ paths, Next.js convention)
    if (existsSync('./public/assets')) {
      await cp('./public/assets', `${DIST_DIR}/assets`, { recursive: true })
    }

    // Also copy public/images to dist/images (for /images/ paths)
    if (existsSync('./public/images')) {
      await cp('./public/images', `${DIST_DIR}/images`, { recursive: true })
    }

    console.log('✅ Public assets copied')
  } else {
    console.log('⚠️  No public directory found')
  }
}

async function createDeploymentManifest(): Promise<void> {
  console.log('\n📋 Creating deployment manifest...')

  const deploymentManifest = {
    name: manifest.name,
    version: manifest.version,
    network: NETWORK,
    buildTime: new Date().toISOString(),
    architecture: manifest.architecture,
    endpoints: {
      api: envConfig.apiUrl,
      domain: envConfig.domain,
      dws: envConfig.dwsUrl,
    },
    dws: manifest.dws,
  }

  await Bun.write(
    `${DIST_DIR}/deployment.json`,
    JSON.stringify(deploymentManifest, null, 2),
  )

  console.log('✅ Deployment manifest created')
}

async function build(): Promise<void> {
  console.log('🔨 Building Babylon Web with Bun...\n')
  const startTime = performance.now()

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true })
  }

  // Create directories
  await mkdir(`${DIST_DIR}/assets`, { recursive: true })

  // Build CSS and JS in parallel
  const [, mainFileName] = await Promise.all([buildCSS(), buildJS()])

  // Create HTML and copy assets
  await Promise.all([
    createHTML(mainFileName),
    copyPublicAssets(),
    createDeploymentManifest(),
  ])

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`\n✅ Build complete in ${duration}s`)
  console.log(`   📁 Output: ${DIST_DIR}/`)
  console.log(`   🌐 Target: ${NETWORK} (${envConfig.domain})`)
}

build().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
