/**
 * Training Automation Pipeline
 *
 * Fully automated RL training pipeline:
 * 1. Monitor data collection
 * 2. Trigger training when ready
 * 3. Score with RULER
 * 4. Export data
 * 5. Train model
 * 6. Deploy new version
 * 7. Monitor performance
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { and, db, desc, eq, isNotNull, isNull, trajectories } from '@babylon/db'
import { logger } from '@babylon/shared'
import { trainWithJejuRLAIF } from '../compute/jeju-rlaif-adapter'
import { recordTrainingOnChain } from '../compute/treasury-integration'
import { getExportGroupedForGRPO } from '../dependencies'
import { benchmarkService } from './BenchmarkService'
import { MarketOutcomesTracker } from './MarketOutcomesTracker'
import { modelSelectionService } from './ModelSelectionService'
import { rewardBackpropagationService } from './RewardBackpropagationService'
import { rulerScoringService } from './RulerScoringService'
import {
  type AutomationConfig,
  type AutomationStatus,
  parseTrajectorySteps,
  type TrainingMonitoringStatus,
  type TrainingReadinessResult,
  type TrainingTriggerOptions,
  type TrainingTriggerResult,
} from './types'
import { getCurrentWindowId, getPreviousWindowId } from './window-utils'

export type { AutomationConfig }

export class AutomationPipeline {
  private config: AutomationConfig
  private currentTrainingJob: string | null = null

  constructor(config: Partial<AutomationConfig> = {}) {
    const envMinTrajectories = parseInt(
      process.env.TRAINING_MIN_TRAJECTORIES ?? '',
      10,
    )
    const envMinGroupSize = parseInt(
      process.env.TRAINING_MIN_GROUP_SIZE ?? '',
      10,
    )

    this.config = {
      minTrajectoriesForTraining:
        config.minTrajectoriesForTraining ??
        (Number.isFinite(envMinTrajectories) && envMinTrajectories > 0
          ? envMinTrajectories
          : 1),
      minGroupSize:
        config.minGroupSize ??
        (Number.isFinite(envMinGroupSize) && envMinGroupSize > 0
          ? envMinGroupSize
          : 1), // Keep at 1 for flexibility
      dataQualityThreshold: config.dataQualityThreshold ?? 0.95,
      autoTriggerTraining: config.autoTriggerTraining !== false,
      trainingInterval: config.trainingInterval || 24, // Daily by default
      baseModel: config.baseModel || 'unsloth/Qwen3-4B-128K', // 4B params, 128K context - ideal for fine-tuning
      modelNamePrefix: config.modelNamePrefix || 'babylon-agent',
      modelStoragePath:
        config.modelStoragePath ||
        path.resolve(process.cwd(), 'storage/models'),
      dataStoragePath:
        config.dataStoragePath ||
        path.resolve(process.cwd(), 'storage/training-data'),
      atroposApiUrl:
        config.atroposApiUrl ||
        process.env.ATROPOS_API_URL ||
        'http://localhost:8000',
      vllmPort:
        config.vllmPort || parseInt(process.env.VLLM_PORT || '9001', 10),
    }
  }

  /**
   * Get configuration (for testing)
   * @internal
   */
  getConfig(): AutomationConfig {
    return this.config
  }

  /**
   * Check if we're ready to train
   */
  async checkTrainingReadiness(): Promise<TrainingReadinessResult> {
    // Count SCORED trajectories ready for training
    const scoredAndReady = await db.trajectory.count({
      where: {
        AND: [
          { isTrainingData: true },
          { usedInTraining: false },
          { aiJudgeReward: { not: null } },
          { stepsJson: { not: 'null' } },
          { stepsJson: { not: '[]' } },
        ],
      },
    })

    // Also count unscored for reporting
    const unscored = await db.trajectory.count({
      where: {
        AND: [
          { isTrainingData: true },
          { usedInTraining: false },
          { aiJudgeReward: null },
        ],
      },
    })

    // Get scenario groups
    const scenarioGroups = await db.trajectory.groupBy({
      by: ['scenarioId'],
      where: {
        AND: [
          { isTrainingData: true },
          { usedInTraining: false },
          { scenarioId: { not: null } },
        ],
      },
      _count: true,
    })

    const validGroups = scenarioGroups.filter((g) => {
      const countValue = g._count
      const count =
        typeof countValue === 'number'
          ? countValue
          : typeof countValue === 'string'
            ? Number(countValue)
            : typeof countValue === 'bigint'
              ? Number(countValue)
              : 0
      return count >= this.config.minGroupSize
    })

    // Calculate data quality
    const quality = await this.calculateDataQuality()

    const stats = {
      totalTrajectories: scoredAndReady, // Use scored trajectory count
      unscoredTrajectories: unscored, // Actual unscored count
      scenarioGroups: validGroups.length,
      dataQuality: quality,
    }

    // Check if ready using SCORED trajectories
    if (scoredAndReady < this.config.minTrajectoriesForTraining) {
      return {
        ready: false,
        reason: `Need ${this.config.minTrajectoriesForTraining - scoredAndReady} more trajectories`,
        stats,
      }
    }

    // Check minimum scenario groups for diversity
    if (validGroups.length < 10) {
      return {
        ready: false,
        reason: `Need more scenario groups (${validGroups.length}/10 minimum)`,
        stats,
      }
    }

    // Check data quality threshold
    if (quality < this.config.dataQualityThreshold) {
      return {
        ready: false,
        reason: `Data quality too low (${(quality * 100).toFixed(1)}% < ${this.config.dataQualityThreshold * 100}%)`,
        stats,
      }
    }

    return {
      ready: true,
      reason: 'Ready to train!',
      stats,
    }
  }

  /**
   * Calculate data quality score
   */
  private async calculateDataQuality(): Promise<number> {
    const sample = await db.trajectory.findMany({
      where: { AND: [{ isTrainingData: true }, { usedInTraining: false }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    if (sample.length === 0) return 0

    let qualityScore = 0
    let totalChecks = 0

    for (const traj of sample) {
      // parseTrajectorySteps handles validation and returns empty array for invalid data
      const steps = parseTrajectorySteps(traj.stepsJson)

      if (steps.length === 0) {
        continue // Skip invalid or empty trajectories
      }

      // Check 1: Has steps
      totalChecks++
      if (steps.length > 0) qualityScore++

      // Check 2: Steps have LLM calls
      totalChecks++
      const hasLLMCalls = steps.every(
        (s) => s.llmCalls && Array.isArray(s.llmCalls) && s.llmCalls.length > 0,
      )
      if (hasLLMCalls) qualityScore++

      // Check 3: LLM calls have substantial prompts
      totalChecks++
      const hasGoodPrompts = steps.every(
        (s) =>
          Array.isArray(s.llmCalls) &&
          s.llmCalls.every(
            (llm) =>
              llm.systemPrompt &&
              llm.systemPrompt.length > 50 &&
              llm.userPrompt &&
              llm.userPrompt.length > 100,
          ),
      )
      if (hasGoodPrompts) qualityScore++

      // Check 4: Has provider accesses
      totalChecks++
      const hasProviders = steps.some(
        (s) =>
          s.providerAccesses &&
          Array.isArray(s.providerAccesses) &&
          s.providerAccesses.length > 0,
      )
      if (hasProviders) qualityScore++

      // Check 5: Actions have results
      totalChecks++
      const hasResults = steps.every(
        (s) => s.action && (s.action.result || s.action.error),
      )
      if (hasResults) qualityScore++
    }

    return qualityScore / totalChecks
  }

  /**
   * Trigger training job
   */
  async triggerTraining(
    options: TrainingTriggerOptions = {},
  ): Promise<TrainingTriggerResult> {
    // Check readiness
    const readiness = await this.checkTrainingReadiness()

    if (!readiness.ready && !options.force) {
      return {
        success: false,
        error: readiness.reason,
      }
    }

    // If forcing but no trajectories at all, try to score some first
    if (
      options.force &&
      readiness.stats.totalTrajectories === 0 &&
      readiness.stats.unscoredTrajectories > 0
    ) {
      logger.info(
        'Force mode: Attempting to score unscored trajectories first',
        {
          unscored: readiness.stats.unscoredTrajectories,
        },
        'AutomationPipeline',
      )

      // Score recent trajectories
      const recentWindows = await db
        .selectDistinct({ windowId: trajectories.windowId })
        .from(trajectories)
        .where(
          and(
            eq(trajectories.isTrainingData, true),
            eq(trajectories.usedInTraining, false),
            isNull(trajectories.aiJudgeReward),
            isNotNull(trajectories.windowId),
          ),
        )
        .orderBy(desc(trajectories.createdAt))
        .limit(5)

      for (const window of recentWindows) {
        const windowId = window.windowId ? String(window.windowId) : null
        if (windowId) {
          await rulerScoringService.scoreWindow(windowId)
        }
      }

      // Re-check readiness after scoring
      const newReadiness = await this.checkTrainingReadiness()
      logger.info(
        'After scoring',
        {
          scored: newReadiness.stats.totalTrajectories,
          stillUnscored: newReadiness.stats.unscoredTrajectories,
        },
        'AutomationPipeline',
      )
    }

    // Use ModelSelectionService for smart model selection
    const modelSelection = await modelSelectionService.selectBaseModel()

    logger.info('Model selection for training', {
      strategy: modelSelection.strategy,
      modelPath: modelSelection.modelPath,
      bundleCount: modelSelection.metadata?.bundleCount,
    })

    // Get data limit based on bundle count
    const dataLimit = await modelSelectionService.getTrainingDataLimit()

    // Prepare data
    logger.info('Preparing training data...', {
      ...readiness.stats,
      selectedModel: modelSelection.modelPath,
      strategy: modelSelection.strategy,
      dataLimit,
    })

    const batchId = `batch-${Date.now()}`
    // Use standardized window ID format (YYYY-MM-DDTHH:00)
    const windowId = getCurrentWindowId()

    // Export trajectories with data limit
    const maxTrajectories =
      dataLimit || options.batchSize || readiness.stats.totalTrajectories

    const exportGroupedForGRPO = getExportGroupedForGRPO()
    const exportResult = await exportGroupedForGRPO({
      outputPath: `${this.config.dataStoragePath}/${batchId}`,
      minTrajectoriesPerGroup: this.config.minGroupSize,
      maxGroupSize: maxTrajectories,
    })

    if (!exportResult.success) {
      return {
        success: false,
        error: `Export failed: ${exportResult.error}`,
      }
    }

    // Create training batch record
    const nextVersion = await this.getNextModelVersion()
    const trajectoryIdsForBatch = await this.getTrajectoryIds(maxTrajectories)
    const batch = await db.trainingBatch.create({
      data: {
        id: batchId,
        batchId,
        name: `Training Batch ${nextVersion}`,
        modelVersion: nextVersion,
        trajectoryIds: trajectoryIdsForBatch,
        trajectoryCount: trajectoryIdsForBatch.length,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          scenarioId: windowId,
          baseModel: modelSelection.modelPath,
          rewards: [],
        },
      },
    })

    // Determine execution mode: jeju (decentralized) or local
    const useJeju =
      process.env.USE_JEJU === 'true' ||
      (process.env.NODE_ENV === 'production' &&
        !!process.env.BABYLON_TREASURY_ADDRESS)

    if (useJeju) {
      // Use Jeju compute marketplace for training
      await this.executeJejuTraining(
        batchId,
        modelSelection.modelPath,
        windowId,
        exportResult.trajectoriesExported ?? 0,
        dataLimit,
      )
    } else {
      // Local training execution
      await this.executeLocalTraining(
        batchId,
        modelSelection.modelPath,
        windowId,
        dataLimit,
        options.force,
      )
    }

    this.currentTrainingJob = batch.id

    logger.info('Training job triggered', {
      batchId: batch.id,
      version: nextVersion,
      trajectories: exportResult.trajectoriesExported,
    })

    return {
      success: true,
      jobId: batch.id,
    }
  }

  /**
   * Get next model version
   */
  private async getNextModelVersion(): Promise<string> {
    const latestModel = await db.trainedModel.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (!latestModel) {
      return 'v1.0.0'
    }

    // Increment patch version
    const [major, minor, patch] = latestModel.version
      .substring(1)
      .split('.')
      .map(Number)
    return `v${major}.${minor}.${(patch ?? 0) + 1}`
  }

  /**
   * Get trajectory IDs for training
   */
  private async getTrajectoryIds(limit?: number): Promise<string[]> {
    const result = await db.trajectory.findMany({
      where: { AND: [{ isTrainingData: true }, { usedInTraining: false }] },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    return result.map((t) => t.trajectoryId)
  }

  /**
   * Execute training via Jeju RLAIF infrastructure
   */
  private async executeJejuTraining(
    batchId: string,
    baseModel: string,
    windowId: string,
    trajectoryCount: number,
    dataLimit?: number,
  ): Promise<void> {
    const archetype = process.env.TRAINING_ARCHETYPE || 'trader'

    logger.info('Submitting training to Jeju RLAIF', {
      batchId,
      baseModel,
      windowId,
      trajectoryCount,
      archetype,
    })

    // Update batch with training status
    await db.trainingBatch.update({
      where: { batchId },
      data: { status: 'training' },
    })

    // Start training using Jeju RLAIF
    const jejuRpcUrl = process.env.JEJU_RPC_URL
    if (!jejuRpcUrl) {
      throw new Error('JEJU_RPC_URL is required for Jeju training')
    }
    const jejuStorageUrl = process.env.JEJU_STORAGE_SERVICE_URL
    if (!jejuStorageUrl) {
      throw new Error('JEJU_STORAGE_SERVICE_URL is required for Jeju training')
    }

    this.monitorJejuRLAIFJob(
      batchId,
      archetype,
      baseModel,
      jejuRpcUrl,
      jejuStorageUrl,
      dataLimit,
    ).catch((err) =>
      logger.error('Jeju RLAIF job monitoring failed', {
        batchId,
        error: String(err),
      }),
    )
  }

  /**
   * Monitor Jeju RLAIF training job in background
   */
  private async monitorJejuRLAIFJob(
    batchId: string,
    archetype: string,
    baseModel: string,
    jejuRpcUrl: string,
    jejuStorageUrl: string,
    iterations?: number,
  ): Promise<void> {
    try {
      const result = await trainWithJejuRLAIF({
        archetype,
        modelCID: baseModel,
        jejuRpcUrl,
        jejuStorageUrl,
        iterations: iterations ? Math.min(10, Math.ceil(iterations / 200)) : 5,
      })

      await db.trainingBatch.update({
        where: { batchId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })

      // Record training on-chain for audit trail
      try {
        const record = await recordTrainingOnChain(
          batchId,
          result.finalPolicyCID,
        )
        if (record?.txHash) {
          logger.info('Training recorded on-chain', {
            epoch: record.epoch,
            txHash: record.txHash,
          })
        }
      } catch (treasuryError) {
        logger.warn('Failed to record training on-chain (non-fatal)', {
          error: treasuryError,
        })
      }

      logger.info('Jeju RLAIF training completed', {
        batchId,
        finalPolicyCID: result.finalPolicyCID,
        iterations: result.iterations,
        bestScore: result.bestScore,
      })
    } catch (error) {
      await db.trainingBatch.update({
        where: { batchId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      })

      logger.error('Jeju RLAIF training failed', {
        batchId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Execute training locally
   */
  private async executeLocalTraining(
    batchId: string,
    baseModel: string,
    windowId: string,
    dataLimit?: number,
    force?: boolean,
  ): Promise<void> {
    const trainingMode = process.env.TRAINING_MODE || 'atropos'
    const useTinker = trainingMode.toLowerCase() === 'tinker'

    const pythonScript = path.resolve(
      process.cwd(),
      'packages/training/python/src/training',
      useTinker ? 'tinker_trainer.py' : 'atropos_trainer.py',
    )

    const nextVersion = await this.getNextModelVersion()

    const env = {
      ...process.env,
      MODE: 'single',
      BATCH_ID: batchId,
      MODEL_VERSION: nextVersion,
      WINDOW_ID: windowId,
      BASE_MODEL: baseModel,
      MAX_EXAMPLES: dataLimit ? dataLimit.toString() : '2000',
      DATABASE_URL: process.env.DATABASE_URL || '',
      ATROPOS_API_URL: this.config.atroposApiUrl || 'http://localhost:8000',
      VLLM_PORT: String(this.config.vllmPort || 9001),
      FORCE_TRAINING: force ? 'true' : 'false',
      MIN_AGENTS_PER_WINDOW: '1',
      TRAINING_MODE: trainingMode,
    }

    logger.info(
      useTinker
        ? 'Training will use Tinker cloud-based GRPO'
        : 'Training will use Atropos GRPO with vLLM',
      { trainingMode, model: baseModel },
    )

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

    const trainingProcess = spawn(pythonCmd, [pythonScript], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })

    trainingProcess.stdout?.on('data', (data: Buffer) => {
      logger.info('Training stdout', { output: data.toString().trim() })
    })

    trainingProcess.stderr?.on('data', (data: Buffer) => {
      logger.warn('Training stderr', { output: data.toString().trim() })
    })

    trainingProcess.on('error', (error: Error) => {
      logger.error('Training process error', { error: error.message })
      void db.trainingBatch
        .update({
          where: { batchId },
          data: {
            status: 'failed',
            error: `Process spawn failed: ${error.message}`,
          },
        })
        .catch((err: Error) =>
          logger.error('Failed to update batch status', {
            error: err.message,
          }),
        )
    })

    trainingProcess.unref()
  }

  /**
   * Monitor training job
   */
  async monitorTraining(batchId: string): Promise<TrainingMonitoringStatus> {
    const batch = await db.trainingBatch.findUnique({
      where: { batchId },
    })

    if (!batch) {
      return { status: 'not_found' }
    }

    // Check if Python process is still running
    // In production, this would check actual training status from W&B or logs

    return {
      status: batch.status,
      progress:
        batch.status === 'training'
          ? 0.5
          : batch.status === 'completed'
            ? 1.0
            : 0,
      eta: batch.status === 'training' ? 1800000 : undefined, // 30 min estimate
      error: batch.error || undefined,
    }
  }

  /**
   * Clean up export files to prevent disk space accumulation.
   *
   * Export files can accumulate to 200GB+ if not cleaned up.
   */
  private async cleanupExportFiles(batchId: string): Promise<void> {
    // Clean up GRPO export directory
    const exportDir = path.resolve(process.cwd(), 'exports', 'grpo-groups')
    const files = await fs.readdir(exportDir)
    for (const file of files) {
      const filePath = path.join(exportDir, file)
      await fs.unlink(filePath)
    }
    logger.info(
      'Cleaned up export files',
      { batchId, filesRemoved: files.length },
      'AutomationPipeline',
    )
  }

  /**
   * Automation loop (called by cron)
   */
  async runAutomationCycle(): Promise<void> {
    logger.info('Running automation cycle')

    // Check if training is already running
    if (this.currentTrainingJob) {
      const status = await this.monitorTraining(this.currentTrainingJob)
      if (status.status === 'completed') {
        await this.deployModel(this.currentTrainingJob)
        await this.cleanupExportFiles(this.currentTrainingJob)
        this.currentTrainingJob = null
      } else if (status.status === 'failed') {
        logger.error('Training job failed', {
          batchId: this.currentTrainingJob,
        })
        await this.cleanupExportFiles(this.currentTrainingJob)
        this.currentTrainingJob = null
      }
      return
    }

    // Check for newly completed batches (Python script may have completed)
    // Check last 24 hours to catch long-running training jobs
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const newlyCompleted = await db.trainingBatch.findFirst({
      where: {
        AND: [
          { status: 'completed' },
          { completedAt: { not: null } },
          { completedAt: { gte: twentyFourHoursAgo } },
        ],
      },
      orderBy: { completedAt: 'desc' },
    })

    // Check if this batch has already been deployed
    if (newlyCompleted) {
      const existingModel = await db.trainedModel.findFirst({
        where: {
          AND: [
            { trainingBatchId: newlyCompleted.batchId },
            { status: 'deployed' },
          ],
        },
      })

      if (existingModel) {
        return // Skip if already deployed
      }

      logger.info('Found newly completed training batch', {
        batchId: newlyCompleted.batchId,
      })
      await this.deployModel(newlyCompleted.batchId)
    }

    // Check if we should trigger training
    const readiness = await this.checkTrainingReadiness()

    if (readiness.ready && this.config.autoTriggerTraining) {
      // Check if enough time has passed since last training
      const lastTraining = await db.trainingBatch.findFirst({
        where: {
          AND: [{ status: 'completed' }, { completedAt: { not: null } }],
        },
        orderBy: { completedAt: 'desc' },
      })

      const hoursSinceLastTraining = lastTraining?.completedAt
        ? (Date.now() - lastTraining.completedAt.getTime()) / (1000 * 60 * 60)
        : 999

      if (hoursSinceLastTraining >= this.config.trainingInterval) {
        logger.info('Triggering automatic training', readiness.stats)
        await this.triggerTraining()
      }
    }

    // Track market outcomes for recent windows (prerequisite for reward backpropagation)
    const outcomesTracker = new MarketOutcomesTracker()
    const synced = await outcomesTracker.syncRecentWindows(24) // Sync last 24 hours
    if (synced > 0) {
      logger.info('Synced market outcomes for windows', {
        windowsSynced: synced,
      })
    }

    // Update rewards for windows with known outcomes (reward backpropagation)
    const processed = await rewardBackpropagationService.processPendingWindows()
    if (processed > 0) {
      logger.info('Updated rewards for trajectories', {
        windowsProcessed: processed,
      })
    }

    // Score trajectories using RULER framework
    // Score trajectories from recent windows (last 24 hours)

    // Score current window and previous windows
    for (let hoursAgo = 0; hoursAgo < 24; hoursAgo++) {
      const windowId = getPreviousWindowId(hoursAgo)

      const scored = await rulerScoringService.scoreWindow(windowId)
      if (scored > 0) {
        logger.info('Scored trajectories with RULER', {
          windowId,
          scored,
        })
      }
    }

    // Health checks
    await this.runHealthChecks()
  }

  /**
   * Deploy trained model.
   *
   * The model is created by the Python training script. This method marks
   * trajectories as used and updates the training batch status.
   */
  private async deployModel(batchId: string): Promise<void> {
    const batch = await db.trainingBatch.findUnique({
      where: { batchId },
    })

    if (!batch) {
      logger.warn('Batch not found for deployment', { batchId })
      return
    }

    // Check if model was created by Python script
    const model = await db.trainedModel.findFirst({
      where: { AND: [{ trainingBatchId: batch.id }, { status: 'ready' }] },
    })

    if (!model) {
      logger.warn('Model not found for batch', { batchId })
      return
    }

    logger.info('Deploying model', {
      version: batch.modelVersion,
      modelId: model.modelId,
      batchId,
    })

    // Mark trajectories as used
    const trajectoryIds = batch.trajectoryIds ?? []

    if (trajectoryIds.length > 0) {
      await db.trajectory.updateMany({
        where: { trajectoryId: { in: trajectoryIds } },
        data: {
          usedInTraining: true,
        },
      })
    }

    // Update model status to deployed
    await db.trainedModel.update({
      where: { modelId: model.modelId },
      data: {
        status: 'deployed',
        deployedAt: new Date(),
        updatedAt: new Date(),
      },
    })

    logger.info('Model deployed', {
      version: batch.modelVersion,
      modelId: model.modelId,
    })
  }

  /**
   * Benchmark and conditionally deploy trained model
   * Only deploys if performance meets threshold
   */
  async benchmarkAndDeploy(
    batchId: string,
    autoDeploy = true,
  ): Promise<{
    benchmarked: boolean
    deployed: boolean
    reason?: string
  }> {
    const batch = await db.trainingBatch.findUnique({
      where: { batchId },
    })

    if (!batch) {
      return { benchmarked: false, deployed: false, reason: 'Batch not found' }
    }

    // Get model
    const model = await db.trainedModel.findFirst({
      where: { AND: [{ trainingBatchId: batch.id }, { status: 'ready' }] },
    })

    if (!model) {
      return { benchmarked: false, deployed: false, reason: 'Model not found' }
    }

    if (!model.modelId) {
      return {
        benchmarked: false,
        deployed: false,
        reason: 'Model has no modelId',
      }
    }

    // Benchmark the model
    logger.info(
      'Benchmarking model...',
      { modelId: model.modelId },
      'AutomationPipeline',
    )
    const benchmarkResults = await benchmarkService.benchmarkModel(
      model.modelId,
    )

    // Compare with previous models
    const comparison = await benchmarkService.compareModels(model.modelId)

    logger.info(
      'Benchmark complete',
      {
        modelId: model.modelId,
        score: benchmarkResults.benchmarkScore,
        shouldDeploy: comparison.shouldDeploy,
        reason: comparison.reason,
      },
      'AutomationPipeline',
    )

    // Deploy if performance is good enough (and autoDeploy is enabled)
    if (comparison.shouldDeploy && autoDeploy) {
      await this.deployModel(batchId)
      return {
        benchmarked: true,
        deployed: true,
        reason: comparison.reason,
      }
    }

    return {
      benchmarked: true,
      deployed: false,
      reason: comparison.reason || 'Performance below threshold',
    }
  }

  /**
   * Get model selection info for next training
   */
  async getModelSelectionInfo() {
    const selection = await modelSelectionService.selectBaseModel()
    const summary = await modelSelectionService.getSelectionSummary()

    return {
      success: true,
      selection,
      summary,
    }
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(): Promise<void> {
    // Check database connectivity
    await db.user.count()

    // Check data collection rate
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const last1h = await db.trajectory.count({
      where: { startTime: { gte: oneHourAgo } },
    })

    if (last1h < 1) {
      logger.warn('Low data collection rate', {
        trajectoriesLastHour: last1h,
      })
    }

    // Check disk space for model storage
    await fs.mkdir(this.config.modelStoragePath, { recursive: true })
    await fs.mkdir(this.config.dataStoragePath, { recursive: true })
  }

  /**
   * Get automation status
   */
  async getStatus(): Promise<AutomationStatus> {
    // Data collection stats
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const last24h = await db.trajectory.count({
      where: { startTime: { gte: twentyFourHoursAgo } },
    })

    const last7d = await db.trajectory.count({
      where: { startTime: { gte: sevenDaysAgo } },
    })

    // Training stats
    const lastCompleted = await db.trainingBatch.findFirst({
      where: { AND: [{ status: 'completed' }, { completedAt: { not: null } }] },
      orderBy: { completedAt: 'desc' },
    })

    // Model stats
    const latestModel = await db.trainedModel.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    const deployedCount = await db.trainedModel.count({
      where: { status: 'deployed' },
    })

    const trainingCount = await db.trainingBatch.count({
      where: { status: 'training' },
    })

    // Health checks - fail fast if unhealthy
    await db.user.count()
    const dbHealthy = true

    await fs.access(this.config.modelStoragePath)
    const storageHealthy = true

    const atroposHealthy = !!this.config.atroposApiUrl

    return {
      dataCollection: {
        last24h,
        last7d,
        ratePerHour: last24h / 24,
      },
      training: {
        currentJob: this.currentTrainingJob,
        lastCompleted: lastCompleted?.completedAt ?? null,
        nextScheduled: lastCompleted?.completedAt
          ? new Date(
              new Date(String(lastCompleted.completedAt)).getTime() +
                this.config.trainingInterval * 60 * 60 * 1000,
            )
          : null,
      },
      models: {
        latest: latestModel?.version ?? null,
        deployed: deployedCount,
        training: trainingCount,
      },
      health: {
        database: dbHealthy,
        storage: storageHealthy,
        atropos: atroposHealthy,
      },
    }
  }
}

// Singleton
export const automationPipeline = new AutomationPipeline()
