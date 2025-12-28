/**
 * TrajectoryRecorder
 *
 * Records agent decisions with full context for GRPO training.
 * Captures environment state, LLM calls, actions, and rewards.
 *
 * Supports two storage modes:
 * 1. Database (legacy) - Writes directly to Prisma/PostgreSQL
 * 2. Static (new) - Writes to DWS/IPFS via StaticTrajectoryStorage
 *
 * Static storage is preferred for production training as it:
 * - Supports efficient batching (JSONL + gzip)
 * - Uses decentralized storage (IPFS/Arweave)
 * - Enables offline RULER scoring before permanent storage
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import type { JsonValue } from '@jejunetwork/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type {
  LLMCallLogRecord,
  StoredTrajectoryRecord as TrajectoryRecord,
} from '@jejunetwork/training'
import {
  getStaticTrajectoryStorage,
  type StaticTrajectoryStorage,
  type TrajectoryBatchReference,
} from '@jejunetwork/training'
import type {
  Action,
  EnvironmentState,
  LLMCall,
  ProviderAccess,
  TrajectoryStep,
} from './types'
import { getCurrentWindowId } from './window-utils'

export type {
  TrajectoryStep,
  EnvironmentState,
  ProviderAccess,
  LLMCall,
  Action,
}

/**
 * Active trajectory being recorded.
 */
interface ActiveTrajectory {
  trajectoryId: string
  agentId: string
  archetype: string | null
  scenarioId: string
  windowId: string
  startTime: number
  steps: TrajectoryStep[]
  currentStep?: Partial<TrajectoryStep>
  metadata: Record<string, JsonValue>
}

/**
 * Options for starting a trajectory.
 */
export interface StartTrajectoryOptions {
  /** The agent's user ID */
  agentId: string
  /** The agent's behavioral archetype */
  archetype?: string
  /** Optional scenario identifier */
  scenarioId?: string
  /** Optional time window ID */
  windowId?: string
  /** Optional metadata */
  metadata?: Record<string, JsonValue>
}

/**
 * Options for ending a trajectory.
 */
export interface EndTrajectoryOptions {
  /** Final account balance */
  finalBalance?: number
  /** Final profit/loss */
  finalPnL?: number
  /** Time window ID */
  windowId?: string
  /** Ground truth market data */
  gameKnowledge?: {
    trueProbabilities?: Record<string, number>
    actualOutcomes?: Record<string, JsonValue>
    futureOutcomes?: Record<string, JsonValue>
  }
}

/**
 * Recorder configuration
 */
export interface TrajectoryRecorderConfig {
  /** Storage mode: 'database' | 'static' | 'dual' */
  storageMode: 'database' | 'static' | 'dual'
  /** Static storage instance (optional, creates default if not provided) */
  staticStorage?: StaticTrajectoryStorage
  /** Callback when a batch is flushed (static mode only) */
  onBatchFlushed?: (batch: TrajectoryBatchReference) => Promise<void>
}

/**
 * LLM call log row for database storage
 */
interface LLMLogRow {
  id: string
  trajectoryId: string
  stepId: string
  callId: string
  timestamp: Date
  latencyMs: number | null
  model: string
  purpose: string
  actionType: string | null
  systemPrompt: string
  userPrompt: string
  messagesJson: string | null
  response: string
  reasoning: string | null
  temperature: number
  maxTokens: number
  metadata: string | null
}

/**
 * Records agent trajectories for RL training.
 */
export class TrajectoryRecorder {
  private activeTrajectories: Map<string, ActiveTrajectory> = new Map()
  private config: TrajectoryRecorderConfig
  private staticStorage: StaticTrajectoryStorage | null = null
  private pendingLLMCalls: Map<string, LLMLogRow[]> = new Map()

