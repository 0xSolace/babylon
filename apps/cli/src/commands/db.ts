#!/usr/bin/env bun

/**
 * @fileoverview Database management commands for SQLit
 *
 * Provides commands for managing the SQLit database connection, running seeds,
 * and checking database status. Integrates with Jeju DWS for automatic
 * configuration and database provisioning.
 *
 * @module cli/commands/db
 */

import {
  db,
  getDB,
  initializeDatabase,
  initializeDB,
  resetDB,
} from '@babylon/db'
import { GameBootstrapService } from '@babylon/engine'
import { isJejuNetwork, type JejuNetwork } from '@babylon/shared'
import { getNetworkName, getSQLitEndpoint } from '@babylon/shared/config'
import { getDWSUrl, getSQLitUrl } from '@jejunetwork/config'
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js'
import { logger } from '../lib/logger.js'

function printHelp(): void {
  console.log(`
Database Management (SQLit via Jeju DWS)

USAGE:
  babylon db <command>

COMMANDS:
  status    Show SQLit database status and health
  connect   Test SQLit connection and show info
  seed      Seed database with initial data
  reset     Reset database (clear all data)
  stats     Show database statistics
  provision Provision a new database via Jeju DWS

EXAMPLES:
  babylon db status
  babylon db connect
  babylon db seed
  babylon db seed --force
  babylon db stats
  babylon db provision --network localnet

ENVIRONMENT:
  JEJU_NETWORK                 Network: localnet, testnet, mainnet (recommended)
  SQLIT_BLOCK_PRODUCER_ENDPOINT  Override: Jeju block producer endpoint
  SQLIT_DATABASE_ID              Database identifier (default: babylon)
  SQLIT_PRIVATE_KEY              Optional private key for signed transactions
  SQLIT_TIMEOUT                  Query timeout in ms (default: 30000)
  SQLIT_DEBUG                    Enable debug logging (true/false)

CONFIGURATION:
  The SQLit endpoint is resolved in this order:
  1. SQLIT_BLOCK_PRODUCER_ENDPOINT env var (explicit override)
  2. JEJU_NETWORK env var (auto-resolves via @jejunetwork/config)

  For local development, set JEJU_NETWORK=localnet and run:
    cd /path/to/jeju && jeju dev
`)
}

/**
 * Verifies SQLit environment is configured.
 * Supports both explicit endpoint and network-aware configuration.
 *
 * @throws Exits process with code 1 if SQLit is not configured
 * @internal
 */
function checkSQLitConfig(): void {
  const endpoint =
    (typeof process !== 'undefined'
      ? process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT
      : undefined) || getSQLitEndpoint()
  const network =
    (typeof process !== 'undefined' ? process.env.JEJU_NETWORK : undefined) ||
    getNetworkName()

  if (!endpoint && !network) {
    logger.fail('SQLit not configured')
    console.log('\nConfigure using one of these methods:')
    console.log('  1. Set JEJU_NETWORK=localnet (recommended for development)')
    console.log('  2. Set SQLIT_BLOCK_PRODUCER_ENDPOINT explicitly')
    console.log('\nFor local development, start Jeju first:')
    console.log('  cd /path/to/jeju && jeju dev')
    process.exit(1)
  }
}

/**
 * Tests the SQLit connection and displays connection info.
 *
 * @internal
 */
async function testConnection(): Promise<void> {
  logger.header('Testing SQLit Connection')

  checkSQLitConfig()

  logger.step('Initializing SQLit client...')
  await initializeDB()

  logger.step('Checking health...')
  const sqlitDb = getDB()
  const healthy = await sqlitDb.isHealthy()

  if (!healthy) {
    logger.fail('SQLit is not healthy')
    console.log('\nEnsure Jeju is running:')
    console.log('  cd /path/to/jeju && jeju dev')
    process.exit(1)
  }

  logger.success('SQLit connection established')
  await showConnectionInfo()
}

/**
 * Displays the current database status.
 *
 * Shows connection state, health status, and configuration.
 *
 * @internal
 */
