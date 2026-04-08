/**
 * Timeframed sub-market reads/writes for `SubMarketService`.
 *
 * **Why here:** Keeps sub-market / spawn-log / org lookup SQL under `asSystem`.
 */

import { and, eq, gte, lte, or, type SQL, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';

type SubMarketDbExecutor = DrizzleClient | Transaction;

import type { ArcStateType, MarketTimeframe } from './tables/narrative-types';
import { organizations } from './tables/organizations';
import {
  type NewSubMarketSpawnLog,
  subMarketSpawnLogs,
} from './tables/sub-market-spawn-logs';
import {
  type NewTimeframedMarket,
  type TimeframedMarket,
  timeframedMarkets,
} from './tables/timeframed-markets';

export async function fetchSubMarketTrySpawnContext(params: {
  parentMarketId: string;
  spawnCutoff: Date;
}): Promise<{ parent: TimeframedMarket | null; recentSpawns: number }> {
  return asSystem(async (c) => {
    const [p] = await c
      .select()
      .from(timeframedMarkets)
      .where(eq(timeframedMarkets.id, params.parentMarketId))
      .limit(1);

    if (!p) {
      return { parent: null, recentSpawns: 0 };
    }

    const [spawnCount] = await c
      .select({ count: sql<number>`count(*)::int` })
      .from(subMarketSpawnLogs)
      .where(
        and(
          eq(subMarketSpawnLogs.parentMarketId, params.parentMarketId),
          gte(subMarketSpawnLogs.createdAt, params.spawnCutoff)
        )
      );

    return {
      parent: p,
      recentSpawns: spawnCount?.count ?? 0,
    };
  }, 'sub-market-try-spawn-read');
}

export async function listChildTimeframedMarketsByParentId(
  parentMarketId: string
): Promise<TimeframedMarket[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(timeframedMarkets)
        .where(eq(timeframedMarkets.parentMarketId, parentMarketId)),
    'sub-market-child-markets'
  );
}

export async function listTimeframedMarketsByRootMarketId(
  rootMarketId: string
): Promise<TimeframedMarket[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(timeframedMarkets)
        .where(eq(timeframedMarkets.rootMarketId, rootMarketId)),
    'sub-market-hierarchy'
  );
}

export async function listActiveTimeframedMarketsByTimeframe(
  timeframe: MarketTimeframe
): Promise<TimeframedMarket[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(timeframedMarkets)
        .where(
          and(
            eq(timeframedMarkets.timeframe, timeframe),
            eq(timeframedMarkets.isActive, true)
          )
        ),
    'sub-market-active-by-timeframe'
  );
}

export type SubMarketParentRootSlice = {
  id: string;
  rootMarketId: string | null;
};

export async function fetchTimeframedMarketParentRootSlice(
  parentMarketId: string
): Promise<SubMarketParentRootSlice | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        rootMarketId: timeframedMarkets.rootMarketId,
        id: timeframedMarkets.id,
      })
      .from(timeframedMarkets)
      .where(eq(timeframedMarkets.id, parentMarketId))
      .limit(1);
    return row ?? null;
  }, 'sub-market-create-parent-lookup');
}

export async function updateSubMarketTimeframedArcState(params: {
  marketId: string;
  newState: ArcStateType;
  now: Date;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(timeframedMarkets)
        .set({
          arcState: params.newState,
          arcStateEnteredAt: params.now,
          updatedAt: params.now,
        })
        .where(eq(timeframedMarkets.id, params.marketId)),
    'sub-market-update-arc-state'
  );
}

export async function resolveSubMarketTimeframedMarket(params: {
  marketId: string;
  now: Date;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(timeframedMarkets)
        .set({
          isActive: false,
          isResolved: true,
          resolvedAt: params.now,
          arcState: 'resolution',
          updatedAt: params.now,
        })
        .where(eq(timeframedMarkets.id, params.marketId)),
    'sub-market-resolve'
  );
}

export async function listSubMarketTimeframedMarketsNeedingResolution(
  now: Date
): Promise<TimeframedMarket[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(timeframedMarkets)
        .where(
          and(
            eq(timeframedMarkets.isActive, true),
            lte(timeframedMarkets.endTime, now),
            eq(timeframedMarkets.isResolved, false)
          )
        ),
    'sub-market-needing-resolution'
  );
}

export async function insertSubMarketTimeframedMarketInTx(
  tx: SubMarketDbExecutor,
  marketData: NewTimeframedMarket
): Promise<TimeframedMarket> {
  const [created] = await tx
    .insert(timeframedMarkets)
    .values(marketData)
    .returning();

  if (!created) {
    throw new Error(`Failed to create timeframed market ${marketData.id}`);
  }

  return created;
}

export async function insertSubMarketTimeframedMarketRow(
  marketData: NewTimeframedMarket
): Promise<TimeframedMarket> {
  return asSystem(
    async (c) => insertSubMarketTimeframedMarketInTx(c, marketData),
    'sub-market-persist'
  );
}

export async function incrementSubMarketParentChildCountInTx(
  tx: SubMarketDbExecutor,
  parentMarketId: string,
  now: Date
): Promise<void> {
  await tx
    .update(timeframedMarkets)
    .set({
      childMarketCount: sql`${timeframedMarkets.childMarketCount} + 1`,
      updatedAt: now,
    })
    .where(eq(timeframedMarkets.id, parentMarketId));
}

export async function incrementSubMarketParentChildCount(params: {
  parentMarketId: string;
  now: Date;
}): Promise<void> {
  await asSystem(
    async (c) =>
      incrementSubMarketParentChildCountInTx(
        c,
        params.parentMarketId,
        params.now
      ),
    'sub-market-incr-parent'
  );
}

export async function listOrganizationIdsDistinctByNameOrTicker(params: {
  orgName?: string;
  ticker?: string;
}): Promise<{ id: string }[]> {
  const conditions: SQL<unknown>[] = [];
  if (params.orgName) {
    conditions.push(eq(organizations.name, params.orgName));
  }
  if (params.ticker) {
    conditions.push(eq(organizations.ticker, params.ticker));
  }
  if (conditions.length === 0) {
    return [];
  }

  return asSystem(
    async (c) =>
      c
        .selectDistinct({ id: organizations.id })
        .from(organizations)
        .where(or(...conditions)),
    'sub-market-generate-question-orgs'
  );
}

export async function insertSubMarketSpawnLogRow(
  log: NewSubMarketSpawnLog,
  traceLabel: 'sub-market-log-skipped' | 'sub-market-log-success'
): Promise<void> {
  await asSystem(
    async (c) => c.insert(subMarketSpawnLogs).values(log),
    traceLabel
  );
}
