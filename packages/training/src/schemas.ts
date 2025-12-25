/**
 * Zod Schemas for Training Package
 *
 * Provides type-safe validation for configuration and data structures.
 */

import { z } from 'zod'

// ============================================================================
// Training Configuration Schemas
// ============================================================================

/**
 * Schema for RL training hyperparameters
 */
export const TrainingConfigSchema = z.object({
  min_trajectories_per_batch: z.number().int().positive(),
  batch_size: z.number().int().positive().max(64),
  learning_rate: z.number().positive().max(1e-3),
  kl_penalty: z.number().nonnegative().max(1.0),
  iterations_per_window: z.number().int().positive(),
  warmup_steps: z.number().int().nonnegative(),
  max_grad_norm: z.number().positive(),
  gamma: z.number().min(0).max(1),
})

/**
 * Schema for benchmark configuration
 */
export const BenchmarkConfigSchema = z.object({
  duration_minutes: z.number().positive(),
  tick_interval_seconds: z.number().positive(),
  num_prediction_markets: z.number().int().positive(),
  num_perpetual_markets: z.number().int().positive(),
})

/**
 * Schema for agent configuration
 */
export const AgentConfigSchema = z.object({
  test_agent_count: z.number().int().positive(),
})

/**
 * Schema for full pipeline configuration
 */
export const PipelineConfigSchema = z.object({
  benchmark: BenchmarkConfigSchema.nullable().optional(),
  training: TrainingConfigSchema,
  agents: AgentConfigSchema,
})

// ============================================================================
// Trajectory Schemas
// ============================================================================

/**
 * Schema for LLM call within a trajectory step
 */
export const LLMCallSchema = z.object({
  callId: z.string().optional(),
  timestamp: z.number(),
  model: z.string(),
  modelVersion: z.string().optional(),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  response: z.string(),
  reasoning: z.string().optional(),
  temperature: z.number(),
  maxTokens: z.number(),
  latencyMs: z.number().optional(),
  purpose: z.enum(['action', 'reasoning', 'evaluation', 'response', 'other']),
  actionType: z.string().optional(),
})

/**
 * Schema for provider access within a trajectory step
 */
export const ProviderAccessSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  timestamp: z.number(),
  query: z.record(z.string(), z.unknown()),
  data: z.record(z.string(), z.unknown()),
  purpose: z.string(),
})

/**
 * Schema for action within a trajectory step
 */
