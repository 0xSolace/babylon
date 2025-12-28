/**
 * Test Infrastructure Setup
 *
 * Orchestrates Jeju service startup and test environment setup.
 * All services are managed by Jeju CLI - no Docker Compose fallback.
 *
 * Prerequisites:
 * - Jeju CLI installed: cd /path/to/jeju && bun install
 * - Services running: cd /path/to/jeju && bun run dev
 *
 * Test Modes:
 * 1. Unit tests: No infrastructure needed (mocks)
 * 2. Integration tests: Postgres + Redis + Hardhat (via Jeju)
 * 3. E2E tests: Full stack including web server
 * 4. Decentralized tests: Full Jeju stack (EQLite, KMS, OAuth3, etc.)
 *
 * Usage:
 *   bun run packages/testing/infrastructure/setup.ts --mode=integration --deploy
 *   bun run packages/testing/infrastructure/setup.ts --mode=e2e --network=localnet
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { checkMessagingContracts, ensureContractsDeployed } from './contracts'
import {
  checkAllServices,
  checkCoreServices,
  checkJejuServices,
  type InfrastructureStatus,
  isJejuRunning,
  printStatus,
} from './health-check'

export type TestMode = 'unit' | 'integration' | 'e2e' | 'decentralized' | 'all'
export type NetworkMode = 'localnet' | 'testnet'

const TEST_MODES: readonly TestMode[] = [
  'unit',
  'integration',
  'e2e',
  'decentralized',
  'all',
]

const NETWORK_MODES: readonly NetworkMode[] = ['localnet', 'testnet']

function isTestMode(value: string): value is TestMode {
  return (TEST_MODES as readonly string[]).includes(value)
}

function isNetworkMode(value: string): value is NetworkMode {
  return (NETWORK_MODES as readonly string[]).includes(value)
}

function parseTestMode(value: string | undefined): TestMode {
  if (value && isTestMode(value)) {
    return value
  }
  return 'integration'
}

function parseNetworkMode(value: string | undefined): NetworkMode {
  if (value && isNetworkMode(value)) {
    return value
  }
  return 'localnet'
}

// Jeju root is two directories up from vendor/babylon
const JEJU_ROOT = join(process.cwd(), '..', '..')

/**
 * Start Jeju services if not already running
 */
