import { agentRuntimeManager, autonomousCoordinator } from '@babylon/agents'
import {
  executeGameTick,
  FEE_CONFIG,
  PerpDbAdapter,
  PerpMarketService,
} from '@babylon/engine'
import { logger, type WalletPort } from '@babylon/shared'
import { trajectoryRecorder } from '@babylon/training'
import {
  getStaticTrajectoryStorage,
  TrainingDbPersistence,
  type TrajectoryBatchReference,
} from '@jejunetwork/training'
import { Elysia } from 'elysia'

// No-op wallet for funding - positions track funding internally, no wallet transfers needed
const systemFundingWalletAdapter: WalletPort = {
  debit: async () => {},
  credit: async () => {},
  recordPnL: async () => {},
  getBalance: async () => ({ balance: 0, lifetimePnL: 0 }),
}

// Initialize PerpMarketService for funding rate updates
const perpDbAdapter = new PerpDbAdapter()
const perpMarketService = new PerpMarketService({
  db: perpDbAdapter,
  wallet: systemFundingWalletAdapter,
  fees: {
    tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
    platformShare: FEE_CONFIG.PLATFORM_SHARE,
    referrerShare: FEE_CONFIG.REFERRER_SHARE,
    minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
  },
})

// Database persistence (lazy initialized)
let dbPersistence: TrainingDbPersistence | null = null

async function getDbPersistence(): Promise<TrainingDbPersistence | null> {
  if (dbPersistence) return dbPersistence

  const dbEndpoint = process.env.EQLITE_ENDPOINT
  if (!dbEndpoint) {
    logger.warn(
      'EQLITE_ENDPOINT not set - trajectory batches will not be persisted to database',
      undefined,
      'CronRoutes',
    )
    return null
  }

  const { EQLiteClient } = await import('@jejunetwork/db')
  const client = new EQLiteClient({ blockProducerEndpoint: dbEndpoint })
  dbPersistence = new TrainingDbPersistence(client)
  return dbPersistence
}

// Initialize static storage for Babylon trajectories
const babylonTrajectoryStorage = getStaticTrajectoryStorage('babylon', {
  maxBufferSize: 100,
  maxBufferAgeMs: 10 * 60 * 1000, // 10 minutes
  usePermanentStorage: false, // Use IPFS for raw trajectories
  onBatchFlushed: async (batch: TrajectoryBatchReference) => {
    logger.info(
      'Trajectory batch flushed',
      {
        batchId: batch.batchId,
        cid: batch.storageCid,
        trajectoryCount: batch.trajectoryCount,
        compressedSize: batch.compressedSizeBytes,
      },
      'CronRoutes',
    )

    // Persist to database for discovery
    const persistence = await getDbPersistence()
    if (persistence) {
      await persistence.saveBatchReference(batch)
    }
  },
})

// Track whether we've warned about missing CRON_SECRET
let warnedAboutMissingSecret = false

/**
 * Cron authentication header check
 */
function verifyCronAuth(headers: Record<string, string | undefined>): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (!warnedAboutMissingSecret) {
      logger.warn(
        'CRON_SECRET not set - cron endpoints are unprotected. Set CRON_SECRET in production.',
        undefined,
        'CronAuth',
      )
      warnedAboutMissingSecret = true
    }
    return true // Allow in development
  }

  const authHeader = headers.authorization
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Cron routes
 * Migrated from: apps/web/app/api/cron/*
 */
