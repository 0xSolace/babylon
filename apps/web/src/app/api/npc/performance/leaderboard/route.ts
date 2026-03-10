/**
 * NPC Performance Leaderboard API
 *
 * @route GET /api/npc/performance/leaderboard - Get NPC leaderboard
 * @access Public
 *
 * @description
 * Returns ranked list of NPC actors by portfolio performance. Includes
 * filtering options for minimum portfolio value and result limit.
 *
 * @openapi
 * /api/npc/performance/leaderboard:
 *   get:
 *     tags:
 *       - NPC
 *     summary: Get NPC performance leaderboard
 *     description: Returns ranked NPC actors by portfolio performance
 *     parameters:
 *       - in: query
 *         name: minValue
 *         schema:
 *           type: number
 *         description: Minimum portfolio value filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum results to return
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       actorId:
 *                         type: string
 *                       totalValue:
 *                         type: number
 *                       pnl:
 *                         type: number
 *
 * @example
 * ```typescript
 * const { leaderboard } = await fetch('/api/npc/performance/leaderboard?limit=10')
 *   .then(r => r.json());
 * ```
 */

import {
  addPublicReadHeaders,
  publicRateLimit,
  withErrorHandling,
} from '@babylon/api';
import { db, eq, npcTrades, poolPositions, pools, sql } from '@babylon/db';
import { NPCInvestmentManager, StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Aggregate trade/position stats for a pool. */
async function getPoolTradeStats(poolId: string, npcActorId: string) {
  // Count trades from NPCTrade table
  const [tradeStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(npcTrades)
    .where(eq(npcTrades.npcActorId, npcActorId));

  // Count closed positions with positive realized PnL (wins) vs total closed
  const [positionStats] = await db
    .select({
      closed: sql<number>`count(*) filter (where ${poolPositions.closedAt} is not null)::int`,
      wins: sql<number>`count(*) filter (where ${poolPositions.closedAt} is not null and ${poolPositions.realizedPnL} > 0)::int`,
      totalRealizedPnL: sql<number>`coalesce(sum(${poolPositions.realizedPnL}) filter (where ${poolPositions.closedAt} is not null), 0)`,
      openCount: sql<number>`count(*) filter (where ${poolPositions.closedAt} is null)::int`,
      openUnrealizedPnL: sql<number>`coalesce(sum(${poolPositions.unrealizedPnL}) filter (where ${poolPositions.closedAt} is null), 0)`,
    })
    .from(poolPositions)
    .where(eq(poolPositions.poolId, poolId));

  return {
    tradeCount: tradeStats?.count ?? 0,
    closedPositions: positionStats?.closed ?? 0,
    wins: positionStats?.wins ?? 0,
    winRate:
      (positionStats?.closed ?? 0) > 0
        ? ((positionStats?.wins ?? 0) / positionStats!.closed) * 100
        : 0,
    totalRealizedPnL: positionStats?.totalRealizedPnL ?? 0,
    openPositionCount: positionStats?.openCount ?? 0,
    openUnrealizedPnL: positionStats?.openUnrealizedPnL ?? 0,
  };
}

export const GET = withErrorHandling(async function GET(request: NextRequest) {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  const minValueParam = searchParams.get('minValue');

  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const minValue = minValueParam ? Number.parseFloat(minValueParam) : 0;

  const activePools = await db
    .select()
    .from(pools)
    .where(eq(pools.isActive, true));

  const leaderboardRows = await Promise.all(
    activePools.map(async (pool) => {
      // Try live portfolio metrics first; fall back to Pool-level columns
      let liveMetrics: Awaited<
        ReturnType<typeof NPCInvestmentManager.getPortfolioMetrics>
      > | null = null;
      try {
        liveMetrics = await NPCInvestmentManager.getPortfolioMetrics(pool.id);
      } catch (err) {
        logger.warn(
          'Live portfolio metrics unavailable, using pool-level data',
          {
            poolId: pool.id,
            actorId: pool.npcActorId,
            error: err instanceof Error ? err.message : String(err),
          },
          'GET /api/npc/performance/leaderboard'
        );
      }

      // Pool-level fallback values
      const poolTotalValue = Number.parseFloat(
        pool.totalValue?.toString() || '0'
      );
      const poolLifetimePnL = Number.parseFloat(
        pool.lifetimePnL?.toString() || '0'
      );

      // Aggregate trade/position stats directly from DB
      const tradeStats = await getPoolTradeStats(pool.id, pool.npcActorId);

      // Prefer live metrics when available and non-zero; otherwise use pool columns
      const totalValue =
        liveMetrics && liveMetrics.totalValue > 0
          ? liveMetrics.totalValue
          : poolTotalValue;
      const realizedPnL =
        tradeStats.totalRealizedPnL !== 0
          ? tradeStats.totalRealizedPnL
          : (liveMetrics?.realizedPnL ?? poolLifetimePnL);
      const unrealizedPnL =
        tradeStats.openUnrealizedPnL !== 0
          ? tradeStats.openUnrealizedPnL
          : (liveMetrics?.unrealizedPnL ?? 0);
      const positionCount =
        tradeStats.openPositionCount > 0
          ? tradeStats.openPositionCount
          : (liveMetrics?.positionCount ?? 0);
      const utilization = liveMetrics?.utilization ?? 0;

      return {
        pool,
        totalValue,
        realizedPnL,
        unrealizedPnL,
        positionCount,
        utilization,
        tradeStats,
      };
    })
  );

  const leaderboard = leaderboardRows
    .filter((row) => row.totalValue >= minValue)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit)
    .map((row, index) => {
      const {
        pool,
        totalValue,
        realizedPnL,
        unrealizedPnL,
        positionCount,
        utilization,
        tradeStats,
      } = row;
      const initialValue = Number.parseFloat(
        pool.totalDeposits?.toString() || '0'
      );
      const roi =
        initialValue > 0
          ? ((totalValue - initialValue) / initialValue) * 100
          : 0;
      const actor = StaticDataRegistry.getActor(pool.npcActorId);

      return {
        rank: index + 1,
        actorId: actor?.id || pool.npcActorId,
        actorName: actor?.name || 'Unknown',
        personality: actor?.personality || null,
        profileImageUrl: actor?.profileImageUrl || null,
        poolId: pool.id,
        performance: {
          totalValue: Math.round(totalValue),
          roi: Number.parseFloat(roi.toFixed(2)),
          realizedPnL: Math.round(realizedPnL),
          unrealizedPnL: Math.round(unrealizedPnL),
          positionCount,
          utilization: Number.parseFloat(utilization.toFixed(1)),
          tradeCount: tradeStats.tradeCount,
          winRate: Number.parseFloat(tradeStats.winRate.toFixed(1)),
        },
      };
    });

  const res = NextResponse.json({
    success: true,
    leaderboard,
    metadata: {
      count: leaderboard.length,
      limit,
      minValue,
    },
  });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
