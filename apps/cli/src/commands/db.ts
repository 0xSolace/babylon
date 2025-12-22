#!/usr/bin/env bun

/**
 * @fileoverview Database management commands for CQL (CovenantSQL)
 *
 * Provides commands for managing the CQL database connection, running seeds,
 * and checking database status.
 *
 * @module cli/commands/db
 */

import { db, getDB, initializeDB, resetDB } from '@babylon/db';
import { $ } from 'bun';
import { parseArgs, wantsHelp } from '../lib/args.js';
import { logger } from '../lib/logger.js';

function printHelp(): void {
  console.log(`
Database Management (CQL)

USAGE:
  babylon db <command>

COMMANDS:
  status    Show CQL database status and health
  connect   Test CQL connection and show info
  seed      Seed database with initial data
  reset     Reset database (clear all data)
  stats     Show database statistics

EXAMPLES:
  babylon db status
  babylon db connect
  babylon db seed
  babylon db seed --force
  babylon db stats

ENVIRONMENT:
  CQL_BLOCK_PRODUCER_ENDPOINT  Jeju block producer endpoint (required)
  CQL_DATABASE_ID              Database identifier (default: babylon)
  CQL_PRIVATE_KEY              Optional private key for signed transactions
  CQL_TIMEOUT                  Query timeout in ms (default: 30000)
  CQL_DEBUG                    Enable debug logging (true/false)

NOTE:
  CQL connects to a Jeju block producer instance. Start Jeju first:
  cd /path/to/jeju && jeju dev
`);
}

/**
 * Verifies CQL environment is configured.
 *
 * @throws Exits process with code 1 if CQL is not configured
 * @internal
 */
function checkCQLConfig(): void {
  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  if (!endpoint) {
    logger.fail('CQL_BLOCK_PRODUCER_ENDPOINT is not set');
    console.log('\nSet the environment variable or start Jeju:');
    console.log('  cd /path/to/jeju && jeju dev');
    process.exit(1);
  }
}

/**
 * Tests the CQL connection and displays connection info.
 *
 * @internal
 */
async function testConnection(): Promise<void> {
  logger.header('Testing CQL Connection');

  checkCQLConfig();

  logger.step('Initializing CQL client...');
  await initializeDB();

  logger.step('Checking health...');
  const cqlDb = getDB();
  const healthy = await cqlDb.isHealthy();

  if (!healthy) {
    logger.fail('CQL is not healthy');
    console.log('\nEnsure Jeju is running:');
    console.log('  cd /path/to/jeju && jeju dev');
    process.exit(1);
  }

  logger.success('CQL connection established');
  await showConnectionInfo();
}

/**
 * Displays the current database status.
 *
 * Shows connection state, health status, and configuration.
 *
 * @internal
 */
