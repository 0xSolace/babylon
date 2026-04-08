/**
 * SQL for the For You feed pipeline (RLS-scoped `db` from the route).
 */

import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { NarrativeFeedRecentPostSlice } from './narrative-feed-queries';
import { feedEvents } from './tables/feed-events';
import { posts } from './tables/posts';

type ForYouFeedDb = DrizzleClient | Transaction;

export type ForYouFeedEventRow = {
  actionType: string;
  itemId: string;
  clusterId: string | null;
  marketId: string | null;
  topicKey: string | null;
  authorId: string | null;
  dwellMs: number | null;
  createdAt: Date;
};

/** Recent user feed events for a surface (e.g. `for_you`), ordered newest first. */
export async function selectForYouFeedEventRows(
  db: ForYouFeedDb,
  params: { userId: string; surface: string; since: Date; limit: number }
): Promise<ForYouFeedEventRow[]> {
  return db
    .select({
      actionType: feedEvents.actionType,
      itemId: feedEvents.itemId,
      clusterId: feedEvents.clusterId,
      marketId: feedEvents.marketId,
      topicKey: feedEvents.topicKey,
      authorId: feedEvents.authorId,
      dwellMs: feedEvents.dwellMs,
      createdAt: feedEvents.createdAt,
    })
    .from(feedEvents)
    .where(
      and(
        eq(feedEvents.userId, params.userId),
        eq(feedEvents.surface, params.surface),
        gte(feedEvents.createdAt, params.since)
      )
    )
    .orderBy(desc(feedEvents.createdAt))
    .limit(params.limit);
}

/**
 * Backfill candidates in [backfillCutoff, primaryCutoff), ranked by
 * `mv_post_interaction_counts.engagement_score` (materialized view).
 */
export async function selectForYouBackfillPostSlicesByHotScore(
  db: ForYouFeedDb,
  params: {
    backfillCutoff: Date;
    primaryCutoff: Date;
    limit: number;
  }
): Promise<NarrativeFeedRecentPostSlice[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      type: posts.type,
      articleTitle: posts.articleTitle,
      fullContent: posts.fullContent,
      category: posts.category,
      imageUrl: posts.imageUrl,
      relatedQuestion: posts.relatedQuestion,
      originalPostId: posts.originalPostId,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.backfillCutoff),
        lt(posts.timestamp, params.primaryCutoff),
        isNull(posts.commentOnPostId),
        isNull(posts.parentCommentId)
      )
    )
    .orderBy(
      sql`(SELECT COALESCE(mic.engagement_score, 0) FROM mv_post_interaction_counts mic WHERE mic.post_id = ${posts.id}) DESC`
    )
    .limit(params.limit);
}
