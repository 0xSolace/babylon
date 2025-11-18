/**
 * NPC Investment Manager
 *
 * Coordinates NPC portfolio management, including:
 * - Trade execution and monitoring
 * - Position rebalancing
 * - Risk management
 * - Performance tracking
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getReputationBreakdown } from '@/lib/reputation/reputation-service';
import { TradeExecutionService } from '@/lib/services/trade-execution-service';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { TradingExecutionResult } from '@/types/market-decisions';

export type PortfolioPosition = {
  id: string;
  poolId: string;
  marketType: 'perp' | 'prediction';
  ticker?: string;
  marketId?: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  leverage?: number;
};

export type PortfolioMetrics = {
  totalValue: number;
  availableBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positionCount: number;
  utilization: number; // Percentage of capital deployed
  riskScore: number; // 0-1, higher = riskier
};

export type RebalanceAction = {
  type: 'open' | 'close' | 'resize';
  positionId?: string;
  marketType: 'perp' | 'prediction';
  ticker?: string;
  marketId?: string;
  side: string;
  targetSize: number;
  reason: string;
};

export class NPCInvestmentManager {
  /**
   * Get portfolio metrics for an NPC pool
   */
  static async getPortfolioMetrics(poolId: string): Promise<PortfolioMetrics> {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        PoolPosition: {
          where: { closedAt: null }, // Open positions have null closedAt
        },
      },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    const positions = pool.PoolPosition as unknown as PortfolioPosition[];
    const availableBalance = parseFloat(pool.availableBalance.toString());

    // Calculate total invested capital (sum of all open position entry values)
    const totalInvested = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.size?.toString() || '0');
    }, 0);

    // Calculate unrealized PnL from open positions
    const unrealizedPnL = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.unrealizedPnL?.toString() || '0');
    }, 0);

    // Calculate total portfolio value
    const totalValue = availableBalance + totalInvested + unrealizedPnL;

    // Calculate utilization (how much capital is deployed)
    const utilization = totalValue > 0 ? (totalInvested / totalValue) * 100 : 0;

    // Calculate risk score based on leverage and concentration
    const riskScore = NPCInvestmentManager.calculateRiskScore(positions, totalValue);

    return {
      totalValue,
      availableBalance,
      unrealizedPnL,
      realizedPnL: 0, // Could track from trade history
      positionCount: positions.length,
      utilization,
      riskScore,
    };
  }

  /**
   * Monitor portfolio and generate rebalance actions if needed
   */
  static async monitorPortfolio(
    poolId: string,
    npcUserId: string,
    strategy: 'aggressive' | 'conservative' | 'balanced'
  ): Promise<RebalanceAction[]> {
    const metrics = await NPCInvestmentManager.getPortfolioMetrics(poolId);
    const actions: RebalanceAction[] = [];

    // Risk thresholds by strategy
    const riskThresholds = {
      aggressive: 0.8,
      conservative: 0.4,
      balanced: 0.6,
    };

    const maxRisk = riskThresholds[strategy];

    // Check if portfolio is too risky
    if (metrics.riskScore > maxRisk) {
      logger.warn(
        `Portfolio risk too high for ${strategy} strategy: ${metrics.riskScore.toFixed(2)} > ${maxRisk}`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );

      // Generate de-risking actions
      const deRiskActions = await NPCInvestmentManager.generateDeRiskingActions(poolId, metrics);
      actions.push(...deRiskActions);
    }

    // Check if utilization is too low (idle capital)
    const targetUtilization = {
      aggressive: 80,
      conservative: 50,
      balanced: 65,
    };

    if (metrics.utilization < targetUtilization[strategy] - 10) {
      logger.info(
        `Portfolio underutilized: ${metrics.utilization.toFixed(1)}% < ${targetUtilization[strategy]}%`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );
      // Could trigger new investment allocations here
    }

    // Check for positions with large unrealized losses
    const lossyPositions = await NPCInvestmentManager.findPositionsWithLargeDrawdowns(poolId, 0.2); // >20% loss
    if (lossyPositions.length > 0) {
      logger.warn(
        `Found ${lossyPositions.length} positions with large drawdowns`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );

      for (const position of lossyPositions) {
        actions.push({
          type: 'close',
          positionId: position.id,
          marketType: position.marketType,
          ticker: position.ticker,
          marketId: position.marketId,
          side: position.side,
          targetSize: 0,
          reason: `Stop-loss triggered: ${position.unrealizedPnL.toFixed(2)} loss`,
        });
      }
    }

    return actions;
  }

  /**
   * Ensure each NPC pool has an initial baseline allocation
   * Invests ~80% of available balance across aligned companies
   */
  static async executeBaselineInvestments(
    timestamp: Date = new Date()
  ): Promise<TradingExecutionResult | null> {
    const baselineDecisions = await NPCInvestmentManager.buildBaselineDecisions();

    if (baselineDecisions.length === 0) {
      return null;
    }

    logger.info(
      `Executing ${baselineDecisions.length} baseline NPC trades`,
      { timestamp: timestamp.toISOString() },
      'NPCInvestmentManager'
    );

    const tradeExecutionService = new TradeExecutionService();
    const result = await tradeExecutionService.executeDecisionBatch(baselineDecisions);

    logger.info(
      'Baseline NPC investments completed',
      {
        trades: result.successfulTrades,
        pools: new Set(baselineDecisions.map((d) => d.npcId)).size,
      },
      'NPCInvestmentManager'
    );

    return result;
  }

  /**
   * Execute a rebalance action
   */
  static async executeRebalanceAction(
    npcUserId: string,
    poolId: string,
    action: RebalanceAction
  ): Promise<void> {
    logger.info(
      `Executing rebalance: ${action.type} for ${action.ticker || action.marketId}`,
      { npcUserId, poolId, action },
      'NPCInvestmentManager'
    );

    try {
      if (action.type === 'close' && action.positionId) {
        // Close position
        await prisma.poolPosition.update({
          where: { id: action.positionId },
          data: { closedAt: new Date() },
        });

        // Record the rebalance trade
        await prisma.nPCTrade.create({
          data: {
            id: await generateSnowflakeId(),
            npcActorId: npcUserId,
            poolId,
            marketType: action.marketType,
            ticker: action.ticker,
            marketId: action.marketId,
            action: 'close',
            side: action.side,
            amount: 0,
            price: 0,
            sentiment: 0,
            reason: action.reason,
          },
        });
      }
      // Add other action types (open, resize) as needed
    } catch (error) {
      logger.error('Error executing NPC action', { error, action });
      throw error;
    }
  }

  /**
   * Periodic portfolio monitoring for all active NPC pools
   */
  static async monitorAllNPCPortfolios(): Promise<void> {
    const activePools = await prisma.pool.findMany({
      where: { isActive: true },
      include: {
        Actor: {
          select: {
            id: true,
            name: true,
            personality: true,
          },
        },
      },
    });

    logger.info(
      `Monitoring ${activePools.length} active NPC portfolios`,
      undefined,
      'NPCInvestmentManager'
    );

    for (const pool of activePools) {
      if (!pool.Actor) continue;

      // Determine strategy from actor personality
      const strategy = NPCInvestmentManager.determineStrategyFromPersonality(
        pool.Actor.personality
      );

      const actions = await NPCInvestmentManager.monitorPortfolio(pool.id, pool.Actor.id, strategy);

      // Execute rebalance actions
      for (const action of actions) {
        await NPCInvestmentManager.executeRebalanceAction(pool.Actor.id, pool.id, action);
      }
    }
  }

  /**
   * Calculate reputation-adjusted allocation amount for an NPC
   *
   * Reputation Score (0-100) adjusts allocation:
   * - Low reputation (0-40): 50% of base allocation (cautious)
   * - Medium reputation (40-70): 100% of base allocation (standard)
   * - High reputation (70-100): 150% of base allocation (confident)
   *
   * @param npcUserId - NPC user ID
   * @param baseAmount - Base allocation amount
   * @returns Adjusted allocation amount
   */
  static async calculateReputationAdjustedAllocation(
    npcUserId: string,
    baseAmount: number
  ): Promise<number> {
    // Get NPC's reputation breakdown
    const reputation = await getReputationBreakdown(npcUserId);

    if (!reputation) {
      logger.warn(
        `No reputation data for NPC ${npcUserId}, using base allocation`,
        { npcUserId, baseAmount },
        'NPCInvestmentManager'
      );
      return baseAmount;
    }

    const reputationScore = reputation.reputationScore;

    // Calculate multiplier based on reputation tiers
    let multiplier: number;

    if (reputationScore < 40) {
      // Low reputation: cautious allocation (50-75%)
      multiplier = 0.5 + (reputationScore / 40) * 0.25;
    } else if (reputationScore < 70) {
      // Medium reputation: standard allocation (75-100%)
      multiplier = 0.75 + ((reputationScore - 40) / 30) * 0.25;
    } else {
      // High reputation: confident allocation (100-150%)
      multiplier = 1.0 + ((reputationScore - 70) / 30) * 0.5;
    }

    const adjustedAmount = baseAmount * multiplier;

    logger.info(
      `Reputation-adjusted allocation: ${baseAmount} → ${adjustedAmount.toFixed(2)} (score: ${reputationScore}, multiplier: ${multiplier.toFixed(2)}x)`,
      {
        npcUserId,
        reputationScore,
        multiplier,
        baseAmount,
        adjustedAmount,
        trustLevel: reputation.trustLevel,
      },
      'NPCInvestmentManager'
    );

    return adjustedAmount;
  }

  /**
   * Get recommended position size based on portfolio metrics and reputation
   *
   * Combines portfolio utilization, risk score, and reputation to determine
   * optimal position size for new trades.
   *
   * @param poolId - Pool ID
   * @param npcUserId - NPC user ID
   * @param strategy - Investment strategy
   * @returns Recommended position size as percentage of available balance
   */
  static async getRecommendedPositionSize(
    poolId: string,
    npcUserId: string,
    strategy: 'aggressive' | 'conservative' | 'balanced'
  ): Promise<number> {
    // Get current portfolio metrics
    const metrics = await NPCInvestmentManager.getPortfolioMetrics(poolId);

    // Get reputation breakdown
    const reputation = await getReputationBreakdown(npcUserId);

    // Base position sizes by strategy
    const basePositionSizes = {
      aggressive: 0.15, // 15% of available balance
      conservative: 0.05, // 5% of available balance
      balanced: 0.1, // 10% of available balance
    };

    let positionSize = basePositionSizes[strategy];

    // Adjust down if portfolio is already highly utilized
    if (metrics.utilization > 70) {
      positionSize *= 0.7; // Reduce by 30%
    }

    // Adjust down if portfolio risk is high
    if (metrics.riskScore > 0.6) {
      positionSize *= 0.8; // Reduce by 20%
    }

    // Adjust based on reputation (if available)
    if (reputation) {
      const reputationScore = reputation.reputationScore;

      if (reputationScore >= 70) {
        positionSize *= 1.2; // Increase by 20% for high reputation
      } else if (reputationScore < 40) {
        positionSize *= 0.8; // Reduce by 20% for low reputation
      }
    }

    // Clamp to reasonable range (2% to 25% of available balance)
    positionSize = Math.max(0.02, Math.min(0.25, positionSize));

    logger.info(
      `Recommended position size: ${(positionSize * 100).toFixed(1)}%`,
      {
        poolId,
        npcUserId,
        strategy,
        utilization: metrics.utilization,
        riskScore: metrics.riskScore,
        reputationScore: reputation?.reputationScore,
        positionSize,
      },
      'NPCInvestmentManager'
    );

    return positionSize;
  }
}
