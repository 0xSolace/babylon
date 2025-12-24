#!/usr/bin/env bun

/**
 * Init Command - Initialize Babylon development environment
 *
 * Creates .env.local from template if it doesn't exist.
 * Optionally sets up decentralized environment with Jeju services.
 *
 * Usage:
 *   babylon init                  # Create .env.local from template
 *   babylon init --force          # Overwrite existing .env.local
 *   babylon init --decentralized  # Setup for decentralized mode
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

const BABYLON_ROOT = process.cwd()
const CLI_ROOT = dirname(dirname(dirname(import.meta.path)))

// Port configuration for decentralized services
const IPFS_PORT = process.env.IPFS_API_PORT ?? '5001'
const CQL_PORT = process.env.CQL_PORT ?? '4661'
const CACHE_PORT = process.env.JEJU_CACHE_PORT ?? '4115'
const OAUTH3_PORT = process.env.JEJU_OAUTH3_PORT ?? '5011'
const KMS_PORT = process.env.JEJU_KMS_PORT ?? '5012'
const L2_RPC_PORT = process.env.L2_RPC_PORT ?? '6545'
const API_PORT = process.env.API_PORT ?? '5007'

// Jeju service defaults
const JEJU_DEFAULTS = {
  CQL_BLOCK_PRODUCER_ENDPOINT: `http://localhost:${CQL_PORT}`,
  JEJU_CACHE_SERVICE_URL: `http://localhost:${CACHE_PORT}`,
  JEJU_STORAGE_SERVICE_URL: `http://localhost:${IPFS_PORT}`,
  JEJU_OAUTH3_SERVICE_URL: `http://localhost:${OAUTH3_PORT}`,
  JEJU_KMS_ENDPOINT: `http://localhost:${KMS_PORT}`,
  CQL_DATABASE_ID: 'babylon-dev',
  JEJU_NETWORK: 'localnet',
  JEJU_RPC_URL: `http://localhost:${L2_RPC_PORT}`,
  L2_RPC_URL: `http://localhost:${L2_RPC_PORT}`,
  JEJU_KMS_SERVICE_URL: `http://localhost:${KMS_PORT}`,
} as const

interface InitOptions {
  force: boolean
  decentralized: boolean
}

interface ServiceStatus {
  name: string
  url: string
  healthy: boolean
  required: boolean
}

function printHelp(): void {
  console.log(`
Init Command - Initialize Babylon development environment

USAGE:
  babylon init [options]

OPTIONS:
  --force           Overwrite existing .env.local
  --decentralized   Setup for decentralized mode with Jeju services

DESCRIPTION:
  Creates a .env.local file from the template with sensible defaults
  for local development. This command is automatically called by
  'babylon dev' if .env.local doesn't exist.

  With --decentralized, also configures environment for Jeju
  decentralized services (CQL, Cache, IPFS, OAuth3).

EXAMPLES:
  babylon init                  # Create .env.local if it doesn't exist
  babylon init --force          # Recreate .env.local from template
  babylon init --decentralized  # Setup for decentralized mode
`)
}

/**
 * Ensures .env.local exists, creating it from template if needed.
 * Returns true if file was created, false if it already existed.
 */
export async function ensureEnvLocal(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const envLocalPath = join(BABYLON_ROOT, '.env.local')
  const templatePath = join(CLI_ROOT, 'env.template')

  // Check if .env.local already exists
  if (existsSync(envLocalPath) && !options.force) {
    return false
  }

  // Check template exists
  if (!existsSync(templatePath)) {
    logger.fail(`Template not found: ${templatePath}`)
    throw new Error('env.template not found in CLI package')
  }

  // Read template
  const template = await Bun.file(templatePath).text()

  // Write .env.local
  await Bun.write(envLocalPath, template)

  return true
}

async function checkService(
  name: string,
  url: string,
  healthPath: string,
  required: boolean,
): Promise<ServiceStatus> {
  try {
    if (!healthPath) {
      // RPC endpoint - use JSON-RPC health check
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      })
      return { name, url, healthy: response.ok, required }
    }

    const method = healthPath.includes('/api/v0') ? 'POST' : 'GET'
    const response = await fetch(`${url}${healthPath}`, {
      method,
      signal: AbortSignal.timeout(5000),
    })
    return { name, url, healthy: response.ok, required }
  } catch {
    return { name, url, healthy: false, required }
  }
}

function updateEnvForJeju(): void {
  const envPath = join(BABYLON_ROOT, '.env')
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

  const updates: Record<string, string> = {}

  const defaults = JEJU_DEFAULTS as Record<string, string>
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key] && !envContent.includes(`${key}=`)) {
      updates[key] = value
    }
  }

  if (Object.keys(updates).length > 0) {
    const newLines = Object.entries(updates)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n')

    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n'
    }
    envContent += `\n# Jeju Decentralized Services (auto-configured)\n${newLines}\n`
    writeFileSync(envPath, envContent)

    logger.success('Updated .env with Jeju service defaults')

    for (const [k, v] of Object.entries(updates)) {
      process.env[k] = v
    }
  }
}