export const cronRoutes = new Elysia({ prefix: '/api/cron' })
  .onBeforeHandle(({ headers, set }) => {
    if (!verifyCronAuth(headers)) {
      set.status = 401
      return { error: 'Unauthorized', message: 'Invalid cron secret' }
    }
  })

  // Training cron job - checks trajectory buffer and flushes if ready
  .post(
    '/training',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Training cron job triggered',
        { timestamp },
        'POST /api/cron/training',
      )

      // Get trajectory recorder stats
      const recorderStats = trajectoryRecorder.getStaticStorageStats()
      const storageStats = babylonTrajectoryStorage.getBufferStats()

      // Flush if buffer has trajectories
      let flushResult = null
      if (storageStats.count > 0) {
        flushResult = await babylonTrajectoryStorage.flush()
      }

      // Also flush the trajectory recorder's static storage
      let recorderFlushResult = null
      if (recorderStats && recorderStats.count > 0) {
        recorderFlushResult = await trajectoryRecorder.flushStaticStorage()
      }

      const duration = Date.now() - startTime

      return {
        success: true,
        message: 'Training cron completed',
        trajectoryBuffer: {
          count: storageStats.count,
          ageMs: storageStats.ageMs,
        },
        recorderBuffer: recorderStats,
        flushed: flushResult !== null || recorderFlushResult !== null,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Training cron job - flush trajectory buffers',
      },
    },
  )

  // Training check job - reports actual training status
  .post(
    '/training-check',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Training check cron job triggered',
        { timestamp },
        'POST /api/cron/training-check',
      )

      // Get trajectory recorder stats
      const recorderStats = trajectoryRecorder.getStaticStorageStats()
      const storageStats = babylonTrajectoryStorage.getBufferStats()
      const activeTrajectories = trajectoryRecorder.getActiveCount()

      // Training is considered "active" if we have active trajectories or pending buffer
      const hasActiveWork =
        activeTrajectories > 0 ||
        storageStats.count > 0 ||
        (recorderStats?.count ?? 0) > 0

      return {
        success: true,
        status: {
          isTraining: hasActiveWork,
          activeTrajectories,
          pendingInBuffer: storageStats.count,
          pendingInRecorder: recorderStats?.count ?? 0,
          bufferAgeMs: storageStats.ageMs,
        },
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Training check - reports actual training status',
      },
    },
  )

  // Weekly dataset upload - flushes all trajectory data to permanent storage
  .post(
    '/weekly-dataset-upload',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Weekly dataset upload triggered',
        { timestamp },
        'POST /api/cron/weekly-dataset-upload',
      )

      // Flush both storage backends
      const storageFlush = await babylonTrajectoryStorage.flush()
      const recorderFlush = await trajectoryRecorder.flushStaticStorage()

      const batches: Array<{ batchId: string; cid: string; count: number }> = []

      if (storageFlush) {
        batches.push({
          batchId: storageFlush.batchId,
          cid: storageFlush.storageCid,
          count: storageFlush.trajectoryCount,
        })
      }

      if (recorderFlush) {
        batches.push({
          batchId: recorderFlush.batchId,
          cid: recorderFlush.storageCid,
          count: recorderFlush.trajectoryCount,
        })
      }

      const totalTrajectories = batches.reduce((sum, b) => sum + b.count, 0)
      const duration = Date.now() - startTime

      logger.info(
        'Weekly dataset upload completed',
        { batchCount: batches.length, totalTrajectories, durationMs: duration },
        'POST /api/cron/weekly-dataset-upload',
      )

      return {
        success: true,
        message:
          batches.length > 0
            ? `Uploaded ${totalTrajectories} trajectories in ${batches.length} batches`
            : 'No trajectories to upload',
        batches,
        totalTrajectories,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary:
          'Weekly dataset upload - flush all trajectories to permanent storage',
      },
    },
  )

  // Perp funding rate update - processes funding payments for all perp positions
  .post(
    '/perp-funding',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Perp funding rate update triggered',
        { timestamp },
        'POST /api/cron/perp-funding',
      )

      // Process funding step - this updates funding rates and applies funding payments
      await perpMarketService.processFundingStep()

      // Get updated market stats to return
      const markets = await perpDbAdapter.listMarkets()
      const fundingRates = markets.map((m) => ({
        ticker: m.ticker,
        rate: m.fundingRate.rate,
        nextFundingTime: m.fundingRate.nextFundingTime,
      }))

      const duration = Date.now() - startTime

      logger.info(
        'Perp funding rate update completed',
        { marketsUpdated: markets.length, durationMs: duration },
        'POST /api/cron/perp-funding',
      )

      return {
        success: true,
        message: `Updated funding rates for ${markets.length} markets`,
        marketsUpdated: markets.length,
        fundingRates,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Update perpetual funding rates - processes funding payments',
      },
    },
  )

  // Internal training trigger - forces trajectory flush
  .post(
    '/_training',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Internal training trigger received',
        { timestamp },
        'POST /api/cron/_training',
      )

      // Force flush all trajectory data
      const storageFlush = await babylonTrajectoryStorage.flush()
      const recorderFlush = await trajectoryRecorder.flushStaticStorage()

      const duration = Date.now() - startTime
      const totalFlushed =
        (storageFlush?.trajectoryCount ?? 0) +
        (recorderFlush?.trajectoryCount ?? 0)

      return {
        success: true,
        message:
          totalFlushed > 0
            ? `Flushed ${totalFlushed} trajectories`
            : 'No trajectories to flush',
        storageBatch: storageFlush
          ? { batchId: storageFlush.batchId, cid: storageFlush.storageCid }
          : null,
        recorderBatch: recorderFlush
          ? { batchId: recorderFlush.batchId, cid: recorderFlush.storageCid }
          : null,
        totalFlushed,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Internal training trigger - force trajectory flush',
      },
    },
  )

  // Agent tick - executes autonomous agent actions
  .post(
    '/agent-tick',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Agent tick cron job started',
        { timestamp },
        'POST /api/cron/agent-tick',
      )

      // Get an existing runtime from the manager
      // Each agent will get its own runtime during execution
      const runtimeCount = agentRuntimeManager.getRuntimeCount()

      if (runtimeCount === 0) {
        logger.info(
          'No agent runtimes initialized - bootstrapping NPCs on first tick',
          undefined,
          'CronRoutes',
        )
        // Bootstrap NPCs on first tick
        const { NPCBootstrapService } = await import('@babylon/agents')
        const bootstrapResult =
          await NPCBootstrapService.getInstance().bootstrapAllNpcs()
        logger.info(
          `NPC bootstrap complete: ${bootstrapResult.initialized} initialized, ${bootstrapResult.failed} failed`,
          { bootstrapResult },
          'CronRoutes',
        )
      }

      // Execute autonomous tick for all active NPCs using the static registry
      const { StaticDataRegistry } = await import('@babylon/engine')
      const allActors = StaticDataRegistry.getAllActors()

      // Get a runtime for the first NPC to use as base
      const firstActor = allActors[0]
      if (!firstActor) {
        return {
          success: true,
          agentsProcessed: 0,
          totalActions: 0,
          errors: 0,
          message: 'No NPCs found in static registry',
          durationMs: Date.now() - startTime,
          timestamp,
        }
      }

      // Get or create runtime for first NPC
      const runtime = await agentRuntimeManager.getRuntime(firstActor.id)

      // Execute autonomous tick for all active agents with trajectory recording
      const result =
        await autonomousCoordinator.executeTickForAllAgents(runtime)

      const duration = Date.now() - startTime

      logger.info(
        'Agent tick cron job completed',
        {
          agentsProcessed: result.agentsProcessed,
          totalActions: result.totalActions,
          errors: result.errors,
          durationMs: duration,
        },
        'POST /api/cron/agent-tick',
      )

      return {
        success: true,
        agentsProcessed: result.agentsProcessed,
        totalActions: result.totalActions,
        errors: result.errors,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Execute autonomous agent tick',
        description:
          'Triggers autonomous actions for all active Babylon agents',
      },
    },
  )

  // Game tick - main game loop progression
  .post(
    '/game-tick',
    async () => {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      logger.info(
        'Game tick cron job started',
        { timestamp },
        'POST /api/cron/game-tick',
      )

      const result = await executeGameTick()

      const duration = Date.now() - startTime

      logger.info(
        'Game tick cron job completed',
        {
          postsCreated: result.postsCreated,
          eventsCreated: result.eventsCreated,
          articlesCreated: result.articlesCreated,
          marketsUpdated: result.marketsUpdated,
          questionsResolved: result.questionsResolved,
          durationMs: duration,
        },
        'POST /api/cron/game-tick',
      )

      return {
        success: true,
        ...result,
        durationMs: duration,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Execute game tick - main game loop',
        description:
          'Executes one canonical unit of game progression including content generation, market decisions, question resolution, and system updates.',
      },
    },
  )

  // Health check
  .post(
    '/health-check',
    async () => {
      const timestamp = new Date().toISOString()

      // Get trajectory storage stats
      const storageStats = babylonTrajectoryStorage.getBufferStats()

      logger.debug(
        'Health check',
        { timestamp, storageStats },
        'POST /api/cron/health-check',
      )

      return {
        success: true,
        status: 'healthy',
        trajectoryBuffer: {
          count: storageStats.count,
          ageMs: storageStats.ageMs,
        },
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Health check',
      },
    },
  )

  // Flush trajectory buffer (can be called manually or on schedule)
  .post(
    '/flush-trajectories',
    async () => {
      const timestamp = new Date().toISOString()

      logger.info(
        'Trajectory flush triggered',
        { timestamp },
        'POST /api/cron/flush-trajectories',
      )

      const batchRef = await babylonTrajectoryStorage.flush()

      if (!batchRef) {
        return {
          success: true,
          message: 'No trajectories to flush',
          timestamp,
        }
      }

      return {
        success: true,
        batchId: batchRef.batchId,
        storageCid: batchRef.storageCid,
        trajectoryCount: batchRef.trajectoryCount,
        compressedSizeBytes: batchRef.compressedSizeBytes,
        timestamp,
      }
    },
    {
      detail: {
        tags: ['Cron'],
        summary: 'Flush trajectory buffer to storage',
      },
    },
  )
