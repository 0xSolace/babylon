/**
 * Reads/writes for `GameBootstrapService` (tick bootstrap / full sync).
 *
 * **Why here:** Keeps bootstrap SQL under `asSystem`. Capital tiers, static
 * registry lookups, and log messages stay in `packages/engine`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { actorState } from './tables/actor-state';
import { games } from './tables/games';
import { organizationState } from './tables/organization-state';
import type { FundingRate } from './tables/perp-market-snapshots';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { pools } from './tables/pools';
import { rssFeedSources } from './tables/rss-feed-sources';
import { users } from './tables/user';

export async function fetchGameBootstrapExistingStateIds(): Promise<{
  actorIds: { id: string }[];
  orgIds: { id: string }[];
}> {
  return asSystem(async (c) => {
    const [actorIds, orgIds] = await Promise.all([
      c.select({ id: actorState.id }).from(actorState),
      c.select({ id: organizationState.id }).from(organizationState),
    ]);
    return { actorIds, orgIds };
  }, 'game-bootstrap-existing-state');
}

export async function insertGameBootstrapActorStateRow(params: {
  id: string;
  tradingBalance: string;
  reputationPoints: number;
}): Promise<void> {
  const { id, tradingBalance, reputationPoints } = params;
  await asSystem(
    async (c) =>
      c.insert(actorState).values({
        id,
        tradingBalance,
        reputationPoints,
        hasPool: false,
        updatedAt: new Date(),
      }),
    'game-bootstrap-seed-actor'
  );
}

export async function runGameBootstrapSyncActorTransaction(params: {
  actorId: string;
  insertIfMissing: { tradingBalance: string; reputationPoints: number };
  minimumBalanceWhenExists: number;
}): Promise<{ created: boolean; updated: boolean }> {
  const { actorId, insertIfMissing, minimumBalanceWhenExists } = params;

  return asSystem(async (c) => {
    const existing = await c
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1);

    if (existing.length === 0) {
      await c.insert(actorState).values({
        id: actorId,
        tradingBalance: insertIfMissing.tradingBalance,
        reputationPoints: insertIfMissing.reputationPoints,
        hasPool: false,
        updatedAt: new Date(),
      });
      return { created: true, updated: false };
    }

    const existingState = existing[0];
    if (!existingState) return { created: false, updated: false };

    const currentBalance = Number(existingState.tradingBalance) || 0;

    if (currentBalance < minimumBalanceWhenExists) {
      await c
        .update(actorState)
        .set({
          tradingBalance: minimumBalanceWhenExists.toString(),
          updatedAt: new Date(),
        })
        .where(eq(actorState.id, actorId));
    }

    return { created: false, updated: true };
  }, 'game-bootstrap-sync-actor');
}

export async function insertGameBootstrapOrganizationStateRow(params: {
  id: string;
  currentPrice: number | null;
  basePrice: number;
}): Promise<void> {
  const { id, currentPrice, basePrice } = params;
  await asSystem(
    async (c) =>
      c.insert(organizationState).values({
        id,
        currentPrice,
        basePrice,
        updatedAt: new Date(),
      }),
    'game-bootstrap-seed-org'
  );
}

export async function runGameBootstrapSyncOrganizationTransaction(params: {
  orgId: string;
  insertIfMissing: { currentPrice: number | null; basePrice: number };
}): Promise<{ created: boolean; updated: boolean }> {
  const { orgId, insertIfMissing } = params;

  return asSystem(async (c) => {
    const existing = await c
      .select({
        id: organizationState.id,
        currentPrice: organizationState.currentPrice,
      })
      .from(organizationState)
      .where(eq(organizationState.id, orgId))
      .limit(1);

    if (existing.length === 0) {
      await c.insert(organizationState).values({
        id: orgId,
        currentPrice: insertIfMissing.currentPrice,
        basePrice: insertIfMissing.basePrice,
        updatedAt: new Date(),
      });
      return { created: true, updated: false };
    }

    const existingState = existing[0];
    if (!existingState) return { created: false, updated: false };

    return { created: false, updated: false };
  }, 'game-bootstrap-sync-org');
}

export type GameBootstrapTopUpEvent = {
  actorId: string;
  previousBalance: number;
  newBalance: number;
  topUpAmount: number;
};

export async function runGameBootstrapEnsureMinimumBalancesTransaction(params: {
  resolveMinimumBalance: (actorId: string) => number;
  maxTopUpAmount: number;
}): Promise<{
  count: number;
  totalAmount: number;
  events: GameBootstrapTopUpEvent[];
}> {
  const { resolveMinimumBalance, maxTopUpAmount } = params;

  return asSystem(async (c) => {
    const allActorStates = await c
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState);

    let toppedUpCount = 0;
    let totalTopUp = 0;
    const events: GameBootstrapTopUpEvent[] = [];

    for (const state of allActorStates) {
      const currentBalance = Number(state.tradingBalance) || 0;
      const minimumBalance = resolveMinimumBalance(state.id);

      if (currentBalance < minimumBalance) {
        const deficit = minimumBalance - currentBalance;
        const topUpAmount = Math.min(deficit, maxTopUpAmount);
        const newBalance = currentBalance + topUpAmount;

        await c
          .update(actorState)
          .set({
            tradingBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, state.id));

        toppedUpCount++;
        totalTopUp += topUpAmount;
        events.push({
          actorId: state.id,
          previousBalance: currentBalance,
          newBalance,
          topUpAmount,
        });
      }
    }

    return { count: toppedUpCount, totalAmount: totalTopUp, events };
  }, 'game-bootstrap-min-balances');
}

export async function runGameBootstrapEnsureActorPoolsTransaction(params: {
  resolvePoolDisplayName: (actorId: string) => string;
}): Promise<number> {
  const { resolvePoolDisplayName } = params;

  return asSystem(async (c) => {
    const actorStatesWithoutPools = await c
      .select({
        id: actorState.id,
        tradingBalance: actorState.tradingBalance,
      })
      .from(actorState)
      .where(eq(actorState.hasPool, false));

    let created = 0;

    for (const state of actorStatesWithoutPools) {
      const poolId = state.id;
      const balance = Number(state.tradingBalance) || 10000;
      const poolName = resolvePoolDisplayName(state.id);

      const existingPool = await c
        .select({ id: pools.id })
        .from(pools)
        .where(eq(pools.id, poolId))
        .limit(1);

      if (existingPool.length === 0) {
        await c.insert(pools).values({
          id: poolId,
          name: `${poolName}'s Pool`,
          npcActorId: state.id,
          totalValue: balance.toString(),
          totalDeposits: balance.toString(),
          availableBalance: balance.toString(),
          lifetimePnL: '0',
          performanceFeeRate: 0.05,
          totalFeesCollected: '0',
          isActive: true,
          status: 'ACTIVE',
          updatedAt: new Date(),
        });

        await c
          .update(actorState)
          .set({ hasPool: true, updatedAt: new Date() })
          .where(eq(actorState.id, state.id));

        created++;
      }
    }

    return created;
  }, 'game-bootstrap-actor-pools');
}

export async function ensureGameBootstrapNpcUserRows(
  staticActors: Array<{ id: string; name: string }>
): Promise<number> {
  if (staticActors.length === 0) {
    return 0;
  }

  const actorIds = staticActors.map((a) => a.id);

  return asSystem(async (c) => {
    const existingUsers = await c
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, actorIds));

    const existingUserIds = new Set(existingUsers.map((u) => u.id));
    let n = 0;
    const now = new Date();

    for (const actor of staticActors) {
      if (existingUserIds.has(actor.id)) {
        continue;
      }

      await c.insert(users).values({
        id: actor.id,
        displayName: actor.name,
        username: actor.id,
        isActor: true,
        virtualBalance: '10000',
        totalDeposited: '10000',
        totalWithdrawn: '0',
        lifetimePnL: '0',
        createdAt: now,
        updatedAt: now,
      });

      n++;
    }

    return n;
  }, 'game-bootstrap-npc-users');
}

export type EnsureGameBootstrapGameOutcome =
  | { changed: true; reason: 'inserted' | 'resumed' }
  | { changed: false; reason: 'unchanged' };

export async function ensureGameBootstrapContinuousGameRow(): Promise<EnsureGameBootstrapGameOutcome> {
  return asSystem(async (c) => {
    const existingGame = await c
      .select()
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);

    if (existingGame.length === 0) {
      const now = new Date();
      const gameId = await generateSnowflakeId();

      await c.insert(games).values({
        id: gameId,
        isContinuous: true,
        isRunning: true,
        currentDate: now,
        currentDay: 1,
        speed: 60000,
        startedAt: now,
        updatedAt: now,
      });

      return { changed: true, reason: 'inserted' };
    }

    const game = existingGame[0];
    if (game && !game.isRunning) {
      await c
        .update(games)
        .set({
          isRunning: true,
          startedAt: game.startedAt || new Date(),
          pausedAt: null,
        })
        .where(eq(games.id, game.id));
      return { changed: true, reason: 'resumed' };
    }

    return { changed: false, reason: 'unchanged' };
  }, 'game-bootstrap-game-state');
}

export async function seedGameBootstrapRssFeedRows(
  feeds: Array<{ name: string; feedUrl: string; category: string }>
): Promise<number> {
  return asSystem(async (c) => {
    let created = 0;

    for (const feed of feeds) {
      const existing = await c
        .select({ id: rssFeedSources.id })
        .from(rssFeedSources)
        .where(eq(rssFeedSources.feedUrl, feed.feedUrl))
        .limit(1);

      if (existing.length === 0) {
        await c.insert(rssFeedSources).values({
          id: await generateSnowflakeId(),
          name: feed.name,
          feedUrl: feed.feedUrl,
          category: feed.category,
          updatedAt: new Date(),
        });
        created++;
      }
    }

    return created;
  }, 'game-bootstrap-rss-feeds');
}

export async function ensureGameBootstrapPerpMarketSnapshots(params: {
  tradeableOrgs: Array<{
    id: string;
    ticker: string;
    name: string;
    initialPrice: number | null;
  }>;
  fundingIntervalMs: number;
}): Promise<number> {
  const { tradeableOrgs, fundingIntervalMs } = params;

  return asSystem(async (c) => {
    let n = 0;

    const existingSnapshots = await c
      .select({ ticker: perpMarketSnapshots.ticker })
      .from(perpMarketSnapshots);
    const existingTickers = new Set(existingSnapshots.map((s) => s.ticker));

    const orgStates = await c.select().from(organizationState);
    const priceMap = new Map<string, number | null>(
      orgStates.map((s) => [s.id, s.currentPrice])
    );

    const now = new Date();
    const nextFundingTime = new Date(
      now.getTime() + fundingIntervalMs
    ).toISOString();

    for (const org of tradeableOrgs) {
      if (!org.ticker || existingTickers.has(org.ticker)) {
        continue;
      }

      const currentPrice = priceMap.get(org.id) ?? org.initialPrice ?? 100;

      const fundingRate: FundingRate = {
        ticker: org.ticker,
        rate: 0.01,
        nextFundingTime,
        predictedRate: 0.01,
      };

      await c.insert(perpMarketSnapshots).values({
        ticker: org.ticker,
        organizationId: org.id,
        name: org.name,
        currentPrice,
        price24hAgo: currentPrice,
        price24hAgoUpdatedAt: now,
        metrics24hResetAt: now,
        change24h: 0,
        changePercent24h: 0,
        high24h: currentPrice,
        low24h: currentPrice,
        volume24h: 0,
        openInterest: 0,
        fundingRate,
        maxLeverage: 100,
        minOrderSize: 10,
        markPrice: currentPrice,
        indexPrice: currentPrice,
        createdAt: now,
        updatedAt: now,
      });

      n++;
      existingTickers.add(org.ticker);
    }

    return n;
  }, 'game-bootstrap-perp-snapshots');
}

export async function fetchGameBootstrapStatsCounts(): Promise<{
  actors: number;
  organizations: number;
  pools: number;
  rssFeedSources: number;
  perpMarkets: number;
}> {
  const [actorCount, orgCount, poolCount, feedCount, perpMarketCount] =
    await asSystem(
      async (c) =>
        Promise.all([
          c.select({ count: sql<number>`count(*)` }).from(actorState),
          c.select({ count: sql<number>`count(*)` }).from(organizationState),
          c.select({ count: sql<number>`count(*)` }).from(pools),
          c.select({ count: sql<number>`count(*)` }).from(rssFeedSources),
          c.select({ count: sql<number>`count(*)` }).from(perpMarketSnapshots),
        ]),
      'game-bootstrap-stats'
    );

  return {
    actors: Number(actorCount[0]?.count ?? 0),
    organizations: Number(orgCount[0]?.count ?? 0),
    pools: Number(poolCount[0]?.count ?? 0),
    rssFeedSources: Number(feedCount[0]?.count ?? 0),
    perpMarkets: Number(perpMarketCount[0]?.count ?? 0),
  };
}
