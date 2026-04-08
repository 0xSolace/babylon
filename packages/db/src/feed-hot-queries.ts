/**
 * SQL for GET /api/feed/hot (candidate posts + engagement aggregates + author slices).
 */

import { and, count, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';

type FeedHotDb = DrizzleClient | Transaction;

export type HotFeedCandidatePostRow = {
  id: string;
  content: string;
  authorId: string;
  timestamp: Date;
  createdAt: Date;
  type: string;
  articleTitle: string | null;
  fullContent: string | null;
  category: string | null;
  imageUrl: string | null;
};

export async function selectHotFeedRecentCandidatePosts(
  db: FeedHotDb,
  params: {
    cutoff: Date;
    now: Date;
    limit: number;
  }
): Promise<HotFeedCandidatePostRow[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
      createdAt: posts.createdAt,
      type: posts.type,
      articleTitle: posts.articleTitle,
      fullContent: posts.fullContent,
      category: posts.category,
      imageUrl: posts.imageUrl,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        gte(posts.timestamp, params.cutoff),
        lte(posts.timestamp, params.now),
        isNull(posts.commentOnPostId),
        isNull(posts.parentCommentId)
      )
    )
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export type HotFeedEngagementCounts = {
  likes: Array<{ postId: string | null; count: number }>;
  comments: Array<{ postId: string; count: number }>;
  shares: Array<{ postId: string; count: number }>;
};

export async function selectHotFeedEngagementCountsByPostIds(
  db: FeedHotDb,
  postIds: string[]
): Promise<HotFeedEngagementCounts> {
  if (postIds.length === 0) {
    return { likes: [], comments: [], shares: [] };
  }

  const [likes, commentsGrouped, sharesGrouped] = await Promise.all([
    db
      .select({
        postId: reactions.postId,
        count: count(),
      })
      .from(reactions)
      .where(
        and(inArray(reactions.postId, postIds), eq(reactions.type, 'like'))
      )
      .groupBy(reactions.postId),
    db
      .select({
        postId: comments.postId,
        count: count(),
      })
      .from(comments)
      .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
      .groupBy(comments.postId),
    db
      .select({
        postId: shares.postId,
        count: count(),
      })
      .from(shares)
      .where(inArray(shares.postId, postIds))
      .groupBy(shares.postId),
  ]);

  return {
    likes,
    comments: commentsGrouped,
    shares: sharesGrouped,
  };
}

export type HotFeedAuthorUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectHotFeedAuthorUsersByIds(
  db: FeedHotDb,
  authorIds: string[]
): Promise<HotFeedAuthorUserRow[]> {
  if (authorIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(inArray(users.id, authorIds));
}

export type HotFeedUserInteractionPostIds = {
  likedPostIds: string[];
  sharedPostIds: string[];
};

export async function selectHotFeedUserLikesAndSharesByPostIds(
  db: FeedHotDb,
  postIds: string[],
  userId: string
): Promise<HotFeedUserInteractionPostIds> {
  if (postIds.length === 0) {
    return { likedPostIds: [], sharedPostIds: [] };
  }

  const [userLikes, userShares] = await Promise.all([
    db
      .select({ postId: reactions.postId })
      .from(reactions)
      .where(
        and(
          inArray(reactions.postId, postIds),
          eq(reactions.userId, userId),
          eq(reactions.type, 'like')
        )
      ),
    db
      .select({ postId: shares.postId })
      .from(shares)
      .where(and(inArray(shares.postId, postIds), eq(shares.userId, userId))),
  ]);

  return {
    likedPostIds: userLikes
      .map((l) => l.postId)
      .filter((id): id is string => id !== null),
    sharedPostIds: userShares.map((s) => s.postId),
  };
}
