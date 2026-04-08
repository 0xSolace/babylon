/**
 * SQL for GET /api/feed/widgets/breaking-news (optional-user RLS client).
 */

import { and, desc, eq, inArray, isNull, lte, notInArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { organizationState } from './tables/organization-state';
import { posts } from './tables/posts';
import { stockPrices } from './tables/stock-prices';
import { worldEvents } from './tables/world-events';

type BreakingNewsDb = DrizzleClient | Transaction;

export async function selectWorldEventTypesSample(
  db: BreakingNewsDb,
  limit: number
): Promise<{ eventType: string }[]> {
  return db
    .select({ eventType: worldEvents.eventType })
    .from(worldEvents)
    .limit(limit);
}

export async function selectRecentPublicWorldEvents(
  db: BreakingNewsDb,
  params: { notAfter: Date; limit: number }
) {
  return db
    .select()
    .from(worldEvents)
    .where(
      and(
        eq(worldEvents.visibility, 'public'),
        lte(worldEvents.timestamp, params.notAfter)
      )
    )
    .orderBy(desc(worldEvents.timestamp))
    .limit(params.limit);
}

export async function selectRecentStockPricesOrdered(
  db: BreakingNewsDb,
  limit: number
) {
  return db
    .select()
    .from(stockPrices)
    .orderBy(desc(stockPrices.timestamp))
    .limit(limit);
}

export async function selectOrganizationStateAll(db: BreakingNewsDb) {
  return db.select().from(organizationState);
}

export async function selectRecentNonDeletedPosts(
  db: BreakingNewsDb,
  params: { notAfter: Date; limit: number }
) {
  return db
    .select()
    .from(posts)
    .where(and(isNull(posts.deletedAt), lte(posts.timestamp, params.notAfter)))
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export async function selectFallbackActorPostsExcludingIds(
  db: BreakingNewsDb,
  params: {
    notAfter: Date;
    authorIds: string[];
    excludePostIds: string[];
    limit: number;
  }
) {
  const whereConditions = [
    lte(posts.timestamp, params.notAfter),
    inArray(posts.authorId, params.authorIds),
    isNull(posts.deletedAt),
  ];
  if (params.excludePostIds.length > 0) {
    whereConditions.push(notInArray(posts.id, params.excludePostIds));
  }
  return db
    .select()
    .from(posts)
    .where(and(...whereConditions))
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export async function selectRecentWorldEventsUpToTime(
  db: BreakingNewsDb,
  params: { notAfter: Date; limit: number }
) {
  return db
    .select()
    .from(worldEvents)
    .where(lte(worldEvents.timestamp, params.notAfter))
    .orderBy(desc(worldEvents.timestamp))
    .limit(params.limit);
}
