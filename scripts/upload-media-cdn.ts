#!/usr/bin/env bun
/**
 * Upload Babylon media assets to DWS Storage (CDN)
 *
 * Uploads large media files (images, assets) separately from the main frontend bundle.
 * These are served from IPFS/CDN for better performance and to keep worker bundles small.
 *
 * Usage:
 *   bun run scripts/upload-media-cdn.ts
 *   NETWORK=testnet bun run scripts/upload-media-cdn.ts
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Network configurations
const NETWORK_CONFIG = {
  localnet: {
    storageUrl: 'http://localhost:4030/storage',
    cdnUrl: 'http://localhost:4030/ipfs',
  },
  testnet: {
    storageUrl: 'https://storage.testnet.jejunetwork.org',
    cdnUrl: 'https://ipfs.testnet.jejunetwork.org',
  },
  mainnet: {
    storageUrl: 'https://storage.jejunetwork.org',
    cdnUrl: 'https://ipfs.jejunetwork.org',
  },
}

type NetworkType = 'localnet' | 'testnet' | 'mainnet'
const NETWORK = (process.env.NETWORK || 'localnet') as NetworkType
const config = NETWORK_CONFIG[NETWORK]

const PUBLIC_DIR = join(import.meta.dir, '../apps/web/public')

// Directories to upload to CDN (excluded from main bundle)
const MEDIA_DIRS = ['images', 'assets']

interface UploadResult {
  path: string
  cid: string
  size: number
}

interface MediaManifest {
  network: NetworkType
  cdnUrl: string
  uploadedAt: string
  directories: Record<
    string,
    {
      cid: string
      fileCount: number
      totalSize: number
    }
  >
  files: Record<string, string> // path -> cid
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function uploadFile(
  filePath: string,
  relativePath: string,
  retries = 3,
): Promise<UploadResult | null> {
  const content = await readFile(filePath)

  for (let attempt = 1; attempt <= retries; attempt++) {
    const formData = new FormData()
    formData.append('file', new Blob([content]), relativePath)

    const response = await fetch(`${config.storageUrl}/api/v0/add?pin=true`, {
      method: 'POST',
      body: formData,
    }).catch(() => null)

    if (!response) {
      if (attempt < retries) {
        console.error(
          `   Retry ${attempt}/${retries}: ${relativePath} (network error)`,
        )
        await sleep(1000 * attempt)
        continue
      }
      console.error(`   Failed: ${relativePath} (network error)`)
      return null
    }

    if (response.status >= 500 || response.status === 429) {
      if (attempt < retries) {
        console.error(
          `   Retry ${attempt}/${retries}: ${relativePath} (${response.status})`,
        )
        await sleep(2000 * attempt)
        continue
      }
      console.error(`   Failed: ${relativePath} (${response.status})`)
      return null
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`   Failed: ${relativePath} - ${response.status} ${text}`)
      return null
    }

    const result = (await response.json()) as { Hash?: string; cid?: string }
    const cid = result.Hash || result.cid
    if (!cid) {
      console.error(`   Failed: ${relativePath} - no CID in response`)
      return null
    }

    return {
      path: relativePath,
      cid,
      size: content.length,
    }
  }

  return null
}

async function uploadDirectory(dirName: string): Promise<{
  files: UploadResult[]
  dirCid: string | null
}> {
  const dirPath = join(PUBLIC_DIR, dirName)
  if (!existsSync(dirPath)) {
    console.log(`   Skipping ${dirName}/ (not found)`)
    return { files: [], dirCid: null }
  }

  console.log(`\n📁 Uploading ${dirName}/...`)

  // Get all files recursively
  const allFiles: string[] = []
  const scan = (dir: string, base: string) => {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = join(base, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath, relPath)
      } else {
        allFiles.push(relPath)
      }
    }
  }
  scan(dirPath, '')

  console.log(`   Found ${allFiles.length} files`)

  const results: UploadResult[] = []
  let totalSize = 0
  let failed = 0

  // Upload in batches
  const batchSize = 5
  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((relativePath) => {
        const fullPath = join(dirPath, relativePath)
        return uploadFile(fullPath, `${dirName}/${relativePath}`)
      }),
    )

    for (const result of batchResults) {
      if (result) {
        results.push(result)
        totalSize += result.size
      } else {
        failed++
      }
    }

    const progress = Math.min(i + batchSize, allFiles.length)
    process.stdout.write(`\r   Progress: ${progress}/${allFiles.length}`)
    await sleep(100) // Small delay between batches
  }

  console.log(`\n   Uploaded: ${results.length} files (${formatBytes(totalSize)})`)
  if (failed > 0) {
    console.log(`   Failed: ${failed} files`)
  }

  // Upload directory as a whole for a root CID
  let dirCid: string | null = null
  try {
    const formData = new FormData()

    // Add all files to form data for directory upload
    for (const result of results) {
      const filePath = join(PUBLIC_DIR, result.path)
      const content = await readFile(filePath)
      formData.append('file', new Blob([content]), result.path)
    }

    const response = await fetch(
      `${config.storageUrl}/api/v0/add?wrap-with-directory=true&pin=true`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (response.ok) {
      const text = await response.text()
      const lines = text.trim().split('\n')
      const lastLine = lines[lines.length - 1]
      if (lastLine) {
        const parsed = JSON.parse(lastLine) as { Hash?: string; cid?: string }
        dirCid = parsed.Hash || parsed.cid || null
        if (dirCid) {
          console.log(`   Directory CID: ${dirCid}`)
        }
      }
    }
  } catch {
    console.log('   Note: Could not get directory CID (individual files still uploaded)')
  }

  return { files: results, dirCid }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  BABYLON MEDIA CDN UPLOAD')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Network:     ${NETWORK}`)
  console.log(`  Storage URL: ${config.storageUrl}`)
  console.log(`  CDN URL:     ${config.cdnUrl}`)
  console.log('═══════════════════════════════════════════════════════════')

  const manifest: MediaManifest = {
    network: NETWORK,
    cdnUrl: config.cdnUrl,
    uploadedAt: new Date().toISOString(),
    directories: {},
    files: {},
  }

  let totalFiles = 0
  let totalSize = 0

  for (const dir of MEDIA_DIRS) {
    const { files, dirCid } = await uploadDirectory(dir)

    if (files.length > 0) {
      const dirSize = files.reduce((sum, f) => sum + f.size, 0)
      manifest.directories[dir] = {
        cid: dirCid || 'individual-files',
        fileCount: files.length,
        totalSize: dirSize,
      }

      for (const file of files) {
        manifest.files[file.path] = file.cid
      }

      totalFiles += files.length
      totalSize += dirSize
    }
  }

  // Save manifest
  const manifestPath = join(PUBLIC_DIR, '../media-cdn-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  UPLOAD COMPLETE')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Total Files: ${totalFiles}`)
  console.log(`  Total Size:  ${formatBytes(totalSize)}`)
  console.log(`  Manifest:    ${manifestPath}`)
  console.log('═══════════════════════════════════════════════════════════')

  // Show example URLs
  if (totalFiles > 0) {
    const firstFile = Object.entries(manifest.files)[0]
    if (firstFile) {
      console.log('\nExample CDN URLs:')
      console.log(`  ${config.cdnUrl}/${firstFile[1]}`)
    }
  }

  console.log('\nMedia files are now available on CDN.')
  console.log('Frontend can reference them via CDN URLs or relative paths.')
}

main().catch((error) => {
  console.error('\nUpload failed:', error)
  process.exit(1)
})
