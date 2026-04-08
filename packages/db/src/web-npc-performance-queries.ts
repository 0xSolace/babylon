/**
 * SQL for `apps/web` GET /api/npc/performance/leaderboard (pools + fallback metrics batch).
 */

import { eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { actorState } from './tables/actor-state';
import { perpPositions } from './tables/perp-positions';
import { poolPositions } from './tables/pool-positions';
import type { Pool } from './tables/pools';
import { pools } from './tables/pools';

type NpcPerfDb = DrizzleClient | Transaction;

export async function selectActivePools(db: NpcPerfDb): Promise<Pool[]> {
  return db.select().from(pools).where(eq(pools.isActive, true));
}

export async function selectActorStateTradingBalanceRowsByIds(
  db: NpcPerfDb,
  ids: string[]
): Promise<{ id: string; tradingBalance: string | null }[]> {
  if (ids.length === 0) return [];
  return db
    .select({
      id: actorState.id,
      tradingBalance: actorState.tradingBalance,
    })
    .from(actorState)
    .where(inArray(actorState.id, ids));
}

export async function selectPoolPositionFallbackRowsForPoolIds(
  db: NpcPerfDb,
  poolIds: string[]
) {
  if (poolIds.length === 0) return [];
  return db
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
    .where(inArray(poolPositions.poolId, poolIds));
}

export async function selectPerpPositionFallbackRowsForUserIds(
  db: NpcPerfDb,
  userIds: string[]
) {
  if (userIds.length === 0) return [];
  return db
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
    .where(inArray(perpPositions.userId, userIds));
}
