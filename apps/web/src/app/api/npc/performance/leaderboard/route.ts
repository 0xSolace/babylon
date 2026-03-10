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
import { db, eq, pools } from '@babylon/db';
import { NPCInvestmentManager, StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
      try {
        const metrics = await NPCInvestmentManager.getPortfolioMetrics(pool.id);
        return { pool, metrics };
      } catch (error) {
        logger.warn(
          'Skipping NPC performance row due to metrics failure',
          {
            poolId: pool.id,
            actorId: pool.npcActorId,
            error: error instanceof Error ? error.message : String(error),
          },
          'GET /api/npc/performance/leaderboard'
        );
        return null;
      }
    })
  );

  const leaderboard = leaderboardRows
    .filter(
      (row): row is NonNullable<(typeof leaderboardRows)[number]> =>
        row !== null && row.metrics.totalValue >= minValue
    )
    .sort((a, b) => b.metrics.totalValue - a.metrics.totalValue)
    .slice(0, limit)
    .map(({ pool, metrics }, index) => {
      const initialValue = Number.parseFloat(
        pool.totalDeposits?.toString() || '0'
      );
      const roi =
        initialValue > 0
          ? ((metrics.totalValue - initialValue) / initialValue) * 100
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
          totalValue: Math.round(metrics.totalValue),
          roi: Number.parseFloat(roi.toFixed(2)),
          realizedPnL: Math.round(metrics.realizedPnL),
          unrealizedPnL: Math.round(metrics.unrealizedPnL),
          positionCount: metrics.positionCount,
          utilization: Number.parseFloat(metrics.utilization.toFixed(1)),
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
