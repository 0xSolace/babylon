/**
 * Trajectory Logger Service
 *
 * Core service for collecting agent interaction trajectories for RL training
 */

import { db, llmCallLogs, trajectories } from '@babylon/db'
import type { JsonValue } from '@babylon/shared'
import { generateSnowflakeId, toNull } from '@babylon/shared'
import type { UUID } from '@elizaos/core'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../../shared/logger'
import type {
  ActionAttempt,
  EnvironmentState,
  LLMCall,
  ProviderAccess,
  RewardComponents,
  Trajectory,
  TrajectoryStep,
} from './types'

export class TrajectoryLoggerService {
  private activeTrajectories: Map<string, Trajectory> = new Map()
  private activeStepIds: Map<string, string> = new Map() // Maps trajectoryId -> current stepId

  /**
   * Start a new trajectory
   */
  startTrajectory(
    agentId: string,
    options: {
      scenarioId?: string
      episodeId?: string
      batchId?: string
      groupIndex?: number
      metadata?: Record<string, JsonValue>
    } = {},
  ): string {
    const trajectoryId = uuidv4()
    const now = Date.now()

    const trajectory: Trajectory = {
      trajectoryId: trajectoryId as UUID,
      agentId: agentId as UUID,
      startTime: now,
      endTime: now,
      durationMs: 0,
      episodeId: options.episodeId,
      scenarioId: options.scenarioId,
      batchId: options.batchId,
      groupIndex: options.groupIndex,
      steps: [],
      totalReward: 0,
      rewardComponents: {
        environmentReward: 0,
      },
      metrics: {
        totalSteps: 0,
        successfulActions: 0,
        failedActions: 0,
        totalLLMCalls: 0,
        totalTokens: 0,
        avgStepDuration: 0,
      },
      metadata: (options.metadata || {}) as Record<string, JsonValue>,
    }

    this.activeTrajectories.set(trajectoryId, trajectory)
    return trajectoryId
  }

  /**
   * Start a new step in the trajectory
   */
  startStep(trajectoryId: string, envState: EnvironmentState): string {
    const stepId = uuidv4()
    const trajectory = this.activeTrajectories.get(trajectoryId)

    if (!trajectory) {
      throw new Error(`Trajectory ${trajectoryId} not found`)
    }

    const step: TrajectoryStep = {
      stepId: stepId as UUID,
      sequenceNum: trajectory.steps.length,
      startTime: envState.timestamp || Date.now(),
      environmentState: envState,
      llmCalls: [],
      providerAccesses: [],
      action: {
        actionType: 'pending',
        actionName: 'pending',
        parameters: {},
        success: false,
      },
    }

    trajectory.steps.push(step)
    this.activeStepIds.set(trajectoryId, stepId)
    return stepId
  }

  /**
   * Log an LLM call
   */
  logLLMCall(stepId: string, llmCall: LLMCall): void {
    const trajectory = this.findTrajectoryByStepId(stepId)
    if (!trajectory) {
      logger.warn('Trajectory not found for LLM call', { stepId })
      return
    }

    const step = trajectory.steps.find(
      (s: TrajectoryStep) => s.stepId === stepId,
    )
    if (!step) {
      logger.warn('Step not found for LLM call', { stepId })
      return
    }

    if (!step.llmCalls) {
      step.llmCalls = []
    }

    step.llmCalls.push(llmCall)

    // Also save to database for analysis (with callId and timestamp for DB)
    const callId = uuidv4()
    const timestamp = Date.now()
    this.saveLLMCallToDB(trajectory.trajectoryId, stepId, {
      ...llmCall,
      callId,
      timestamp,
    }).catch((error) => {
      logger.error(
        'Failed to save LLM call to database',
        error,
        'TrajectoryLoggerService',
      )
    })
  }

  /**
   * Save LLM call to database using CQL
   */
  private async saveLLMCallToDB(
    trajectoryId: string,
    stepId: string,
    llmCall: LLMCall & { callId: string; timestamp: number },
  ): Promise<void> {
    await db.insert(llmCallLogs).values({
      id: await generateSnowflakeId(),
      trajectoryId,
      stepId,
      callId: llmCall.callId,
      timestamp: new Date(llmCall.timestamp),
      latencyMs: llmCall.latencyMs,
      model: llmCall.model,
      purpose: llmCall.purpose,
      actionType: llmCall.actionType,
      systemPrompt: llmCall.systemPrompt,
      userPrompt: llmCall.userPrompt,
      messagesJson: null,
      response: llmCall.response,
      reasoning: llmCall.reasoning,
      temperature: llmCall.temperature,
      maxTokens: llmCall.maxTokens ?? 8192,
      promptTokens: llmCall.promptTokens,
      completionTokens: llmCall.completionTokens,
      totalTokens:
        llmCall.promptTokens && llmCall.completionTokens
          ? llmCall.promptTokens + llmCall.completionTokens
          : null,
      metadata: JSON.stringify({
        purpose: llmCall.purpose,
        actionType: llmCall.actionType,
        modelVersion: llmCall.modelVersion,
      }),
    })
  }

