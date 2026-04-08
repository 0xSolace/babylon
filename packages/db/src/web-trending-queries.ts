/**
 * SQL for `apps/web` GET /api/trending/[tag] and GET /api/trending/group.
 */

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { postTags } from './tables/post-tags';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { tags } from './tables/tags';
import { users } from './tables/user';

type TrendingDb = DrizzleClient | Transaction;

export type TrendingAuthorUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
};

export async function selectTrendingAuthorUserRowsByIds(
  db: TrendingDb,
  userIds: string[]
): Promise<TrendingAuthorUserRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export type PostIdCountRow = { postId: string | null; count: number };

export async function selectPostLikeReactionCountsGroupedByPostIds(
  db: TrendingDb,
  postIds: string[]
): Promise<PostIdCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({
      postId: reactions.postId,
      count: count(),
    })
    .from(reactions)
    .where(and(inArray(reactions.postId, postIds), eq(reactions.type, 'like')))
    .groupBy(reactions.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.count),
  }));
}

export async function selectPostReactionCountsGroupedByPostIds(
  db: TrendingDb,
  postIds: string[]
): Promise<PostIdCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({
      postId: reactions.postId,
      count: count(),
    })
    .from(reactions)
    .where(inArray(reactions.postId, postIds))
    .groupBy(reactions.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.count),
  }));
}

export async function selectPostCommentCountsGroupedByPostIds(
  db: TrendingDb,
  postIds: string[]
): Promise<PostIdCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({
      postId: comments.postId,
      count: count(),
    })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.count),
  }));
}

export async function selectPostShareCountsGroupedByPostIds(
  db: TrendingDb,
  postIds: string[]
): Promise<PostIdCountRow[]> {
  if (postIds.length === 0) return [];
  const rows = await db
    .select({
      postId: shares.postId,
      count: count(),
    })
    .from(shares)
    .where(inArray(shares.postId, postIds))
    .groupBy(shares.postId);
  return rows.map((r) => ({
    postId: r.postId,
    count: Number(r.count),
  }));
}

export async function selectPostIdsLikedByUser(
  db: TrendingDb,
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
  return rows
    .map((r) => r.postId)
    .filter((id): id is string => id !== null && id !== undefined);
}

export async function selectPostIdsSharedByUser(
  db: TrendingDb,
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
  return rows.map((r) => r.postId);
}

export type TrendingTagListRow = {
  id: string;
  name: string;
  displayName: string;
  category: string | null;
};

export async function selectTagsByNames(
  db: TrendingDb,
  names: string[]
): Promise<TrendingTagListRow[]> {
  if (names.length === 0) return [];
  return db
    .select({
      id: tags.id,
      name: tags.name,
      displayName: tags.displayName,
      category: tags.category,
    })
    .from(tags)
    .where(inArray(tags.name, names));
}

export type GroupedTrendingPostTagRow = {
  postId: string;
  tagId: string;
  createdAt: Date;
  post: {
    id: string;
    content: string;
    authorId: string;
    timestamp: Date;
    type: string;
    articleTitle: string | null;
    byline: string | null;
    biasScore: number | null;
    category: string | null;
  };
};

export async function selectPostTagsWithPostsForTagIdsOrderCreatedDescLimit(
  db: TrendingDb,
  params: { tagIds: string[]; limit: number }
): Promise<GroupedTrendingPostTagRow[]> {
  if (params.tagIds.length === 0) return [];
  const rows = await db
    .select({
      postId: postTags.postId,
      tagId: postTags.tagId,
      createdAt: postTags.createdAt,
      post: {
        id: posts.id,
        content: posts.content,
        authorId: posts.authorId,
        timestamp: posts.timestamp,
        type: posts.type,
        articleTitle: posts.articleTitle,
        byline: posts.byline,
        biasScore: posts.biasScore,
        category: posts.category,
      },
    })
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .where(and(inArray(postTags.tagId, params.tagIds), isNull(posts.deletedAt)))
    .orderBy(desc(postTags.createdAt))
    .limit(params.limit);

  return rows.map((r) => ({
    postId: r.postId,
    tagId: r.tagId,
    createdAt: r.createdAt,
    post: r.post,
  }));
}

export type TrendingGroupAuthorRow = {
  id: string;
  username: string | null;
  displayName: string | null;
};

export async function selectTrendingGroupAuthorRowsByIds(
  db: TrendingDb,
  userIds: string[]
): Promise<TrendingGroupAuthorRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}
