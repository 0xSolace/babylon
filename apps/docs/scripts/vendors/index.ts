#!/usr/bin/env bun
/**
 * Orchestrator for vendor docs generation.
 *
 * Pulls documentation from all configured vendor sources:
 * - Bun: Runtime documentation
 * - CQL: CovenantSQL / Jeju database docs
 * - Elysia: Web framework documentation
 *
 * Usage:
 *   bun run apps/docs/scripts/vendors/index.ts [--vendor <name>] [--output <dir>]
 *
 * Examples:
 *   bun run apps/docs/scripts/vendors/index.ts           # Pull all vendor docs
 *   bun run apps/docs/scripts/vendors/index.ts --vendor bun  # Pull only Bun docs
 */

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pullBunDocs } from './pull-bun-docs'
import { pullCqlDocs } from './pull-cql-docs'
import { pullElysiaDocs } from './pull-elysia-docs'

const rootDir = resolve(import.meta.dir, '../../../..')
const defaultOutput = join(rootDir, 'docs/vendors')

type Vendor = 'bun' | 'cql' | 'elysia'

interface VendorConfig {
  name: Vendor
  description: string
  pull: (outputDir: string) => Promise<{ ok: number; skipped: number }>
}

const VENDORS: VendorConfig[] = [
  {
    name: 'bun',
    description: 'Bun runtime documentation',
    pull: async (output) =>
      pullBunDocs({
        baseUrl: 'https://bun.com',
        sitemapPath: '/docs/sitemap.xml',
        output,
        workers: 16,
      }),
  },
  {
    name: 'cql',
    description: 'CQL / Jeju database documentation',
    pull: async (output) =>
      pullCqlDocs({
        repo: 'jeju-labs/jeju',
        branch: 'main',
        output,
        workers: 16,
        docsPrefix: 'docs/',
      }),
  },
  {
    name: 'elysia',
    description: 'Elysia web framework documentation',
    pull: async (output) =>
      pullElysiaDocs({
        baseUrl: 'https://elysiajs.com',
        output,
        workers: 16,
      }),
  },
]

function getArg(flag: string, fallback: string): string {
  const args = Bun.argv.slice(2)
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) {
    const value = args[idx + 1]
    if (value) return value
  }
  return fallback
}

function hasFlag(flag: string): boolean {
  return Bun.argv.slice(2).includes(flag)
}

function printHelp(): void {
  console.log(`
Vendor Documentation Generator

USAGE:
  bun run apps/docs/scripts/vendors/index.ts [options]

OPTIONS:
  --vendor <name>   Pull docs for specific vendor only (bun, cql, elysia)
  --output <dir>    Output directory (default: docs/vendors)
  --list            List available vendors
  -h, --help        Show this help

VENDORS:
${VENDORS.map((v) => `  ${v.name.padEnd(10)} ${v.description}`).join('\n')}

EXAMPLES:
  bun run apps/docs/scripts/vendors/index.ts             # Pull all
  bun run apps/docs/scripts/vendors/index.ts --vendor bun    # Pull Bun only
  bun run apps/docs/scripts/vendors/index.ts --output ./my-docs
`)
}

export async function generateVendorDocs(options?: {
  vendor?: Vendor
  output?: string
}): Promise<void> {
  const outputRoot = options?.output || defaultOutput
  await mkdir(outputRoot, { recursive: true })

  const vendorsToRun = options?.vendor
    ? VENDORS.filter((v) => v.name === options.vendor)
    : VENDORS

  if (vendorsToRun.length === 0) {
    console.error(`Unknown vendor: ${options?.vendor}`)
    console.log('Available vendors:', VENDORS.map((v) => v.name).join(', '))
    process.exit(1)
  }

  console.log(
    `Pulling documentation for: ${vendorsToRun.map((v) => v.name).join(', ')}`,
  )
  console.log(`Output directory: ${outputRoot}\n`)

  const results: Array<{
    vendor: string
    ok: number
    skipped: number
    error?: string
  }> = []

  for (const vendor of vendorsToRun) {
    const vendorOutput = join(outputRoot, vendor.name)
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${vendor.name.toUpperCase()} - ${vendor.description}`)
    console.log(`${'═'.repeat(60)}\n`)

    try {
      const result = await vendor.pull(vendorOutput)
      results.push({ vendor: vendor.name, ...result })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`Failed to pull ${vendor.name} docs:`, error)
      results.push({ vendor: vendor.name, ok: 0, skipped: 0, error })
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  SUMMARY')
  console.log(`${'═'.repeat(60)}\n`)

  for (const result of results) {
    if (result.error) {
      console.log(`  ❌ ${result.vendor}: ${result.error}`)
    } else {
      console.log(
        `  ✅ ${result.vendor}: ${result.ok} docs pulled, ${result.skipped} skipped`,
      )
    }
  }

  const failures = results.filter((r) => r.error)
  if (failures.length > 0) {
    process.exit(1)
  }
}

if (import.meta.main) {
  if (hasFlag('-h') || hasFlag('--help')) {
    printHelp()
    process.exit(0)
  }

  if (hasFlag('--list')) {
    console.log('Available vendors:')
    for (const v of VENDORS) {
      console.log(`  ${v.name.padEnd(10)} ${v.description}`)
    }
    process.exit(0)
  }

  const vendor = getArg('--vendor', '') as Vendor | ''
  const output = getArg('--output', defaultOutput)

  generateVendorDocs({
    vendor: vendor || undefined,
    output,
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
