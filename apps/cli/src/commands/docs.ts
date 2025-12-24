#!/usr/bin/env bun

/**
 * Docs Command - Generate and manage Babylon documentation
 *
 * Subcommands:
 *   vendors    Pull vendor documentation (bun, cql, elysia)
 *   api        Generate API documentation from routes
 *   all        Generate all documentation
 *
 * Usage:
 *   babylon docs vendors           # Pull all vendor docs
 *   babylon docs vendors --vendor bun  # Pull only Bun docs
 *   babylon docs api               # Generate API docs
 *   babylon docs all               # Generate everything
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getFlag, getOption, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

const BABYLON_ROOT = process.cwd()

type Vendor = 'bun' | 'cql' | 'elysia'

function printHelp(): void {
  console.log(`
Docs Command - Generate and manage documentation

USAGE:
  babylon docs <subcommand> [options]

SUBCOMMANDS:
  vendors     Pull vendor documentation (Bun, CQL, Elysia)
  api         Generate API documentation from routes
  all         Generate all documentation

OPTIONS:
  --vendor <name>   For 'vendors': pull specific vendor only (bun, cql, elysia)
  --output <dir>    Output directory for vendor docs (default: docs/vendors)
  --list            List available vendors

EXAMPLES:
  babylon docs vendors              # Pull all vendor docs
  babylon docs vendors --vendor bun # Pull only Bun docs
  babylon docs api                  # Generate API docs
  babylon docs all                  # Generate everything
`)
}

async function runVendorDocs(args: string[]): Promise<void> {
  const parsed = parseArgs(args)
  const vendor = getOption(parsed, 'vendor', 'v') as Vendor | undefined
  const output = getOption(parsed, 'output', 'o')
  const list = getFlag(parsed, 'list')

  // Dynamic import to avoid loading heavy deps at CLI startup
  const vendorsPath = join(BABYLON_ROOT, 'apps/docs/scripts/vendors/index.ts')

  if (!existsSync(vendorsPath)) {
    logger.fail('Vendor docs scripts not found')
    logger.info(`Expected at: ${vendorsPath}`)
    process.exit(1)
  }

  if (list) {
    const { VENDORS } = (await import(vendorsPath)) as {
      VENDORS: Array<{ name: string; description: string }>
    }
    console.log('Available vendors:')
    for (const v of VENDORS) {
      console.log(`  ${v.name.padEnd(10)} ${v.description}`)
    }
    return
  }

  logger.header('Generating Vendor Documentation')

  const { generateVendorDocs } = (await import(vendorsPath)) as {
    generateVendorDocs: (options?: {
      vendor?: Vendor
      output?: string
    }) => Promise<void>
  }

  await generateVendorDocs({
    vendor,
    output: output || join(BABYLON_ROOT, 'docs/vendors'),
  })

  logger.success('Vendor documentation generated')
}

async function runApiDocs(): Promise<void> {
  logger.header('Generating API Documentation')

  const apiDocsScript = join(
    BABYLON_ROOT,
    'apps/docs/scripts/generate-api-docs.ts',
  )

  if (!existsSync(apiDocsScript)) {
    logger.fail('API docs script not found')
    logger.info(`Expected at: ${apiDocsScript}`)
    process.exit(1)
  }

  const proc = Bun.spawn(['bun', 'run', apiDocsScript], {
    cwd: join(BABYLON_ROOT, 'apps/docs'),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    logger.fail('API docs generation failed')
    process.exit(1)
  }

  logger.success('API documentation generated')
}

async function runAllDocs(args: string[]): Promise<void> {
  logger.header('Generating All Documentation')

  await runVendorDocs(args)
  await runApiDocs()

  logger.success('All documentation generated')
}

export async function runDocsCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    return
  }

  const subcommand = parsed.command

  switch (subcommand) {
    case 'vendors':
    case 'vendor':
      await runVendorDocs(args.slice(1))
      break

    case 'api':
      await runApiDocs()
      break

    case 'all':
      await runAllDocs(args.slice(1))
      break

    case '':
    case undefined:
      // Default to showing help
      printHelp()
      break

    default:
      logger.fail(`Unknown subcommand: ${subcommand}`)
      printHelp()
      process.exit(1)
  }
}
