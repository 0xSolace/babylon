/**
 * Upload Babylon frontend to DWS Storage
 * 
 * Creates a manifest with file CIDs for the app router to serve.
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DWS_URL = process.env.DWS_URL || 'https://dws.testnet.jejunetwork.org'
const DIST_DIR = join(import.meta.dir, '../apps/web/dist')

type FileEntry = {
  path: string
  cid: string
  size: number
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function uploadFile(filePath: string, relativePath: string, retries = 3): Promise<FileEntry | null> {
  const content = await readFile(filePath)
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const formData = new FormData()
    formData.append('file', new Blob([content]), relativePath)
    formData.append('filename', relativePath)
    
    const response = await fetch(`${DWS_URL}/storage/upload`, {
      method: 'POST',
      body: formData,
    }).catch(() => null)
    
    if (!response) {
      console.error(`Failed to upload ${relativePath}: network error (attempt ${attempt})`)
      if (attempt < retries) await sleep(1000 * attempt)
      continue
    }
    
    if (response.status === 500 || response.status === 503 || response.status === 429) {
      console.error(`Failed to upload ${relativePath}: ${response.status} (attempt ${attempt})`)
      if (attempt < retries) await sleep(2000 * attempt)
      continue
    }
    
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`Failed to upload ${relativePath}: ${response.status} ${text}`)
      return null
    }
    
    const data = await response.json() as { cid: string; size: number }
    console.log(`Uploaded: ${relativePath} -> ${data.cid}`)
    
    return {
      path: relativePath,
      cid: data.cid,
      size: data.size,
    }
  }
  
  console.error(`Failed to upload ${relativePath} after ${retries} attempts`)
  return null
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir))
    } else {
      files.push(fullPath)
    }
  }
  
  return files
}

async function main() {
  console.log(`Uploading frontend from ${DIST_DIR} to ${DWS_URL}`)
  
  const files = await getAllFiles(DIST_DIR)
  console.log(`Found ${files.length} files to upload`)
  
  const manifest: { files: Record<string, string> } = { files: {} }
  const uploaded: FileEntry[] = []
  
  // Upload files in batches of 5 to avoid overwhelming server
  const batchSize = 5
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(file => {
        const relativePath = file.replace(DIST_DIR + '/', '')
        return uploadFile(file, relativePath)
      })
    )
    
    for (const result of results) {
      if (result) {
        uploaded.push(result)
        manifest.files[result.path] = result.cid
      }
    }
    
    console.log(`Progress: ${Math.min(i + batchSize, files.length)}/${files.length}`)
  }
  
  // Upload manifest itself
  const manifestJson = JSON.stringify(manifest, null, 2)
  const manifestBlob = new Blob([manifestJson], { type: 'application/json' })
  const manifestFormData = new FormData()
  manifestFormData.append('file', manifestBlob, 'manifest.json')
  manifestFormData.append('filename', 'manifest.json')
  
  const manifestResponse = await fetch(`${DWS_URL}/storage/upload`, {
    method: 'POST',
    body: manifestFormData,
  })
  
  if (!manifestResponse.ok) {
    console.error('Failed to upload manifest')
    process.exit(1)
  }
  
  const manifestData = await manifestResponse.json() as { cid: string }
  console.log(`\nManifest CID: ${manifestData.cid}`)
  console.log(`Total files: ${uploaded.length}`)
  
  // Save manifest locally
  await writeFile(join(DIST_DIR, '../frontend-manifest.json'), manifestJson)
  
  console.log('\nTo update app registration, run:')
  console.log(`curl -X POST ${DWS_URL}/deploy/apps -H "Content-Type: application/json" -d '${JSON.stringify({
    name: 'babylon',
    frontendCid: manifestData.cid,
    spa: true,
  })}'`)
}

main().catch(console.error)