async function showStatus(): Promise<void> {
  logger.header('Database Status (CQL)');

  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  const databaseId = process.env.CQL_DATABASE_ID || 'babylon';

  if (!endpoint) {
    console.log('Status: ❌ Not configured');
    console.log('\nCQL_BLOCK_PRODUCER_ENDPOINT is not set.');
    console.log('Start Jeju: cd /path/to/jeju && jeju dev');
    return;
  }

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Database: ${databaseId}`);

  logger.step('Checking CQL health...');

  await initializeDB();
  const cqlDb = getDB();
  const healthy = await cqlDb.isHealthy();

  if (healthy) {
    console.log('Status: ✅ Connected');

    const blockHeight = await cqlDb.getBlockHeight();
    console.log(`Block Height: ${blockHeight}`);
  } else {
    console.log('Status: ❌ Unhealthy');
    console.log('\nEnsure Jeju is running:');
    console.log('  cd /path/to/jeju && jeju dev');
  }
}

/**
 * Displays database connection information.
 *
 * @internal
 */
async function showConnectionInfo(): Promise<void> {
  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT || 'not set';
  const databaseId = process.env.CQL_DATABASE_ID || 'babylon';
  const timeout = process.env.CQL_TIMEOUT || '30000';
  const debug = process.env.CQL_DEBUG || 'false';

  console.log('\nConnection Info:');
  console.log(`  Endpoint:    ${endpoint}`);
  console.log(`  Database ID: ${databaseId}`);
  console.log(`  Timeout:     ${timeout}ms`);
  console.log(`  Debug:       ${debug}`);

  const cqlDb = getDB();
  if (cqlDb.isInitialized()) {
    const blockHeight = await cqlDb.getBlockHeight();
    console.log(`  Block Height: ${blockHeight}`);
  }
}

/**
 * Seeds the database with initial data.
 *
 * Runs the seed script to populate the database with actors, organizations,
 * and other initial data. Requires CQL connection.
 *
 * @internal
 */
async function seedDatabase(args: string[]): Promise<void> {
  logger.header('Seeding Database');

  checkCQLConfig();

  logger.step('Initializing CQL...');
  await initializeDB();

  const cqlDb = getDB();
  const healthy = await cqlDb.isHealthy();
  if (!healthy) {
    logger.fail('CQL is not healthy');
    console.log('Start Jeju first: cd /path/to/jeju && jeju dev');
    process.exit(1);
  }

  logger.step('Running seed script...');
  const rootDir = import.meta.dirname.replace('/apps/cli/src/commands', '');
  const seedArgs = args.filter((arg) => arg.startsWith('--'));
  await $`bun run ${rootDir}/scripts/seed-database.ts ${seedArgs}`;
  logger.success('Database seeded');
}

/**
 * Shows database statistics.
 *
 * @internal
 */
async function showStats(): Promise<void> {
  logger.header('Database Statistics');

  checkCQLConfig();

  logger.step('Fetching stats...');
  const rootDir = import.meta.dirname.replace('/apps/cli/src/commands', '');
  await $`bun run ${rootDir}/scripts/seed-database.ts --stats`;
}

/**
 * Resets the database by clearing all data.
 *
 * **Warning:** This will delete all data!
 *
 * @internal
 */
async function resetDatabase(): Promise<void> {
  logger.header('Resetting Database');

  logger.warn('This will delete all data!');

  checkCQLConfig();

  logger.step('Initializing CQL...');
  await initializeDB();

  const cqlDb = getDB();
  const healthy = await cqlDb.isHealthy();
  if (!healthy) {
    logger.fail('CQL is not healthy');
    process.exit(1);
  }

  logger.step('Clearing database...');

  // Get list of all tables and truncate them
  // Note: CQL/SQLite uses sqlite_master, not information_schema
  const tables = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cql_%'`
  );

  for (const table of tables) {
    logger.step(`Clearing table: ${table.name}`);
    await db.exec(`DELETE FROM "${table.name}"`);
  }

  logger.success('Database reset complete');

  // Reset the client to clear any cached state
  resetDB();
}

/**
 * Main entry point for database domain commands.
 *
 * Routes to appropriate sub-command handlers based on parsed arguments.
 *
 * **Supported Commands:**
 * - `status` - Show CQL database status
 * - `connect` - Test CQL connection
 * - `seed` - Seed database with initial data
 * - `stats` - Show database statistics
 * - `reset` - Reset database (clear all data)
 *
 * @param args - Raw command-line arguments for the database domain
 * @throws Exits process with code 1 on error, 0 on success
 */
export async function runDbCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (wantsHelp(parsed)) {
    printHelp();
    process.exit(0);
  }

  switch (parsed.command) {
    case 'status':
      await showStatus();
      break;

    case 'connect':
      await testConnection();
      break;

    case 'seed':
      await seedDatabase(args);
      break;

    case 'stats':
      await showStats();
      break;

    case 'reset':
      await resetDatabase();
      break;

    // Legacy commands - provide helpful migration messages
    case 'start':
    case 'stop':
    case 'restart':
      logger.warn(`The '${parsed.command}' command is not needed with CQL.`);
      console.log('\nCQL connects to a Jeju block producer instance.');
      console.log('Start Jeju instead: cd /path/to/jeju && jeju dev');
      break;

    case 'migrate':
      logger.warn("The 'migrate' command is not needed with CQL.");
      console.log('\nCQL handles schema management automatically.');
      console.log('Use "babylon db status" to check connection health.');
      break;

    default:
      if (parsed.command) {
        logger.fail(`Unknown command: ${parsed.command}`);
      }
      printHelp();
      process.exit(parsed.command ? 1 : 0);
  }
}
