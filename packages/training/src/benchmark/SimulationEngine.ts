/**
 * Simulation Engine Types
 *
 * Type definitions for the simulation engine used in benchmarking.
 * The actual simulation implementation lives elsewhere - these types
 * are used for benchmark result storage and comparison.
 */

import type {
  SimulationAgent,
  SimulationFeedPost,
  SimulationGroupChat,
  SimulationPerpetualMarket,
  SimulationPredictionMarket,
} from '../type-guards'

/**
 * Full simulation state returned by getState()
 */
export interface SimulationEngineState {
  tick: number
  initialized: boolean
  predictionMarkets: SimulationPredictionMarket[]
  perpetualMarkets: SimulationPerpetualMarket[]
  posts?: SimulationFeedPost[]
  groupChats?: SimulationGroupChat[]
  agents: SimulationAgent[]
}

/**
 * Agent action recorded during simulation
 */
export interface AgentAction {
  type:
    | 'buy_prediction'
    | 'sell_prediction'
    | 'open_perp'
    | 'close_perp'
    | 'query_state'
    | 'post'
    | 'comment'
    | 'idle'
  timestamp: number
  marketId?: string
  amount?: number
  direction?: 'long' | 'short'
  correctness?: {
    predictionCorrect?: boolean
    pnl?: number
  }
  metadata?: Record<string, unknown>
}

/**
 * Configuration for running a simulation
 */
export interface SimulationConfig {
  /** Duration of the simulation in milliseconds */
  durationMs?: number
  /** Interval between ticks in milliseconds */
  tickIntervalMs?: number
  /** Number of prediction markets to include */
  numPredictionMarkets?: number
  /** Number of perpetual markets to include */
  numPerpMarkets?: number
  /** Random seed for reproducibility */
  seed?: number
  /** Benchmark snapshot to use */
  snapshot?: unknown
  /** Agent ID for the simulation */
  agentId?: string
  /** Whether to run in fast-forward mode */
  fastForward?: boolean
  /** Response timeout in milliseconds */
  responseTimeout?: number
}

/**
 * Prediction market metrics from simulation
 */
export interface PredictionMetrics {
  totalPositions: number
  correctPredictions: number
  incorrectPredictions: number
  accuracy: number
  avgPnlPerPosition: number
}

/**
 * Perpetual market metrics from simulation
 */
export interface PerpMetrics {
  totalTrades: number
  profitableTrades: number
  winRate: number
  avgPnlPerTrade: number
  maxDrawdown: number
}

/**
 * Social engagement metrics from simulation
 */
export interface SocialMetrics {
  postsCreated: number
  groupsJoined: number
  messagesReceived: number
  reputationGained: number
}

/**
 * Timing metrics from simulation
 */
export interface TimingMetrics {
  avgResponseTime: number
  maxResponseTime: number
  totalDuration: number
}

/**
 * Complete metrics from a simulation run
 */
export interface SimulationMetrics {
  totalPnl: number
  predictionMetrics: PredictionMetrics
  perpMetrics: PerpMetrics
  socialMetrics: SocialMetrics
  timing: TimingMetrics
  optimalityScore: number
}

/**
 * Result of a simulation run
 */
export interface SimulationResult {
  /** Unique identifier for the simulation run */
  id: string
  /** Whether the simulation completed successfully */
  success: boolean
  /** Detailed metrics from the run */
  metrics: SimulationMetrics
  /** Error message if simulation failed */
  error?: string
  /** Duration of the simulation in milliseconds */
  durationMs: number
  /** Benchmark ID for comparison */
  benchmarkId?: string
  /** Recorded trajectory from the simulation */
  trajectory?: unknown
  /** Actions executed during simulation */
  actions: AgentAction[]
}

/**
 * Simulation Engine Stub
 *
 * The actual simulation implementation was moved to the game engine.
 * This class provides a type-compatible stub that throws when used.
 * NOTE: Use game engine simulation instead
 */
export class SimulationEngine {
  private _tickNumber = 0
  private _maxTicks = 100
  private _initialized = false

  constructor(config: SimulationConfig) {
    // Calculate max ticks from config if available
    if (config.durationMs && config.tickIntervalMs) {
      this._maxTicks = Math.ceil(config.durationMs / config.tickIntervalMs)
    }
  }

  /** Initialize the simulation engine */
  initialize(): void {
    this._initialized = true
    this._tickNumber = 0
  }

  /** Check if simulation is complete */
  isComplete(): boolean {
    return this._tickNumber >= this._maxTicks
  }

  /** Get current tick number */
  getCurrentTickNumber(): number {
    return this._tickNumber
  }

  /** Advance to next tick */
  advanceTick(): void {
    this._tickNumber++
  }

  async run(): Promise<SimulationResult> {
    // Return a stub result with empty metrics
    return {
      id: `stub-${Date.now()}`,
      success: false,
      metrics: {
        totalPnl: 0,
        predictionMetrics: {
          totalPositions: 0,
          correctPredictions: 0,
          incorrectPredictions: 0,
          accuracy: 0,
          avgPnlPerPosition: 0,
        },
        perpMetrics: {
          totalTrades: 0,
          profitableTrades: 0,
          winRate: 0,
          avgPnlPerTrade: 0,
          maxDrawdown: 0,
        },
        socialMetrics: {
          postsCreated: 0,
          groupsJoined: 0,
          messagesReceived: 0,
          reputationGained: 0,
        },
        timing: {
          avgResponseTime: 0,
          maxResponseTime: 0,
          totalDuration: 0,
        },
        optimalityScore: 0,
      },
      error: 'SimulationEngine is deprecated. Use game engine simulation.',
      durationMs: 0,
      actions: [],
    }
  }

  async runWithAgent(_agent: unknown): Promise<SimulationResult> {
    return this.run()
  }

  getState(): SimulationEngineState {
    return {
      tick: this._tickNumber,
      initialized: this._initialized,
      predictionMarkets: [],
      perpetualMarkets: [],
      agents: [],
    }
  }
}
