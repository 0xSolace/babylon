/**
 * Reads for `prompts/random-context.ts` (entropy samples for LLM prompts).
 *
 * **Why here:** Keeps `Market` / `Post` / `WorldEvent` filters in `@babylon/db`.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { asSystem } from './db';
import { type Market, markets } from './tables/markets';
import { type Post, posts } from './tables/posts';
import { type WorldEvent, worldEvents } from './tables/world-events';

export async function listUnresolvedMarketsEndingAfter(
  now: Date,
  limit: number
): Promise<Market[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(markets)
        .where(and(eq(markets.resolved, false), gte(markets.endDate, now)))
        .limit(limit),
    'random-context-active-markets'
  );
}

export async function listPostsBetweenTimestampsOrderedDesc(params: {
  startInclusive: Date;
  endInclusive: Date;
  limit: number;
}): Promise<Post[]> {
  const { startInclusive, endInclusive, limit } = params;
  return asSystem(
    async (c) =>
      c
        .select()
        .from(posts)
        .where(
          and(
            gte(posts.timestamp, startInclusive),
            lte(posts.timestamp, endInclusive)
          )
        )
        .orderBy(desc(posts.timestamp))
        .limit(limit),
    'random-context-trending-posts'
  );
}

export async function listWorldEventsNotAfterOrderedDesc(
  now: Date,
  limit: number
): Promise<WorldEvent[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldEvents)
        .where(lte(worldEvents.timestamp, now))
        .orderBy(desc(worldEvents.timestamp))
        .limit(limit),
    'random-context-world-events'
  );
}
