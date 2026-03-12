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
 *         description: Maximum results to return (capped at 100)
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       actorId:
 *                         type: string
 *                       actorName:
 *                         type: string
 *                       personality:
 *                         type: string
 *                         nullable: true
 *                       profileImageUrl:
 *                         type: string
 *                         nullable: true
 *                       poolId:
 *                         type: string
 *                       performance:
 *                         type: object
 *                         properties:
 *                           totalValue:
 *                             type: number
 *                           roi:
 *                             type: number
 *                           realizedPnL:
 *                             type: number
 *                           unrealizedPnL:
 *                             type: number
 *                           positionCount:
 *                             type: integer
 *                           utilization:
 *                             type: number
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     minValue:
 *                       type: number
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
import {
  actorState,
  db,
  eq,
  inArray,
  perpPositions,
  poolPositions,
  pools,
} from '@babylon/db';
import { NPCInvestmentManager, StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type LeaderboardMetrics = Awaited<
  ReturnType<typeof NPCInvestmentManager.getPortfolioMetrics>
>;

type LeaderboardFallbackMetrics = Pick<
  LeaderboardMetrics,
  | 'availableBalance'
  | 'unrealizedPnL'
  | 'realizedPnL'
  | 'positionCount'
  | 'utilization'
  | 'totalValue'
>;

type FallbackPositionRow = {
  id: string;
  poolId: string;
  marketType: string;
  size: number | null;
  leverage: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  closedAt: Date | null;
};

type FallbackPerpRow = {
  id: string;
  userId: string;
  size: number | null;
  leverage: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  closedAt: Date | null;
};

function getEffectiveLeverage(leverage: number | null | undefined): number {
  return Number.isFinite(leverage) && Number(leverage) > 0
    ? Number(leverage)
    : 1;
}

function getPositionExposure(
  size: number | null | undefined,
  leverage?: number | null
): number {
  const numericSize = Number(size ?? 0);
  if (!Number.isFinite(numericSize)) return 0;

  if (leverage === undefined) {
    return Math.abs(numericSize);
  }

  return Math.abs(numericSize / getEffectiveLeverage(leverage));
}

function buildFallbackMetricsByPool(
  activePools: Array<typeof pools.$inferSelect>,
  balances: Array<{ id: string; tradingBalance: string | null }>,
  positionRows: FallbackPositionRow[],
  perpRows: FallbackPerpRow[]
): Map<string, LeaderboardFallbackMetrics> {
  const balanceByPoolId = new Map(
    balances.map(({ id, tradingBalance }) => [
      id,
      Number.parseFloat(tradingBalance ?? '0'),
    ])
  );

  const perpIdsByPool = new Map<string, Set<string>>();
  for (const perp of perpRows) {
    const ids = perpIdsByPool.get(perp.userId) ?? new Set<string>();
    ids.add(perp.id);
    perpIdsByPool.set(perp.userId, ids);
  }

  const metricsByPool = new Map<
    string,
    {
      availableBalance: number;
      totalInvested: number;
      unrealizedPnL: number;
      realizedPnL: number;
      positionCount: number;
    }
  >();

  const ensureMetrics = (poolId: string) => {
    const existing = metricsByPool.get(poolId);
    if (existing) return existing;

    const created = {
      availableBalance: balanceByPoolId.get(poolId) ?? 0,
      totalInvested: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      positionCount: 0,
    };
    metricsByPool.set(poolId, created);
    return created;
  };

  for (const position of positionRows) {
    if (
      position.marketType === 'perp' &&
      perpIdsByPool.get(position.poolId)?.has(position.id)
    ) {
      continue;
    }

    const metrics = ensureMetrics(position.poolId);
    const isOpen = position.closedAt === null;

    if (isOpen) {
      metrics.totalInvested +=
        position.marketType === 'perp'
          ? getPositionExposure(position.size, position.leverage)
          : getPositionExposure(position.size);
      metrics.unrealizedPnL += Number(position.unrealizedPnL ?? 0);
      metrics.positionCount += 1;
      continue;
    }

    metrics.realizedPnL += Number(position.realizedPnL ?? 0);
  }

  for (const perp of perpRows) {
    const metrics = ensureMetrics(perp.userId);
    const isOpen = perp.closedAt === null;

    if (isOpen) {
      metrics.totalInvested += getPositionExposure(perp.size, perp.leverage);
      metrics.unrealizedPnL += Number(perp.unrealizedPnL ?? 0);
      metrics.positionCount += 1;
      continue;
    }

    metrics.realizedPnL += Number(perp.realizedPnL ?? 0);
  }

  return new Map(
    activePools.map((pool) => {
      const metrics = ensureMetrics(pool.id);
      const totalValue =
        metrics.availableBalance +
        metrics.totalInvested +
        metrics.unrealizedPnL;
      const utilization =
        totalValue > 0 ? (metrics.totalInvested / totalValue) * 100 : 0;

      return [
        pool.id,
        {
          availableBalance: metrics.availableBalance,
          unrealizedPnL: metrics.unrealizedPnL,
          realizedPnL: metrics.realizedPnL,
          positionCount: metrics.positionCount,
          utilization,
          totalValue,
        },
      ];
    })
  );
}

export const GET = withErrorHandling(async function GET(request: NextRequest) {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  const minValueParam = searchParams.get('minValue');

  const limit = Math.min(
    limitParam ? Number.parseInt(limitParam, 10) : 50,
    100
  );
  const minValue = minValueParam ? Number.parseFloat(minValueParam) : 0;

  const activePools = await db
    .select()
    .from(pools)
    .where(eq(pools.isActive, true));

  const activePoolIds = activePools.map((pool) => pool.id);

  // Fetch fallback data upfront so we can serve metrics even when
  // getPortfolioMetrics() throws (e.g. missing actorState rows).
  // NOTE: buildFallbackMetricsByPool mirrors the calculation logic in
  // NPCInvestmentManager.getPortfolioMetrics — keep them in sync.
  let fallbackMetricsByPool: Map<string, LeaderboardFallbackMetrics> | null =
    null;

  const loadFallbackMetrics = async () => {
    if (fallbackMetricsByPool) return fallbackMetricsByPool;
    if (activePoolIds.length === 0) {
      fallbackMetricsByPool = new Map();
      return fallbackMetricsByPool;
    }

    const [balances, positionRows, perpRows] = await Promise.all([
      db
        .select({
          id: actorState.id,
          tradingBalance: actorState.tradingBalance,
        })
        .from(actorState)
        .where(inArray(actorState.id, activePoolIds)),
      db
        .select({
          id: poolPositions.id,
          poolId: poolPositions.poolId,
          marketType: poolPositions.marketType,
          size: poolPositions.size,
          leverage: poolPositions.leverage,
          unrealizedPnL: poolPositions.unrealizedPnL,
          realizedPnL: poolPositions.realizedPnL,
          closedAt: poolPositions.closedAt,
        })
        .from(poolPositions)
        .where(inArray(poolPositions.poolId, activePoolIds)),
      db
        .select({
          id: perpPositions.id,
          userId: perpPositions.userId,
          size: perpPositions.size,
          leverage: perpPositions.leverage,
          unrealizedPnL: perpPositions.unrealizedPnL,
          realizedPnL: perpPositions.realizedPnL,
          closedAt: perpPositions.closedAt,
        })
        .from(perpPositions)
        .where(inArray(perpPositions.userId, activePoolIds)),
    ]);

    fallbackMetricsByPool = buildFallbackMetricsByPool(
      activePools,
      balances,
      positionRows,
      perpRows
    );
    return fallbackMetricsByPool;
  };

  const leaderboardRows = await Promise.all(
    activePools.map(async (pool) => {
      try {
        const metrics = await NPCInvestmentManager.getPortfolioMetrics(pool.id);
        return { pool, metrics };
      } catch (error) {
        const fallback = (await loadFallbackMetrics()).get(pool.id);
        if (!fallback) {
          logger.warn('Skipping NPC performance row due to metrics failure', {
            poolId: pool.id,
            actorId: pool.npcActorId,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }

        logger.warn('Using batched fallback NPC performance metrics', {
          poolId: pool.id,
          actorId: pool.npcActorId,
          error: error instanceof Error ? error.message : String(error),
        });

        return { pool, metrics: fallback };
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