async function ensureJejuRunning(maxWaitSeconds = 120): Promise<boolean> {
  const running = await isJejuRunning()
  if (running) {
    console.log('[Setup] Jeju services already running')
    return true
  }

  console.log('[Setup] Starting Jeju services...')
  console.log(`[Setup] Jeju root: ${JEJU_ROOT}`)

  // Start jeju dev in background
  const jejuCliPath = join(JEJU_ROOT, 'packages/cli/src/index.ts')
  if (!existsSync(jejuCliPath)) {
    console.error(`[Setup] Jeju CLI not found at ${jejuCliPath}`)
    return false
  }

  // Start the services
  Bun.spawn(['bun', 'run', jejuCliPath, 'dev'], {
    cwd: JEJU_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  // Wait for services to be ready
  console.log(`[Setup] Waiting up to ${maxWaitSeconds}s for services...`)
  for (let i = 0; i < maxWaitSeconds; i += 5) {
    await new Promise((r) => setTimeout(r, 5000))
    const ready = await isJejuRunning()
    if (ready) {
      console.log(`[Setup] Services ready after ${i + 5}s`)
      return true
    }
    if (i % 15 === 0) {
      console.log(`[Setup] Still waiting... (${i}s elapsed)`)
    }
  }

  console.error('[Setup] Timeout waiting for Jeju services')
  return false
}

/**
 * Wait for EQLite database to be ready and initialized
 */
async function waitForEQLite(maxAttempts = 30): Promise<boolean> {
  const eqliteEndpoint =
    process.env.EQLITE_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4661'
  console.log(`[Setup] Waiting for EQLite at ${eqliteEndpoint}...`)

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${eqliteEndpoint}/v1/health`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null)

    if (response?.ok) {
      console.log('[Setup] EQLite is ready')
      return true
    }

    await new Promise((r) => setTimeout(r, 2000))
  }

  console.warn('[Setup] EQLite did not become ready in time')
  return false
}

/**
 * Initialize database with required tables and seed data
 */
async function initializeDatabase(): Promise<boolean> {
  try {
    const { initializeDatabase: initDb } = await import('@babylon/db')
    await initDb()
    console.log('[Setup] Database initialized')
    return true
  } catch (error) {
    console.error('[Setup] Database initialization failed:', error)
    return false
  }
}

/**
 * Seed database with test data
 */
async function seedDatabase(): Promise<boolean> {
  try {
    const seedScript = join(process.cwd(), 'apps/cli/src/commands/db.ts')
    if (existsSync(seedScript)) {
      const result = await $`bun run ${seedScript} seed --quiet`
        .quiet()
        .nothrow()
      if (result.exitCode === 0) {
        console.log('[Setup] Database seeded')
        return true
      }
    }
    // Alternative: use GameBootstrapService directly
    const { GameBootstrapService } = await import('@babylon/engine')
    const bootstrap = new GameBootstrapService()
    await bootstrap.bootstrapAll()
    console.log('[Setup] Database seeded via GameBootstrapService')
    return true
  } catch (error) {
    console.warn(
      '[Setup] Database seeding failed (may already be seeded):',
      error,
    )
    return false
  }
}

interface SetupOptions {
  testMode: TestMode
  network: NetworkMode
  deployContracts: boolean
  skipHealthCheck: boolean
  timeout: number
}

const DEFAULT_OPTIONS: SetupOptions = {
  testMode: 'integration',
  network: 'localnet',
  deployContracts: false,
  skipHealthCheck: false,
  timeout: 120000, // 2 minutes
}

/**
 * Parse environment file and return key-value pairs
 * @param envPath - Path to env file (defaults to .env in cwd)
 */
export function parseEnvFile(
  envPath = join(process.cwd(), '.env'),
): Record<string, string> {
  if (!existsSync(envPath)) return {}

  const content = readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=').replace(/^["']|["']$/g, '')
      }
    }
  }

  return env
}

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      `${Object.entries(updates)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')}\n`,
    )
    return
  }

  let content = readFileSync(envPath, 'utf-8')

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
    } else {
      content += `\n${key}=${value}`
    }
  }

  writeFileSync(envPath, content)
}

