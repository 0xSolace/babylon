/**
 * SQL for GET /api/admin/markets (aggregate stats + market list with position counts).
 */

import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { markets } from './tables/markets';
import { positions } from './tables/positions';

type AdminMarketsDb = DrizzleClient | Transaction;

export type AdminMarketsOverviewStatusFilter =
  | 'all'
  | 'active'
  | 'expired'
  | 'resolved';

export type AdminMarketOverviewListRow = {
  id: string;
  question: string;
  description: string | null;
  yesShares: string;
  noShares: string;
  liquidity: string;
  resolved: boolean;
  resolution: boolean | null;
  endDate: Date;
  createdAt: Date;
  onChainMarketId: string | null;
  positionCount: number;
  tradeCount: number;
  totalVolume: number;
};

export type AdminMarketsOverviewStats = {
  total: number;
  active: number;
  expired: number;
  resolved: number;
  totalLiquidity: number;
};

export type AdminMarketsPositionOverviewStats = {
  totalPositions: number;
  activePositions: number;
  totalValue: number;
};

function buildMarketStatusWhere(
  status: AdminMarketsOverviewStatusFilter,
  now: Date
) {
  if (status === 'active') {
    return and(eq(markets.resolved, false), gte(markets.endDate, now));
  }
  if (status === 'expired') {
    return and(eq(markets.resolved, false), lte(markets.endDate, now));
  }
  if (status === 'resolved') {
    return eq(markets.resolved, true);
  }
  return undefined;
}

export async function fetchAdminMarketsOverviewBundle(
  db: AdminMarketsDb,
  params: {
    status: AdminMarketsOverviewStatusFilter;
    limit: number;
    now: Date;
    /** ISO string for timestamp comparison in aggregate FILTER clauses. */
    nowIso: string;
  }
): Promise<{
  marketStats: AdminMarketsOverviewStats | undefined;
  positionStats: AdminMarketsPositionOverviewStats | undefined;
  marketsList: AdminMarketOverviewListRow[];
}> {
  const { status, limit, now, nowIso } = params;
  const statusFilter = buildMarketStatusWhere(status, now);

  const [ms] = await db
    .select({
      total: count(),
      active: sql<number>`COUNT(*) FILTER (WHERE ${markets.resolved} = false AND ${markets.endDate} > ${nowIso}::timestamp)`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${markets.resolved} = false AND ${markets.endDate} <= ${nowIso}::timestamp)`,
      resolved: sql<number>`COUNT(*) FILTER (WHERE ${markets.resolved} = true)`,
      totalLiquidity: sql<number>`COALESCE(SUM(${markets.liquidity}::numeric), 0)`,
    })
    .from(markets);

  const [ps] = await db
    .select({
      totalPositions: count(),
      activePositions: sql<number>`COUNT(*) FILTER (WHERE ${positions.status} = 'active')`,
      totalValue: sql<number>`COALESCE(SUM(${positions.amount}::numeric), 0)`,
    })
    .from(positions);

  const listRaw = await db
    .select({
      id: markets.id,
      question: markets.question,
      description: markets.description,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
      liquidity: markets.liquidity,
      resolved: markets.resolved,
      resolution: markets.resolution,
      endDate: markets.endDate,
      createdAt: markets.createdAt,
      onChainMarketId: markets.onChainMarketId,
      positionCount: sql<number>`(
        SELECT COUNT(*) FROM "Position"
        WHERE "Position"."marketId" = ${markets.id}
      )`,
      tradeCount: sql<number>`0`,
      totalVolume: sql<number>`0`,
    })
    .from(markets)
    .where(statusFilter)
    .orderBy(desc(markets.createdAt))
    .limit(limit);

  const marketsList: AdminMarketOverviewListRow[] = listRaw.map((row) => ({
    ...row,
    positionCount: Number(row.positionCount),
    tradeCount: Number(row.tradeCount),
    totalVolume: Number(row.totalVolume),
  }));

  const marketStats: AdminMarketsOverviewStats | undefined = ms
    ? {
        total: ms.total,
        active: Number(ms.active),
        expired: Number(ms.expired),
        resolved: Number(ms.resolved),
        totalLiquidity: Number(ms.totalLiquidity),
      }
    : undefined;

  const positionStats: AdminMarketsPositionOverviewStats | undefined = ps
    ? {
        totalPositions: ps.totalPositions,
        activePositions: Number(ps.activePositions),
        totalValue: Number(ps.totalValue),
      }
    : undefined;

  return {
    marketStats,
    positionStats,
    marketsList,
  };
}