  /**
   * Log provider access
   */
  logProviderAccess(
    stepId: string,
    access: Omit<ProviderAccess, 'providerId' | 'timestamp'>,
  ): void {
    const trajectory = this.findTrajectoryByStepId(stepId)
    if (!trajectory) {
      logger.warn('Trajectory not found for provider access', { stepId })
      return
    }

    const step = trajectory.steps.find(
      (s: TrajectoryStep) => s.stepId === stepId,
    )
    if (!step) {
      logger.warn('Step not found for provider access', { stepId })
      return
    }

    const fullAccess: ProviderAccess = {
      providerId: uuidv4(),
      timestamp: Date.now(),
      ...access,
    }

    if (!step.providerAccesses) {
      step.providerAccesses = []
    }
    step.providerAccesses.push(fullAccess)
  }

  /**
   * Log LLM call using trajectory ID (convenience method)
   */
  logLLMCallByTrajectoryId(trajectoryId: string, llmCall: LLMCall): void {
    const stepId = this.activeStepIds.get(trajectoryId)
    if (!stepId) {
      logger.warn('No active step for trajectory', { trajectoryId })
      return
    }
    this.logLLMCall(stepId, llmCall)
  }

  /**
   * Log provider access using trajectory ID (convenience method)
   */
  logProviderAccessByTrajectoryId(
    trajectoryId: string,
    access: Omit<ProviderAccess, 'providerId' | 'timestamp'>,
  ): void {
    const stepId = this.activeStepIds.get(trajectoryId)
    if (!stepId) {
      logger.warn('No active step for trajectory', { trajectoryId })
      return
    }
    this.logProviderAccess(stepId, access)
  }

  /**
   * Get current step ID for a trajectory
   */
  getCurrentStepId(trajectoryId: string): string | null {
    return this.activeStepIds.get(trajectoryId) || null
  }

  /**
   * Complete a step with action and reward
   */
  completeStep(
    trajectoryId: string,
    stepId: string,
    action: Omit<ActionAttempt, 'attemptId' | 'timestamp'>,
    rewardInfo?: { reward?: number; components?: Partial<RewardComponents> },
  ): void {
    const trajectory = this.activeTrajectories.get(trajectoryId)
    if (!trajectory) {
      logger.warn('Trajectory not found for completeStep', { trajectoryId })
      return
    }

    const step = trajectory.steps.find(
      (s: TrajectoryStep) => s.stepId === stepId,
    )
    if (!step) {
      logger.warn('Step not found for completeStep', { trajectoryId, stepId })
      return
    }

    step.action = {
      ...action,
    }

    // Set end time and duration
    step.endTime = Date.now()
    if (step.startTime) {
      step.durationMs = step.endTime - step.startTime
    }

    if (rewardInfo?.reward !== undefined) {
      step.reward = rewardInfo.reward
      trajectory.totalReward += rewardInfo.reward
    }

    if (rewardInfo?.components) {
      step.rewardComponents = {
        ...step.rewardComponents,
        ...rewardInfo.components,
      }
    }

    // Clear current step ID
    this.activeStepIds.delete(trajectoryId)
  }

  /**
   * Complete step using current step ID (convenience method)
   */
  completeCurrentStep(
    trajectoryId: string,
    action: Omit<ActionAttempt, 'attemptId' | 'timestamp'>,
    rewardInfo?: { reward?: number; components?: Partial<RewardComponents> },
  ): void {
    const stepId = this.activeStepIds.get(trajectoryId)
    if (!stepId) {
      logger.warn('No active step for trajectory', { trajectoryId })
      return
    }
    this.completeStep(trajectoryId, stepId, action, rewardInfo)
  }

