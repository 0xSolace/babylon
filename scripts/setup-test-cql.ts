/**
 * Setup Test CQL Database
 *
 * This script initializes a test CQL database for CI/CD pipelines.
 * It ensures the database is healthy and ready for tests.
 */

import { getDB, initializeDB, resetDB } from '@babylon/db';

interface TableInfo {
  name: string;
  type: string;
}

async function setupTestDatabase(): Promise<void> {
  console.log('🧹 Setting up test CQL database...');

  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  const databaseId = process.env.CQL_DATABASE_ID || 'test_babylon';

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

  console.log('✅ CQL database is healthy');

  // Get current tables
  const tables = await db.query<TableInfo>(
    `SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );

  console.log(`\n📊 Tables in database: ${tables.length}`);

  // For test database, we may want to clear data
  if (process.env.CLEAR_TEST_DATA === 'true') {
    console.log('\n🗑️  Clearing test data...');
    for (const table of tables) {
      await db.exec(`DELETE FROM "${table.name}"`);
      console.log(`   Cleared: ${table.name}`);
    }
  }

  console.log('\n✅ Test CQL database setup complete');

  resetDB();
}

setupTestDatabase();
