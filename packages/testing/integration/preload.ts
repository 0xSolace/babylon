/**
 * Preload file for integration tests
 *
 * This file is loaded before all integration tests to:
 * 1. Set up proper test environment
 * 2. Check Jeju infrastructure health
 * 3. Configure database for test isolation
 * 4. Set up graceful cleanup handlers
 * 5. Configure LLM timeouts for faster test failures
 *
 * Prerequisites:
 * - Jeju CLI running: cd /path/to/jeju && bun run dev
 *
 * @module testing/integration/preload
 */

// Set test environment first (before any imports)
;(process.env as Record<string, string>).NODE_ENV = 'test'
;(process.env as Record<string, string>).BUN_ENV = 'test'

// Reduce LLM timeout for tests (30 seconds instead of default)
process.env.LLM_TIMEOUT_MS = '30000'

import { db } from '@babylon/db'
import {
  checkCoreServices,
  isJejuRunning,
  printStatus,
} from '../infrastructure/health-check'

/**
 * Removes stale generation locks that may interfere with test execution.
 */
async function cleanupStaleLocks(): Promise<void> {
  try {
    const expiredLocks = await db.generationLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    if (expiredLocks.count > 0) {
      console.log(
        `[Test Preload] Cleaned up ${expiredLocks.count} expired generation locks`,
      )
    }

    const testLocks = await db.generationLock.deleteMany({
      where: {
        OR: [
          { id: { contains: 'test' } },
          { lockedBy: { contains: 'test' } },
          {
            AND: [
              { lockedBy: { startsWith: 'serverless-' } },
              { lockedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
            ],
          },
        ],
      },
    })

    if (testLocks.count > 0) {
      console.log(
        `[Test Preload] Cleaned up ${testLocks.count} test-related locks`,
      )
    }
  } catch (err) {
    // Table might not exist yet
    console.log(
      `[Test Preload] Lock cleanup skipped: ${(err as Error).message}`,
    )
  }
}

/**
 * Removes test data that may interfere with other tests.
 */
async function cleanupTestData(): Promise<void> {
  try {
    const testUsers = await db.user.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'test-' } },
          { username: { startsWith: 'lock-test-' } },
          { username: { startsWith: 'endpoint-lock-' } },
          { username: { contains: 'integration-test' } },
        ],
      },
    })

    if (testUsers.count > 0) {
      console.log(`[Test Preload] Cleaned up ${testUsers.count} test users`)
    }

    // Clean up test questions/markets created in previous runs
    const oldTestQuestions = await db.question.deleteMany({
      where: {
        AND: [
          { text: { startsWith: 'Integration test:' } },
          { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
        ],
      },
    })

    if (oldTestQuestions.count > 0) {
      console.log(
        `[Test Preload] Cleaned up ${oldTestQuestions.count} old test questions`,
      )
    }

    const oldTestMarkets = await db.market.deleteMany({
      where: {
        AND: [
          { question: { startsWith: 'Integration test:' } },
          { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
        ],
      },
    })

    if (oldTestMarkets.count > 0) {
      console.log(
        `[Test Preload] Cleaned up ${oldTestMarkets.count} old test markets`,
      )
    }
  } catch (err) {
    // Tables might not exist yet
    console.log(
      `[Test Preload] Data cleanup skipped: ${(err as Error).message}`,
    )
  }
}

// Global flag to track if database is available
let dbAvailable = false

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return dbAvailable
}

/**
 * Initialize test environment
 */
async function initializeTestEnvironment(): Promise<void> {
  console.log('[Test Preload] Initializing integration test environment...')

  // Check if Jeju CLI is running
  const jejuRunning = await isJejuRunning()
  if (!jejuRunning) {
    console.error('[Test Preload] ❌ Jeju CLI is not running!')
    console.error('')
    console.error('Please start Jeju services:')
    console.error('  cd /path/to/jeju && bun run dev')
    console.error('')
    console.error('Tests will attempt to run but may fail.')
  } else {
    console.log('[Test Preload] ✅ Jeju CLI detected')
  }

  // Check core services
  console.log('[Test Preload] Checking core services...')
  const coreStatus = await checkCoreServices()

  if (!coreStatus.healthy) {
    printStatus(coreStatus)
    console.warn(
      `[Test Preload] ⚠️ Some services not healthy: ${coreStatus.missingServices.join(', ')}`,
    )
    console.warn('[Test Preload] Tests requiring these services may fail')
  } else {
    console.log('[Test Preload] ✅ Core services ready')
  }

  // Verify database connection
  try {
    await db.$queryRaw`SELECT 1`
    console.log('[Test Preload] ✅ Database connection verified')
    dbAvailable = true

    // Clean up stale data from previous test runs
    await cleanupStaleLocks()
    await cleanupTestData()
  } catch (err) {
    console.warn(
      `[Test Preload] ⚠️ Database not available: ${(err as Error).message}`,
    )
    console.warn('[Test Preload] Tests requiring database will be skipped')
    dbAvailable = false
  }

  console.log('[Test Preload] Integration test environment ready')
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(): Promise<void> {
  console.log('[Test Preload] Shutting down test environment...')

  try {
    // Clean up any remaining test data
    if (dbAvailable) {
      await cleanupStaleLocks()
    }

    // Disconnect database
    await db.$disconnect()
    console.log('[Test Preload] Database disconnected')
  } catch {
    // Ignore errors during shutdown
  }
}

// Run initialization
initializeTestEnvironment().catch((error) => {
  console.error('[Test Preload] Failed to initialize:', error)
  // Don't exit - let tests handle missing infrastructure gracefully
})

// Register shutdown handlers
process.on('beforeExit', gracefulShutdown)
process.on('SIGINT', async () => {
  await gracefulShutdown()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await gracefulShutdown()
  process.exit(0)
})

// Export utilities for tests to use
export { cleanupStaleLocks, cleanupTestData }