  constructor(config: Partial<TrajectoryRecorderConfig> = {}) {
    this.config = {
      storageMode: config.storageMode ?? 'dual',
      staticStorage: config.staticStorage,
      onBatchFlushed: config.onBatchFlushed,
    }

    // Initialize static storage if using static or dual mode
    if (
      this.config.storageMode === 'static' ||
      this.config.storageMode === 'dual'
    ) {
      this.staticStorage =
        config.staticStorage ??
        getStaticTrajectoryStorage('babylon', {
          maxBufferSize: 100,
          maxBufferAgeMs: 10 * 60 * 1000, // 10 minutes
          usePermanentStorage: false, // Raw trajectories go to IPFS
          onBatchFlushed: config.onBatchFlushed,
        })
    }
  }

  /**
   * Start recording a new trajectory.
   * @param options - Configuration for the trajectory
   * @returns The unique trajectory ID
   */
  async startTrajectory(options: StartTrajectoryOptions): Promise<string> {
    const trajectoryId = await generateSnowflakeId()
    const windowId = options.windowId ?? getCurrentWindowId()

    this.activeTrajectories.set(trajectoryId, {
      trajectoryId,
      agentId: options.agentId,
      archetype: options.archetype ?? null,
      scenarioId: options.scenarioId ?? windowId,
      windowId,
      startTime: Date.now(),
      steps: [],
      metadata: options.metadata ?? {},
    })

    this.pendingLLMCalls.set(trajectoryId, [])

    logger.info('Started trajectory recording', {
      trajectoryId,
      agentId: options.agentId,
      archetype: options.archetype,
      scenarioId: options.scenarioId,
      windowId,
      storageMode: this.config.storageMode,
    })

    return trajectoryId
  }

  /**
   * Start a new step in the trajectory.
   * @param trajectoryId - The trajectory ID
   * @param environmentState - Current environment state
   * @throws Error if trajectory not found
   */
  startStep(trajectoryId: string, environmentState: EnvironmentState): void {
    const traj = this.activeTrajectories.get(trajectoryId)
    if (!traj) {
      throw new Error(`Trajectory not found: ${trajectoryId}`)
    }

    traj.currentStep = {
      stepNumber: traj.steps.length,
      timestamp: Date.now(),
      environmentState,
      providerAccesses: [],
      llmCalls: [],
      reward: 0,
    }
  }

  /**
   * Log a provider access in the current step.
   * @param trajectoryId - The trajectory ID
   * @param access - Provider access details
   * @throws Error if no current step exists
   */
  logProviderAccess(
    trajectoryId: string,
    access: {
      providerName: string
      data: Record<string, JsonValue>
      purpose: string
    },
  ): void {
    const traj = this.activeTrajectories.get(trajectoryId)
    if (!traj?.currentStep) {
      throw new Error(`No current step for trajectory: ${trajectoryId}`)
    }

    traj.currentStep.providerAccesses = traj.currentStep.providerAccesses ?? []
    // Create full ProviderAccess with required fields
    traj.currentStep.providerAccesses.push({
      providerId: `${trajectoryId}-provider-${Date.now()}`,
      providerName: access.providerName,
      timestamp: Date.now(),
      query: access.data,
      data: access.data,
      purpose: access.purpose,
    })
  }

  /**
   * Log an LLM call in the current step.
   * @param trajectoryId - The trajectory ID
   * @param llmCall - LLM call details
   * @throws Error if no current step exists
   */
  logLLMCall(trajectoryId: string, llmCall: LLMCall): void {
    const traj = this.activeTrajectories.get(trajectoryId)
    if (!traj?.currentStep) {
      throw new Error(`No current step for trajectory: ${trajectoryId}`)
    }

    traj.currentStep.llmCalls = traj.currentStep.llmCalls ?? []
    traj.currentStep.llmCalls.push(llmCall)
  }

