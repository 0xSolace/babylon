/**
 * Upload essential Babylon frontend files to DWS Storage
 * 
 * Only uploads files required for the app to load (JS, CSS, HTML)
 * Images and other assets load from relative paths in the deployed app
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

// Only upload essential file types
const ESSENTIAL_EXTENSIONS = ['.html', '.js', '.css', '.json', '.svg', '.ico', '.woff', '.woff2', '.ttf']

function isEssentialFile(path: string): boolean {
  // Always include index.html
  if (path === 'index.html') return true
  
  // Include all files in assets/ that are JS or CSS
  if (path.startsWith('assets/') && (path.endsWith('.js') || path.endsWith('.css'))) return true
  
  // Include fonts
  if (ESSENTIAL_EXTENSIONS.some(ext => path.endsWith(ext))) return true
  
  return false
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
  console.log(`Uploading essential frontend files from ${DIST_DIR} to ${DWS_URL}`)
  
  const allFiles = await getAllFiles(DIST_DIR)
  const files = allFiles.filter(file => {
    const relativePath = file.replace(DIST_DIR + '/', '')
    return isEssentialFile(relativePath)
  })
  
  console.log(`Found ${files.length} essential files to upload (out of ${allFiles.length} total)`)
  
  const manifest: { files: Record<string, string> } = { files: {} }
  const uploaded: FileEntry[] = []
  let failed = 0
  
  // Upload files in batches of 3 (conservative to avoid rate limiting)
  const batchSize = 3
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
      } else {
        failed++
      }
    }
    
    console.log(`Progress: ${Math.min(i + batchSize, files.length)}/${files.length}`)
    
    // Small delay between batches
    await sleep(500)
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
  console.log(`Failed files: ${failed}`)
  
  // Save manifest locally
  await writeFile(join(DIST_DIR, '../frontend-manifest.json'), manifestJson)
  
  // Update app registration
  console.log('\nUpdating app registration...')
  const appResponse = await fetch(`${DWS_URL}/deploy/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'babylon',
      frontendCid: manifestData.cid,
      backendWorkerId: 'babylon-backend',
      apiPaths: ['/api', '/health', '/.well-known'],
      spa: true,
    }),
  })
  
  if (appResponse.ok) {
    const appData = await appResponse.json()
    console.log('App registration updated:', JSON.stringify(appData, null, 2))
  } else {
    const text = await appResponse.text()
    console.error(`Failed to update app registration: ${appResponse.status} ${text}`)
  }
}

main().catch(console.error)