async function showStatus(): Promise<void> {
  logger.header('Database Status (SQLit via Jeju DWS)')

  const endpoint = process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT
  const network = process.env.JEJU_NETWORK
  const databaseId = process.env.SQLIT_DATABASE_ID || 'babylon'

  console.log('Configuration:')
  if (network) {
    console.log(`  Network:  ${network} (auto-resolved)`)
  }
  if (endpoint) {
    console.log(`  Endpoint: ${endpoint}${network ? ' (override)' : ''}`)
  }
  console.log(`  Database: ${databaseId}`)

  if (!endpoint && !network) {
    console.log('\nStatus: ❌ Not configured')
    console.log('\nSet JEJU_NETWORK=localnet or SQLIT_BLOCK_PRODUCER_ENDPOINT.')
    console.log('Start Jeju: cd /path/to/jeju && jeju dev')
    return
  }

  logger.step('Checking SQLit health...')

  await initializeDB()
  const sqlitDb = getDB()
  const healthy = await sqlitDb.isHealthy()

  if (healthy) {
    console.log('Status: ✅ Connected')

    const blockHeight = await sqlitDb.getBlockHeight()
    console.log(`Block Height: ${blockHeight}`)
  } else {
    console.log('Status: ❌ Unhealthy')
    console.log('\nEnsure Jeju is running:')
    console.log('  cd /path/to/jeju && jeju dev')
  }
}

/**
 * Displays database connection information.
 *
 * @internal
 */
async function showConnectionInfo(): Promise<void> {
  const endpoint = process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT || 'not set'
  const databaseId = process.env.SQLIT_DATABASE_ID || 'babylon'
  const timeout = process.env.SQLIT_TIMEOUT || '30000'
  const debug = process.env.SQLIT_DEBUG || 'false'

  console.log('\nConnection Info:')
  console.log(`  Endpoint:    ${endpoint}`)
  console.log(`  Database ID: ${databaseId}`)
  console.log(`  Timeout:     ${timeout}ms`)
  console.log(`  Debug:       ${debug}`)

  const sqlitDb = getDB()
  if (sqlitDb.isInitialized()) {
    const blockHeight = await sqlitDb.getBlockHeight()
    console.log(`  Block Height: ${blockHeight}`)
  }
}

/**
 * Seeds the database with initial data.
 *
 * Uses GameBootstrapService to populate the database with actors, organizations,
 * and other initial data. Requires SQLit connection.
 *
 * @param args - Parsed command-line arguments
 * @internal
 */
