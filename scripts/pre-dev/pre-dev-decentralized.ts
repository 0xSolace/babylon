#!/usr/bin/env bun
/**
 * Pre-Development Setup (Decentralized Mode)
 *
 * Thin wrapper that calls `babylon init --decentralized`.
 * This script is called by `jeju dev` when running Babylon as a vendor app.
 *
 * For full implementation, see: apps/cli/src/commands/init.ts
 */

import { join } from 'node:path'

const BABYLON_ROOT = join(import.meta.dir, '../..')

async function main(): Promise<void> {
  const cliPath = join(BABYLON_ROOT, 'apps/cli/src/index.ts')

  const proc = Bun.spawn(['bun', 'run', cliPath, 'init', '--decentralized'], {
    cwd: BABYLON_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  const exitCode = await proc.exited
  process.exit(exitCode)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
