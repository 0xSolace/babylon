/**
 * Batched post feed SQL (counts, follow lists, bulk post loads) for `apps/web` post routes.
 */

import { and, count, desc, eq, inArray, isNull, lt, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import type { Post } from './tables/posts';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { userActorFollows } from './tables/user-actor-follows';

type FeedDb = DrizzleClient | Transaction;

type FeedGroupedCountRow = {
  postId: string | null;
  count: number;
};

export async function countPostLikesGroupedByPostIds(
  db: FeedDb,
  postIds: string[]
): Promise<FeedGroupedCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({ postId: reactions.postId, c: count() })
    .from(reactions)
    .where(and(inArray(reactions.postId, postIds), eq(reactions.type, 'like')))
    .groupBy(reactions.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.c),
  }));
}

export async function countCommentsGroupedByPostIds(
  db: FeedDb,
  postIds: string[]
): Promise<FeedGroupedCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({ postId: comments.postId, c: count() })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.c),
  }));
}

export async function countSharesGroupedByPostIds(
  db: FeedDb,
  postIds: string[]
): Promise<FeedGroupedCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({ postId: shares.postId, c: count() })
    .from(shares)
    .where(inArray(shares.postId, postIds))
    .groupBy(shares.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.c),
  }));
}

export async function selectLikedPostIdsForUserInPostIds(
  db: FeedDb,
  params: { postIds: string[]; userId: string }
): Promise<string[]> {
  if (params.postIds.length === 0) return [];
  const rows = await db
    .select({ postId: reactions.postId })
    .from(reactions)
    .where(
      and(
        inArray(reactions.postId, params.postIds),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    );
  const out: string[] = [];
  for (const r of rows) {
    if (r.postId) out.push(r.postId);
  }
  return out;
}

export async function selectSharedPostIdsForUserInPostIds(
  db: FeedDb,
  params: { postIds: string[]; userId: string }
): Promise<string[]> {
  if (params.postIds.length === 0) return [];
  const rows = await db
    .select({ postId: shares.postId })
    .from(shares)
    .where(
      and(
        inArray(shares.postId, params.postIds),
        eq(shares.userId, params.userId)
      )
    );
  const out: string[] = [];
  for (const r of rows) {
    if (r.postId) out.push(r.postId);
  }
  return out;
}

export async function listPostsByIdsWhereNotDeleted(
  db: FeedDb,
  postIds: string[]
): Promise<Post[]> {
  if (postIds.length === 0) return [];
  return db
    .select()
    .from(posts)
    .where(and(inArray(posts.id, postIds), isNull(posts.deletedAt)));
}

export async function selectFollowingIdsByFollowerId(
  db: FeedDb,
  followerId: string
): Promise<string[]> {
  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, followerId));
  return rows.map((r) => r.followingId);
}

export async function selectFollowedActorIdsByUserId(
  db: FeedDb,
  userId: string
): Promise<string[]> {
  const rows = await db
    .select({ actorId: userActorFollows.actorId })
    .from(userActorFollows)
    .where(eq(userActorFollows.userId, userId));
  return rows.map((r) => r.actorId);
}

export async function selectPostsByTypePaginated(
  db: FeedDb,
  params: {
    postType: string;
    limit: number;
    now: Date;
    cursorTimestamp?: Date;
  }
): Promise<Post[]> {
  const conditions = [eq(posts.type, params.postType), isNull(posts.deletedAt)];
  if (params.cursorTimestamp) {
    conditions.push(lt(posts.timestamp, params.cursorTimestamp));
  }
  conditions.push(lte(posts.timestamp, params.now));
  return db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}
