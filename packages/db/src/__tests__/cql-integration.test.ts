/**
 * CQL Integration Test
 *
 * Verifies that Babylon can:
 * 1. Initialize a database through DWS/CQL
 * 2. Create tables properly
 * 3. Persist data across restarts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { BABYLON_SCHEMAS } from '../decentralized/cql-schema'
import { db, getDB, initializeDatabase, initializeDB, resetDB } from '../index'

// Skip tests if CQL is not available
const CQL_AVAILABLE = await checkCQLHealth()

async function checkCQLHealth(): Promise<boolean> {
  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT || 'http://localhost:4661'
  try {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

describe.skipIf(!CQL_AVAILABLE)('CQL Integration', () => {
  beforeAll(async () => {
    // Set environment for localnet
    process.env.JEJU_NETWORK = 'localnet'
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4661'
    process.env.CQL_DATABASE_ID = 'babylon-test'

    // Reset any existing connection and initialize
    resetDB()
    await initializeDatabase()
  })

  afterAll(() => {
    resetDB()
  })

  test('should initialize database connection', async () => {
    // Database already initialized in beforeAll, just verify it works
    const dbInstance = getDB()
    expect(dbInstance.isInitialized()).toBe(true)
  })

  test('should create tables from schema', async () => {
    const dbInstance = getDB()

    // Verify tables exist by running a simple query
    // Table names are PascalCase in CQL
    const tables = ['User', 'Market', 'Position', 'Post', 'Chat', 'Message']

    for (const table of tables) {
      // Each table query should succeed (even if returning 0 rows)
      const result = await dbInstance.query(
        `SELECT COUNT(*) as count FROM "${table}" LIMIT 1`,
      )
      expect(result).toBeDefined()
    }
  })

  test('should generate correct DDL for all schemas', () => {
    // Verify we have schemas defined
    expect(BABYLON_SCHEMAS.length).toBeGreaterThan(0)

    // Each schema should have required properties
    for (const schema of BABYLON_SCHEMAS) {
      expect(schema.name).toBeDefined()
      expect(schema.columns).toBeDefined()
      expect(schema.columns.length).toBeGreaterThan(0)
      expect(schema.primaryKey).toBeDefined()
    }
  })

  test('should persist data across queries', async () => {
    const dbInstance = getDB()
    const testId = `test-${Date.now()}`

    // Insert a test user
    await dbInstance.exec(
      `INSERT INTO "User" (id, "createdAt", "updatedAt") VALUES (?, datetime('now'), datetime('now'))`,
      [testId],
    )

    // Query it back
    const result = await dbInstance.queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE id = ?',
      [testId],
    )

    expect(result).not.toBeNull()
    expect(result?.id).toBe(testId)

    // Clean up
    await dbInstance.exec('DELETE FROM "User" WHERE id = ?', [testId])
  })

  test('should support transactions', async () => {
    const dbInstance = getDB()
    const testId1 = `tx-test-1-${Date.now()}`
    const testId2 = `tx-test-2-${Date.now()}`

    // Execute a transaction
    await dbInstance.transaction(async (ctx) => {
      await ctx.exec(
        `INSERT INTO "User" (id, "createdAt", "updatedAt") VALUES (?, datetime('now'), datetime('now'))`,
        [testId1],
      )
      await ctx.exec(
        `INSERT INTO "User" (id, "createdAt", "updatedAt") VALUES (?, datetime('now'), datetime('now'))`,
        [testId2],
      )
    })

    // Verify both were inserted
    const count = await dbInstance.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM "User" WHERE id IN (?, ?)',
      [testId1, testId2],
    )

    expect(count?.count).toBe(2)

    // Clean up
    await dbInstance.exec('DELETE FROM "User" WHERE id IN (?, ?)', [
      testId1,
      testId2,
    ])
  })

  test('db client should work with repository pattern', async () => {
    // Use the db client directly (lazy proxy)
    const testId = `repo-test-${Date.now()}`

    // This should use the CQL-backed repository
    const user = await db.user.create({
      data: {
        id: testId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    expect(user).toBeDefined()
    expect(user.id).toBe(testId)

    // Query it back
    const found = await db.user.findUnique({
      where: { id: testId },
    })

    expect(found).not.toBeNull()
    expect(found?.id).toBe(testId)

    // Clean up
    await db.user.delete({
      where: { id: testId },
    })
  })
})

describe.skipIf(!CQL_AVAILABLE)('CQL Persistence', () => {
  beforeAll(async () => {
    process.env.JEJU_NETWORK = 'localnet'
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4661'
    process.env.CQL_DATABASE_ID = 'babylon-persistence-test'
    resetDB()
    await initializeDatabase()
  })

  afterAll(() => {
    resetDB()
  })

  test('should persist data in CQL data directory', async () => {
    const dbInstance = await initializeDB()
    const testId = `persist-${Date.now()}`

    // Insert test data
    await dbInstance.exec(
      `INSERT INTO "User" (id, "createdAt", "updatedAt") VALUES (?, datetime('now'), datetime('now'))`,
      [testId],
    )

    // Verify it exists
    const result = await dbInstance.queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE id = ?',
      [testId],
    )
    expect(result?.id).toBe(testId)

    // Reset connection and reconnect
    resetDB()
    const newDbInstance = await initializeDB()

    // Data should still exist (persisted to disk)
    const afterReset = await newDbInstance.queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE id = ?',
      [testId],
    )

    expect(afterReset?.id).toBe(testId)

    // Clean up
    await newDbInstance.exec('DELETE FROM "User" WHERE id = ?', [testId])
  })

  test('should handle block height tracking', async () => {
    const dbInstance = await initializeDB()

    // Get current block height
    const blockHeight = await dbInstance.getBlockHeight()

    // Block height should be a positive number
    expect(blockHeight).toBeGreaterThan(0)
  })

  test('should report healthy status', async () => {
    const dbInstance = await initializeDB()
    const healthy = await dbInstance.isHealthy()
    expect(healthy).toBe(true)
  })
})
