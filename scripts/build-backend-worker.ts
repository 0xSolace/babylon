#!/usr/bin/env bun
/**
 * Build script for Babylon Backend Worker
 * 
 * Bundles the full backend into a single file for DWS deployment.
 * Uses Bun's native resolution from monorepo root.
 */

import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dir, '..')
const DIST_DIR = resolve(ROOT_DIR, 'dist/worker')

// Get network from env
const network = process.env.NETWORK ?? process.env.JEJU_NETWORK ?? 'testnet'

// Node.js built-ins to mark as external (for workerd/bun compatibility)
const EXTERNALS = [
  'bun:sqlite',
  'child_process',
  'node:child_process',
  'http2',
  'tls',
  'dgram',
  'net',
  'dns',
  'cluster',
  'fs',
  'path',
  'crypto',
  'http',
  'https',
  'stream',
  'os',
  'url',
  'util',
  'events',
  'buffer',
  'querystring',
  'zlib',
  'assert',
]

async function buildBackendWorker(): Promise<void> {
  console.log(`Building Babylon Backend Worker for ${network}...\n`)

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true })
  }
  await mkdir(DIST_DIR, { recursive: true })

  const entrypoint = resolve(ROOT_DIR, 'apps/api/dws-worker.ts')
  
  console.log(`Entry point: ${entrypoint}`)
  console.log(`Output: ${DIST_DIR}/index.js`)

  // Use Bun's native bundler with simple config
  // Run from monorepo root to leverage workspace resolution
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: DIST_DIR,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    packages: 'bundle',
    external: EXTERNALS,
    drop: ['debugger'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.JEJU_NETWORK': JSON.stringify(network),
      'process.env.NETWORK': JSON.stringify(network),
    },
    naming: {
      entry: 'index.js',
    },
  })

  if (!result.success) {
    console.error('Backend build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error('Backend build failed')
  }

  // Report bundle sizes
  console.log('\n📊 Bundle Sizes:')
  for (const output of result.outputs) {
    const size = Bun.file(output.path).size
    const sizeStr = size > 1024 * 1024 
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(1)} KB`
    console.log(`   ${sizeStr.padStart(10)}  ${output.path.split('/').pop()}`)
  }

  console.log(`\n✅ Backend worker built successfully`)
  console.log(`   Output: ${DIST_DIR}/index.js`)
}

buildBackendWorker().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
