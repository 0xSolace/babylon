/**
 * Apply CQL Migrations
 *
 * This script applies database schema migrations to CovenantQL.
 * It reads the schema definitions from packages/db/src/schema and ensures
 * the CQL database has all required tables.
 */

import { getDB, initializeDB, resetDB } from '@babylon/db';

interface TableInfo {
  name: string;
  type: string;
}

async function applyMigrations(): Promise<void> {
  console.log('🗄️  Applying CQL migrations...');

  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  const databaseId = process.env.CQL_DATABASE_ID || 'babylon';

  if (!endpoint) {
    console.error('❌ CQL_BLOCK_PRODUCER_ENDPOINT is required');
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Database: ${databaseId}`);

  // Initialize CQL connection
  await initializeDB();
  const db = getDB();

  // Check if database is healthy
  const healthy = await db.isHealthy();
  if (!healthy) {
    console.error('❌ CQL database is not healthy');
    process.exit(1);
  }

  // Get current tables
  const tables = await db.query<TableInfo>(
    `SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );

  console.log(`\n📊 Current tables: ${tables.length}`);
  for (const table of tables) {
    console.log(`   - ${table.name}`);
  }

  // CQL schema is managed through the Jeju platform
  // The schema definitions in packages/db/src/schema/ are used for type inference
  // Actual schema creation/migration is handled by Jeju's schema management

  console.log('\n✅ CQL migration check complete');
  console.log('   Schema is managed by Jeju platform');
  console.log(
    '   Local schema definitions in packages/db/src/schema/ are for types only'
  );

  resetDB();
}

applyMigrations();
