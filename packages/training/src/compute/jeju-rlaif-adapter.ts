/**
 * Babylon Jeju RLAIF Adapter
 *
 * Bridges Babylon's game environment to the Jeju RLAIF framework.
 * Handles:
 * - Trajectory conversion from Babylon format to Jeju format
 * - Archetype-specific rubric mapping
 * - Integration with Babylon's existing scoring services
 * - Registration of Babylon rubrics with Jeju's rubric registry
 *
 * Babylon-specific code stays here; generalizable infra uses Jeju DWS.
 */

import { getDB, initializeDB } from '@babylon/db'
import { type JsonValue, logger } from '@babylon/shared'
import {
  type JudgeRubric as JejuJudgeRubric,
  registerOrUpdateRubric as jejuRegisterRubric,
} from '@jejunetwork/training'
import {
  getAvailableArchetypes,
  getPriorityMetrics,
  getRubric,
  type JudgeRubric,
} from '../rubrics'
import {
  isArrayOf,
  isParsedTrajectoryStep,
  isRLAIFRunStatusResponse,
  isRunIdResponse,
  type ParsedTrajectoryStep,
  toJsonValueRecord,
  toLLMPurpose,
} from '../type-guards'

type QueryParam = string | number | boolean | null | Uint8Array | bigint

interface LLMCall {
  model: string
  systemPrompt: string
  userPrompt: string
  response: string
  reasoning?: string
  temperature: number
  maxTokens: number
  latencyMs: number
  purpose: 'action' | 'reasoning' | 'evaluation' | 'response' | 'other'
}

interface Action {
  type: string
  parameters: Record<string, JsonValue>
  reasoning?: string
}

interface JejuStep {
  stepNumber: number
  timestamp: number
  observation: Record<string, JsonValue>
  action: Action
  reward: number
  done: boolean
  llmCalls?: LLMCall[]
}

interface Trajectory {
  id: string
  environmentId: string
  agentId: string
  policyModelCID: string
  steps: JejuStep[]
  totalReward: number
  metadata: Record<string, JsonValue>
}

export interface BabylonRLAIFConfig {
  jejuRpcUrl: string
  jejuStorageUrl: string
  archetype: string
  windowId?: string
  lookbackHours?: number
  minActionsPerTrajectory?: number
}

export class BabylonJejuAdapter {
  private config: BabylonRLAIFConfig

  constructor(config: BabylonRLAIFConfig) {
    this.config = {
      lookbackHours: 72,
      minActionsPerTrajectory: 3,
      ...config,
    }
  }

  private static tableName = 'Trajectory'

  async loadTrajectories(): Promise<Trajectory[]> {
    await initializeDB()
    const db = getDB()

    const where: string[] = [
      `"isTrainingData" = TRUE`,
      `"aiJudgeReward" IS NULL`,
      `"stepsJson" NOT IN ('null', '[]')`,
    ]
    const params: QueryParam[] = []

    if (this.config.windowId) {
      params.push(this.config.windowId)
      where.push(`"windowId" = $${params.length}`)
    }

    const sql = `SELECT "trajectoryId", "agentId", "archetype", "stepsJson", "scenarioId", "windowId", "finalPnL", "episodeLength", "totalReward", "startTime", "endTime"
      FROM "${BabylonJejuAdapter.tableName}"
      WHERE ${where.join(' AND ')}
      LIMIT 500`

    type Numeric = number | string | bigint
    type TrajectoryRow = {
      trajectoryId: string
      agentId: string
      archetype: string | null
      stepsJson: string
      scenarioId: string | null
      windowId: string | null
      finalPnL: Numeric | null
      episodeLength: Numeric | null
      totalReward: Numeric | null
      startTime: Date | string | number
      endTime: Date | string | number
    }

    const rows = await db.query<TrajectoryRow>(sql, params)

    const jejuTrajectories: Trajectory[] = []

    const lookbackHours = this.config.lookbackHours ?? 72
    const cutoffMs = Date.now() - lookbackHours * 60 * 60 * 1000

    const toMillis = (value: Date | string | number): number => {
      if (value instanceof Date) return value.getTime()
      if (typeof value === 'number') return value
      const parsed = Date.parse(value)
      if (Number.isNaN(parsed)) {
        throw new Error(`[RLAIF] Invalid timestamp: ${value}`)
      }
      return parsed
    }

    const toNumber = (value: Numeric | null): number | null => {
      if (value === null) return null
      return typeof value === 'bigint' ? Number(value) : Number(value)
    }

    for (const row of rows) {
      if (toMillis(row.startTime) < cutoffMs) continue

      const parsedSteps: unknown = JSON.parse(row.stepsJson)
      if (!isArrayOf(parsedSteps, isParsedTrajectoryStep)) continue
      if (parsedSteps.length < (this.config.minActionsPerTrajectory ?? 3))
        continue

      const jejuSteps = this.convertSteps(parsedSteps)

      jejuTrajectories.push({
        id: row.trajectoryId,
        environmentId: 'babylon',
        agentId: row.agentId,
        policyModelCID: '',
        steps: jejuSteps,
        totalReward:
          toNumber(row.totalReward) ??
          jejuSteps.reduce((sum, s) => sum + s.reward, 0),
        metadata: {
          startTime: toMillis(row.startTime),
          endTime: toMillis(row.endTime),
          episodeLength: toNumber(row.episodeLength) ?? jejuSteps.length,
          scenarioId: row.scenarioId,
          windowId: row.windowId,
          finalPnL: toNumber(row.finalPnL),
          archetype: row.archetype ?? this.config.archetype,
        },
      })
    }

    return jejuTrajectories
  }