  /**
   * End trajectory and save to database using CQL
   */
  async endTrajectory(
    trajectoryId: string,
    status: 'completed' | 'terminated' | 'error' | 'timeout',
    finalMetrics?: Record<string, JsonValue>,
  ): Promise<void> {
    const trajectory = this.activeTrajectories.get(trajectoryId)
    if (!trajectory) {
      logger.warn('Trajectory not found for endTrajectory', { trajectoryId })
      return
    }

    trajectory.endTime = Date.now()
    trajectory.durationMs = trajectory.endTime - trajectory.startTime

    // Update metrics
    if (!trajectory.metrics) {
      trajectory.metrics = {
        totalSteps: 0,
        successfulActions: 0,
        failedActions: 0,
        totalLLMCalls: 0,
        totalTokens: 0,
        avgStepDuration: 0,
      }
    }
    trajectory.metrics.totalSteps = trajectory.steps.length

    // Count successful/failed actions and LLM calls
    let successfulActions = 0
    let failedActions = 0
    let totalLLMCalls = 0
    let totalTokens = 0
    let totalDuration = 0

    for (const step of trajectory.steps) {
      if (step.action) {
        if (step.action.success) {
          successfulActions++
        } else {
          failedActions++
        }
      }
      if (step.llmCalls) {
        totalLLMCalls += step.llmCalls.length
        for (const call of step.llmCalls) {
          if (call.promptTokens) totalTokens += call.promptTokens
          if (call.completionTokens) totalTokens += call.completionTokens
        }
      }
      if (step.durationMs) {
        totalDuration += step.durationMs
      }
    }

    trajectory.metrics.successfulActions = successfulActions
    trajectory.metrics.failedActions = failedActions
    trajectory.metrics.totalLLMCalls = totalLLMCalls
    trajectory.metrics.totalTokens = totalTokens
    trajectory.metrics.avgStepDuration =
      trajectory.steps.length > 0 ? totalDuration / trajectory.steps.length : 0

    if (finalMetrics) {
      trajectory.metrics = {
        ...trajectory.metrics,
        ...finalMetrics,
      }
    }

    // Save to database using CQL
    await db.insert(trajectories).values({
      id: await generateSnowflakeId(),
      trajectoryId,
      agentId: trajectory.agentId,
      startTime: new Date(trajectory.startTime),
      endTime: new Date(trajectory.endTime),
      durationMs: trajectory.durationMs,
      episodeId: trajectory.episodeId || null,
      scenarioId: trajectory.scenarioId || null,
      batchId: trajectory.batchId || null,
      stepsJson: JSON.stringify(trajectory.steps),
      rewardComponentsJson: JSON.stringify(trajectory.rewardComponents),
      metricsJson: JSON.stringify(trajectory.metrics),
      metadataJson: JSON.stringify(trajectory.metadata),
      totalReward: trajectory.totalReward,
      episodeLength: trajectory.metrics.totalSteps,
      finalStatus: status,
      finalBalance: toNull(
        trajectory.metrics.finalBalance as number | undefined,
      ),
      finalPnL: toNull(trajectory.metrics.finalPnL as number | undefined),
      tradesExecuted: toNull(
        trajectory.metrics.tradesExecuted as number | undefined,
      ),
      postsCreated: toNull(
        trajectory.metrics.postsCreated as number | undefined,
      ),
      isTrainingData:
        (trajectory.metadata?.isTrainingData as boolean | undefined) ?? true,
      isEvaluation:
        (trajectory.metadata?.isEvaluation as boolean | undefined) ?? false,
      usedInTraining: false,
      updatedAt: new Date(),
    })

    logger.info(
      'Trajectory saved to database',
      {
        trajectoryId,
        agentId: trajectory.agentId,
        steps: trajectory.steps.length,
        totalReward: trajectory.totalReward,
      },
      'TrajectoryLoggerService',
    )

    // Keep in memory for retrieval
    this.activeTrajectories.set(trajectoryId, trajectory)
    this.activeStepIds.delete(trajectoryId)
  }

  /**
   * Get active trajectory
   */
  getActiveTrajectory(trajectoryId: string): Trajectory | null {
    return this.activeTrajectories.get(trajectoryId) || null
  }

  /**
   * Helper to find trajectory by step ID
   */
  private findTrajectoryByStepId(stepId: string): Trajectory | null {
    for (const trajectory of this.activeTrajectories.values()) {
      if (trajectory.steps.some((s: TrajectoryStep) => s.stepId === stepId)) {
        return trajectory
      }
    }
    return null
  }
}