  /**
   * Complete the current step with an action.
   * @param trajectoryId - The trajectory ID
   * @param action - The action taken
   * @param reward - Immediate reward for the step
   * @throws Error if no current step exists
   */
  completeStep(trajectoryId: string, action: Action, reward: number = 0): void {
    const traj = this.activeTrajectories.get(trajectoryId)
    if (!traj?.currentStep) {
      throw new Error(`No current step for trajectory: ${trajectoryId}`)
    }

    const { stepNumber, timestamp, environmentState } = traj.currentStep
    if (stepNumber === undefined || timestamp === undefined) {
      throw new Error(`Incomplete step for trajectory: ${trajectoryId}`)
    }

    const completeStep: TrajectoryStep = {
      stepNumber,
      timestamp,
      environmentState,
      providerAccesses: traj.currentStep.providerAccesses ?? [],
      llmCalls: traj.currentStep.llmCalls ?? [],
      action,
      reward,
    }

    traj.steps.push(completeStep)
    traj.currentStep = undefined
  }

  /**
   * Cancel an active trajectory without saving
   */
  cancelTrajectory(trajectoryId: string): void {
    this.activeTrajectories.delete(trajectoryId)
    this.pendingLLMCalls.delete(trajectoryId)
    logger.debug('Trajectory cancelled', { trajectoryId })
  }

  /**
   * End trajectory and save to configured storage.
   * @param trajectoryId - The trajectory ID
   * @param options - End options including final metrics
   * @throws Error if trajectory not found
   */
  async endTrajectory(
    trajectoryId: string,
    options: EndTrajectoryOptions = {},
  ): Promise<void> {
    const traj = this.activeTrajectories.get(trajectoryId)
    if (!traj) {
      throw new Error(`Trajectory not found: ${trajectoryId}`)
    }

    const endTime = Date.now()
    const durationMs = endTime - traj.startTime
    const totalReward = traj.steps.reduce(
      (sum, step) => sum + (step.reward ?? 0),
      0,
    )
    const windowId = options.windowId ?? traj.windowId

    // Calculate metrics
    const tradesExecuted = traj.steps.filter(
      (s) =>
        s.action &&
        (s.action.actionType.includes('BUY') ||
          s.action.actionType.includes('SELL')),
    ).length

    const postsCreated = traj.steps.filter((s) =>
      s.action?.actionType.includes('POST'),
    ).length

    const errorCount = traj.steps.filter(
      (s) => s.action && !s.action.success,
    ).length
    const finalStatus = errorCount > 0 ? 'completed_with_errors' : 'completed'

    // Save to database if using database or dual mode
    if (
      this.config.storageMode === 'database' ||
      this.config.storageMode === 'dual'
    ) {
      await this.saveToDB(
        traj,
        endTime,
        durationMs,
        totalReward,
        windowId,
        finalStatus,
        tradesExecuted,
        postsCreated,
        options,
      )
    }

    // Save to static storage if using static or dual mode
    if (
      (this.config.storageMode === 'static' ||
        this.config.storageMode === 'dual') &&
      this.staticStorage
    ) {
      await this.saveToStaticStorage(
        traj,
        endTime,
        durationMs,
        totalReward,
        windowId,
        finalStatus,
        tradesExecuted,
        postsCreated,
        options,
      )
    }

    this.activeTrajectories.delete(trajectoryId)
    this.pendingLLMCalls.delete(trajectoryId)

    logger.info('Trajectory saved', {
      trajectoryId,
      archetype: traj.archetype,
      steps: traj.steps.length,
      reward: totalReward,
      duration: durationMs,
      storageMode: this.config.storageMode,
    })
  }

