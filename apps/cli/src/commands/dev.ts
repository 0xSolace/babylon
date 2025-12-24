#!/usr/bin/env bun

/**
 * Dev Command - Start the full Babylon development environment
 *
 * This command:
 * 1. Starts the Jeju localnet (L1, L2, CQL) via the Jeju CLI
 * 2. Deploys Babylon contracts
 * 3. Starts the Babylon backend server (Elysia)
 * 4. Starts the Babylon web app (Next.js)
 *
 * Usage:
 *   babylon dev                 # Start everything
 *   babylon dev --minimal       # Chain only, no backend/frontend
 *   babylon dev --skip-chain    # Skip chain, just start backend/frontend
 *   babylon dev --stop          # Stop all services
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getCQLUrl, getDWSUrl, getFarcasterHubUrl } from '@jejunetwork/config'
import { $ } from 'bun'
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'
import { ensureEnvLocal } from './init.js'

// Root directory of the Jeju monorepo
const JEJU_ROOT = join(process.cwd(), '..', '..')
const BABYLON_ROOT = process.cwd()

interface DevOptions {
  minimal: boolean
  skipChain: boolean
  skipContracts: boolean
  skipCqlWait: boolean
  stop: boolean
}

function printHelp(): void {
  console.log(`
Dev Command - Start Babylon development environment

USAGE:
  babylon dev [options]

OPTIONS:
  --minimal         Start chain only (no web app)
  --skip-chain      Skip chain startup (assumes already running)
  --skip-contracts  Skip contract deployment
  --skip-cql-wait   Don't wait for CQL to be ready (may cause DB errors)
  --stop            Stop all services

ENVIRONMENT:
  JEJU_RPC_URL      Override L2 RPC URL (default: http://localhost:6546)
  CQL_ENDPOINT      Override CQL endpoint (default: http://localhost:4661)

EXAMPLES:
  babylon dev                    # Start everything
  babylon dev --minimal          # Chain only
  babylon dev --skip-chain       # Web app only
  babylon dev --stop             # Stop all services
`)
}

async function checkJejuCLI(): Promise<boolean> {
  try {
    await $`which jeju`.quiet()
    return true
  } catch {
    // Try bunx @jejunetwork/cli
    try {
      await $`bunx @jejunetwork/cli --version`.quiet()
      return true
    } catch {
      // Try local jeju CLI source in monorepo
      const jejuCli = join(JEJU_ROOT, 'packages/cli/src/index.ts')
      return existsSync(jejuCli)
    }
  }
}

async function runJejuCommand(args: string[]): Promise<void> {
  // Try global jeju first
  try {
    await $`which jeju`.quiet()
    const proc = Bun.spawn(['jeju', ...args], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
    await proc.exited
    return
  } catch {
    // Fall back to bunx
  }

  // Try bunx @jejunetwork/cli
  try {
    const proc = Bun.spawn(['bunx', '@jejunetwork/cli', ...args], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
    await proc.exited
    return
  } catch {
    // Fall back to local
  }

  // Try local jeju CLI source in monorepo
  const jejuCli = join(JEJU_ROOT, 'packages/cli/src/index.ts')
  if (existsSync(jejuCli)) {
    const proc = Bun.spawn(['bun', 'run', jejuCli, ...args], {
      cwd: JEJU_ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    await proc.exited
    return
  }

  throw new Error(
    'Jeju CLI not found. Install with: bun add -g @jejunetwork/cli or bunx @jejunetwork/cli',
  )
}

async function startChain(): Promise<void> {
  logger.header('Starting Jeju Chain')

  // Check if chain is already running
  try {
    const result =
      await $`curl -s -X POST http://localhost:6546 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'`.quiet()
    if (result.text().includes('result')) {
      logger.success('Chain already running')
      return
    }
  } catch {
    // Chain not running, continue
  }

  // Start via Jeju CLI in background (jeju dev is long-running)
  // Note: We use 'jeju dev' (not --minimal) to ensure DWS starts
  logger.step('Starting Jeju localnet (including DWS)...')

  // Try global jeju first
  try {
    await $`which jeju`.quiet()
    Bun.spawn(['jeju', 'dev'], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch {
    // Try bunx @jejunetwork/cli
    try {
      Bun.spawn(['bunx', '@jejunetwork/cli', 'dev'], {
        stdout: 'inherit',
        stderr: 'inherit',
      })
    } catch {
      // Try local jeju CLI source in monorepo
      const jejuCli = join(JEJU_ROOT, 'packages/cli/src/index.ts')
      if (existsSync(jejuCli)) {
        Bun.spawn(['bun', 'run', jejuCli, 'dev'], {
          cwd: JEJU_ROOT,
          stdout: 'inherit',
          stderr: 'inherit',
        })
      } else {
        throw new Error(
          'Jeju CLI not found. Install with: bun add -g @jejunetwork/cli or bunx @jejunetwork/cli',
        )
      }
    }
  }

  // Don't wait for it to exit - it runs indefinitely

  // Wait for chain to be ready
  logger.step('Waiting for chain...')
  let attempts = 0
  while (attempts < 30) {
    try {
      const result =
        await $`curl -s -X POST http://localhost:6546 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'`.quiet()
      if (result.text().includes('result')) {
        logger.success('Chain is ready')
        break
      }
    } catch {
      // Keep trying
    }
    await new Promise((r) => setTimeout(r, 2000))
    attempts++
  }

  if (attempts >= 30) {
    throw new Error('Chain failed to start in time')
  }
}

function getCQLEndpoint(): string {
  // Environment variable takes precedence
  if (process.env.CQL_BLOCK_PRODUCER_ENDPOINT) {
    return process.env.CQL_BLOCK_PRODUCER_ENDPOINT
  }

  // Try to get from Jeju config
  const network =
    (process.env.JEJU_NETWORK as
      | 'localnet'
      | 'testnet'
      | 'mainnet'
      | undefined) || 'localnet'
  try {
    return getCQLUrl(network)
  } catch {
    // Fallback if config not available
  }

  // Fallback to default port based on network
  // localnet uses port 4661 for CQL
  return network === 'localnet'
    ? 'http://localhost:4661'
    : 'http://localhost:4300'
}

function getDWSEndpoint(): string {
  const network = process.env.JEJU_NETWORK as
    | 'localnet'
    | 'testnet'
    | 'mainnet'
    | undefined
  try {
    return getDWSUrl(network || 'localnet')
  } catch {
    // Fallback for local development
    return network === 'localnet'
      ? 'http://localhost:4030'
      : 'http://localhost:4030'
  }
}

async function checkDWS(): Promise<boolean> {
  try {
    const dwsUrl = getDWSEndpoint()
    const healthUrl = `${dwsUrl}/health`
    const result = await $`curl -s ${healthUrl}`.quiet()
    const response = result.text()
    // Check for various health indicators
    return (
      response.includes('ok') ||
      response.includes('healthy') ||
      response.includes('status') ||
      result.exitCode === 0
    )
  } catch {
    return false
  }
}

async function checkCQL(): Promise<boolean> {
  try {
    const endpoint = getCQLEndpoint()
    const healthUrl = endpoint.endsWith('/health')
      ? endpoint
      : `${endpoint}/health`
    const result = await $`curl -s ${healthUrl}`.quiet()
    return result.text().includes('ok') || result.exitCode === 0
  } catch {
    return false
  }
}

async function waitForDWS(maxAttempts = 60): Promise<boolean> {
  logger.step('Waiting for DWS to be ready...')

  // Quick check first
  const quickCheck = await checkDWS()
  if (quickCheck) {
    logger.success('DWS is ready')
    return true
  }

  logger.info('DWS not ready yet, waiting...')
  for (let i = 0; i < maxAttempts; i++) {
    // Show progress every 10 attempts
    if (i > 0 && i % 10 === 0) {
      logger.info(
        `Still waiting for DWS... (${i}/${maxAttempts} attempts, ~${i * 2}s)`,
      )
    }

    const ready = await checkDWS()
    if (ready) {
      logger.success('DWS is ready')
      return true
    }

    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  const dwsUrl = getDWSEndpoint()
  logger.warn(
    `DWS did not become ready after ${maxAttempts} attempts (~${maxAttempts * 2} seconds)`,
  )
  logger.warn('CQL queries require DWS to be running')
  logger.info(`Expected DWS at: ${dwsUrl}`)
  logger.info('DWS should start automatically with jeju dev')
  logger.info('If DWS is not starting, you can try:')
  logger.info('  1. Check Jeju logs for DWS startup errors')
  logger.info('  2. Try starting DWS separately: jeju dws dev')
  logger.info('  3. Use --skip-cql-wait to continue without database features')
  return false
}

async function waitForCQL(maxAttempts = 30): Promise<boolean> {
  logger.step('Waiting for CQL to be ready...')

  // Ensure CQL_BLOCK_PRODUCER_ENDPOINT is set for @babylon/db
  const cqlEndpoint = getCQLEndpoint()
  process.env.CQL_BLOCK_PRODUCER_ENDPOINT = cqlEndpoint
  logger.info(`CQL endpoint: ${cqlEndpoint}`)

  // First wait for DWS (required for CQL queries)
  logger.info('DWS is required for CQL queries, checking DWS first...')
  const dwsReady = await waitForDWS()
  if (!dwsReady) {
    logger.warn('DWS not ready - CQL queries will fail without DWS')
    logger.info('You can continue, but database features may not work')
    logger.info(
      'Tip: Try running "jeju dws dev" separately if DWS is not starting',
    )
  }

  // Quick check first - maybe it's already ready
  const quickCheck = await checkCQL()
  if (quickCheck) {
    logger.info('CQL appears ready, verifying database initialization...')
    try {
      const { initializeDatabase } = await import('@babylon/db')
      await initializeDatabase()
      logger.success('CQL is healthy and database initialized')
      return true
    } catch (error) {
      logger.info(
        `Database initialization failed, will retry... (${String(error).slice(0, 80)})`,
      )
      if (
        String(error).includes('4028') ||
        String(error).includes('ConnectionRefused')
      ) {
        logger.warn(
          'Connection to DWS failed - ensure DWS is running on port 4028/4030',
        )
      }
    }
  }

  for (let i = 0; i < maxAttempts; i++) {
    // Show progress every 5 attempts
    if (i > 0 && i % 5 === 0) {
      logger.info(
        `Still waiting for CQL... (${i}/${maxAttempts} attempts, ~${i * 2}s)`,
      )
    }

    const healthy = await checkCQL()
    if (healthy) {
      logger.info('CQL health endpoint responded, initializing database...')
      // Also verify the database can be initialized
      try {
        const { initializeDatabase } = await import('@babylon/db')
        await initializeDatabase()
        logger.success('CQL is healthy and database initialized')
        return true
      } catch (error) {
        // CQL health check passed but DB init failed, keep waiting
        if (i < maxAttempts - 1) {
          logger.info(
            `Database initialization failed, retrying... (${String(error).slice(0, 80)})`,
          )
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        logger.warn(
          'CQL health check passed but database initialization failed',
        )
        logger.warn(String(error))
        return false
      }
    }

    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  logger.warn(
    `CQL did not become ready after ${maxAttempts} attempts (~${maxAttempts * 2} seconds)`,
  )
  logger.info('You can continue, but database features may not work')
  logger.info('Tip: Use --skip-cql-wait to skip this wait in the future')
  return false
}

async function deployContracts(): Promise<void> {
  logger.header('Deploying Contracts')

  // Check if contracts already deployed
  const envPath = join(BABYLON_ROOT, '.env.local')
  if (existsSync(envPath)) {
    const env = await Bun.file(envPath).text()
    if (env.includes('BABYLON_DIAMOND_ADDRESS=0x')) {
      logger.success('Contracts already deployed')
      return
    }
  }

  logger.step('Deploying Babylon contracts...')
  const deployProc = Bun.spawn(['bun', 'run', 'babylon', 'deploy', 'local'], {
    cwd: BABYLON_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await deployProc.exited
  logger.success('Contracts deployed')
}

async function startWebApp(): Promise<void> {
  logger.header('Starting Babylon')

  // Get DWS endpoint for @jejunetwork/db configuration
  const dwsEndpoint = getDWSEndpoint()

  logger.step('Starting backend server...')
  const cqlEndpoint = getCQLEndpoint()
  logger.info(`Using CQL endpoint: ${cqlEndpoint}`)

  const serverProc = Bun.spawn(['bun', 'run', 'dev'], {
    cwd: join(BABYLON_ROOT, 'apps/server'),
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      JEJU_NETWORK: 'localnet',
      PUBLIC_RPC_URL: 'http://localhost:6546',
      CQL_BLOCK_PRODUCER_ENDPOINT: cqlEndpoint,
      JEJU_DWS_ENDPOINT: dwsEndpoint,
      MESSAGING_MODE: 'decentralized',
      FARCASTER_HUB_URL: getFarcasterHubUrl(),
    },
  })

  // Give server a moment to start
  await new Promise((r) => setTimeout(r, 2000))

  logger.step('Starting web app...')
  // Run turbo dev for web with Jeju environment
  const webProc = Bun.spawn(['bun', 'run', 'dev:web'], {
    cwd: BABYLON_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      JEJU_NETWORK: 'localnet',
      PUBLIC_RPC_URL: 'http://localhost:6546',
      CQL_BLOCK_PRODUCER_ENDPOINT: cqlEndpoint,
      JEJU_DWS_ENDPOINT: dwsEndpoint,
      MESSAGING_MODE: 'decentralized',
      FARCASTER_HUB_URL: getFarcasterHubUrl(),
    },
  })

  // Wait for either process to exit (they should run indefinitely)
  await Promise.race([serverProc.exited, webProc.exited])
}

async function stopAll(): Promise<void> {
  logger.header('Stopping All Services')

  // Stop backend server
  logger.step('Stopping backend server...')
  await $`pkill -f "bun.*apps/server" || true`.quiet().nothrow()

  // Stop web app (kill Next.js processes)
  logger.step('Stopping web app...')
  await $`pkill -f "next dev" || true`.quiet().nothrow()

  // Stop chain via Jeju CLI
  logger.step('Stopping chain...')
  try {
    await runJejuCommand(['dev', '--stop'])
  } catch {
    // OK if it fails
  }

  logger.success('All services stopped')
}

export async function runDevCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    return
  }

  const options: DevOptions = {
    minimal: getFlag(parsed, 'minimal'),
    skipChain: getFlag(parsed, 'skip-chain'),
    skipContracts: getFlag(parsed, 'skip-contracts'),
    skipCqlWait: getFlag(parsed, 'skip-cql-wait'),
    stop: getFlag(parsed, 'stop'),
  }

  if (options.stop) {
    await stopAll()
    return
  }

  // Ensure .env.local exists
  const created = await ensureEnvLocal()
  if (created) {
    logger.success('Created .env.local from template')
    logger.info(
      'Edit .env.local to configure API keys, then re-run babylon dev',
    )
  }

  // Check Jeju CLI is available
  if (!options.skipChain) {
    const hasJeju = await checkJejuCLI()
    if (!hasJeju) {
      logger.fail('Jeju CLI not found')
      console.log('\nInstall with:')
      console.log(`  cd ${JEJU_ROOT} && bun install && bun link`)
      console.log('  # or')
      console.log('  bun add -g @jejunetwork/cli')
      process.exit(1)
    }
  }

  // Start chain (L1, L2, CQL)
  if (!options.skipChain) {
    await startChain()

    // Wait for CQL to be fully ready and database initialized
    if (!options.skipCqlWait) {
      const cqlReady = await waitForCQL()
      if (!cqlReady) {
        logger.warn('CQL not fully ready - some features may not work')
        const endpoint = getCQLEndpoint()
        logger.info(`CQL endpoint: ${endpoint}`)
        logger.info('You may need to wait a bit longer for CQL to initialize')
        logger.info('Or use --skip-cql-wait to continue anyway')
      }
    } else {
      logger.info('Skipping CQL wait (--skip-cql-wait)')
      logger.warn('Database features may not work until CQL is ready')
    }
  } else {
    // Even if skipping chain, check if CQL is available
    const cqlHealthy = await checkCQL()
    if (!cqlHealthy) {
      logger.warn('CQL not responding - decentralized features may not work')
      const endpoint = getCQLEndpoint()
      logger.info(`CQL endpoint: ${endpoint}`)
    }
  }

  // Deploy contracts
  if (!options.skipContracts) {
    await deployContracts()
  }

  // Start web app
  if (!options.minimal) {
    await startWebApp()
  } else {
    logger.success('Minimal mode - chain is running')
    logger.info('L2 RPC: http://localhost:6546')
    logger.info('CQL API: http://localhost:4661')
    logger.info('\nPress Ctrl+C to stop')

    // Keep running
    await new Promise(() => {})
  }
}
