/**
 * SQL for GET /api/feed/widgets/stats (platform aggregates for the stats widget).
 */

import { count, eq, sum } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { actorState } from './tables/actor-state';
import { posts } from './tables/posts';
import { users } from './tables/user';

type FeedWidgetStatsDb = DrizzleClient | Transaction;

export type FeedWidgetPlatformStatsAggregates = {
  activePlayers: number;
  totalHoots: number;
  userPoints: string;
  actorPoints: string;
};

export async function selectFeedWidgetPlatformStatsAggregates(
  db: FeedWidgetStatsDb
): Promise<FeedWidgetPlatformStatsAggregates> {
  const [
    activePlayersResult,
    totalHootsResult,
    userPointsResult,
    actorPointsResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.isActor, false)),
    db.select({ count: count() }).from(posts),
    db
      .select({ total: sum(users.virtualBalance) })
      .from(users)
      .where(eq(users.isActor, false)),
    db.select({ total: sum(actorState.tradingBalance) }).from(actorState),
  ]);

  return {
    activePlayers: Number(activePlayersResult[0]?.count ?? 0),
    totalHoots: Number(totalHootsResult[0]?.count ?? 0),
    userPoints: userPointsResult[0]?.total ?? '0',
    actorPoints: actorPointsResult[0]?.total ?? '0',
  };
}
