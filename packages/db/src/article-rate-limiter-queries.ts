/**
 * Article post counts for hourly rate limiting.
 *
 * **Why here:** Keeps `Post` filter SQL in `@babylon/db`; limits stay in engine.
 */

import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';

export async function countNonDeletedArticlesSince(
  windowStart: Date
): Promise<number> {
  return asSystem(async (c) => {
    const [result] = await c
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        and(
          eq(posts.type, 'article'),
          gte(posts.timestamp, windowStart),
          isNull(posts.deletedAt)
        )
      );
    return result?.count ?? 0;
  }, 'article-rate-limiter-recent-count');
}
