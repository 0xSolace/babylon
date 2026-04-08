/**
 * Drizzle for `@babylon/core` `PerpDbAdapter`.
 *
 * **Why here:** Keeps `drizzle-orm` usage in `packages/db` while core keeps port + mapping.
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NewPerpPosition, PerpPosition } from './model-types';
import type {
  FundingRate,
  PerpMarketSnapshot,
} from './tables/perp-market-snapshots';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { perpPositions } from './tables/perp-positions';

type CorePerpDbExecutor = DrizzleClient | Transaction;

export async function corePerpSelectAllMarketSnapshots(
  client: CorePerpDbExecutor
): Promise<PerpMarketSnapshot[]> {
  return client.select().from(perpMarketSnapshots);
}

export async function corePerpSelectOpenPositions(
  client: CorePerpDbExecutor
): Promise<PerpPosition[]> {
  return client
    .select()
    .from(perpPositions)
    .where(isNull(perpPositions.closedAt));
}

export async function corePerpSelectPositionById(
  client: CorePerpDbExecutor,
  id: string
): Promise<PerpPosition | undefined> {
  const [row] = await client
    .select()
    .from(perpPositions)
    .where(eq(perpPositions.id, id))
    .limit(1);
  return row;
}

export async function corePerpSelectOpenPositionsByUserId(
  client: CorePerpDbExecutor,
  userId: string
): Promise<PerpPosition[]> {
  return client
    .select()
    .from(perpPositions)
    .where(
      and(eq(perpPositions.userId, userId), isNull(perpPositions.closedAt))
    );
}

export async function corePerpSelectOpenPositionByUserAndTicker(
  client: CorePerpDbExecutor,
  userId: string,
  ticker: string
): Promise<PerpPosition | undefined> {
  const [row] = await client
    .select()
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.userId, userId),
        eq(perpPositions.ticker, ticker),
        isNull(perpPositions.closedAt)
      )
    )
    .limit(1);
  return row;
}

export async function corePerpUpsertPositionReturning(
  client: CorePerpDbExecutor,
  insert: NewPerpPosition
): Promise<PerpPosition> {
  const [row] = await client
    .insert(perpPositions)
    .values(insert)
    .onConflictDoUpdate({
      target: perpPositions.id,
      set: { ...insert, openedAt: insert.openedAt },
    })
    .returning();
  if (!row) {
    throw new Error('corePerpUpsertPositionReturning: empty returning');
  }
  return row;
}

export type CorePerpOpenPositionFieldPatch = Partial<{
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  fundingPaid: number;
  liquidationPrice: number;
  size: number;
  entryPrice: number;
  lastUpdated: Date;
}>;

export async function corePerpUpdateOpenPositionFields(
  client: CorePerpDbExecutor,
  positionId: string,
  updates: CorePerpOpenPositionFieldPatch
): Promise<void> {
  const setFields: Record<string, unknown> = {
    lastUpdated: updates.lastUpdated ?? new Date(),
  };
  if (updates.currentPrice !== undefined) {
    setFields.currentPrice = updates.currentPrice;
  }
  if (updates.unrealizedPnL !== undefined) {
    setFields.unrealizedPnL = updates.unrealizedPnL;
  }
  if (updates.unrealizedPnLPercent !== undefined) {
    setFields.unrealizedPnLPercent = updates.unrealizedPnLPercent;
  }
  if (updates.fundingPaid !== undefined) {
    setFields.fundingPaid = updates.fundingPaid;
  }
  if (updates.liquidationPrice !== undefined) {
    setFields.liquidationPrice = updates.liquidationPrice;
  }
  if (updates.size !== undefined) {
    setFields.size = updates.size;
  }
  if (updates.entryPrice !== undefined) {
    setFields.entryPrice = updates.entryPrice;
  }

  await client
    .update(perpPositions)
    .set(setFields as Partial<typeof perpPositions.$inferInsert>)
    .where(
      and(eq(perpPositions.id, positionId), isNull(perpPositions.closedAt))
    );
}

export type CorePerpClosePositionFieldPatch = Partial<{
  currentPrice: number;
  closedAt: Date | null;
  realizedPnL: number | null;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  lastUpdated: Date;
}>;

export async function corePerpClosePositionFields(
  client: CorePerpDbExecutor,
  positionId: string,
  updates: CorePerpClosePositionFieldPatch
): Promise<void> {
  const closedAt = updates.closedAt ?? new Date();
  const setFields: Record<string, unknown> = {
    closedAt,
    lastUpdated: closedAt,
    unrealizedPnL: updates.unrealizedPnL ?? 0,
    unrealizedPnLPercent: updates.unrealizedPnLPercent ?? 0,
  };
  if (updates.currentPrice !== undefined) {
    setFields.currentPrice = updates.currentPrice;
  }
  if (updates.realizedPnL !== undefined) {
    setFields.realizedPnL = updates.realizedPnL;
  }

  await client
    .update(perpPositions)
    .set(setFields as Partial<typeof perpPositions.$inferInsert>)
    .where(eq(perpPositions.id, positionId));
}

export async function corePerpSelectMarketSnapshotByTicker(
  client: CorePerpDbExecutor,
  ticker: string
): Promise<PerpMarketSnapshot | undefined> {
  const [row] = await client
    .select()
    .from(perpMarketSnapshots)
    .where(eq(perpMarketSnapshots.ticker, ticker))
    .limit(1);
  return row;
}

export type CorePerpMarketSnapshotFullUpdate = {
  currentPrice: number;
  price24hAgo: number | null;
  price24hAgoUpdatedAt: Date | null;
  metrics24hResetAt: Date | null;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: FundingRate;
  maxLeverage: number;
  minOrderSize: number;
  markPrice: number | null;
  indexPrice: number | null;
  updatedAt: Date;
};

export async function corePerpUpdateMarketSnapshotFull(
  client: CorePerpDbExecutor,
  ticker: string,
  values: CorePerpMarketSnapshotFullUpdate
): Promise<void> {
  await client
    .update(perpMarketSnapshots)
    .set(values)
    .where(eq(perpMarketSnapshots.ticker, ticker));
}
