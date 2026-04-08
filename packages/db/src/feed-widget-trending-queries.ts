/**
 * SQL for GET /api/feed/widgets/trending (recent post samples per tag).
 */

import { desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { postTags } from './tables/post-tags';
import { posts } from './tables/posts';

type FeedWidgetTrendingDb = DrizzleClient | Transaction;

export type TrendingWidgetPostSampleRow = {
  postId: string;
  postContent: string;
};

export async function selectTrendingWidgetRecentPostSamplesByTagId(
  db: FeedWidgetTrendingDb,
  tagId: string,
  limit: number
): Promise<TrendingWidgetPostSampleRow[]> {
  return db
    .select({
      postId: postTags.postId,
      postContent: posts.content,
    })
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(eq(postTags.tagId, tagId))
    .orderBy(desc(postTags.createdAt))
    .limit(limit);
}