export async function setupTestInfrastructure(
  options: Partial<SetupOptions> = {},
): Promise<{
  healthy: boolean
  services: InfrastructureStatus
  contractsDeployed: boolean
  dbInitialized: boolean
  dbSeeded: boolean
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`JEJU TEST INFRASTRUCTURE (${opts.network}, ${opts.testMode})`)
  console.log(`${'═'.repeat(60)}\n`)

  // Load environment
  const env = parseEnvFile()
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }

  // Set test environment
  process.env.NODE_ENV = 'test'
  process.env.BUN_ENV = 'test'

  // Set required environment variables if not present
  if (!process.env.EQLITE_BLOCK_PRODUCER_ENDPOINT) {
    process.env.EQLITE_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4661'
  }
  if (!process.env.JEJU_DWS_ENDPOINT) {
    process.env.JEJU_DWS_ENDPOINT = 'http://localhost:4030'
  }
  if (!process.env.JEJU_NETWORK) {
    process.env.JEJU_NETWORK = opts.network
  }

  // For unit tests, no infrastructure needed
  if (opts.testMode === 'unit') {
    console.log('[Setup] Unit test mode - no infrastructure required')
    return {
      healthy: true,
      services: {
        healthy: true,
        services: [],
        missingServices: [],
        timestamp: Date.now(),
      },
      contractsDeployed: false,
      dbInitialized: false,
      dbSeeded: false,
    }
  }

  // Check if Jeju is running, start if not
  let jejuRunning = await isJejuRunning()
  if (!jejuRunning) {
    console.log('[Setup] Jeju CLI is not running, attempting to start...')

    if (!opts.skipHealthCheck) {
      // Try to start Jeju services
      jejuRunning = await ensureJejuRunning(opts.timeout / 1000)

      if (!jejuRunning) {
        console.error('[Setup] ❌ Failed to start Jeju services')
        console.error('')
        console.error('To start Jeju services manually:')
        console.error(`  cd ${JEJU_ROOT} && bun run dev`)
        console.error('')
        throw new Error('Failed to start Jeju services')
      }
    }
  }

  if (jejuRunning) {
    console.log('[Setup] ✅ Jeju CLI detected')
  }

  // Check core services
  console.log('[Setup] Checking core services...')
  const coreStatus = await checkCoreServices()

  if (!coreStatus.healthy && !opts.skipHealthCheck) {
    printStatus(coreStatus)
    console.error(
      `\n[Setup] ❌ Core services not healthy: ${coreStatus.missingServices.join(', ')}`,
    )
    throw new Error(
      `Core services not healthy: ${coreStatus.missingServices.join(', ')}`,
    )
  }

  console.log('[Setup] ✅ Core services ready')

  let contractsDeployed = false
  let dbInitialized = false
  let dbSeeded = false

  // For integration, decentralized or e2e mode, check all Jeju services
  if (
    opts.testMode === 'integration' ||
    opts.testMode === 'decentralized' ||
    opts.testMode === 'e2e' ||
    opts.testMode === 'all'
  ) {
    console.log('[Setup] Checking Jeju services...')
    const jejuStatus = await checkJejuServices()

    if (!jejuStatus.healthy && !opts.skipHealthCheck) {
      printStatus(jejuStatus)
      console.error('[Setup] ❌ Required Jeju services not healthy')
      throw new Error(
        `Jeju services not healthy. Missing: ${jejuStatus.missingServices.join(', ')}`,
      )
    }

    console.log('[Setup] ✅ Jeju services ready')

    // Wait for EQLite to be ready
    const eqliteReady = await waitForEQLite()
    if (eqliteReady) {
      // Initialize database
      dbInitialized = await initializeDatabase()

      // Seed database with test data
      if (dbInitialized) {
        dbSeeded = await seedDatabase()
      }
    }

    // Check and deploy contracts if needed
    if (opts.deployContracts) {
      console.log('[Setup] Checking messaging contracts...')
      const contractStatus = await checkMessagingContracts(opts.network)

      if (!contractStatus.allDeployed) {
        console.log('[Setup] Deploying messaging contracts...')
        const addresses = await ensureContractsDeployed(opts.network)

        // Update .env with contract addresses
        updateEnvFile({
          KEY_REGISTRY_ADDRESS: addresses.keyRegistry,
          MESSAGE_NODE_REGISTRY_ADDRESS: addresses.messageNodeRegistry,
        })

        // Also set in process.env for current run
        process.env.KEY_REGISTRY_ADDRESS = addresses.keyRegistry
        process.env.MESSAGE_NODE_REGISTRY_ADDRESS =
          addresses.messageNodeRegistry

        contractsDeployed = true
        console.log('[Setup] ✅ Contracts deployed')
      } else {
        contractsDeployed = true
        console.log('[Setup] ✅ Contracts already deployed')
      }
    }
  }

  // Final status
  const finalStatus = await checkAllServices()
  printStatus(finalStatus)

  console.log('═'.repeat(60))
  console.log('SETUP COMPLETE')
  console.log(`  - Services healthy: ${finalStatus.healthy}`)
  console.log(`  - Contracts deployed: ${contractsDeployed}`)
  console.log(`  - Database initialized: ${dbInitialized}`)
  console.log(`  - Database seeded: ${dbSeeded}`)
  console.log(`${'═'.repeat(60)}\n`)

  return {
    healthy: coreStatus.healthy,
    services: finalStatus,
    contractsDeployed,
    dbInitialized,
    dbSeeded,
  }
}

export async function teardownTestInfrastructure(): Promise<void> {
  console.log('\n[Teardown] Test infrastructure cleanup complete\n')
  // Don't stop Jeju services - they should keep running for other tests
}

// Export for preload usage
export {
  checkAllServices,
  checkCoreServices,
  checkJejuServices,
  isJejuRunning,
  printStatus,
}

// CLI entry point
if (import.meta.main) {
  const testModeArg = process.argv
    .find((a) => a.startsWith('--mode='))
    ?.split('=')[1]
  const testMode = parseTestMode(testModeArg)

  const networkArg = process.argv
    .find((a) => a.startsWith('--network='))
    ?.split('=')[1]
  const network = parseNetworkMode(networkArg)

  const deployContracts = process.argv.includes('--deploy')
  const skipHealthCheck = process.argv.includes('--skip-health')

  const result = await setupTestInfrastructure({
    testMode,
    network,
    deployContracts,
    skipHealthCheck,
  })

  process.exit(result.healthy ? 0 : 1)
}