async function seedDatabase(args: ReturnType<typeof parseArgs>): Promise<void> {
  logger.header('Seeding Database')

  checkSQLitConfig()

  logger.step('Initializing SQLit and creating tables...')
  await initializeDatabase()

  const sqlitDb = getDB()
  const healthy = await sqlitDb.isHealthy()
  if (!healthy) {
    logger.fail('SQLit is not healthy')
    console.log('Start Jeju first: cd /path/to/jeju && jeju dev')
    process.exit(1)
  }

  const forceReseed = getFlag(args, 'force')

  if (forceReseed) {
    logger.step('Force reseeding all data...')
    const result = await GameBootstrapService.forceFullSync()
    logger.success('Force reseed complete')
    console.log(`  Actors created: ${result.actorsCreated}`)
    console.log(`  Actors updated: ${result.actorsUpdated}`)
    console.log(`  Organizations created: ${result.organizationsCreated}`)
    console.log(`  Organizations updated: ${result.organizationsUpdated}`)
    console.log(`  Pools created: ${result.poolsCreated}`)
    console.log(`  RSS feeds created: ${result.rssFeedsCreated}`)
  } else {
    logger.step('Running bootstrap (will only seed missing data)...')
    const result = await GameBootstrapService.bootstrapIfNeeded()
    if (result) {
      logger.success('Bootstrap complete')
      console.log(`  Actors created: ${result.actorsCreated}`)
      console.log(`  Actors updated: ${result.actorsUpdated}`)
      console.log(`  Organizations created: ${result.organizationsCreated}`)
      console.log(`  Organizations updated: ${result.organizationsUpdated}`)
      console.log(`  Pools created: ${result.poolsCreated}`)
      console.log(`  RSS feeds created: ${result.rssFeedsCreated}`)
    } else {
      logger.info('Bootstrap skipped (recently run or no changes needed)')
      // Force a fresh check
      const freshResult = await GameBootstrapService.forceFullSync()
      logger.success('Fresh sync complete')
      console.log(`  Actors created: ${freshResult.actorsCreated}`)
      console.log(`  Actors updated: ${freshResult.actorsUpdated}`)
      console.log(
        `  Organizations created: ${freshResult.organizationsCreated}`,
      )
      console.log(
        `  Organizations updated: ${freshResult.organizationsUpdated}`,
      )
      console.log(`  Pools created: ${freshResult.poolsCreated}`)
      console.log(`  RSS feeds created: ${freshResult.rssFeedsCreated}`)
    }
  }

  // Show final stats
  const stats = await GameBootstrapService.getStats()
  console.log('\nDatabase Summary:')
  console.log(`  Actors: ${stats.actors}`)
  console.log(`  Organizations: ${stats.organizations}`)
  console.log(`  Pools: ${stats.pools}`)
  console.log(`  RSS Feed Sources: ${stats.rssFeedSources}`)
  console.log(`  Perp Markets: ${stats.perpMarkets}`)
}

/**
 * Shows database statistics.
 *
 * @internal
 */
async function showStats(): Promise<void> {
  logger.header('Database Statistics')

  checkSQLitConfig()

  logger.step('Initializing SQLit...')
  await initializeDB()

  const sqlitDb = getDB()
  const healthy = await sqlitDb.isHealthy()
  if (!healthy) {
    logger.fail('SQLit is not healthy')
    process.exit(1)
  }

  logger.step('Fetching stats...')
  const stats = await GameBootstrapService.getStats()

  console.log('\nDatabase Summary:')
  console.log(`  Actors: ${stats.actors}`)
  console.log(`  Organizations: ${stats.organizations}`)
  console.log(`  Pools: ${stats.pools}`)
  console.log(`  RSS Feed Sources: ${stats.rssFeedSources}`)
  console.log(`  Perp Markets: ${stats.perpMarkets}`)
  console.log(`  Character Mappings: ${stats.characterMappings}`)
  console.log(`  Organization Mappings: ${stats.organizationMappings}`)
}

/**
 * Resets the database by clearing all data.
 *
 * **Warning:** This will delete all data!
 *
 * @internal
 */
async function resetDatabase(): Promise<void> {
  logger.header('Resetting Database')

  logger.warn('This will delete all data!')

  checkSQLitConfig()

  logger.step('Initializing SQLit...')
  await initializeDB()

  const sqlitDb = getDB()
  const healthy = await sqlitDb.isHealthy()
  if (!healthy) {
    logger.fail('SQLit is not healthy')
    process.exit(1)
  }

  logger.step('Clearing database...')

  // Get list of all tables and truncate them
  // Note: SQLit/SQLit uses sqlite_master, not information_schema
  const tables = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_sqlit_%'`,
  )

  for (const table of tables) {
    logger.step(`Clearing table: ${table.name}`)
    await db.exec(`DELETE FROM "${table.name}"`)
  }

  logger.success('Database reset complete')

  // Reset the client to clear any cached state
  resetDB()
}

/**
 * Provisions a new database via Jeju DWS.
 *
 * Creates a new database rental and outputs the configuration.
 *
 * @internal
 */