  /**
   * Save trajectory to database (legacy mode)
   */
  private async saveToDB(
    traj: ActiveTrajectory,
    endTime: number,
    durationMs: number,
    totalReward: number,
    windowId: string,
    finalStatus: string,
    tradesExecuted: number,
    postsCreated: number,
    options: EndTrajectoryOptions,
  ): Promise<void> {
    await db.trajectory.create({
      data: {
        id: await generateSnowflakeId(),
        trajectoryId: traj.trajectoryId,
        agentId: traj.agentId,
        archetype: traj.archetype,
        startTime: new Date(traj.startTime),
        endTime: new Date(endTime),
        durationMs,
        windowId,
        windowHours: 1,
        scenarioId: traj.scenarioId,
        episodeId: traj.scenarioId ? `${traj.scenarioId}-${Date.now()}` : null,
        stepsJson: JSON.stringify(traj.steps),
        rewardComponentsJson: JSON.stringify({
          environmentReward: totalReward,
        }),
        metricsJson: JSON.stringify({
          episodeLength: traj.steps.length,
          finalStatus,
          finalBalance: options.finalBalance,
          finalPnL: options.finalPnL,
          tradesExecuted,
          postsCreated,
          errorCount: traj.steps.filter((s) => s.action && !s.action.success)
            .length,
        }),
        metadataJson: JSON.stringify({
          isTrainingData: true,
          gameKnowledge: options.gameKnowledge ?? {},
        }),
        totalReward,
        episodeLength: traj.steps.length,
        finalStatus,
        finalBalance: options.finalBalance ?? null,
        finalPnL: options.finalPnL ?? null,
        tradesExecuted,
        postsCreated,
        isTrainingData: true,
        isEvaluation: false,
        usedInTraining: false,
        updatedAt: new Date(),
      },
    })

    // Save LLM calls
    const llmLogRows: LLMLogRow[] = []

    for (const step of traj.steps) {
      const llmCalls = step.llmCalls ?? []
      for (let i = 0; i < llmCalls.length; i++) {
        const llmCall = llmCalls[i]
        if (!llmCall) continue

        llmLogRows.push({
          id: await generateSnowflakeId(),
          trajectoryId: traj.trajectoryId,
          stepId: `${traj.trajectoryId}-step-${step.stepNumber}`,
          callId: `${traj.trajectoryId}-call-${step.stepNumber}-${i}`,
          timestamp: new Date(step.timestamp),
          latencyMs: llmCall.latencyMs ?? null,
          model: llmCall.model,
          purpose: llmCall.purpose,
          actionType: llmCall.actionType ?? null,
          systemPrompt: llmCall.systemPrompt,
          userPrompt: llmCall.userPrompt,
          messagesJson: JSON.stringify([
            { role: 'system', content: llmCall.systemPrompt },
            { role: 'user', content: llmCall.userPrompt },
          ]),
          response: llmCall.response,
          reasoning: llmCall.reasoning ?? null,
          temperature: llmCall.temperature,
          maxTokens: llmCall.maxTokens,
          metadata: JSON.stringify({ modelVersion: llmCall.modelVersion }),
        })
      }
    }

    if (llmLogRows.length > 0) {
      await db.llmCallLog.createMany({
        data: llmLogRows,
      })
    }
  }