async function waitForServices(maxWaitMs = 120000): Promise<boolean> {
  logger.step('Waiting for Jeju services...')

  const startTime = Date.now()
  const requiredServices = [
    {
      name: 'CQL Database',
      url: JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT,
      path: '/health',
    },
    {
      name: 'Cache',
      url: JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL,
      path: '/health',
    },
  ]

  while (Date.now() - startTime < maxWaitMs) {
    const statuses = await Promise.all(
      requiredServices.map((s) => checkService(s.name, s.url, s.path, true)),
    )

    const allHealthy = statuses.every((s) => s.healthy)
    if (allHealthy) {
      logger.success('All required Jeju services are ready')
      return true
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const unhealthy = statuses.filter((s) => !s.healthy).map((s) => s.name)
    process.stdout.write(
      `\r  [${elapsed}s] Waiting for: ${unhealthy.join(', ')}...          `,
    )

    await new Promise((r) => setTimeout(r, 2000))
  }

  console.log('')
  return false
}

async function initializeCQLSchema(): Promise<void> {
  logger.step('Initializing CQL database schema...')

  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT ||
    JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT
  const databaseId =
    process.env.CQL_DATABASE_ID || JEJU_DEFAULTS.CQL_DATABASE_ID

  try {
    // Import from @babylon/db
    const { generateAllDDL } = await import('@babylon/db')
    const ddlStatements = generateAllDDL()

    let created = 0
    let skipped = 0

    for (const ddl of ddlStatements) {
      const response = await fetch(`${endpoint}/api/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: databaseId,
          type: 'exec',
          sql: ddl,
          params: [],
          timestamp: Date.now(),
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        created++
      } else {
        const text = await response.text()
        if (text.includes('already exists')) {
          skipped++
        }
      }
    }

    logger.success(
      `CQL schema ready (${created} created, ${skipped} already exist)`,
    )
  } catch (err) {
    logger.warn(`Schema initialization skipped: ${(err as Error).message}`)
  }
}

async function checkServiceStatus(): Promise<void> {
  logger.step('Service Status:')

  const services = await Promise.all([
    checkService(
      'CQL Database',
      JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT,
      '/health',
      true,
    ),
    checkService(
      'Cache',
      JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL,
      '/health',
      true,
    ),
    checkService(
      'Storage (IPFS)',
      JEJU_DEFAULTS.JEJU_STORAGE_SERVICE_URL,
      '/api/v0/id',
      false,
    ),
    checkService('L2 RPC', JEJU_DEFAULTS.JEJU_RPC_URL, '', false),
  ])

  for (const service of services) {
    const icon = service.healthy ? '✓' : service.required ? '✗' : '○'
    const color = service.healthy
      ? '\x1b[32m'
      : service.required
        ? '\x1b[31m'
        : '\x1b[33m'
    const reset = '\x1b[0m'
    console.log(
      `    ${color}${icon}${reset} ${service.name} ${reset}${service.url}`,
    )
  }
}

/**
 * Initialize decentralized environment with Jeju services.
 * This is called by `jeju dev` when running Babylon as a vendor app.
 */
export async function initDecentralized(): Promise<void> {
  logger.header('Babylon Decentralized Setup')

  const isJejuDev = !!process.env.JEJU_RPC_URL || !!process.env.L2_RPC_URL

  if (isJejuDev) {
    logger.info('Running under Jeju dev environment')
  } else {
    logger.warn('Standalone mode - ensure Jeju services are running')
    logger.info('Start with: cd /path/to/jeju && bun run dev')
  }

  // Update .env with Jeju defaults
  updateEnvForJeju()

  // Quick check if services are already running
  const quickCheck = await Promise.all([
    checkService(
      'CQL',
      JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT,
      '/health',
      true,
    ),
    checkService(
      'Cache',
      JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL,
      '/health',
      true,
    ),
  ])
  const servicesRunning = quickCheck.every((s) => s.healthy)

  if (!servicesRunning && !isJejuDev) {
    logger.warn('Services not running - please start Jeju infrastructure')
    logger.info('Run: cd /path/to/jeju && bun run dev')
  }

  // Wait for services
  const servicesReady = await waitForServices()

  if (!servicesReady) {
    logger.fail('Required Jeju services not available')
    logger.info('Please start Jeju: cd /path/to/jeju && bun run dev')
    process.exit(1)
  }

  await checkServiceStatus()
  await initializeCQLSchema()

  logger.success('Babylon Decentralized Ready')
  console.log('')
  console.log('Services:')
  console.log(`  CQL:     ${JEJU_DEFAULTS.CQL_BLOCK_PRODUCER_ENDPOINT}`)
  console.log(`  Cache:   ${JEJU_DEFAULTS.JEJU_CACHE_SERVICE_URL}`)
  console.log(`  Storage: ${JEJU_DEFAULTS.JEJU_STORAGE_SERVICE_URL}`)
  console.log('')
  console.log('App:')
  console.log(`  Web:     http://localhost:${API_PORT}`)
  console.log('')
}

export async function runInitCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    return
  }

  const options: InitOptions = {
    force: getFlag(parsed, 'force'),
    decentralized: getFlag(parsed, 'decentralized'),
  }

  if (options.decentralized) {
    await initDecentralized()
    return
  }

  logger.header('Initializing Babylon')

  const created = await ensureEnvLocal({ force: options.force })

  if (created) {
    logger.success('Created .env.local from template')
    logger.info('')
    logger.info('Next steps:')
    logger.info('  1. Edit .env.local with your API keys')
    logger.info('  2. Run: babylon dev')
  } else {
    logger.info('.env.local already exists (use --force to overwrite)')
  }
}
