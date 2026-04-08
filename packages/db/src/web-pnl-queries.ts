/**
 * SQL for `apps/web` wallet P&L history and snapshots.
 */

import { and, asc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { users } from './tables/user';
import {
  type NewUserPnLSnapshot,
  userPnLSnapshots,
} from './tables/user-pnl-snapshots';

type PnlWebDb = DrizzleClient | Transaction;

/** Agent user ids owned by `ownerUserId` (for scoped P&L public API). */
export async function selectManagedAgentUserIdsByOwner(
  db: PnlWebDb,
  ownerUserId: string
): Promise<{ id: string }[]> {
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.managedBy, ownerUserId), eq(users.isAgent, true)));
}

export async function selectUsersForPnlMetricsLoad(
  db: PnlWebDb,
  targetUserIds?: string[]
): Promise<{ id: string; lifetimePnL: unknown; privyId: string | null }[]> {
  const userFilter =
    targetUserIds && targetUserIds.length > 0
      ? and(
          eq(users.isActor, false),
          or(
            inArray(users.id, targetUserIds),
            inArray(users.privyId, targetUserIds)
          )
        )
      : eq(users.isActor, false);

  return db
    .select({
      id: users.id,
      lifetimePnL: users.lifetimePnL,
      privyId: users.privyId,
    })
    .from(users)
    .where(userFilter);
}

export async function selectPerpUnrealizedPnLSumByUserIdsOpenOnly(
  db: PnlWebDb,
  userIdBatch: string[]
): Promise<{ userId: string; unrealizedPnL: number }[]> {
  if (userIdBatch.length === 0) return [];
  return db
    .select({
      userId: perpPositions.userId,
      unrealizedPnL: sql<number>`COALESCE(SUM(${perpPositions.unrealizedPnL}), 0)`,
    })
    .from(perpPositions)
    .where(
      and(
        inArray(perpPositions.userId, userIdBatch),
        isNull(perpPositions.closedAt)
      )
    )
    .groupBy(perpPositions.userId);
}

export type ActivePredictionPositionMarketRow = {
  userId: string;
  shares: string;
  avgPrice: string;
  side: boolean | null;
  yesShares: string;
  noShares: string;
};

export async function selectActivePredictionPositionsWithMarketForUserIds(
  db: PnlWebDb,
  userIdBatch: string[]
): Promise<ActivePredictionPositionMarketRow[]> {
  if (userIdBatch.length === 0) return [];
  return db
    .select({
      userId: positions.userId,
      shares: positions.shares,
      avgPrice: positions.avgPrice,
      side: positions.side,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(positions)
    .innerJoin(markets, eq(positions.marketId, markets.id))
    .where(
      and(
        inArray(positions.userId, userIdBatch),
        eq(positions.status, 'active'),
        eq(markets.resolved, false)
      )
    );
}

export async function selectUserPnLSnapshotsForScopedChart(
  db: PnlWebDb,
  scopeUserIds: string[],
  cutoff?: Date
): Promise<{ userId: string; snapshotAt: Date; currentPnL: number }[]> {
  if (scopeUserIds.length === 0) return [];
  return db
    .select({
      userId: userPnLSnapshots.userId,
      snapshotAt: userPnLSnapshots.snapshotAt,
      currentPnL: userPnLSnapshots.currentPnL,
    })
    .from(userPnLSnapshots)
    .where(
      cutoff
        ? and(
            inArray(userPnLSnapshots.userId, scopeUserIds),
            gte(userPnLSnapshots.snapshotAt, cutoff)
          )
        : inArray(userPnLSnapshots.userId, scopeUserIds)
    )
    .orderBy(asc(userPnLSnapshots.snapshotAt));
}

export async function selectNonActorUserIdsWithNonZeroLifetimePnL(
  db: PnlWebDb
): Promise<{ userId: string }[]> {
  return db
    .select({ userId: users.id })
    .from(users)
    .where(and(eq(users.isActor, false), sql`${users.lifetimePnL} <> 0`));
}

export async function selectDistinctOpenPerpPositionUserIds(
  db: PnlWebDb
): Promise<{ userId: string }[]> {
  return db
    .selectDistinct({ userId: perpPositions.userId })
    .from(perpPositions)
    .where(isNull(perpPositions.closedAt));
}

export async function selectDistinctActivePredictionPositionUserIds(
  db: PnlWebDb
): Promise<{ userId: string }[]> {
  return db
    .selectDistinct({ userId: positions.userId })
    .from(positions)
    .innerJoin(markets, eq(positions.marketId, markets.id))
    .where(and(eq(positions.status, 'active'), eq(markets.resolved, false)));
}

export async function insertUserPnLSnapshotsBatchOnConflictDoNothing(
  db: PnlWebDb,
  batch: NewUserPnLSnapshot[]
): Promise<{ id: string }[]> {
  if (batch.length === 0) return [];
  return db
    .insert(userPnLSnapshots)
    .values(batch)
    .onConflictDoNothing({
      target: [userPnLSnapshots.userId, userPnLSnapshots.snapshotAt],
    })
    .returning({ id: userPnLSnapshots.id });
}
