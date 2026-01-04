#!/usr/bin/env bun
/**
 * Deploy Babylon Backend Worker to DWS
 * 
 * This script:
 * 1. Builds the backend worker bundle
 * 2. Uploads to DWS storage
 * 3. Deploys as a DWS worker
 * 4. Updates the babylon app registration
 * 
 * Usage: 
 *   bun run scripts/deploy-backend-worker.ts --network=testnet
 *   bun run scripts/deploy-backend-worker.ts --network=localnet
 */

import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getCurrentNetwork, getServiceEndpoint } from '@jejunetwork/config'

const NETWORK = process.env.NETWORK ?? process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] ?? getCurrentNetwork()
const DRY_RUN = process.argv.includes('--dry-run')

// DWS endpoints by network
const DWS_ENDPOINTS: Record<string, string> = {
  localnet: 'http://127.0.0.1:4030',
  testnet: 'https://dws.testnet.jejunetwork.org',
  mainnet: 'https://dws.jejunetwork.org',
}

// Get DWS endpoint based on network
function getEndpoint(): string {
  // Check env override first
  if (process.env.DWS_ENDPOINT) return process.env.DWS_ENDPOINT
  
  const endpoint = DWS_ENDPOINTS[NETWORK]
  if (!endpoint) {
    throw new Error(`No DWS endpoint configured for network: ${NETWORK}`)
  }
  return endpoint
}

async function checkHealth(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/health`, { 
      signal: AbortSignal.timeout(5000) 
    })
    return response.ok
  } catch {
    return false
  }
}

async function uploadBundle(endpoint: string, bundlePath: string): Promise<string> {
  console.log('Uploading worker bundle to DWS storage...')
  
  const content = await readFile(bundlePath)
  const stats = await stat(bundlePath)
  console.log(`  Bundle size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  
  if (DRY_RUN) {
    console.log('  [DRY RUN] Would upload bundle')
    return 'dry-run-cid'
  }
  
  const response = await fetch(`${endpoint}/storage/upload/raw?tier=permanent&category=code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/javascript',
      'x-filename': 'babylon-worker.js',
      'x-jeju-address': '0x1234',
    },
    body: content,
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Upload failed: ${response.status} - ${text}`)
  }
  
  const result = await response.json() as { cid: string }
  console.log(`  Uploaded: CID=${result.cid}`)
  return result.cid
}

async function deployWorker(endpoint: string, codeCid: string): Promise<string> {
  console.log('Deploying worker to DWS...')
  
  if (DRY_RUN) {
    console.log('  [DRY RUN] Would deploy worker')
    return 'dry-run-worker-id'
  }
  
  const response = await fetch(`${endpoint}/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-jeju-address': '0x1234',
    },
    body: JSON.stringify({
      name: 'babylon-api',
      codeCid,
      runtime: 'bun',
      handler: 'fetch',
      memory: 512,
      timeout: 60000,
      env: {
        JEJU_NETWORK: NETWORK,
        NETWORK: NETWORK,
        PORT: '5009',
        SQLIT_DATABASE_ID: 'babylon',
        SQLIT_BLOCK_PRODUCER_ENDPOINT: `${endpoint}/sqlit`,
      },
    }),
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Worker deployment failed: ${response.status} - ${text}`)
  }
  
  const result = await response.json() as { functionId: string; codeCid: string }
  console.log(`  Deployed: Worker ID=${result.functionId}`)
  return result.functionId
}

async function updateAppRegistration(endpoint: string, workerId: string): Promise<void> {
  console.log('Updating babylon app registration...')
  
  if (DRY_RUN) {
    console.log('  [DRY RUN] Would update app registration')
    return
  }
  
  // Get existing registration first
  const getResponse = await fetch(`${endpoint}/apps/babylon`)
  const existing = getResponse.ok ? await getResponse.json() as { frontendCid?: string; staticFiles?: Record<string, string> } : null
  
  const response = await fetch(`${endpoint}/apps/babylon`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-jeju-address': '0x1234',
    },
    body: JSON.stringify({
      name: 'babylon',
      jnsName: 'babylon.jeju',
      frontendCid: existing?.frontendCid ?? null,
      staticFiles: existing?.staticFiles ?? null,
      backendEndpoint: `${endpoint}/workers/${workerId}/http`,
      apiPaths: ['/api', '/a2a', '/mcp'],
      spa: true,
      enabled: true,
    }),
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`App registration update failed: ${response.status} - ${text}`)
  }
  
  console.log('  App registration updated')
}

async function main(): Promise<void> {
  console.log('═'.repeat(60))
  console.log('  Babylon Backend Worker Deployment')
  console.log('═'.repeat(60))
  console.log(`  Network: ${NETWORK}`)
  console.log(`  Dry run: ${DRY_RUN}`)
  console.log('')
  
  // Get DWS endpoint
  const endpoint = getEndpoint()
  console.log(`  DWS Endpoint: ${endpoint}`)
  
  // Check health
  console.log('')
  console.log('Checking DWS health...')
  const healthy = await checkHealth(endpoint)
  if (!healthy) {
    console.error('  ERROR: DWS is not responding')
    console.error(`  Endpoint: ${endpoint}`)
    console.error('  Please ensure DWS is running and try again')
    process.exit(1)
  }
  console.log('  DWS is healthy')
  
  // Check if bundle exists
  const bundlePath = resolve(import.meta.dir, '../dist/worker/index.js')
  if (!existsSync(bundlePath)) {
    console.error('  ERROR: Worker bundle not found')
    console.error(`  Expected: ${bundlePath}`)
    console.error('  Run: bun run scripts/esbuild-backend.ts')
    process.exit(1)
  }
  
  // Upload bundle
  console.log('')
  const cid = await uploadBundle(endpoint, bundlePath)
  
  // Deploy worker
  console.log('')
  const workerId = await deployWorker(endpoint, cid)
  
  // Update app registration
  console.log('')
  await updateAppRegistration(endpoint, workerId)
  
  console.log('')
  console.log('═'.repeat(60))
  console.log('  Deployment complete')
  console.log('═'.repeat(60))
  console.log(`  Worker ID: ${workerId}`)
  console.log(`  Code CID: ${cid}`)
  console.log(`  Endpoint: ${endpoint}/workers/${workerId}/http`)
  console.log('')
  console.log('  Test with:')
  console.log(`    curl ${endpoint}/workers/${workerId}/http/api/health`)
  console.log('')
}

main().catch((error) => {
  console.error('Deployment failed:', error.message)
  process.exit(1)
})
