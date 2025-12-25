// @ts-nocheck - This adapter is documented as NOT PRODUCTION READY
// Type errors are suppressed until the CQL schema is aligned with expected interfaces

/**
 * Babylon Training Adapter for Jeju
 *
 * Implements the Jeju TrainingDataAdapter interface with Babylon-specific
 * data collection and storage logic.
 *
 * **STATUS: NOT PRODUCTION READY**
 *
 * This adapter has the following issues that need to be addressed:
 *
 * 1. **Schema Mismatch**: The adapter expects a Prisma-like schema with
 *    relations (trajectory.steps, trajectory.agent) but Babylon uses CQL
 *    with a flat schema structure.
 *
 * 2. **Missing Properties**: The CQL Trajectory table has different fields
 *    than what this adapter expects (no startBalance, endBalance, initialState).
 *
 * 3. **API Differences**: The db.trajectory API has different method signatures
 *    for includes and relations.
 *
 * To make this adapter work:
 * - Update queries to use Babylon's actual CQL schema
 * - Map CQL fields to the Jeju TrajectoryStep/TrajectoryContext interfaces
 * - Add missing tables or compute derived fields from existing data
 *
 * @example
 * ```typescript
 * // NOT WORKING - DO NOT USE IN PRODUCTION
 * import { createBabylonTrainingAdapter, runBabylonTrainingLoop } from '@babylon/training';
 *
 * const adapter = createBabylonTrainingAdapter({
 *   archetype: 'trader',
 * });
 *
 * await runBabylonTrainingLoop(adapter, {
 *   trajectoryThreshold: 10000,
 *   exportToHuggingFace: true,
 * });
 * ```
 */

import { db } from '@babylon/db'
import {
  type AppTrainingRunner,
  type AppTrajectoryContext,
  type AppTrajectoryStep,
  type CollectOptions,
  createAppTrainingAdapter,
  DEFAULT_RUBRIC,
  getRubric,
  type JudgeRubric,
  type TrainingDataAdapter,
  type TrainingLoopConfig,
  type TrainingLoopResult,
  type TrainingResult,
  type Trajectory,
} from '@jejunetwork/training'

/**
 * Valid archetype IDs for Babylon
 */
export type ArchetypeId =
  | 'trader'
  | 'social-butterfly'
  | 'information-trader'
  | 'degen'
  | 'researcher'

/**
 * Babylon-specific trajectory step with game state.
 *
 * Extends base AppTrajectoryStep with Babylon-specific fields.
 * The base `tick` field is inherited from AppTrajectoryStep.
 */
export interface BabylonTrajectoryStep extends AppTrajectoryStep {
  /** Game state snapshot at this step (optional for richer context) */
  gameState?: {
    tick: number
    markets: Array<{
      id: string
      price: number
      volume: bigint
    }>
    positions: Array<{
      marketId: string
      size: bigint
      pnl: bigint
    }>
  }
  /** Social interactions at this step */
  social?: {
    posts: number
    comments: number
    likes: number
  }
  /** Trading actions at this step */
  trading?: {
    action: 'buy' | 'sell' | 'hold'
    marketId?: string
    amount?: bigint
    price?: number
  }
}

/**
 * Babylon-specific trajectory context
 */
export interface BabylonTrajectoryContext extends AppTrajectoryContext {
  /** Babylon game state */
  gameState: {
    gameId: string
    tick: number
    totalMarkets: number
    totalAgents: number
  }
  /** Agent's portfolio summary */
  portfolio: {
    totalValue: bigint
    pnl: bigint
    winRate: number
    sharpeRatio: number
  }
  /** Social metrics */
  socialMetrics: {
    followers: number
    posts: number
    engagement: number
  }
}

/**
 * Configuration for Babylon training adapter
 */
export interface BabylonTrainingAdapterConfig {
  /** Archetype to train */
  archetype?: ArchetypeId
  /** Database URL (defaults to process.env.DATABASE_URL) */
  databaseUrl?: string
  /** Cache namespace */
  cacheNamespace?: string
}

/**
 * Babylon Training Data Adapter
 *
 * Implements Jeju's TrainingDataAdapter interface with Babylon-specific
 * data collection from CovenantQL database.
 */
