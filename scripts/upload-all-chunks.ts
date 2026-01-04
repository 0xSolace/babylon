/**
 * Upload all frontend JS chunks to DWS storage
 * This uploads all code-split chunks for the Babylon frontend
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const DWS_URL = 'https://dws.testnet.jejunetwork.org'
const DIST_ASSETS = join(import.meta.dir, '../apps/web/dist/assets')

interface UploadResult {
  cid: string
  size: number
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function uploadFile(filepath: string, filename: string, retries = 3): Promise<UploadResult | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const file = Bun.file(filepath)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('filename', filename)

    const response = await fetch(`${DWS_URL}/storage/upload`, {
      method: 'POST',
      headers: {
        'x-jeju-address': '0x0000000000000000000000000000000000000000',
      },
      body: formData,
    })

    if (response.ok) {
      const result = await response.json() as UploadResult
      return result
    }

    if (response.status === 500 && attempt < retries) {
      await sleep(1000 * attempt) // Exponential backoff
      continue
    }
    
    console.error(`Failed to upload ${filename}: ${response.status}`)
    return null
  }
  return null
}

async function main() {
  const files = await readdir(DIST_ASSETS)
  const allJsFiles = files.filter(f => f.endsWith('.js'))
  
  // Load existing static files to skip already uploaded
  const outputPath = join(import.meta.dir, '../apps/web/dist/static-files.json')
  let staticFiles: Record<string, string> = {}
  try {
    const existing = await Bun.file(outputPath).json()
    staticFiles = existing
    console.log(`Loaded ${Object.keys(staticFiles).length} existing files`)
  } catch {
    console.log('No existing static-files.json found')
  }
  
  // Filter out already uploaded files
  const jsFiles = allJsFiles.filter(f => !staticFiles[`assets/${f}`])
  
  console.log(`Found ${jsFiles.length} JS files to upload (${allJsFiles.length - jsFiles.length} already done)`)
  let uploaded = 0
  let failed = 0
  
  // Upload in batches of 5 with delay to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < jsFiles.length; i += batchSize) {
    const batch = jsFiles.slice(i, i + batchSize)
    
    const promises = batch.map(async (file) => {
      const filepath = join(DIST_ASSETS, file)
      const filename = `assets/${file}`
      
      const result = await uploadFile(filepath, filename)
      if (result) {
        staticFiles[filename] = result.cid
        uploaded++
        if (uploaded % 50 === 0) {
          console.log(`Uploaded ${uploaded}/${jsFiles.length} files`)
        }
      } else {
        failed++
      }
    })
    
    await Promise.all(promises)
    
    // Rate limit: wait 100ms between batches
    await sleep(100)
  }
  
  console.log(`\nUpload complete: ${uploaded} succeeded, ${failed} failed`)
  
  // Write the staticFiles JSON
  await Bun.write(outputPath, JSON.stringify(staticFiles, null, 2))
  console.log(`\nstatic files saved to: ${outputPath}`)
}

main().catch(console.error)
