/**
 * Unit Test Setup
 *
 * Provides mocked database client and other dependencies for unit tests.
 * Unit tests should not require a real database connection.
 */

import { beforeAll, mock } from 'bun:test'
import type { MockDatabaseClient, MockTransactionFn } from '../types/test-types'

// Mock database client for all unit tests
beforeAll(() => {
  // Set test environment variables for decentralized services
  // Service URLs are loaded from @jejunetwork/config based on JEJU_NETWORK
  ;(process.env as Record<string, string>).NODE_ENV = 'test'
  process.env.JEJU_NETWORK = 'localnet'
  process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4661'
  process.env.SQLIT_DATABASE_ID = 'babylon_test'

  // Mock the database module entirely
  mock.module('@babylon/db', () => {
    const mockDatabase = createMockDatabase()
    return {
      db: mockDatabase,
      dbBase: mockDatabase,
    }
  })

  // Mock decentralized cache
  mock.module('@babylon/api/cache', () => {
    const mockCache = {
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(true)),
      exists: mock(() => Promise.resolve(false)),
      ttl: mock(() => Promise.resolve(-1)),
      expire: mock(() => Promise.resolve(true)),
      keys: mock(() => Promise.resolve([])),
      flush: mock(() => Promise.resolve()),
      healthCheck: mock(() => Promise.resolve(true)),
      incr: mock(() => Promise.resolve(1)),
      decr: mock(() => Promise.resolve(0)),
    }
    return {
      getCache: mock(() => mockCache),
      initializeCache: mock(() => Promise.resolve(mockCache)),
      isCacheServiceReachable: mock(() => Promise.resolve(true)),
      CacheClient: class MockCacheClient {
        async initialize() {}
        async get() {
          return null
        }
        async set() {}
        async delete() {
          return true
        }
        async exists() {
          return false
        }
        async healthCheck() {
          return true
        }
      },
    }
  })
})

/**
 * Create a mock database client with all necessary models
 */
function createMockDatabase() {
  const mockModels = [
    'user',
    'actor',
    'pool',
    'market',
    'position',
    'trade',
    'post',
    'comment',
    'worldFact',
    'parodyHeadline',
    'waitlistEntry',
    'points',
    'marketOutcome',
    'vote',
    'marketSpotlight',
    'userGroup',
    'userGroupMember',
    'actorFollow',
    'userActorFollow',
    'actorRelationship',
    'nPCTrade',
    'marketPool',
    'liquidityPosition',
    'swap',
    'userStats',
    'aiPrompt',
    'threadMessage',
    'userGroupAdmin',
    'userGroupInvite',
    'article',
    'rSSFeedItem',
    'rSSFeedSource',
    'rSSHeadline',
    'conversation',
    'notification',
    'fact',
    'factCategoryBlacklist',
    'factResponse',
    'topicCategory',
    'stickerPackCollectionInfo',
    'leaderboardResults',
    'onChainUserMapping',
    'automationTask',
    'automationLog',
    'automationCampaign',
    'feedback',
    'reputationLog',
    'achievements',
    // Agent-related models
    'agentGoal',
    'agentGoalAction',
    'agentMessage',
    'agentLog',
    'agentPointsTransaction',
    'agentPerformanceMetrics',
    // Trajectory and training models
    'trajectory',
    'trainingBatch',
    'trainedModel',
    'llmCallLog',
    'rewardJudgment',
  ]

  // Initialize base mock client - model methods are added dynamically below
  const mockClient = {
    $connect: mock(() => Promise.resolve()),
    $disconnect: mock(() => Promise.resolve()),
    $queryRaw: mock(() => Promise.resolve([])),
    $executeRaw: mock(() => Promise.resolve(0)),
    $transaction: mock(async (fn: MockTransactionFn) => {
      // Execute the transaction function with the mock client
      return await fn(mockClient as MockDatabaseClient)
    }),
  } as MockDatabaseClient

  // Add mock methods for each database model
  for (const modelName of mockModels) {
    mockClient[modelName] = {
      findUnique: mock(() => Promise.resolve(null)),
      findMany: mock(() => Promise.resolve([])),
      findFirst: mock(() => Promise.resolve(null)),
      count: mock(() => Promise.resolve(0)),
      create: mock(() => Promise.resolve({ id: 'mock-id' })),
      createMany: mock(() => Promise.resolve({ count: 0 })),
      update: mock(() => Promise.resolve({ id: 'mock-id' })),
      updateMany: mock(() => Promise.resolve({ count: 0 })),
      upsert: mock(() => Promise.resolve({ id: 'mock-id' })),
      delete: mock(() => Promise.resolve({ id: 'mock-id' })),
      deleteMany: mock(() => Promise.resolve({ count: 0 })),
      aggregate: mock(() =>
        Promise.resolve({
          _count: 0,
          _sum: null,
          _avg: null,
          _min: null,
          _max: null,
        }),
      ),
      groupBy: mock(() => Promise.resolve([])),
    }
  }

  return mockClient
}

export { createMockDatabase }
