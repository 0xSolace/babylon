/**
 * Unit Tests for AutomationPipeline
 *
 * Tests core functionality without external dependencies
 * Uses SQLit mocks for database operations
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'

// Tests use mocked db module
const describeTests = describe

import type {
  AutomationConfig,
  AutomationPipeline as AutomationPipelineType,
} from '@babylon/training'

// Type for pipeline with private properties/methods exposed for testing
// Uses a structural type to access private members in tests
interface PipelineTestAccess {
  config: AutomationConfig
  getNextModelVersion: () => Promise<string>
  getTrajectoryIds: (limit?: number) => Promise<string[]>
  runTrainingPipeline: () => Promise<void>
  processTrainingBatch: () => Promise<void>
  evaluateModel: () => Promise<void>
  runHealthChecks: () => Promise<void>
}

// Helper to access private members for testing purposes
// This is a test-only utility that bypasses TypeScript's access modifiers
const asTestAccess = (pipeline: AutomationPipelineType): PipelineTestAccess =>
  pipeline as never as PipelineTestAccess

// Type for mock function with mockClear
interface MockFunction {
  mockClear?: () => void
}

// Store mock results for repository methods - these are consumed in order by tests
let mockCountResults: number[] = []
let mockGroupByResults: Array<{ scenarioId: string; _count: number }>[] = []
let mockFindManyResults: unknown[][] = []
let mockTrainedModelFindFirstResults: Array<{ version: string } | null> = []
// Unused but kept for potential future use
// let mockTrainingBatchSelectResults: unknown[][] = [];

// Helper to get the next count result
const getNextCountResult = () => mockCountResults.shift() ?? 0

// Helper to get the next groupBy result
const getNextGroupByResult = () => mockGroupByResults.shift() ?? []

// Helper to get the next findMany result
const getNextFindManyResult = () => mockFindManyResults.shift() ?? []

// Helper to get the next trainedModel.findFirst result
const getNextTrainedModelFindFirstResult = () =>
  mockTrainedModelFindFirstResults.shift() ?? null

// Helper to get the next trainingBatch select result (unused but kept for future use)
// const _getNextTrainingBatchSelectResult = () =>
//   mockTrainingBatchSelectResults.shift() ?? [];

// Store mock results for trainingBatch.findUnique
let mockTrainingBatchFindUniqueResults: Array<{
  batchId: string
  status: string
  error: string | null
} | null> = []

// Helper to get the next trainingBatch.findUnique result
const getNextTrainingBatchFindUniqueResult = () =>
  mockTrainingBatchFindUniqueResults.shift() ?? null

// Store mock results for trainingBatch.findFirst
let mockTrainingBatchFindFirstResults: Array<{
  completedAt: Date | null
} | null> = []
const getNextTrainingBatchFindFirstResult = () =>
  mockTrainingBatchFindFirstResults.shift() ?? null

// Store mock results for trainedModel.count
let mockTrainedModelCountResults: number[] = []
const getNextTrainedModelCountResult = () =>
  mockTrainedModelCountResults.shift() ?? 0

// Store mock results for trainingBatch.count
let mockTrainingBatchCountResults: number[] = []
const getNextTrainingBatchCountResult = () =>
  mockTrainingBatchCountResults.shift() ?? 0

// Store mock results for user.count
let mockUserCountResults: number[] = []
let mockUserCountShouldThrow = false
const getNextUserCountResult = () => {
  if (mockUserCountShouldThrow) {
    mockUserCountShouldThrow = false // Reset after throwing
    throw new Error('DB Error')
  }
  return mockUserCountResults.shift() ?? 0
}

// Create a chainable SQLit query builder mock for select queries
const createQueryChain = () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
  }

  return Object.assign(chain, {
    // biome-ignore lint/suspicious/noThenProperty: Mock object for testing, needs then for promise-like behavior
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (error: Error) => void,
    ) => Promise.resolve([]).then(resolve, reject),
    catch: (reject: (error: Error) => void) =>
      Promise.resolve([]).catch(reject),
    [Symbol.toStringTag]: 'Promise',
  })
}

// Define mocks for SQLit db client
const mockDb = {
  // SQLit query builder methods
  select: mock(() => createQueryChain()),
  insert: mock(() => ({
    values: () => ({
      returning: () => Promise.resolve([{ id: 'mock-id' }]),
      onConflictDoNothing: () => Promise.resolve(),
    }),
  })),
  update: mock(() => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  })),
  delete: mock(() => ({
    where: () => ({
      returning: () => Promise.resolve([]),
    }),
  })),
  // Raw SQLit query methods
  query: mock(async () => []),
  queryOne: mock(async () => null),
  exec: mock(async () => ({ rowsAffected: 0 })),
  $queryRaw: mock(() => Promise.resolve([{ result: 1 }])),
  $executeRaw: mock(() => Promise.resolve(0)),
  // SQLit table repositories
  trajectory: {
    count: mock(() => Promise.resolve(getNextCountResult())),
    groupBy: mock(async () => getNextGroupByResult()),
    findMany: mock(async () => getNextFindManyResult()),
    findFirst: mock(() => Promise.resolve(null)),
    updateMany: mock(() => Promise.resolve({ count: 0 })),
  },
  trainingBatch: {
    create: mock(() => Promise.resolve({ id: 'batch-1' })),
    findUnique: mock(() =>
      Promise.resolve(getNextTrainingBatchFindUniqueResult()),
    ),
    findFirst: mock(() =>
      Promise.resolve(getNextTrainingBatchFindFirstResult()),
    ),
    count: mock(() => Promise.resolve(getNextTrainingBatchCountResult())),
    update: mock(() => Promise.resolve({})),
  },
  trainedModel: {
    findFirst: mock(() =>
      Promise.resolve(getNextTrainedModelFindFirstResult()),
    ),
    create: mock(() => Promise.resolve({ id: 'model-1' })),
    count: mock(() => Promise.resolve(getNextTrainedModelCountResult())),
    update: mock(() => Promise.resolve({})),
  },
  user: {
    count: mock(() => Promise.resolve(getNextUserCountResult())),
  },
}

const mockLogger = {
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock(),
}

// Mock modules - using @babylon/db since AutomationPipeline imports from there
// Include all exports that may be imported by AutomationPipeline and its dependencies
mock.module('@babylon/db', () => ({
  db: mockDb,
  // SQLit initialization functions
  initializeDB: mock(async () => {}),
  resetDB: mock(() => {}),
  getDB: mock(() => mockDb),
  // Tables (as empty objects since we're mocking db methods)
  // Core tables
  users: {},
  actorState: {},
  posts: {},
  comments: {},
  reactions: {},
  shares: {},
  messages: {},
  chats: {},
  chatParticipants: {},
  notifications: {},
  // Agent-related tables
  agentLogs: {},
  agentMessages: {},
  agentPerformanceMetrics: {},
  agentGoals: {},
  agentGoalActions: {},
  agentPointsTransactions: {},
  agentTrades: {},
  agentRegistries: {},
  agentCapabilities: {},
  externalAgentConnections: {},
  npcInteractions: {},
  npcTrades: {},
  // Training tables
  trajectories: {},
  trainingBatches: {},
  trainedModels: {},
  benchmarkResults: {},
  llmCallLogs: {},
  marketOutcomes: {},
  rewardJudgments: {},
  // Other tables
  worldFacts: {},
  worldEvents: {},
  referrals: {},
  pointsTransactions: {},
  balanceTransactions: {},
  markets: {},
  positions: {},
  perpPositions: {},
  pools: {},
  poolPositions: {},
  poolDeposits: {},
  organizationState: {},
  stockPrices: {},
  questions: {},
  predictionPriceHistories: {},
  favorites: {},
  follows: {},
  followStatuses: {},
  tags: {},
  postTags: {},
  trendingTags: {},
  actorFollows: {},
  actorRelationships: {},
  userActorFollows: {},
  userInteractions: {},
  tradingFees: {},
  feedbacks: {},
  reports: {},
  moderationEscrows: {},
  // Operators
  eq: () => ({}),
  and: () => ({}),
  or: () => ({}),
  sql: () => ({}),
  desc: () => ({}),
  asc: () => ({}),
  gte: () => ({}),
  lte: () => ({}),
  gt: () => ({}),
  lt: () => ({}),
  ne: () => ({}),
  isNull: () => ({}),
  isNotNull: () => ({}),
  not: () => ({}),
  count: () => ({}),
  inArray: () => ({}),
  notInArray: () => ({}),
  like: () => ({}),
  ilike: () => ({}),
  between: () => ({}),
  exists: () => ({}),
  notExists: () => ({}),
  sum: () => ({}),
  avg: () => ({}),
  min: () => ({}),
  max: () => ({}),
  // Types (for satisfying type imports)
  Trajectory: {},
  TrainingBatch: {},
  TrainedModel: {},
}))

mock.module('@babylon/shared', () => ({
  logger: mockLogger,
}))

// Mock the training package logger
// AutomationPipeline imports from '../utils/logger' relative to its location
// We need to mock it using the package export path
mock.module('@babylon/training/utils/logger', () => ({
  logger: mockLogger,
}))

// Mock fs module for health checks
const mockMkdir = mock(() => Promise.resolve(undefined))
const mockAccess = mock(() => Promise.resolve(undefined))
const mockStat = mock(() => Promise.resolve({ size: 1000000 }))
mock.module('node:fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    access: mockAccess,
    stat: mockStat,
  },
  mkdir: mockMkdir,
  access: mockAccess,
  stat: mockStat,
}))

// Set SQLit endpoint to prevent database from complaining
// This must be done before importing the module
process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT =
  process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT || 'http://localhost:4661'

import { AutomationPipeline } from '@babylon/training/training'

describeTests('AutomationPipeline - Unit Tests', () => {
  let pipeline: AutomationPipelineType
  let mockConfig: Partial<AutomationConfig>

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockDb).forEach((model) => {
      if (typeof model === 'object') {
        Object.values(model).forEach((fn) => {
          const mockFn = fn as MockFunction
          mockFn.mockClear?.()
        })
      } else {
        const mockFn = model as MockFunction
        mockFn.mockClear?.()
      }
    })
    Object.values(mockLogger).forEach((fn) => {
      fn.mockClear()
    })

    // Reset query result queues
    mockCountResults = []
    mockGroupByResults = []
    mockFindManyResults = []
    mockTrainedModelFindFirstResults = []
    mockTrainingBatchFindUniqueResults = []
    mockTrainingBatchFindFirstResults = []
    mockTrainedModelCountResults = []
    mockTrainingBatchCountResults = []
    mockUserCountResults = []

    mockConfig = {
      minTrajectoriesForTraining: 50,
      minGroupSize: 3,
      dataQualityThreshold: 0.9,
      autoTriggerTraining: true,
      trainingInterval: 12,
      baseModel: 'unsloth/Qwen3-4B-128K',
      modelNamePrefix: 'test-model',
      atroposApiUrl: 'http://localhost:8000',
      vllmPort: 9001,
      modelStoragePath: '/tmp/test-models',
      dataStoragePath: '/tmp/test-data',
    }

    pipeline = new AutomationPipeline(mockConfig)
  })

  describe('Configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultPipeline = new AutomationPipeline()
      const status = defaultPipeline.getConfig()

      // Check that it uses environment variables if set, or defaults to 1
      // Logic matches implementation: must be finite and > 0
      const envMinTraj = Number.parseInt(
        process.env.TRAINING_MIN_TRAJECTORIES || '',
        10,
      )
      const expectedMinTrajectories =
        Number.isFinite(envMinTraj) && envMinTraj > 0 ? envMinTraj : 1

      const envMinGroup = Number.parseInt(
        process.env.TRAINING_MIN_GROUP_SIZE || '',
        10,
      )
      const expectedMinGroupSize =
        Number.isFinite(envMinGroup) && envMinGroup > 0 ? envMinGroup : 1

      expect(status.minTrajectoriesForTraining).toBe(expectedMinTrajectories)
      expect(status.minGroupSize).toBe(expectedMinGroupSize)
      expect(status.dataQualityThreshold).toBe(0.95)
      expect(status.baseModel).toBe('unsloth/Qwen3-4B-128K')
    })

    test('should merge custom config with defaults', () => {
      // Access private config property for testing
      const pipelineWithPrivate = asTestAccess(pipeline)
      const config = pipelineWithPrivate.config

      expect(config.minTrajectoriesForTraining).toBe(50)
      expect(config.minGroupSize).toBe(3)
      expect(config.dataQualityThreshold).toBe(0.9)
      expect(config.baseModel).toBe('unsloth/Qwen3-4B-128K')
    })

    test('should use OpenPipe model by default', () => {
      const defaultPipeline = new AutomationPipeline()
      // Access private config property for testing
      const config = asTestAccess(defaultPipeline).config
      expect(config.baseModel).toBe('unsloth/Qwen3-4B-128K')
    })

    test('should allow custom model override', () => {
      const customPipeline = new AutomationPipeline({
        baseModel: 'custom-model',
      })
      // Access private config property for testing
      const config = asTestAccess(customPipeline).config
      expect(config.baseModel).toBe('custom-model')
    })
  })

  describe('Training Readiness Check', () => {
    test('should be not ready when insufficient trajectories', async () => {
      // Setup query results in order of calls:
      // 1. scoredAndReady count
      // 2. unscored count
      // 3. scenarios groupBy
      // 4. calculateDataQuality findMany
      mockCountResults = [30, 0] // scoredAndReady=30, unscored=0
      mockGroupByResults = [[]]
      mockFindManyResults = [[]]

      const result = await pipeline.checkTrainingReadiness()

      expect(result.ready).toBe(false)
      expect(result.reason).toContain('more trajectories')
      expect(result.stats.totalTrajectories).toBe(30)
    })

    test('should be not ready when insufficient scenario groups', async () => {
      // Setup query results in order of calls:
      // 1. scoredAndReady count = 100
      // 2. unscored count = 0
      // 3. scenarios groupBy (only 2 groups, need minGroupSize)
      // 4. calculateDataQuality findMany
      mockCountResults = [100, 0] // scoredAndReady=100, unscored=0
      mockGroupByResults = [
        [
          { scenarioId: 'scenario-1', _count: 5 },
          { scenarioId: 'scenario-2', _count: 4 },
        ],
      ]
      // Data quality check - needs valid trajectory data matching TrajectoryStepSchema
      mockFindManyResults = [
        Array.from({ length: 50 }, (_, i) => ({
          trajectoryId: `traj-${i}`,
          stepsJson: JSON.stringify([
            {
              stepNumber: 0,
              timestamp: Date.now(),
              llmCalls: [
                {
                  timestamp: Date.now(),
                  model: 'test-model',
                  systemPrompt: 'a'.repeat(100),
                  userPrompt: 'b'.repeat(150),
                  response: 'Test response',
                  temperature: 0.7,
                  maxTokens: 1000,
                  purpose: 'action',
                },
              ],
              providerAccesses: [
                {
                  providerId: 'test-provider',
                  providerName: 'test',
                  timestamp: Date.now(),
                  query: { type: 'test' },
                  data: { result: 'test' },
                  purpose: 'test',
                },
              ],
              action: {
                timestamp: Date.now(),
                actionType: 'test',
                success: true,
                result: { status: 'success' },
              },
            },
          ]),
        })),
      ]

      const result = await pipeline.checkTrainingReadiness()

      expect(result.ready).toBe(false)
      expect(result.reason).toContain('scenario groups')
      expect(result.stats.scenarioGroups).toBe(2)
    })

    test('should be ready when all conditions met', async () => {
      // Good quality trajectory data matching TrajectoryStepSchema
      const goodTrajectories = Array.from({ length: 50 }, (_, i) => ({
        trajectoryId: `traj-${i}`,
        stepsJson: JSON.stringify([
          {
            stepNumber: 0,
            timestamp: Date.now(),
            llmCalls: [
              {
                timestamp: Date.now(),
                model: 'test-model',
                systemPrompt: 'a'.repeat(100),
                userPrompt: 'b'.repeat(150),
                response: 'Test response',
                temperature: 0.7,
                maxTokens: 1000,
                purpose: 'action',
              },
            ],
            providerAccesses: [
              {
                providerId: 'test-provider',
                providerName: 'test',
                timestamp: Date.now(),
                query: { type: 'test' },
                data: { result: 'test' },
                purpose: 'test',
              },
            ],
            action: {
              timestamp: Date.now(),
              actionType: 'test',
              success: true,
              result: { status: 'success' },
            },
          },
        ]),
      }))

      mockCountResults = [100, 0] // scoredAndReady=100, unscored=0
      mockGroupByResults = [
        Array.from({ length: 15 }, (_, i) => ({
          scenarioId: `scenario-${i}`,
          _count: 5,
        })),
      ]
      mockFindManyResults = [goodTrajectories]

      const result = await pipeline.checkTrainingReadiness()

      expect(result.ready).toBe(true)
      expect(result.reason).toBe('Ready to train!')
      expect(result.stats.scenarioGroups).toBeGreaterThanOrEqual(10)
    })

    test('should check data quality', async () => {
      // Mock poor quality data - valid schema but empty llmCalls = poor quality
      const poorQualityData = Array.from({ length: 50 }, () => ({
        trajectoryId: 'traj-poor-quality',
        stepsJson: JSON.stringify([
          {
            stepNumber: 0,
            timestamp: Date.now(),
            llmCalls: [], // No LLM calls = poor quality
            action: {
              timestamp: Date.now(),
              actionType: 'noop',
              success: false,
              result: {},
            },
          },
        ]),
      }))

      mockCountResults = [100, 0] // scoredAndReady=100, unscored=0
      mockGroupByResults = [
        Array.from({ length: 15 }, (_, i) => ({
          scenarioId: `scenario-${i}`,
          _count: 5,
        })),
      ]
      mockFindManyResults = [poorQualityData]

      const result = await pipeline.checkTrainingReadiness()

      expect(result.ready).toBe(false)
      expect(result.reason).toContain('quality')
      expect(result.stats.dataQuality).toBeLessThan(1.0)
    })
  })

  describe('Model Versioning', () => {
    test('should start at v1.0.0 when no models exist', async () => {
      mockTrainedModelFindFirstResults = [null] // No models exist

      // Access private method for testing
      const pipelineWithPrivate = asTestAccess(pipeline)
      const version = await pipelineWithPrivate.getNextModelVersion()

      expect(version).toBe('v1.0.0')
    })

    test('should increment patch version', async () => {
      mockTrainedModelFindFirstResults = [{ version: 'v1.0.5' }]

      // Access private method for testing
      const pipelineWithPrivate = asTestAccess(pipeline)
      const version = await pipelineWithPrivate.getNextModelVersion()

      expect(version).toBe('v1.0.6')
    })

    test('should handle double-digit versions', async () => {
      mockTrainedModelFindFirstResults = [{ version: 'v2.3.99' }]

      // Access private method for testing
      const pipelineWithPrivate = asTestAccess(pipeline)
      const version = await pipelineWithPrivate.getNextModelVersion()

      expect(version).toBe('v2.3.100')
    })
  })

  describe('Trajectory ID Retrieval', () => {
    test('should retrieve trajectory IDs for training', async () => {
      mockFindManyResults = [
        [
          { trajectoryId: 'traj-1' },
          { trajectoryId: 'traj-2' },
          { trajectoryId: 'traj-3' },
        ],
      ]

      // Access private method for testing
      const pipelineWithPrivate = asTestAccess(pipeline)
      const ids = await pipelineWithPrivate.getTrajectoryIds(3)

      expect(ids).toEqual(['traj-1', 'traj-2', 'traj-3'])
    })

    test('should retrieve all trajectories when no limit', async () => {
      mockFindManyResults = [
        [{ trajectoryId: 'traj-1' }, { trajectoryId: 'traj-2' }],
      ]

      // Access private method for testing
      const ids = await asTestAccess(pipeline).getTrajectoryIds()

      expect(ids).toHaveLength(2)
    })
  })

  describe('Training Monitoring', () => {
    test('should return not_found for non-existent batch', async () => {
      mockTrainingBatchFindUniqueResults = [null] // No batch found

      const status = await pipeline.monitorTraining('non-existent')

      expect(status.status).toBe('not_found')
    })

    test('should return training status', async () => {
      mockTrainingBatchFindUniqueResults = [
        {
          batchId: 'batch-1',
          status: 'training',
          error: null,
        },
      ]

      const status = await pipeline.monitorTraining('batch-1')

      expect(status.status).toBe('training')
      expect(status.progress).toBe(0.5)
      expect(status.eta).toBeDefined()
    })

    test('should return completed status', async () => {
      mockTrainingBatchFindUniqueResults = [
        {
          batchId: 'batch-1',
          status: 'completed',
          error: null,
        },
      ]

      const status = await pipeline.monitorTraining('batch-1')

      expect(status.status).toBe('completed')
      expect(status.progress).toBe(1.0)
      expect(status.eta).toBeUndefined()
    })
  })

  describe('Status Reporting', () => {
    test('should return comprehensive status', async () => {
      // Setup mock results in order of calls:
      // 1. last24h trajectory count
      // 2. last7d trajectory count
      // 3. trainingBatch.findFirst (lastCompleted)
      // 4. trainedModel.findFirst (latestModel)
      // 5. trainedModel.count (deployedCount)
      // 6. trainingBatch.count (trainingCount)
      mockCountResults = [50, 200] // trajectory counts
      mockTrainingBatchFindFirstResults = [
        { completedAt: new Date('2024-01-01T12:00:00Z') },
      ]
      mockTrainedModelFindFirstResults = [{ version: 'v1.2.3' }]
      mockTrainedModelCountResults = [5] // deployed
      mockTrainingBatchCountResults = [2] // training

      const status = await pipeline.getStatus()

      expect(status.dataCollection.last24h).toBe(50)
      expect(status.dataCollection.last7d).toBe(200)
      expect(status.dataCollection.ratePerHour).toBeCloseTo(50 / 24, 1)
      expect(status.models.latest).toBe('v1.2.3')
      expect(status.models.deployed).toBe(5)
      expect(status.models.training).toBe(2)
      expect(status.health.database).toBe(true)
    })

    test('should handle no training history', async () => {
      mockCountResults = [0, 0] // trajectory counts
      mockTrainingBatchFindFirstResults = [null] // no completed batch
      mockTrainedModelFindFirstResults = [null] // no model
      mockTrainedModelCountResults = [0] // deployed
      mockTrainingBatchCountResults = [0] // training

      const status = await pipeline.getStatus()

      expect(status.training.lastCompleted).toBeNull()
      expect(status.models.latest).toBeNull()
      expect(status.dataCollection.last24h).toBe(0)
    })
  })

  describe('Health Checks', () => {
    test('should check database connectivity', async () => {
      // runHealthChecks calls:
      // 1. db.user.count()
      // 2. db.trajectory.count() for last hour
      mockUserCountResults = [1]
      mockCountResults = [10]

      // Access private method for testing via bracket notation to bypass TypeScript's private check
      const pipelineWithPrivate = asTestAccess(pipeline)
      const runHealthChecks = pipelineWithPrivate.runHealthChecks.bind(pipeline)
      if (runHealthChecks) {
        await runHealthChecks()
      }

      expect(mockDb.user.count).toHaveBeenCalled()
    })

    test('should propagate database errors for caller to handle', async () => {
      // Make db.user.count throw an error (database connectivity check)
      // Uses flag-based approach since mockImplementationOnce doesn't work in Bun
      mockUserCountShouldThrow = true

      // Access private method for testing - call it directly on the pipeline instance
      // Using type assertion to access private method and bind to pipeline
      const runHealthChecks = (
        pipeline as never as { runHealthChecks: () => Promise<void> }
      ).runHealthChecks.bind(pipeline)

      // The method propagates database errors to the caller
      await expect(runHealthChecks()).rejects.toThrow('DB Error')
    })

    test('should warn on low data collection rate', async () => {
      // Clear previous calls
      mockLogger.warn.mockClear()

      // runHealthChecks calls:
      // 1. db.user.count()
      // 2. db.trajectory.count() for last hour (returns 0 = low rate)
      mockUserCountResults = [1]
      mockCountResults = [0]

      // Access private method for testing - call it directly on the pipeline instance
      // Using type assertion to access private method
      const runHealthChecks = (
        pipeline as never as { runHealthChecks: () => Promise<void> }
      ).runHealthChecks
      await runHealthChecks.call(pipeline)

      // The warning should be logged when trajectoriesLastHour < 1
      expect(mockLogger.warn).toHaveBeenCalled()
      const warnCalls = mockLogger.warn.mock.calls
      const hasLowDataRateWarning = warnCalls.some(
        (call) => call[0] === 'Low data collection rate',
      )
      expect(hasLowDataRateWarning).toBe(true)
    })
  })
})
