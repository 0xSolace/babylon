#!/usr/bin/env bun

/**
 * Dev Command - Start the full Babylon development environment
 *
 * This command:
 * 1. Starts the Jeju localnet (L1, L2, SQLit) via the Jeju CLI
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
import { getDWSUrl, getFarcasterHubUrl, getSQLitUrl } from '@jejunetwork/config'
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
  skipSQLitWait: boolean
  skipTokenBootstrap: boolean
  stop: boolean
}

function printHelp(): void {
  console.log(`
Dev Command - Start Babylon development environment with full token ecosystem

USAGE:
  babylon dev [options]

OPTIONS:
  --minimal              Start chain only (no web app)
  --skip-chain           Skip chain startup (assumes already running)
  --skip-contracts       Skip contract deployment
  --skip-sqlit-wait     Don't wait for SQLit to be ready (may cause database errors)
  --skip-token-bootstrap Skip BBLN token, DAO, and liquidity setup
  --stop                 Stop all services

ON STARTUP (unless skipped):
  1. Starts Jeju localnet (L1, L2, SQLit)
  2. Deploys Babylon game contracts
  3. Bootstraps BBLN token ecosystem:
     - Deploys BBLN token (if not deployed)
     - Deploys DAO (Governor, Treasury, Timelock)
     - Seeds ETH/BBLN liquidity pool
     - Seeds JEJU/BBLN liquidity pool  
     - Funds NPCs with initial BBLN allocation
  4. Starts backend server and web app

ENVIRONMENT:
  JEJU_RPC_URL           Override L2 RPC URL (default: http://localhost:6546)
  SQLIT_ENDPOINT        Override SQLit endpoint (default: http://localhost:4661)
  DEPLOYER_PRIVATE_KEY   Private key for contract deployment (optional for local)

EXAMPLES:
  babylon dev                         # Start everything with full token setup
  babylon dev --minimal               # Chain only
  babylon dev --skip-chain            # Web app only (chain already running)
  babylon dev --skip-token-bootstrap  # Skip token/DAO/liquidity setup
  babylon dev --stop                  # Stop all services
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

function getSQLitEndpoint(): string {
  // Environment variable override takes precedence
  if (
    typeof process !== 'undefined' &&
    process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT
  ) {
    return process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT
  }

  // Get from config
  const network =
    (typeof process !== 'undefined'
      ? (process.env.JEJU_NETWORK as
          | 'localnet'
          | 'testnet'
          | 'mainnet'
          | undefined)
      : undefined) || 'localnet'
  try {
    return getSQLitUrl(network)
  } catch {
    // Fallback if config not available
  }

  // Fallback to default port based on network
  return network === 'localnet'
    ? 'http://localhost:4661'
    : 'http://localhost:4300'
}

function getDWSEndpoint(): string {
  // Environment variable override takes precedence
  if (typeof process !== 'undefined' && process.env.JEJU_DWS_ENDPOINT) {
    return process.env.JEJU_DWS_ENDPOINT
  }

  // Get from config
  const network =
    (typeof process !== 'undefined'
      ? (process.env.JEJU_NETWORK as
          | 'localnet'
          | 'testnet'
          | 'mainnet'
          | undefined)
      : undefined) || 'localnet'
  try {
    return getDWSUrl(network)
  } catch {
    // Fallback for local development
    return 'http://localhost:4030'
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

async function checkSQLit(): Promise<boolean> {
  try {
    const endpoint = getSQLitEndpoint()
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
  logger.warn('SQLit queries require DWS to be running')
  logger.info(`Expected DWS at: ${dwsUrl}`)
  logger.info('DWS should start automatically with jeju dev')
  logger.info('If DWS is not starting, you can try:')
  logger.info('  1. Check Jeju logs for DWS startup errors')
  logger.info('  2. Try starting DWS separately: jeju dws dev')
  logger.info(
    '  3. Use --skip-sqlit-wait to continue without database features',
  )
  return false
}

async function waitForSQLit(maxAttempts = 30): Promise<boolean> {
  logger.step('Waiting for SQLit to be ready...')

  // Ensure SQLIT_BLOCK_PRODUCER_ENDPOINT is set for @babylon/db
  const sqlitEndpoint = getSQLitEndpoint()
  process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT = sqlitEndpoint
  logger.info(`SQLit endpoint: ${sqlitEndpoint}`)

  // First wait for DWS (required for SQLit queries)
  logger.info('DWS is required for SQLit queries, checking DWS first...')
  const dwsReady = await waitForDWS()
  if (!dwsReady) {
    logger.warn('DWS not ready - SQLit queries will fail without DWS')
    logger.info('You can continue, but database features may not work')
    logger.info(
      'Tip: Try running "jeju dws dev" separately if DWS is not starting',
    )
  }

  // Quick check first - maybe it's already ready
  const quickCheck = await checkSQLit()
  if (quickCheck) {
    logger.info('SQLit appears ready, verifying database initialization...')
    try {
      const { initializeDatabase } = await import('@babylon/db')
      await initializeDatabase()
      logger.success('SQLit is healthy and database initialized')
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
        `Still waiting for SQLit... (${i}/${maxAttempts} attempts, ~${i * 2}s)`,
      )
    }

    const healthy = await checkSQLit()
    if (healthy) {
      logger.info('SQLit health endpoint responded, initializing database...')
      // Also verify the database can be initialized
      try {
        const { initializeDatabase } = await import('@babylon/db')
        await initializeDatabase()
        logger.success('SQLit is healthy and database initialized')
        return true
      } catch (error) {
        // SQLit health check passed but DB init failed, keep waiting
        if (i < maxAttempts - 1) {
          logger.info(
            `Database initialization failed, retrying... (${String(error).slice(0, 80)})`,
          )
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        logger.warn(
          'SQLit health check passed but database initialization failed',
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
    `SQLit did not become ready after ${maxAttempts} attempts (~${maxAttempts * 2} seconds)`,
  )
  logger.info('You can continue, but database features may not work')
  logger.info('Tip: Use --skip-sqlit-wait to skip this wait in the future')
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

async function bootstrapTokenEcosystem(): Promise<void> {
  logger.header('Bootstrapping BBLN Token Ecosystem')

  try {
    // Dynamic import to avoid circular dependencies
    const { bootstrapTokenEcosystem: bootstrap, isTokenEcosystemReady } =
      await import('@babylon/api')

    // Check if already ready
    if (isTokenEcosystemReady()) {
      logger.success('Token ecosystem already initialized')
      return
    }

    logger.step('Deploying BBLN token, DAO, and liquidity pools...')

    const result = await bootstrap({
      force: false,
      skipLiquidity: false,
      skipNpcFunding: false,
      dryRun: false,
    })

    if (result.alreadyInitialized) {
      logger.success('Token ecosystem was already initialized')
      return
    }

    if (result.errors.length > 0) {
      logger.warn(
        `Token bootstrap completed with ${result.errors.length} errors`,
      )
      for (const err of result.errors) {
        console.log(`  - ${err}`)
      }
    } else {
      logger.success('Token ecosystem bootstrapped successfully')
    }

    // Log summary
    console.log('\n  Token Ecosystem Summary:')
    console.log(`    BBLN Token:     ${result.tokenAddress ?? 'Not deployed'}`)
    if (result.daoAddresses) {
      console.log(
        `    DAO Governor:   ${result.daoAddresses.governor ?? 'Not deployed'}`,
      )
      console.log(
        `    DAO Treasury:   ${result.daoAddresses.treasury ?? 'Not deployed'}`,
      )
    }
    console.log(
      `    ETH/BBLN Pool:  ${result.liquidityPairs.ethBbln ?? 'Not created'}`,
    )
    console.log(
      `    JEJU/BBLN Pool: ${result.liquidityPairs.jejuBbln ?? 'Not created'}`,
    )
    console.log(`    NPCs Funded:    ${result.npcsCount}`)
  } catch (error) {
    logger.warn('Token bootstrap failed - game will use simulated balances')
    console.log(
      `  Error: ${error instanceof Error ? error.message : String(error)}`,
    )
    console.log('  Run "babylon token fund-npcs" manually to retry funding')
  }
}

async function startWebApp(): Promise<void> {
  logger.header('Starting Babylon')

  // Get DWS endpoint for @jejunetwork/db configuration
  const dwsEndpoint = getDWSEndpoint()

  logger.step('Starting backend server...')
  const sqlitEndpoint = getSQLitEndpoint()
  logger.info(`Using SQLit endpoint: ${sqlitEndpoint}`)

  const serverProc = Bun.spawn(['bun', 'run', 'dev'], {
    cwd: join(BABYLON_ROOT, 'apps/server'),
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      JEJU_NETWORK: 'localnet',
      PUBLIC_RPC_URL: 'http://localhost:6546',
      SQLIT_BLOCK_PRODUCER_ENDPOINT: sqlitEndpoint,
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
      SQLIT_BLOCK_PRODUCER_ENDPOINT: sqlitEndpoint,
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
    skipSQLitWait: getFlag(parsed, 'skip-sqlit-wait'),
    skipTokenBootstrap: getFlag(parsed, 'skip-token-bootstrap'),
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

  // Start chain (L1, L2, SQLit)
  if (!options.skipChain) {
    await startChain()

    // Wait for SQLit to be fully ready and database initialized
    if (!options.skipSQLitWait) {
      const sqlitReady = await waitForSQLit()
      if (!sqlitReady) {
        logger.warn('SQLit not fully ready - some features may not work')
        const endpoint = getSQLitEndpoint()
        logger.info(`SQLit endpoint: ${endpoint}`)
        logger.info('You may need to wait a bit longer for SQLit to initialize')
        logger.info('Or use --skip-sqlit-wait to continue anyway')
      }
    } else {
      logger.info('Skipping SQLit wait (--skip-sqlit-wait)')
      logger.warn('Database features may not work until SQLit is ready')
    }
  } else {
    // Even if skipping chain, check if SQLit is available
    const sqlitHealthy = await checkSQLit()
    if (!sqlitHealthy) {
      logger.warn('SQLit not responding - decentralized features may not work')
      const endpoint = getSQLitEndpoint()
      logger.info(`SQLit endpoint: ${endpoint}`)
    }
  }

  // Deploy contracts
  if (!options.skipContracts) {
    await deployContracts()
  }

  // Bootstrap token ecosystem (BBLN, DAO, liquidity pools, NPC funding)
  if (!options.skipTokenBootstrap) {
    await bootstrapTokenEcosystem()
  } else {
    logger.info('Skipping token bootstrap (--skip-token-bootstrap)')
  }

  // Start web app
  if (!options.minimal) {
    await startWebApp()
  } else {
    logger.success('Minimal mode - chain is running')
    logger.info('L2 RPC: http://localhost:6546')
    logger.info('SQLit API: http://localhost:4661')
    logger.info('\nPress Ctrl+C to stop')

    // Keep running
    await new Promise(() => {})
  }
}
