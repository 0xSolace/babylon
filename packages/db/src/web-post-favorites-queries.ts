/**
 * SQL for `apps/web` GET /api/posts/feed/favorites.
 */

import { and, count, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { favorites } from './tables/favorites';
import type { Post } from './tables/posts';
import { posts } from './tables/posts';

type FavDb = DrizzleClient | Transaction;

export async function selectFavoriteTargetUserIdsByFavoriter(
  db: FavDb,
  userId: string
): Promise<string[]> {
  const rows = await db
    .select({ targetUserId: favorites.targetUserId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  return rows.map((r) => r.targetUserId);
}

export async function selectFavoritesFeedPostPage(
  db: FavDb,
  params: {
    authorIds: string[];
    now: Date;
    offset: number;
    fetchLimit: number;
  }
): Promise<Post[]> {
  if (params.authorIds.length === 0) return [];
  return db
    .select()
    .from(posts)
    .where(
      and(
        inArray(posts.authorId, params.authorIds),
        isNull(posts.deletedAt),
        lte(posts.timestamp, params.now)
      )
    )
    .orderBy(desc(posts.createdAt))
    .offset(params.offset)
    .limit(params.fetchLimit);
}

export async function countFavoritesFeedPostsTotal(
  db: FavDb,
  params: { authorIds: string[]; now: Date }
): Promise<number> {
  if (params.authorIds.length === 0) return 0;
  const [row] = await db
    .select({ c: count() })
    .from(posts)
    .where(
      and(
        inArray(posts.authorId, params.authorIds),
        lte(posts.timestamp, params.now)
      )
    );
  return Number(row?.c ?? 0);
}