  async loadByArchetype(archetype: string): Promise<Trajectory[]> {
    await initializeDB()
    const db = getDB()

    const params: QueryParam[] = [archetype]
    const sql = `SELECT "trajectoryId", "agentId", "archetype", "stepsJson", "scenarioId", "windowId", "finalPnL", "episodeLength", "totalReward", "startTime", "endTime"
      FROM "${BabylonJejuAdapter.tableName}"
      WHERE "archetype" = $1
        AND "isTrainingData" = TRUE
        AND "stepsJson" NOT IN ('null', '[]')
      LIMIT 500`

    type Numeric = number | string | bigint
    type TrajectoryRow = {
      trajectoryId: string
      agentId: string
      archetype: string | null
      stepsJson: string
      scenarioId: string | null
      windowId: string | null
      finalPnL: Numeric | null
      episodeLength: Numeric | null
      totalReward: Numeric | null
      startTime: Date | string | number
      endTime: Date | string | number
    }

    const rows = await db.query<TrajectoryRow>(sql, params)

    const jejuTrajectories: Trajectory[] = []

    const toMillis = (value: Date | string | number): number => {
      if (value instanceof Date) return value.getTime()
      if (typeof value === 'number') return value
      const parsed = Date.parse(value)
      if (Number.isNaN(parsed)) {
        throw new Error(`[RLAIF] Invalid timestamp: ${value}`)
      }
      return parsed
    }

    const toNumber = (value: Numeric | null): number | null => {
      if (value === null) return null
      return typeof value === 'bigint' ? Number(value) : Number(value)
    }

    for (const row of rows) {
      const parsedSteps: unknown = JSON.parse(row.stepsJson)
      if (!isArrayOf(parsedSteps, isParsedTrajectoryStep)) continue
      if (parsedSteps.length < (this.config.minActionsPerTrajectory ?? 3))
        continue

      const jejuSteps = this.convertSteps(parsedSteps)

      jejuTrajectories.push({
        id: row.trajectoryId,
        environmentId: 'babylon',
        agentId: row.agentId,
        policyModelCID: '',
        steps: jejuSteps,
        totalReward:
          toNumber(row.totalReward) ??
          jejuSteps.reduce((sum, s) => sum + s.reward, 0),
        metadata: {
          startTime: toMillis(row.startTime),
          endTime: toMillis(row.endTime),
          episodeLength: toNumber(row.episodeLength) ?? jejuSteps.length,
          scenarioId: row.scenarioId,
          windowId: row.windowId,
          finalPnL: toNumber(row.finalPnL),
          archetype: archetype,
        },
      })
    }

    return jejuTrajectories
  }