export const ActionSchema = z.object({
  attemptId: z.string().optional(),
  timestamp: z.number(),
  actionType: z.string(),
  actionName: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
  success: z.boolean(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
})

/**
 * Schema for environment state in a trajectory step
 */
export const EnvironmentStateSchema = z
  .object({
    timestamp: z.number().optional(),
    agentBalance: z.number().optional(),
    agentPoints: z.number().optional(),
    agentPnL: z.number().optional(),
    openPositions: z.number().int().optional(),
  })
  .passthrough()

/**
 * Schema for a single trajectory step
 */
export const TrajectoryStepSchema = z.object({
  stepId: z.string().optional(),
  stepNumber: z.number().int().nonnegative(),
  timestamp: z.number(),
  environmentState: EnvironmentStateSchema.optional(),
  observation: z.record(z.string(), z.unknown()).optional(),
  providerAccesses: z.array(ProviderAccessSchema).optional(),
  llmCalls: z.array(LLMCallSchema).optional(),
  llm_calls: z.array(LLMCallSchema).optional(), // snake_case variant
  action: ActionSchema.nullable().optional(),
  reward: z.number().optional(),
  done: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Schema for trajectory data stored in database
 */
export const TrajectoryDataSchema = z.object({
  trajectoryId: z.string(),
  agentId: z.string(),
  windowId: z.string().optional(),
  steps: z.array(TrajectoryStepSchema),
  totalReward: z.number().optional(),
  episodeLength: z.number().int().optional(),
  finalStatus: z.string().optional(),
  finalPnL: z.number().optional(),
  aiJudgeReward: z.number().optional(),
  archetype: z.string().optional(),
})

// ============================================================================
// LLM Judge Response Schemas
// ============================================================================

/**
 * Schema for single trajectory score response from LLM judge
 */
export const TrajectoryScoreResponseSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
})

/**
 * Schema for RULER comparison score response
 */
export const RulerScoreResponseSchema = z.object({
  scores: z.array(
    z.object({
      trajectory_id: z.string(),
      explanation: z.string(),
      score: z.number().min(0).max(1),
    }),
  ),
})

// ============================================================================
// Automation Pipeline Schemas
// ============================================================================

/**
 * Schema for automation pipeline configuration
 */
export const AutomationConfigSchema = z.object({
  minTrajectoriesForTraining: z.number().int().positive().default(1),
  minGroupSize: z.number().int().positive().default(1),
  dataQualityThreshold: z.number().min(0).max(1).default(0.95),
  autoTriggerTraining: z.boolean().default(true),
  trainingInterval: z.number().positive().default(24),
  baseModel: z.string().default('unsloth/Qwen3-4B-128K'),
  modelNamePrefix: z.string().default('babylon-agent'),
  modelStoragePath: z.string(),
  dataStoragePath: z.string(),
  atroposApiUrl: z.string().url().optional(),
  vllmPort: z.number().int().positive().default(9001),
})

/**
 * Schema for training readiness stats
 */
export const TrainingStatsSchema = z.object({
  totalTrajectories: z.number().int().nonnegative(),
  unscoredTrajectories: z.number().int().nonnegative(),
  scenarioGroups: z.number().int().nonnegative(),
  dataQuality: z.number().min(0).max(1),
})

/**
 * Schema for training trigger options
 */
export const TrainingTriggerOptionsSchema = z.object({
  force: z.boolean().optional(),
  batchSize: z.number().int().positive().optional(),
})

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type TrainingConfig = z.infer<typeof TrainingConfigSchema>
export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>
export type AgentConfig = z.infer<typeof AgentConfigSchema>
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>

export type LLMCall = z.infer<typeof LLMCallSchema>
export type ProviderAccess = z.infer<typeof ProviderAccessSchema>
export type Action = z.infer<typeof ActionSchema>
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>
export type TrajectoryData = z.infer<typeof TrajectoryDataSchema>

export type TrajectoryScoreResponse = z.infer<
  typeof TrajectoryScoreResponseSchema
>
export type RulerScoreResponse = z.infer<typeof RulerScoreResponseSchema>

export type AutomationConfig = z.infer<typeof AutomationConfigSchema>
export type TrainingStats = z.infer<typeof TrainingStatsSchema>
export type TrainingTriggerOptions = z.infer<
  typeof TrainingTriggerOptionsSchema
>

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Safely parse JSON with Zod validation
 */
export function safeParseJson<T>(
  schema: z.ZodType<T>,
  jsonString: string,
  context?: string,
): T {
  const parsed: unknown = JSON.parse(jsonString)
  const result = schema.safeParse(parsed)
  if (!result.success) {
    const errorMessage = result.error.issues
      .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
      .join(', ')
    throw new Error(
      `Validation failed${context ? ` for ${context}` : ''}: ${errorMessage}`,
    )
  }
  return result.data
}

/**
 * Safely parse trajectory steps from JSON string
 */
export function parseTrajectorySteps(stepsJson: string): TrajectoryStep[] {
  if (!stepsJson || stepsJson === 'null' || stepsJson === '[]') {
    return []
  }
  return safeParseJson(
    z.array(TrajectoryStepSchema),
    stepsJson,
    'trajectory steps',
  )
}

/**
 * Safely parse trajectory IDs from JSON string
 */
export function parseTrajectoryIds(idsJson: string): string[] {
  if (!idsJson || idsJson === 'null' || idsJson === '[]') {
    return []
  }
  return safeParseJson(z.array(z.string()), idsJson, 'trajectory IDs')
}
