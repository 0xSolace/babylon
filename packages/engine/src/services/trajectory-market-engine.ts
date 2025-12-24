/**
 * Trajectory Market Engine
 *
 * Tracks market trajectories and predictions for training data generation.
 */

export interface TrajectoryMarketEngine {
  recordDecision(npcId: string, decision: MarketDecision): Promise<void>
  getTrajectory(npcId: string): Promise<MarketTrajectory | null>
}

export interface MarketDecision {
  action: string
  marketType: 'perp' | 'prediction'
  ticker?: string
  marketId?: string
  amount: number
  confidence: number
  reasoning: string
  timestamp: string
}

export interface MarketTrajectory {
  npcId: string
  decisions: MarketDecision[]
  totalPnL: number
  winRate: number
}

/**
 * Create a trajectory market engine for recording NPC decisions.
 */
export function createTrajectoryMarketEngine(): TrajectoryMarketEngine {
  const trajectories = new Map<string, MarketTrajectory>()

  return {
    async recordDecision(
      npcId: string,
      decision: MarketDecision,
    ): Promise<void> {
      let trajectory = trajectories.get(npcId)
      if (!trajectory) {
        trajectory = {
          npcId,
          decisions: [],
          totalPnL: 0,
          winRate: 0,
        }
        trajectories.set(npcId, trajectory)
      }
      trajectory.decisions.push(decision)
    },

    async getTrajectory(npcId: string): Promise<MarketTrajectory | null> {
      return trajectories.get(npcId) ?? null
    },
  }
}
