/**
 * Babylon Web Deployment Script
 *
 * Deploys Babylon Web to DWS infrastructure:
 * 1. Builds frontend
 * 2. Uploads static assets to IPFS/CDN
 * 3. Updates CDN configuration
 *
 * Usage:
 *   bun run deploy              # Deploy to localnet
 *   NETWORK=testnet bun run deploy  # Deploy to testnet
 *   NETWORK=mainnet bun run deploy  # Deploy to mainnet
 */

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'
import { keccak256 } from 'viem'

// Load manifest for deployment config
const manifestPath = join(import.meta.dir, '../jeju-manifest.json')
const manifest = JSON.parse(await Bun.file(manifestPath).text()) as {
  name: string
  version: string
  dws: {
    cdn: {
      domain: string
      staticDir: string
      spa: { enabled: boolean; fallback: string; excludeRoutes: string[] }
      cacheRules: Array<{ pattern: string; ttl: number; immutable?: boolean }>
    }
  }
  deployment: {
    environments: Record<
      string,
      { dwsUrl: string; domain: string; apiUrl: string }
    >
  }
}

// ============================================================================
// Configuration
// ============================================================================

type NetworkType = 'localnet' | 'testnet' | 'mainnet'

interface DeployConfig {
  network: NetworkType
  dwsUrl: string
  domain: string
  apiUrl: string
  cdnEnabled: boolean
}

function getConfig(): DeployConfig {
  const network = (process.env.NETWORK || 'localnet') as NetworkType
  const envConfig = manifest.deployment.environments[network]

  if (!envConfig) {
    throw new Error(`Unknown network: ${network}`)
  }

  return {
    network,
    dwsUrl: process.env.DWS_URL || envConfig.dwsUrl,
    domain: process.env.DOMAIN || envConfig.domain,
    apiUrl: process.env.API_URL || envConfig.apiUrl,
    cdnEnabled: process.env.CDN_ENABLED !== 'false',
  }
}

// ============================================================================
// Build Check
// ============================================================================

async function checkBuild(): Promise<void> {
  const requiredFiles = ['./dist/static/index.html', './dist/deployment.json']

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      console.log('Build not found, running build first...')
      await $`bun run scripts/build.ts`
      return
    }
  }

  console.log('✅ Build found')
}

// ============================================================================
// IPFS Upload
// ============================================================================

interface UploadResult {
  cid: string
  hash: `0x${string}`
  size: number
}

async function uploadToIPFS(
  dwsUrl: string,
  filePath: string,
  name: string,
): Promise<UploadResult> {
  const content = await readFile(filePath)
  const hash = keccak256(content) as `0x${string}`

  const formData = new FormData()
  formData.append('file', new Blob([content]), name)
  formData.append('name', name)

  const response = await fetch(`${dwsUrl}/storage/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${await response.text()}`)
  }

  const data = (await response.json()) as { cid: string }

  return {
    cid: data.cid,
    hash,
    size: content.length,
  }
}

async function uploadDirectory(
  dwsUrl: string,
  dirPath: string,
  prefix: string = '',
): Promise<Map<string, UploadResult>> {
  const results = new Map<string, UploadResult>()
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const key = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const subResults = await uploadDirectory(dwsUrl, fullPath, key)
      for (const [k, v] of subResults) {
        results.set(k, v)
      }
    } else {
      const result = await uploadToIPFS(dwsUrl, fullPath, key)
      results.set(key, result)
      console.log(`   📤 ${key} -> ${result.cid}`)
    }
  }

  return results
}

// ============================================================================
// CDN Setup
// ============================================================================

