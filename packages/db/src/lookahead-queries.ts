/**
 * Reads for `lookahead-generation-service` (content buffer / pacing).
 *
 * **Why here:** Keeps post/question/game/actor-state aggregates under `asSystem`.
 */

import { and, count, desc, eq, gte, isNull, lt, max } from 'drizzle-orm';
import { asSystem } from './db';
import { actorState } from './tables/actor-state';
import { games } from './tables/games';
import { posts } from './tables/posts';
import { questions } from './tables/questions';

export async function fetchLatestPostTimestampForLookahead(): Promise<Date | null> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({ timestamp: posts.timestamp })
        .from(posts)
        .orderBy(desc(posts.timestamp))
        .limit(1),
    'lookahead-latest-post'
  );
  return rows[0]?.timestamp ?? null;
}

export async function countPostsInLookaheadTimeWindow(params: {
  windowStart: Date;
  windowEnd: Date;
}): Promise<number> {
  const [result] = await asSystem(
    async (c) =>
      c
        .select({ count: count() })
        .from(posts)
        .where(
          and(
            gte(posts.timestamp, params.windowStart),
            lt(posts.timestamp, params.windowEnd),
            isNull(posts.deletedAt)
          )
        ),
    'lookahead-window-post-count'
  );
  return result?.count ?? 0;
}

export async function fetchContinuousGameStartedAt(): Promise<Date | null> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({ startedAt: games.startedAt })
        .from(games)
        .where(eq(games.isContinuous, true))
        .limit(1),
    'lookahead-continuous-game'
  );
  return rows[0]?.startedAt ?? null;
}

export async function listActiveQuestionsForLookahead() {
  return asSystem(
    async (c) =>
      c.select().from(questions).where(eq(questions.status, 'active')),
    'lookahead-active-questions'
  );
}

export async function listTopActorStatesByReputationForLookahead(params: {
  limit: number;
}) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorState)
        .orderBy(desc(actorState.reputationPoints))
        .limit(params.limit),
    'lookahead-top-actor-states'
  );
}

export type LookaheadActorPostStatRow = {
  authorId: string;
  lastPostTime: Date | null;
  dailyCount: number;
};

export async function aggregateActorPostStatsForLookahead(params: {
  dayStartInclusive: Date;
  windowStartExclusive: Date;
}): Promise<LookaheadActorPostStatRow[]> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({
          authorId: posts.authorId,
          lastPostTime: max(posts.timestamp),
          dailyCount: count(),
        })
        .from(posts)
        .where(
          and(
            gte(posts.timestamp, params.dayStartInclusive),
            lt(posts.timestamp, params.windowStartExclusive),
            isNull(posts.deletedAt)
          )
        )
        .groupBy(posts.authorId),
    'lookahead-actor-post-stats'
  );
  return rows.map((r) => ({
    authorId: r.authorId,
    lastPostTime: r.lastPostTime,
    dailyCount: Number(r.dailyCount),
  }));
}
