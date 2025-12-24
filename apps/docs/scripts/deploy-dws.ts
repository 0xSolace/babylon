#!/usr/bin/env bun

/**
 * Deploy Babylon Docs to DWS (Decentralized Web Services)
 *
 * This script deploys the static documentation to:
 * 1. IPFS via Jeju Storage Service
 * 2. Registers with JNS (Jeju Name Service)
 * 3. Optionally deploys worker to Jeju Compute
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { hasStringProperty, isObject, parseJson, responseJson } from './utils'

// Response types for external APIs
interface IPFSAddResponse {
  Hash: string
}

interface WorkerDeployResponse {
  url: string
}

function isIPFSAddResponse(value: unknown): value is IPFSAddResponse {
  return isObject(value) && hasStringProperty(value, 'Hash')
}

function isWorkerDeployResponse(value: unknown): value is WorkerDeployResponse {
  return isObject(value) && hasStringProperty(value, 'url')
}

function parseIPFSAddResponse(json: unknown): IPFSAddResponse {
  if (!isIPFSAddResponse(json)) {
    throw new Error('Invalid IPFS add response: missing Hash field')
  }
  return json
}

function parseWorkerDeployResponse(json: unknown): WorkerDeployResponse {
  if (!isWorkerDeployResponse(json)) {
    throw new Error('Invalid worker deploy response: missing url field')
  }
  return json
}

const COLORS = {
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
  RESET: '\x1b[0m',
}

// Configuration
const DIST_DIR = join(import.meta.dir, '..', 'dist')
const STORAGE_URL =
  process.env.JEJU_STORAGE_SERVICE_URL || 'http://localhost:5001'
const JNS_URL = process.env.JEJU_JNS_URL || 'http://localhost:4400'
const COMPUTE_URL = process.env.JEJU_COMPUTE_URL || 'http://localhost:4500'
const JNS_NAME = process.env.JNS_NAME || 'docs.babylon.jeju'
const DEPLOY_WORKER = process.env.DEPLOY_WORKER !== 'false'

interface DeploymentResult {
  ipfsCid: string
  jnsName: string
  gatewayUrl: string
  workerUrl?: string
}

async function checkStorageConnection(): Promise<boolean> {
  const response = await fetch(`${STORAGE_URL}/health`).catch(() => null)
  if (!response) {
    return false
  }
  return response.ok
}

async function _uploadToIPFS(filePath: string): Promise<string> {
  const file = Bun.file(filePath)
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${STORAGE_URL}/api/v0/add?pin=true`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload ${filePath}: ${response.statusText}`)
  }

  const json = await responseJson(response)
  const result = parseIPFSAddResponse(json)
  return result.Hash
}

async function uploadDirectory(dir: string): Promise<string> {
  const files: { path: string; content: Blob }[] = []

  function collectFiles(currentDir: string) {
    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        collectFiles(fullPath)
      } else {
        const relativePath = relative(dir, fullPath)
        files.push({
          path: relativePath,
          content: Bun.file(fullPath),
        })
      }
    }
  }

  collectFiles(dir)

  // Upload as a directory
  const formData = new FormData()
  for (const file of files) {
    formData.append('file', file.content, file.path)
  }

  const response = await fetch(
    `${STORAGE_URL}/api/v0/add?pin=true&wrap-with-directory=true`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to upload directory: ${response.statusText}`)
  }

  // Get the root CID from the last line (IPFS returns newline-delimited JSON)
  const text = await response.text()
  const lines = text.trim().split('\n')
  const lastLineText = lines[lines.length - 1]
  if (!lastLineText) {
    throw new Error('Empty response from IPFS add')
  }
  const lastLine = parseIPFSAddResponse(parseJson(lastLineText))
  return lastLine.Hash
}

async function registerJNS(
  name: string,
  contentHash: string,
): Promise<boolean> {
  const response = await fetch(`${JNS_URL}/api/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      contentHash: `ipfs://${contentHash}`,
      ttl: 3600,
    }),
  })

  return response.ok
}

async function deployWorker(): Promise<string | undefined> {
  if (!DEPLOY_WORKER) return undefined

  const workerPath = join(DIST_DIR, 'worker', 'worker.js')
  if (!existsSync(workerPath)) {
    console.log(
      `${COLORS.YELLOW}Worker not found, skipping worker deployment${COLORS.RESET}`,
    )
    return undefined
  }

  const response = await fetch(`${COMPUTE_URL}/api/v1/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'babylon-docs',
      runtime: 'workerd',
      entrypoint: workerPath,
      env: {
        NODE_ENV: 'production',
      },
    }),
  })

  if (!response.ok) {
    console.log(
      `${COLORS.YELLOW}Worker deployment failed: ${response.statusText}${COLORS.RESET}`,
    )
    return undefined
  }

  const json = await responseJson(response)
  const result = parseWorkerDeployResponse(json)
  return result.url
}

async function main() {
  console.log(
    `\n${COLORS.CYAN}=== Babylon Docs DWS Deployment ===${COLORS.RESET}\n`,
  )

  // Check dist directory exists
  if (!existsSync(DIST_DIR)) {
    console.log(
      `${COLORS.RED}Error: dist directory not found. Run 'bun run build' first.${COLORS.RESET}`,
    )
    process.exit(1)
  }

  // Check storage connection
  console.log(`${COLORS.DIM}Checking storage connection...${COLORS.RESET}`)
  const storageOk = await checkStorageConnection()
  if (!storageOk) {
    console.log(
      `${COLORS.RED}Error: Cannot connect to Jeju Storage at ${STORAGE_URL}${COLORS.RESET}`,
    )
    console.log(
      `${COLORS.DIM}Start Jeju: cd /path/to/jeju && bun run dev${COLORS.RESET}`,
    )
    process.exit(1)
  }
  console.log(`${COLORS.GREEN}✓ Storage connected${COLORS.RESET}`)

  // Upload static files to IPFS
  console.log(`\n${COLORS.CYAN}Uploading to IPFS...${COLORS.RESET}`)
  const cid = await uploadDirectory(DIST_DIR)
  console.log(`${COLORS.GREEN}✓ Uploaded: ipfs://${cid}${COLORS.RESET}`)

  // Register with JNS
  console.log(`\n${COLORS.CYAN}Registering with JNS...${COLORS.RESET}`)
  const jnsOk = await registerJNS(JNS_NAME, cid)
  if (jnsOk) {
    console.log(`${COLORS.GREEN}✓ Registered: ${JNS_NAME}${COLORS.RESET}`)
  } else {
    console.log(
      `${COLORS.YELLOW}⚠ JNS registration skipped (service not available)${COLORS.RESET}`,
    )
  }

  // Deploy worker
  let workerUrl: string | undefined
  if (DEPLOY_WORKER) {
    console.log(`\n${COLORS.CYAN}Deploying worker...${COLORS.RESET}`)
    workerUrl = await deployWorker()
    if (workerUrl) {
      console.log(
        `${COLORS.GREEN}✓ Worker deployed: ${workerUrl}${COLORS.RESET}`,
      )
    }
  }

  // Output summary
  const result: DeploymentResult = {
    ipfsCid: cid,
    jnsName: JNS_NAME,
    gatewayUrl: `${STORAGE_URL}/ipfs/${cid}`,
    workerUrl,
  }

  console.log(`\n${COLORS.GREEN}=== Deployment Complete ===${COLORS.RESET}\n`)
  console.log('IPFS CID:', result.ipfsCid)
  console.log('JNS Name:', result.jnsName)
  console.log('Gateway URL:', result.gatewayUrl)
  if (result.workerUrl) {
    console.log('Worker URL:', result.workerUrl)
  }
  console.log('')

  // Save deployment info
  const deploymentInfo = {
    ...result,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  }

  await Bun.write(
    join(DIST_DIR, 'deployment.json'),
    JSON.stringify(deploymentInfo, null, 2),
  )
  console.log(
    `${COLORS.DIM}Saved deployment info to dist/deployment.json${COLORS.RESET}`,
  )
}

main().catch((err) => {
  console.error(`${COLORS.RED}Error: ${err.message}${COLORS.RESET}`)
  process.exit(1)
})
