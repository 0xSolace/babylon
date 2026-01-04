#!/usr/bin/env bun

/**
 * Babylon DWS Deployment Script
 *
 * Deploys Babylon to Jeju DWS (Decentralized Web Services):
 * 1. Frontend → IPFS/DWS Storage
 * 2. Backend → DWS Workers (workerd runtime with Bun support)
 * 3. JNS routing setup for babylon.testnet.jejunetwork.org
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

// Network configurations
const NETWORK_CONFIG = {
  localnet: {
    dwsUrl: 'http://localhost:4030',
    storageUrl: 'http://localhost:4030/storage',
    frontendDomain: 'babylon.localnet.jejunetwork.org',
    apiDomain: 'babylon-api.localnet.jejunetwork.org',
  },
  testnet: {
    dwsUrl: 'https://dws.testnet.jejunetwork.org',
    storageUrl: 'https://storage.testnet.jejunetwork.org',
    frontendDomain: 'babylon.testnet.jejunetwork.org',
    apiDomain: 'babylon-api.testnet.jejunetwork.org',
  },
  mainnet: {
    dwsUrl: 'https://dws.jejunetwork.org',
    storageUrl: 'https://storage.jejunetwork.org',
    frontendDomain: 'babylon.jejunetwork.org',
    apiDomain: 'babylon-api.jejunetwork.org',
  },
}

interface DeployConfig {
  network: 'localnet' | 'testnet' | 'mainnet'
  dryRun: boolean
  skipFrontend: boolean
  skipBackend: boolean
}

function parseArgs(): DeployConfig {
  const args = process.argv.slice(2)
  const network =
    args.find((a) => a.startsWith('--network='))?.split('=')[1] || 'localnet'
  const dryRun = args.includes('--dry-run')
  const skipFrontend = args.includes('--skip-frontend')
  const skipBackend = args.includes('--skip-backend')

  if (network !== 'localnet' && network !== 'testnet' && network !== 'mainnet') {
    console.error('Invalid network. Use --network=localnet, --network=testnet or --network=mainnet')
    process.exit(1)
  }

  return { network: network as 'localnet' | 'testnet' | 'mainnet', dryRun, skipFrontend, skipBackend }
}

async function buildFrontend(config: DeployConfig): Promise<string> {
  console.log('\n📦 Building frontend...')

  const webDir = join(process.cwd(), 'apps/web')
  
  // Check if minimal dist exists
  const minimalDist = join(webDir, 'dist-minimal')
  if (existsSync(minimalDist)) {
    console.log('✅ Using minimal frontend build')
    return minimalDist
  }

  const networkConfig = NETWORK_CONFIG[config.network]
  const env = {
    ...process.env,
    NETWORK: config.network,
    VITE_NETWORK: config.network,
    VITE_API_BASE_URL: `https://${networkConfig.apiDomain}`,
    VITE_DOMAIN: networkConfig.frontendDomain,
  }

  const buildProc = Bun.spawn(['bun', 'run', 'build'], {
    cwd: webDir,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await buildProc.exited
  if (exitCode !== 0) {
    throw new Error('Frontend build failed')
  }

  const distDir = join(webDir, 'dist')
  if (!existsSync(distDir)) {
    throw new Error(`Build output not found: ${distDir}`)
  }

  console.log('✅ Frontend built')
  return distDir
}

async function buildBackend(config: DeployConfig): Promise<string> {
  console.log('\n📦 Building backend worker...')

  const workerEntry = join(process.cwd(), 'apps/api/dws-worker-minimal.ts')
  const distDir = join(process.cwd(), 'dist/worker')

  if (!existsSync(workerEntry)) {
    throw new Error(`Worker entry not found: ${workerEntry}`)
  }

  // Clean dist directory
  const { rmSync, mkdirSync } = await import('node:fs')
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true })
  }
  mkdirSync(distDir, { recursive: true })

  // Use Bun.build for proper tree shaking and optimization
  // Only externalize true runtime dependencies (node builtins, bun:sqlite)
  const buildResult = await Bun.build({
    entrypoints: [workerEntry],
    outdir: distDir,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    splitting: false,
    packages: 'bundle', // Bundle all packages for tree shaking
    drop: ['debugger'],
    external: [
      // Only externalize actual runtime dependencies
      'bun:sqlite',
      'node:*',
      // Heavy ML packages that should be loaded separately
      '@tensorflow/*',
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.JEJU_NETWORK': JSON.stringify(config.network),
    },
    naming: {
      entry: 'dws-worker-minimal.js',
    },
  })

  if (!buildResult.success) {
    console.error('Backend build failed:')
    for (const log of buildResult.logs) {
      console.error(log)
    }
    throw new Error('Backend build failed')
  }

  const bundlePath = join(distDir, 'dws-worker-minimal.js')
  if (!existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`)
  }

  // Report bundle sizes
  console.log('\n📊 Backend Bundle Sizes:')
  let totalSize = 0
  for (const output of buildResult.outputs) {
    const size = output.size
    totalSize += size
    const sizeStr = size > 1024 * 1024 
      ? `${(size / (1024 * 1024)).toFixed(2)} MB`
      : `${(size / 1024).toFixed(1)} KB`
    console.log(`   ${sizeStr.padStart(10)}  ${output.kind.padEnd(12)}  ${output.path.split('/').pop()}`)
  }
  console.log(`   ${'─'.repeat(40)}`)
  console.log(`   ${totalSize > 1024 * 1024 ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB` : `${(totalSize / 1024).toFixed(1)} KB`.padStart(10)}  Total`)

  console.log('✅ Backend built')

  return bundlePath
}

async function uploadToIPFS(
  path: string,
  config: DeployConfig,
): Promise<string> {
  console.log(`\n📤 Uploading to IPFS: ${path}`)

  const networkConfig = NETWORK_CONFIG[config.network]
  const storageUrl = networkConfig.storageUrl

  // Read the file and upload via fetch
  const file = Bun.file(path)
  const buffer = await file.arrayBuffer()
  const fileName = path.split('/').pop() || 'file'
  
  const formData = new FormData()
  formData.append('file', new Blob([buffer]), fileName)

  const response = await fetch(
    `${storageUrl}/api/v0/add?pin=true`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${await response.text()}`)
  }

  const result = (await response.json()) as { Hash?: string; cid?: string }
  const cid = result.Hash || result.cid
  if (!cid) {
    throw new Error('No CID in IPFS response')
  }

  console.log(`✅ Uploaded: ${cid}`)
  return cid
}

async function deployFrontendToDWS(
  buildDir: string,
  config: DeployConfig,
): Promise<string> {
  console.log('\n🌐 Deploying frontend to DWS...')

  const networkConfig = NETWORK_CONFIG[config.network]
  const storageUrl = networkConfig.storageUrl

  // Create FormData with all files
  const formData = new FormData()

  async function addFiles(dir: string, basePath = ''): Promise<void> {
    const entries = await Array.fromAsync(
      new Bun.Glob('**/*').scan({ cwd: dir }),
    )

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = await Bun.file(fullPath).exists()
      if (stat) {
        const file = Bun.file(fullPath)
        const relativePath = basePath ? `${basePath}/${entry}` : entry
        formData.append('file', file, relativePath)
      }
    }
  }

  await addFiles(buildDir)

  console.log('   Uploading directory to IPFS...')
  const response = await fetch(
    `${storageUrl}/api/v0/add?wrap-with-directory=true&pin=true`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status}`)
  }

  const text = await response.text()
  const lines = text.trim().split('\n')
  const lastLine = lines[lines.length - 1]
  if (!lastLine) {
    throw new Error('Empty response from IPFS')
  }

  const result = JSON.parse(lastLine) as { Hash?: string; cid?: string }
  const cid = result.Hash || result.cid
  if (!cid) {
    throw new Error('No CID in IPFS response')
  }

  console.log(`✅ Frontend deployed to IPFS: ${cid}`)
  return cid
}

async function registerApp(
  frontendCid: string | null,
  backendWorkerId: string | null,
  config: DeployConfig,
): Promise<void> {
  console.log('\n📋 Registering app with DWS...')

  const networkConfig = NETWORK_CONFIG[config.network]
  const dwsUrl = networkConfig.dwsUrl

  const appName = 'babylon'
  const jnsName = networkConfig.frontendDomain
  const apiJnsName = networkConfig.apiDomain

  const payload = {
    name: appName,
    jnsName: jnsName,
    frontendCid,
    backendWorkerId,
    staticFiles: frontendCid ? { '/': frontendCid } : null,
    backendEndpoint: backendWorkerId
      ? `${dwsUrl}/workers/${backendWorkerId}/http`
      : null,
    apiPaths: ['/api', '/health', '/a2a', '/mcp', '/ws'],
    spa: true,
    enabled: true,
  }

  console.log(`   App: ${appName}`)
  console.log(`   Frontend JNS: ${jnsName}`)
  console.log(`   Frontend CID: ${frontendCid || 'none'}`)
  console.log(`   Backend Worker: ${backendWorkerId || 'none'}`)

  if (config.dryRun) {
    console.log('   [DRY RUN] Would register:', JSON.stringify(payload, null, 2))
    return
  }

  // Use the /deploy/apps endpoint for full app registration
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-jeju-address': '0x0000000000000000000000000000000000000000',
  }
  
  if (config.network === 'localnet') {
    headers['Host'] = 'dws.localnet.jejunetwork.org'
  }

  const response = await fetch(`${dwsUrl}/deploy/apps`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`App registration failed: ${error}`)
  }

  console.log('✅ App registered with DWS')
}

async function deployBackendWorker(
  bundlePath: string,
  config: DeployConfig,
): Promise<string> {
  console.log('\n🔧 Deploying backend worker to DWS...')

  const networkConfig = NETWORK_CONFIG[config.network]
  const dwsUrl = networkConfig.dwsUrl

  console.log('   Deploying worker with code file...')

  if (config.dryRun) {
    console.log('   [DRY RUN] Would deploy worker from', bundlePath)
    return 'dry-run-worker-id'
  }

  // Use FormData to upload the worker code file
  const formData = new FormData()
  const workerFile = Bun.file(bundlePath)
  formData.append('code', workerFile, 'dws-worker.js')
  formData.append('name', 'babylon-api')
  formData.append('runtime', 'bun')
  formData.append('handler', 'fetch')
  formData.append('memory', '512')
  formData.append('timeout', '60000')
  formData.append('routes', JSON.stringify(['/api', '/health', '/a2a', '/mcp', '/ws']))
  formData.append('env', JSON.stringify({
    JEJU_NETWORK: config.network,
    NETWORK: config.network,
  }))

  // For localnet, use Host header to access DWS directly
  const headers: Record<string, string> = {
    'x-jeju-address': '0x0000000000000000000000000000000000000000',
  }
  
  if (config.network === 'localnet') {
    headers['Host'] = 'dws.localnet.jejunetwork.org'
  }

  const response = await fetch(`${dwsUrl}/deploy/worker`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Worker deployment failed: ${response.status} ${error}`)
  }

  const result = (await response.json()) as { functionId: string }
  console.log(`✅ Worker deployed: ${result.functionId}`)

  return result.functionId
}