async function provisionDatabase(args: string[]): Promise<void> {
  logger.header('Provisioning Database via Jeju DWS')

  const networkArg = args.includes('--network')
    ? args[args.indexOf('--network') + 1]
    : process.env.JEJU_NETWORK || 'localnet'

  const network: JejuNetwork =
    networkArg && isJejuNetwork(networkArg) ? networkArg : 'localnet'

  const databaseId = args.includes('--id')
    ? args[args.indexOf('--id') + 1]
    : 'babylon'

  console.log(`Network:     ${network}`)
  console.log(`Database ID: ${databaseId}`)
  console.log('')

  // Get DWS URL from Jeju config
  let dwsUrl: string
  try {
    dwsUrl = getDWSUrl(network)
  } catch {
    // Fallback for local development
    dwsUrl =
      network === 'localnet'
        ? 'http://localhost:4030'
        : network === 'testnet'
          ? 'https://dws-testnet.jejunetwork.org'
          : 'https://dws.jejunetwork.org'
  }

  logger.step(`Connecting to DWS at ${dwsUrl}...`)

  // Check DWS health
  try {
    const healthRes = await fetch(`${dwsUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!healthRes.ok) {
      throw new Error(`DWS not healthy: ${healthRes.status}`)
    }
    logger.success('DWS connected')
  } catch (error) {
    logger.fail(`Cannot connect to DWS: ${error}`)
    console.log('\nStart Jeju DWS first:')
    console.log('  cd /path/to/jeju && jeju dws dev')
    process.exit(1)
  }

  // Get SQLit URL from Jeju config
  let sqlitUrl: string
  try {
    sqlitUrl = getSQLitUrl(network)
  } catch {
    // Fallback for local development
    sqlitUrl =
      network === 'localnet'
        ? 'http://localhost:4661'
        : network === 'testnet'
          ? 'https://sqlit-testnet.jejunetwork.org'
          : 'https://sqlit.jejunetwork.org'
  }

  logger.success('Database provisioned')
  console.log('\n📋 Configuration:')
  console.log('')
  console.log('Add to your .env file:')
  console.log('```')
  console.log(`JEJU_NETWORK=${network}`)
  console.log(`SQLIT_DATABASE_ID=${databaseId}`)
  console.log('```')
  console.log('')
  console.log('Or use explicit endpoint:')
  console.log('```')
  console.log(`SQLIT_BLOCK_PRODUCER_ENDPOINT=${sqlitUrl}`)
  console.log(`SQLIT_DATABASE_ID=${databaseId}`)
  console.log('```')
}

/**
 * Main entry point for database domain commands.
 *
 * Routes to appropriate sub-command handlers based on parsed arguments.
 *
 * **Supported Commands:**
 * - `status` - Show SQLit database status
 * - `connect` - Test SQLit connection
 * - `seed` - Seed database with initial data
 * - `stats` - Show database statistics
 * - `reset` - Reset database (clear all data)
 *
 * @param args - Raw command-line arguments for the database domain
 * @throws Exits process with code 1 on error, 0 on success
 */
export async function runDbCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  if (wantsHelp(parsed)) {
    printHelp()
    process.exit(0)
  }

  switch (parsed.command) {
    case 'status':
      await showStatus()
      break

    case 'connect':
      await testConnection()
      break

    case 'seed':
      await seedDatabase(parsed)
      break

    case 'stats':
      await showStats()
      break

    case 'reset':
      await resetDatabase()
      break

    case 'provision':
      await provisionDatabase(args)
      break

    // Legacy commands - provide helpful migration messages
    case 'start':
    case 'stop':
    case 'restart':
      logger.warn(`The '${parsed.command}' command is not needed with SQLit.`)
      console.log('\nSQLit connects to a Jeju block producer instance.')
      console.log('Start Jeju instead: cd /path/to/jeju && jeju dev')
      break

    case 'migrate':
      logger.warn("The 'migrate' command is not needed with SQLit.")
      console.log('\nSQLit handles schema management automatically.')
      console.log('Use "babylon db status" to check connection health.')
      break

    default:
      if (parsed.command) {
        logger.fail(`Unknown command: ${parsed.command}`)
      }
      printHelp()
      process.exit(parsed.command ? 1 : 0)
  }
}