  async saveScores(
    scores: Array<{ trajectoryId: string; score: number; reasoning: string }>,
  ): Promise<void> {
    await initializeDB()
    const db = getDB()
    for (const score of scores) {
      await db.exec(
        `UPDATE "${BabylonJejuAdapter.tableName}"
         SET "aiJudgeReward" = $1, "aiJudgeReasoning" = $2, "judgedAt" = CURRENT_TIMESTAMP
         WHERE "trajectoryId" = $3`,
        [score.score, score.reasoning, score.trajectoryId],
      )
    }
  }

  getRubricForArchetype(archetype: string): JudgeRubric {
    const rubricText = getRubric(archetype)
    const priorityMetrics = getPriorityMetrics(archetype)

    return {
      id: `babylon-${archetype}`,
      name: `Babylon ${archetype}`,
      description: `LLM-as-judge rubric for ${archetype} archetype in Babylon prediction markets`,
      criteria: rubricText,
      priorityMetrics,
    }
  }

  private convertSteps(steps: ParsedTrajectoryStep[]): JejuStep[] {
    return steps.map((step, idx): JejuStep => {
      const llmCalls = (step.llmCalls ?? []).map((call) => ({
        model: call.model,
        systemPrompt: call.systemPrompt ?? '',
        userPrompt: call.userPrompt ?? '',
        response: call.response ?? '',
        reasoning: call.reasoning,
        temperature: call.temperature ?? 0,
        maxTokens: call.maxTokens ?? 0,
        latencyMs: call.latencyMs ?? 0,
        purpose: toLLMPurpose(call.purpose),
      }))

      return {
        stepNumber: idx,
        timestamp: step.timestamp ?? Date.now(),
        observation: this.extractObservation(step),
        action: step.action
          ? {
              type: step.action.actionType,
              parameters: toJsonValueRecord(step.action.parameters),
              reasoning: step.action.reasoning,
            }
          : {
              type: 'unknown',
              parameters: {},
            },
        reward: step.reward ?? 0,
        done: idx === steps.length - 1,
        llmCalls,
      }
    })
  }

  private extractObservation(
    step: ParsedTrajectoryStep,
  ): Record<string, JsonValue> {
    const env = step.environmentState ?? {}
    const obs: Record<string, JsonValue> = {
      timestamp: step.timestamp ?? Date.now(),
    }
    // Only assign if value is a valid JsonValue (not {} or null)
    // Check if value is primitive, array, or non-empty object
    const isValidJsonValue = (val: unknown): val is JsonValue => {
      if (val === null) return true
      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      )
        return true
      if (Array.isArray(val)) return true
      if (
        typeof val === 'object' &&
        val !== null &&
        Object.keys(val).length > 0
      )
        return true
      return false
    }
    if (env.agentBalance !== undefined && isValidJsonValue(env.agentBalance)) {
      obs.balance = env.agentBalance
    }
    if (env.agentPnL !== undefined && isValidJsonValue(env.agentPnL)) {
      obs.pnl = env.agentPnL
    }
    if (
      env.openPositions !== undefined &&
      isValidJsonValue(env.openPositions)
    ) {
      obs.positions = env.openPositions
    }
    return {
      ...obs,
    }
  }
}

export function createBabylonJejuAdapter(
  config: BabylonRLAIFConfig,
): BabylonJejuAdapter {
  return new BabylonJejuAdapter(config)
}

