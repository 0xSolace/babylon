/**
 * Trajectory Logger Types
 *
 * Type definitions for trajectory logging, used in RL training pipelines.
 */

import type { UUID } from '@elizaos/core'
import type { JsonValue } from '@jejunetwork/shared'

/**
 * Environment state snapshot at a point in time
 */
export interface EnvironmentState {
  timestamp: number
  agentBalance: number
  agentPoints: number
  agentPnL: number
  openPositions: number
  activeMarkets?: number
  recentEvents?: string[]
  customState?: Record<string, JsonValue>
}

/**
 * Attempt to execute an action
 */
export interface ActionAttempt {
  timestamp?: number
  attemptId?: string
  actionType: string
  actionName?: string
  parameters?: Record<string, JsonValue>
  reasoning?: string
  success: boolean
  result?: Record<string, JsonValue>
  error?: string
  correctness?: number
}

/**
 * LLM call record for trajectory step
 */
export interface LLMCall {
  model: string
  modelVersion?: string
  systemPrompt: string
  userPrompt: string
  response: string
  reasoning?: string
  temperature: number
  maxTokens?: number
  promptTokens?: number
  completionTokens?: number
  latencyMs: number
  purpose: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
  actionType?: string
}

/**
 * Provider access record
 */
export interface ProviderAccess {
  providerId: string
  providerName: string
  timestamp: number
  query: Record<string, JsonValue>
  data: Record<string, JsonValue>
  purpose: string
}

/**
 * Reward components breakdown
 */
export interface RewardComponents {
  tradingReward?: number
  socialReward?: number
  informationReward?: number
  penaltyReward?: number
  bonusReward?: number
  [key: string]: number | undefined
}

/**
 * Step within a trajectory
 */
export interface TrajectoryStep {
  stepId: string
  sequenceNum: number
  startTime: number
  endTime?: number
  durationMs?: number

  // State
  environmentState: EnvironmentState

  // Action
  action?: ActionAttempt

  // LLM interactions
  llmCalls?: LLMCall[]

  // Provider accesses
  providerAccesses?: ProviderAccess[]

  // Reward
  reward?: number
  rewardComponents?: RewardComponents

  // Metadata
  metadata?: Record<string, JsonValue>
}

/**
 * Trajectory metrics
 */
export interface TrajectoryMetrics {
  totalSteps: number
  successfulActions: number
  failedActions: number
  totalLLMCalls: number
  totalTokens: number
  avgStepDuration: number
  [key: string]: JsonValue
}

/**
 * Full trajectory record
 */
export interface Trajectory {
  trajectoryId: UUID
  agentId: UUID
  scenarioId?: string
  episodeId?: string
  batchId?: string
  groupIndex?: number

  // Timing
  startTime: number
  endTime: number
  durationMs: number

  // Steps
  steps: TrajectoryStep[]

  // Rewards
  totalReward: number
  rewardComponents?: RewardComponents

  // Metrics
  metrics?: TrajectoryMetrics

  // Metadata
  metadata?: Record<string, JsonValue>

  // Status
  status?: 'active' | 'completed' | 'terminated' | 'error' | 'timeout'

  // Training flags
  isTrainingData?: boolean
  judgeScore?: number
  judgeReasoning?: string
}