async function deploy(): Promise<void> {
  const config = parseArgs()

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  BABYLON DWS DEPLOYMENT')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Network:       ${config.network}`)
  console.log(`  Mode:          ${config.dryRun ? 'DRY RUN' : 'DEPLOY'}`)
  console.log('═══════════════════════════════════════════════════════════')

  let frontendCid: string | null = null
  let backendWorkerId: string | null = null

  if (!config.skipFrontend) {
    const buildDir = await buildFrontend(config)
    frontendCid = await deployFrontendToDWS(buildDir, config)
  }

  if (!config.skipBackend) {
    const bundlePath = await buildBackend(config)
    backendWorkerId = await deployBackendWorker(bundlePath, config)
  }

  await registerApp(frontendCid, backendWorkerId, config)

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  DEPLOYMENT COMPLETE')
  console.log('═══════════════════════════════════════════════════════════')

  if (frontendCid) {
    console.log(`  Frontend CID:  ${frontendCid}`)
    console.log(
      `  Frontend URL:  https://babylon.${config.network}.jejunetwork.org`,
    )
  }

  if (backendWorkerId) {
    console.log(`  Backend ID:    ${backendWorkerId}`)
    console.log(
      `  Backend URL:   https://babylon-api.${config.network}.jejunetwork.org`,
    )
  }

  console.log('═══════════════════════════════════════════════════════════')
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:')
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