// Helper to run Babylon training using Jeju RLAIF
export async function trainWithJejuRLAIF(options: {
  archetype: string
  modelCID: string
  jejuRpcUrl?: string
  jejuStorageUrl?: string
  iterations?: number
}): Promise<{
  finalPolicyCID: string
  iterations: number
  bestScore: number
}> {
  const jejuRpcUrl = options.jejuRpcUrl ?? process.env.JEJU_RPC_URL
  if (!jejuRpcUrl) {
    throw new Error('JEJU_RPC_URL is required')
  }
  const jejuStorageUrl =
    options.jejuStorageUrl ?? process.env.JEJU_STORAGE_SERVICE_URL
  if (!jejuStorageUrl) {
    throw new Error('JEJU_STORAGE_SERVICE_URL is required')
  }

  const adapter = createBabylonJejuAdapter({
    jejuRpcUrl,
    jejuStorageUrl,
    archetype: options.archetype,
  })

  // Load trajectories
  const trajectories = await adapter.loadByArchetype(options.archetype)

  if (trajectories.length < 10) {
    throw new Error(
      `Not enough trajectories for archetype ${options.archetype}. Found ${trajectories.length}, need at least 10.`,
    )
  }

  // Submit to Jeju RLAIF
  const computeUrl = process.env.JEJU_COMPUTE_API_URL
  if (!computeUrl) {
    throw new Error('JEJU_COMPUTE_API_URL is required for RLAIF')
  }
  const response = await fetch(`${computeUrl}/rlaif/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: {
        id: 'babylon',
        type: 'game',
        configCID: `babylon-${options.archetype}`,
      },
      model: {
        baseModelCID: options.modelCID,
        tokenizer: 'Qwen/Qwen2.5-3B-Instruct',
      },
      judge: {
        rubricId: `babylon-${options.archetype}`,
      },
      targetIterations: options.iterations ?? 5,
      minTrajectoriesPerIteration: 20,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create RLAIF run: ${response.status}`)
  }

  const runIdData: unknown = await response.json()
  if (!isRunIdResponse(runIdData)) {
    throw new Error('Invalid run ID response')
  }
  const { runId } = runIdData

  // Submit trajectories
  const rolloutsResponse = await fetch(
    `${computeUrl}/rlaif/runs/${runId}/rollouts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trajectories }),
    },
  )

  if (!rolloutsResponse.ok) {
    throw new Error(`Failed to submit rollouts: ${rolloutsResponse.status}`)
  }

  // Start training
  const startResponse = await fetch(`${computeUrl}/rlaif/runs/${runId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxIterations: options.iterations ?? 5 }),
  })

  if (!startResponse.ok) {
    throw new Error(`Failed to start training: ${startResponse.status}`)
  }

  // Poll for completion
  let finalStatus: {
    state: number
    currentIteration: number
    bestPolicyCID?: string
    bestEvalScore?: number
  } | null = null

  while (true) {
    const statusResponse = await fetch(`${computeUrl}/rlaif/runs/${runId}`)
    if (!statusResponse.ok) {
      throw new Error(`Failed to get run status: ${statusResponse.status}`)
    }

    const statusData: unknown = await statusResponse.json()
    if (!isRLAIFRunStatusResponse(statusData)) {
      throw new Error('Invalid run status response')
    }
    finalStatus = statusData

    if (finalStatus.state === 7) {
      // Finished
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 10000))
  }

  if (!finalStatus) {
    throw new Error('Failed to get final status')
  }

  return {
    finalPolicyCID: finalStatus.bestPolicyCID ?? options.modelCID,
    iterations: finalStatus.currentIteration,
    bestScore: finalStatus.bestEvalScore ?? 0,
  }
}

// ============================================================================
// Jeju Rubric Registry Integration
// ============================================================================

/** Track if rubrics have been registered */
let rubricsRegistered = false

/**
 * Register all Babylon archetypes as rubrics in Jeju's rubric registry.
 *
 * This allows Jeju's RLAIF coordinator and RULER scorer to use Babylon's
 * archetype-specific rubrics for trajectory scoring.
 *
 * Call this once during application initialization.
 */
export function registerBabylonRubrics(): void {
  if (rubricsRegistered) {
    return
  }

  const archetypes = getAvailableArchetypes()

  for (const archetype of archetypes) {
    const rubricText = getRubric(archetype)
    const priorityMetrics = getPriorityMetrics(archetype)

    const jejuRubric: JejuJudgeRubric = {
      id: `babylon-${archetype}`,
      name: `Babylon ${archetype}`,
      description: `LLM-as-judge rubric for ${archetype} archetype in Babylon prediction markets`,
      criteria: rubricText,
      priorityMetrics,
      version: '1.0.0',
    }

    jejuRegisterRubric(jejuRubric)
  }

  rubricsRegistered = true
  logger.info(
    'Registered rubrics with Jeju',
    { count: archetypes.length },
    'Babylon',
  )
}

/**
 * Get the Jeju rubric ID for a Babylon archetype
 *
 * @param archetype - Babylon archetype name
 * @returns Jeju rubric ID in format "babylon-{archetype}"
 */
export function getBabylonRubricId(archetype: string): string {
  return `babylon-${archetype}`
}

/**
 * Check if Babylon rubrics have been registered with Jeju
 */
export function areBabylonRubricsRegistered(): boolean {
  return rubricsRegistered
}