async function setupCDN(
  config: DeployConfig,
  staticAssets: Map<string, UploadResult>,
): Promise<void> {
  if (!config.cdnEnabled) {
    console.log('   CDN disabled, skipping...')
    return
  }

  // Register static assets with CDN
  const assets = Array.from(staticAssets.entries()).map(([path, result]) => ({
    path: `/${path}`,
    cid: result.cid,
    contentType: getContentType(path),
    immutable:
      path.includes('-') && (path.endsWith('.js') || path.endsWith('.css')),
  }))

  const cdnConfig = {
    name: manifest.name,
    domain: config.domain,
    spa: manifest.dws.cdn.spa,
    assets,
    cacheRules: manifest.dws.cdn.cacheRules,
    // Route API requests to backend
    proxyRoutes: [
      { pattern: '/api/*', target: config.apiUrl },
      { pattern: '/health', target: config.apiUrl },
      { pattern: '/.well-known/*', target: config.apiUrl },
    ],
  }

  const response = await fetch(`${config.dwsUrl}/cdn/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cdnConfig),
  })

  if (!response.ok) {
    console.warn(`   ⚠️ CDN configuration failed: ${await response.text()}`)
  } else {
    console.log('   ✅ CDN configured')
  }
}

function getContentType(path: string): string {
  if (path.endsWith('.js')) return 'application/javascript'
  if (path.endsWith('.css')) return 'text/css'
  if (path.endsWith('.html')) return 'text/html'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.woff2')) return 'font/woff2'
  if (path.endsWith('.woff')) return 'font/woff'
  if (path.endsWith('.ico')) return 'image/x-icon'
  return 'application/octet-stream'
}

// ============================================================================
// JNS Registration (for decentralized domain)
// ============================================================================

async function registerJNS(
  config: DeployConfig,
  indexCid: string,
): Promise<void> {
  if (config.network === 'localnet') {
    console.log('   Skipping JNS registration on localnet')
    return
  }

  const jnsConfig = {
    name: 'babylon.jeju',
    contentHash: `ipfs://${indexCid}`,
    records: {
      url: `https://${config.domain}`,
      description: 'Babylon Social Prediction Platform',
    },
  }

  const response = await fetch(`${config.dwsUrl}/jns/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jnsConfig),
  })

  if (!response.ok) {
    console.warn(`   ⚠️ JNS registration failed: ${await response.text()}`)
  } else {
    console.log('   ✅ JNS registered: babylon.jeju')
  }
}

// ============================================================================
// Main Deploy Function
// ============================================================================

async function deploy(): Promise<void> {
  console.log(`🚀 Deploying ${manifest.name} v${manifest.version} to DWS...\n`)

  const config = getConfig()
  console.log(`📡 Network: ${config.network}`)
  console.log(`🌐 DWS: ${config.dwsUrl}`)
  console.log(`🔗 Domain: ${config.domain}\n`)

  // Check build exists
  await checkBuild()

  // Upload static assets
  console.log('\n📦 Uploading static assets...')
  const staticAssets = await uploadDirectory(config.dwsUrl, './dist/static')
  console.log(`   Total: ${staticAssets.size} files\n`)

  // Setup CDN
  console.log('🌐 Configuring CDN...')
  await setupCDN(config, staticAssets)

  // Register JNS
  console.log('\n📛 Registering JNS...')
  const indexCid = staticAssets.get('index.html')?.cid
  if (indexCid) {
    await registerJNS(config, indexCid)
  }

  // Print summary
  console.log('\n✅ Deployment complete!')
  console.log('\n📍 Endpoints:')
  console.log(`   Frontend: https://${config.domain}`)
  console.log(`   IPFS: ipfs://${indexCid}`)
  console.log(`   API: ${config.apiUrl}`)

  if (config.network !== 'localnet') {
    console.log(`   JNS: babylon.jeju`)
  }

  // Write deployment receipt
  const receipt = {
    name: manifest.name,
    version: manifest.version,
    network: config.network,
    timestamp: new Date().toISOString(),
    domain: config.domain,
    ipfsCid: indexCid,
    apiUrl: config.apiUrl,
    assetCount: staticAssets.size,
  }

  await Bun.write(
    './dist/deployment-receipt.json',
    JSON.stringify(receipt, null, 2),
  )
  console.log('\n📄 Deployment receipt saved to dist/deployment-receipt.json')
}

// Run deployment
deploy().catch((error) => {
  console.error('❌ Deployment failed:', error)
  process.exit(1)
})