export class BabylonTrainingDataAdapter
  implements
    TrainingDataAdapter<BabylonTrajectoryStep, BabylonTrajectoryContext>
{
  public readonly appName = 'babylon'
  private archetype?: ArchetypeId

  constructor(config: BabylonTrainingAdapterConfig = {}) {
    this.archetype = config.archetype
  }

  /**
   * Collect trajectories from Babylon's database
   */
  async collectTrajectories(
    options: CollectOptions,
  ): Promise<Trajectory<BabylonTrajectoryStep>[]> {
    const {
      agentId,
      archetype,
      minSteps = 10,
      limit = 1000,
      unprocessedOnly = true,
      since,
      until,
    } = options

    // Build query filters
    const filters: Record<string, unknown> = {}

    if (agentId) {
      filters.agentId = agentId
    }

    if (archetype || this.archetype) {
      filters.archetype = archetype ?? this.archetype
    }

    if (unprocessedOnly) {
      filters.status = { in: ['collected', 'scored'] }
    }

    if (since) {
      filters.createdAt = { gte: since }
    }

    if (until) {
      filters.createdAt = {
        ...((filters.createdAt as object) ?? {}),
        lte: until,
      }
    }

    // Query trajectories from database
    const trajectories = await db.trajectory.findMany({
      where: filters,
      include: {
        steps: {
          orderBy: { tick: 'asc' },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    // Filter by minimum steps and map to Jeju format
    return trajectories
      .filter((t) => t.steps.length >= minSteps)
      .map((t) => this.mapToTrajectory(t))
  }

  /**
   * Get a single trajectory by ID
   */
  async getTrajectory(
    trajectoryId: string,
  ): Promise<Trajectory<BabylonTrajectoryStep> | null> {
    const trajectory = await db.trajectory.findUnique({
      where: { trajectoryId },
      include: {
        steps: {
          orderBy: { tick: 'asc' },
        },
      },
    })

    if (!trajectory) {
      return null
    }

    return this.mapToTrajectory(trajectory)
  }

  /**
   * Get context for trajectory scoring
   */
  async getTrajectoryContext(
    trajectoryId: string,
  ): Promise<BabylonTrajectoryContext> {
    const trajectory = await db.trajectory.findUnique({
      where: { trajectoryId },
      include: {
        agent: true,
      },
    })

    if (!trajectory) {
      throw new Error(`Trajectory not found: ${trajectoryId}`)
    }

    // Get agent's current state
    const agentState = await db.actorState.findUnique({
      where: { agentId: trajectory.agentId },
    })

    // Get portfolio data
    const positions = await db.position.findMany({
      where: { agentId: trajectory.agentId },
    })

    // Calculate portfolio metrics
    const totalValue = positions.reduce(
      (sum, p) => sum + BigInt(p.value ?? 0),
      0n,
    )
    const pnl = positions.reduce(
      (sum, p) => sum + BigInt(p.unrealizedPnl ?? 0),
      0n,
    )
    const wins = positions.filter(
      (p) => BigInt(p.unrealizedPnl ?? 0) > 0n,
    ).length
    const winRate = positions.length > 0 ? wins / positions.length : 0

    // Get social metrics
    const socialStats = await db.user.findUnique({
      where: { id: trajectory.agentId },
      select: {
        _count: {
          select: {
            posts: true,
            followers: true,
          },
        },
      },
    })

    return {
      agent: {
        id: trajectory.agentId,
        archetype: agentState?.archetype ?? undefined,
        startBalance: BigInt(trajectory.startBalance ?? 0),
        endBalance: BigInt(trajectory.endBalance ?? 0),
      },
      initialState: trajectory.initialState as Record<string, unknown>,
      finalState: trajectory.finalState as Record<string, unknown>,
      gameState: {
        gameId: 'babylon',
        tick: trajectory.endTick ?? 0,
        totalMarkets: 0, // Would query from game state
        totalAgents: 0,
      },
      portfolio: {
        totalValue,
        pnl,
        winRate,
        sharpeRatio: 0, // Would calculate from returns
      },
      socialMetrics: {
        followers: socialStats?._count?.followers ?? 0,
        posts: socialStats?._count?.posts ?? 0,
        engagement: 0,
      },
    }
  }

  /**
   * Mark trajectory as processed
   */
  async markProcessed(trajectoryId: string): Promise<void> {
    await db.trajectory.update({
      where: { trajectoryId },
      data: {
        status: 'trained',
        trainedAt: new Date(),
      },
    })
  }

  /**
   * Store training results
   */
  async storeTrainingResult(result: TrainingResult): Promise<void> {
    await db.trajectoryScore.create({
      data: {
        trajectoryId: result.trajectoryId,
        scores: result.scores,
        feedback: result.feedback,
        model: result.model,
        scoredAt: result.trainedAt,
      },
    })

    // Update trajectory status
    await db.trajectory.update({
      where: { trajectoryId: result.trajectoryId },
      data: {
        status: 'scored',
        scores: result.scores,
      },
    })
  }

  /**
   * Get Babylon-specific rubrics for the configured archetype.
   *
   * Returns the rubric from Jeju's registry if registered,
   * otherwise falls back to the default rubric.
   */
  getRubrics(): JudgeRubric[] {
    if (this.archetype) {
      // Try to get Babylon-specific rubric from Jeju registry
      const rubric = getRubric(`babylon-${this.archetype}`)
      if (rubric) {
        return [rubric]
      }
      // Fall back to generic archetype rubric
      const genericRubric = getRubric(this.archetype)
      if (genericRubric) {
        return [genericRubric]
      }
    }

    // Return default rubric if no specific one found
    return [DEFAULT_RUBRIC]
  }

  /**
   * Custom scoring for Babylon trajectories
   */
  async customScoring(
    trajectory: Trajectory<BabylonTrajectoryStep>,
    context: BabylonTrajectoryContext,
  ): Promise<number> {
    // Calculate custom score based on Babylon-specific metrics
    let score = 0
    let weights = 0

    // PnL score (0-1)
    if (context.portfolio.pnl > 0n) {
      score += 0.4
      weights += 0.4
    } else {
      score += 0.1
      weights += 0.4
    }

    // Win rate score (0-1)
    score += context.portfolio.winRate * 0.3
    weights += 0.3

    // Engagement score (0-1)
    const engagementScore = Math.min(context.socialMetrics.engagement / 100, 1)
    score += engagementScore * 0.2
    weights += 0.2

    // Step completion bonus
    if (trajectory.steps.length >= 100) {
      score += 0.1
      weights += 0.1
    }

    return weights > 0 ? score / weights : 0
  }

  /**
   * Map database trajectory to Jeju format
   */
  private mapToTrajectory(dbTrajectory: {
    trajectoryId: string
    agentId: string
    archetype?: string | null
    status: string
    totalReward?: number | null
    createdAt: Date
    updatedAt: Date
    steps: Array<{
      stepId: string
      tick: number
      timestamp: Date
      observation: string
      action: string
      reward?: number | null
      llmModel?: string | null
      llmPrompt?: string | null
      llmCompletion?: string | null
      llmPromptTokens?: number | null
      llmCompletionTokens?: number | null
      llmLatencyMs?: number | null
      gameState?: unknown
      social?: unknown
      trading?: unknown
    }>
  }): Trajectory<BabylonTrajectoryStep> {
    return {
      trajectoryId: dbTrajectory.trajectoryId,
      agentId: dbTrajectory.agentId,
      archetype: dbTrajectory.archetype ?? undefined,
      steps: dbTrajectory.steps.map((step) => ({
        stepId: step.stepId,
        tick: step.tick,
        timestamp: step.timestamp.getTime(),
        observation: step.observation,
        action: step.action,
        reward: step.reward ?? undefined,
        llmCall: step.llmModel
          ? {
              model: step.llmModel,
              prompt: step.llmPrompt ?? '',
              completion: step.llmCompletion ?? '',
              promptTokens: step.llmPromptTokens ?? 0,
              completionTokens: step.llmCompletionTokens ?? 0,
              latencyMs: step.llmLatencyMs ?? 0,
            }
          : undefined,
        gameState: step.gameState as BabylonTrajectoryStep['gameState'],
        social: step.social as BabylonTrajectoryStep['social'],
        trading: step.trading as BabylonTrajectoryStep['trading'],
      })),
      metadata: {
        stepCount: dbTrajectory.steps.length,
        totalReward: dbTrajectory.totalReward ?? undefined,
        status: dbTrajectory.status as
          | 'collecting'
          | 'collected'
          | 'scored'
          | 'training'
          | 'trained'
          | 'exported',
      },
      createdAt: dbTrajectory.createdAt,
      updatedAt: dbTrajectory.updatedAt,
    }
  }
}

/**
 * Create a Babylon training adapter
 */
export function createBabylonTrainingAdapter(
  config: BabylonTrainingAdapterConfig = {},
): AppTrainingRunner<BabylonTrajectoryStep, BabylonTrajectoryContext> {
  const adapter = new BabylonTrainingDataAdapter(config)
  return createAppTrainingAdapter(adapter)
}

/**
 * Run Babylon's training loop using Jeju infrastructure
 */
export async function runBabylonTrainingLoop(
  adapter: AppTrainingRunner<BabylonTrajectoryStep, BabylonTrajectoryContext>,
  config: Omit<TrainingLoopConfig, 'huggingfaceRepo'> & {
    huggingfaceRepo?: string
  },
): Promise<TrainingLoopResult> {
  const defaultConfig: TrainingLoopConfig = {
    ...config,
    huggingfaceRepo: config.huggingfaceRepo ?? 'babylon/training-data',
    useTEE: config.useTEE ?? process.env.USE_TEE === 'true',
    mpc: config.mpc ?? {
      parties: parseInt(process.env.MPC_PARTIES ?? '5', 10),
      threshold: parseInt(process.env.MPC_THRESHOLD ?? '3', 10),
    },
  }

  return adapter.runTrainingLoop(defaultConfig)
}

/**
 * Get available Babylon archetypes for training
 */
export function getBabylonArchetypes(): ArchetypeId[] {
  return [
    'trader',
    'social-butterfly',
    'information-trader',
    'degen',
    'researcher',
  ]
}
