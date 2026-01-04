/**
 * Production build script for Babylon Web
 *
 * Builds static frontend using Vite + Tailwind CSS.
 * Uses jeju-manifest.json for environment configuration.
 *
 * Usage:
 *   bun run scripts/build.ts              # localnet config
 *   NETWORK=testnet bun run scripts/build.ts
 *   NETWORK=mainnet bun run scripts/build.ts
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { $ } from 'bun'

// Load manifest for deployment config
const manifest = await Bun.file('./jeju-manifest.json').json()

// Determine target environment
type NetworkEnv = 'localnet' | 'testnet' | 'mainnet'
const NETWORK = (process.env.NETWORK || process.env.VITE_NETWORK || 'localnet') as NetworkEnv
const envConfig = manifest.deployment?.environments?.[NETWORK]

if (!envConfig) {
  console.error(`Unknown network: ${NETWORK}`)
  console.error('Available: localnet, testnet, mainnet')
  process.exit(1)
}

console.log(`🌐 Building for: ${NETWORK}`)
console.log(`   API URL: ${envConfig.apiUrl}`)
console.log(`   Domain: ${envConfig.domain}`)
console.log(`   DWS URL: ${envConfig.dwsUrl}`)

const DIST_DIR = './dist'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function buildJS(): Promise<string> {
  console.log('\n📦 Building JavaScript with Vite...')

  // Set environment variables for Vite build
  process.env.NODE_ENV = 'production'
  process.env.NETWORK = NETWORK
  // Use relative API path for DWS deployment (API served from same domain)
  // Override with PUBLIC_API_BASE_URL env var if needed
  process.env.PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? ''
  process.env.PUBLIC_WAITLIST_MODE = process.env.PUBLIC_WAITLIST_MODE || 'false'

  // Use Vite for production build - better monorepo module resolution
  const viteResult = await $`bunx vite build --outDir ${DIST_DIR}`.quiet()

  if (viteResult.exitCode !== 0) {
    console.error('❌ Vite build failed:')
    console.error(viteResult.stderr.toString())
    throw new Error('Vite build failed')
  }

  // Report bundle sizes
  console.log('\n📊 Frontend Bundle Sizes:')
  const assetsDir = `${DIST_DIR}/assets`
  
  if (existsSync(assetsDir)) {
    const files = readdirSync(assetsDir)
    const jsFiles = files.filter(f => f.endsWith('.js'))
    let totalSize = 0
    
    const fileSizes = jsFiles.map(f => {
      const stat = statSync(`${assetsDir}/${f}`)
      totalSize += stat.size
      return { name: f, size: stat.size }
    }).sort((a, b) => b.size - a.size)
    
    for (const file of fileSizes.slice(0, 10)) {
      console.log(`   ${formatBytes(file.size).padStart(10)}  ${file.name}`)
    }
    
    if (fileSizes.length > 10) {
      const remaining = fileSizes.slice(10)
      const remainingSize = remaining.reduce((sum, f) => sum + f.size, 0)
      console.log(`   ${formatBytes(remainingSize).padStart(10)}  ... and ${remaining.length} more files`)
    }
    
    console.log(`   ${'─'.repeat(50)}`)
    console.log(`   ${formatBytes(totalSize).padStart(10)}  Total JavaScript`)
  }

  // Find the main entry file
  const indexFile = readdirSync(`${DIST_DIR}/assets`)
    .find(f => f.startsWith('index-') && f.endsWith('.js'))
  const mainFileName = indexFile || 'index.js'

  console.log(`✅ JavaScript built`)
  return mainFileName
}

async function verifyHTML(): Promise<void> {
  // Vite generates index.html automatically
  // Just verify it exists
  if (!existsSync(`${DIST_DIR}/index.html`)) {
    throw new Error('Vite did not generate index.html')
  }
  console.log('✅ index.html verified')
}

// Large media directories that should be uploaded to DWS Storage separately
// These are excluded from the bundle to keep deployment size manageable
const EXCLUDED_PUBLIC_DIRS = [
  'images',  // 69MB - actor/org banners (should be CDN)
  'assets',  // 30MB - static assets (should be CDN) 
]

async function copyPublicAssetsFiltered(): Promise<void> {
  console.log('\n📁 Copying public assets (excluding large media)...')

  if (!existsSync('./public')) {
    console.log('⚠️  No public directory found')
    return
  }
  
  // Create dist/public
  await mkdir(`${DIST_DIR}/public`, { recursive: true })
  
  // Copy only essential files, excluding large media dirs
  const entries = readdirSync('./public', { withFileTypes: true })
  let excludedSize = 0
  
  for (const entry of entries) {
    const srcPath = `./public/${entry.name}`
    const destPath = `${DIST_DIR}/public/${entry.name}`
    
    if (entry.isDirectory() && EXCLUDED_PUBLIC_DIRS.includes(entry.name)) {
      // Calculate excluded size
      const stat = await import('node:fs/promises').then(fs => 
        fs.stat(srcPath).catch(() => ({ size: 0 }))
      )
      // Estimate directory size
      const files = readdirSync(srcPath, { recursive: true })
      for (const file of files) {
        try {
          const fileStat = statSync(`${srcPath}/${file}`)
          if (fileStat.isFile()) excludedSize += fileStat.size
        } catch { /* skip */ }
      }
      console.log(`    Skipping ${entry.name}/ (upload separately to DWS Storage)`)
      continue
    }
    
    if (entry.isDirectory()) {
      await cp(srcPath, destPath, { recursive: true })
    } else {
      await cp(srcPath, destPath)
    }
  }
  
  console.log(`✅ Public assets copied (excluded ${formatBytes(excludedSize)} of media)`)
  console.log('   Note: Upload /images and /assets to DWS Storage separately for CDN delivery')
}

async function copyPublicAssets(): Promise<void> {
  await copyPublicAssetsFiltered()
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
  console.log('🔨 Building Babylon Web with Vite...\n')
  const startTime = performance.now()

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true })
  }

  // Build JS (Vite handles CSS too)
  await buildJS()

  // Verify HTML and create manifests
  await Promise.all([
    verifyHTML(),
    copyPublicAssets(),
    createDeploymentManifest(),
  ])

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`\n✅ Build complete in ${duration}s`)
  console.log(`   📁 Output: ${DIST_DIR}/`)
  console.log(`   🌐 Target: ${NETWORK} (${envConfig.domain})`)
}

build()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Build failed:', error)
    process.exit(1)
  })