  /**
   * Save trajectory to static storage (new mode)
   */
  private async saveToStaticStorage(
    traj: ActiveTrajectory,
    endTime: number,
    durationMs: number,
    totalReward: number,
    windowId: string,
    finalStatus: string,
    tradesExecuted: number,
    postsCreated: number,
    options: EndTrajectoryOptions,
  ): Promise<void> {
    if (!this.staticStorage) return

    // Convert to TrajectoryRecord format expected by StaticTrajectoryStorage
    const record: TrajectoryRecord = {
      id: await generateSnowflakeId(),
      trajectoryId: traj.trajectoryId,
      agentId: traj.agentId,
      archetype: traj.archetype,
      startTime: new Date(traj.startTime),
      endTime: new Date(endTime),
      durationMs,
      windowId,
      windowHours: Math.ceil(durationMs / (1000 * 60 * 60)), // Duration in hours, at least 1
      scenarioId: traj.scenarioId,
      episodeId: traj.trajectoryId, // Use trajectory ID as episode ID
      steps: traj.steps.map((step, idx) => ({
        stepNumber: step.stepNumber,
        timestamp: step.timestamp,
        environmentState: step.environmentState ?? {
          timestamp: step.timestamp,
        },
        providerAccesses: step.providerAccesses ?? [],
        llmCalls: step.llmCalls ?? [],
        action: step.action ?? null,
        reward: step.reward ?? 0,
        stepId: `${traj.trajectoryId}-step-${idx}`,
      })),
      rewardComponents: {
        environmentReward: totalReward,
      },
      metrics: {
        episodeLength: traj.steps.length,
        finalStatus,
        finalBalance: options.finalBalance,
        finalPnL: options.finalPnL,
        tradesExecuted,
        postsCreated,
        errorCount: traj.steps.filter((s) => s.action?.error).length,
      },
      metadata: {
        ...traj.metadata,
        isTrainingData: true,
        gameKnowledge: options.gameKnowledge ?? {},
      },
      totalReward,
    }

    await this.staticStorage.saveTrajectory(record)

    // Also save LLM calls
    const llmCallLogs: LLMCallLogRecord[] = []
    for (const step of traj.steps) {
      const llmCalls = step.llmCalls ?? []
      for (let i = 0; i < llmCalls.length; i++) {
        const llmCall = llmCalls[i]
        if (!llmCall) continue

        llmCallLogs.push({
          id: await generateSnowflakeId(),
          trajectoryId: traj.trajectoryId,
          stepId: `${traj.trajectoryId}-step-${step.stepNumber}`,
          callId:
            llmCall.callId ??
            `${traj.trajectoryId}-call-${step.stepNumber}-${i}`,
          timestamp: new Date(step.timestamp),
          latencyMs: llmCall.latencyMs ?? null,
          model: llmCall.model,
          purpose: llmCall.purpose,
          actionType: llmCall.actionType ?? null,
          systemPrompt: llmCall.systemPrompt,
          userPrompt: llmCall.userPrompt,
          messages: [
            { role: 'system', content: llmCall.systemPrompt },
            { role: 'user', content: llmCall.userPrompt },
          ],
          response: llmCall.response,
          reasoning: llmCall.reasoning ?? null,
          temperature: llmCall.temperature,
          maxTokens: llmCall.maxTokens,
          metadata: { modelVersion: llmCall.modelVersion },
        })
      }
    }

    if (llmCallLogs.length > 0) {
      await this.staticStorage.saveLLMCallLogs(llmCallLogs)
    }
  }

  /**
   * Get an active trajectory by ID.
   * @param trajectoryId - The trajectory ID
   * @returns The active trajectory or undefined
   */
  getActiveTrajectory(trajectoryId: string): ActiveTrajectory | undefined {
    return this.activeTrajectories.get(trajectoryId)
  }

  /**
   * Check if a trajectory is active.
   * @param trajectoryId - The trajectory ID
   * @returns True if trajectory is active
   */
  isActive(trajectoryId: string): boolean {
    return this.activeTrajectories.has(trajectoryId)
  }

  /**
   * Get count of active trajectories.
   * @returns Number of active trajectories
   */
  getActiveCount(): number {
    return this.activeTrajectories.size
  }

  /**
   * Get static storage buffer stats (if using static mode)
   */
  getStaticStorageStats(): {
    count: number
    ageMs: number | null
    oldestTrajectoryId: string | null
  } | null {
    if (!this.staticStorage) return null
    return this.staticStorage.getBufferStats()
  }

  /**
   * Force flush static storage (if using static mode)
   */
  async flushStaticStorage(): Promise<TrajectoryBatchReference | null> {
    if (!this.staticStorage) return null
    return this.staticStorage.flush()
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.staticStorage) {
      await this.staticStorage.shutdown()
    }
    this.activeTrajectories.clear()
    this.pendingLLMCalls.clear()
  }
}

/** Default singleton instance (dual mode) */
export const trajectoryRecorder = new TrajectoryRecorder({
  storageMode: 'dual',
})

/** Create a recorder with specific storage mode */
export function createTrajectoryRecorder(
  config: Partial<TrajectoryRecorderConfig> = {},
): TrajectoryRecorder {
  return new TrajectoryRecorder(config)
}
