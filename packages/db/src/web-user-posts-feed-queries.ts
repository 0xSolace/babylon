/**
 * SQL for GET /api/users/[userId]/posts (posts + replies feed slices).
 */

import { and, count, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type Comment, comments } from './tables/comments';
import { type Post, posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';

type UserPostsFeedDb = DrizzleClient | Transaction;

export type UserRepliesFeedAuthorRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
};

export type UserRepliesFeedDbPayload = {
  userComments: Comment[];
  postsData: Array<{
    id: string;
    content: string;
    authorId: string;
    timestamp: Date;
  }>;
  parentCommentsData: Array<{
    id: string;
    content: string;
    authorId: string;
    createdAt: Date;
  }>;
  likeCountsResult: Array<{ commentId: string | null; count: number }>;
  replyCountsResult: Array<{ parentCommentId: string | null; count: number }>;
  userLikesCommentIds: string[];
  postLikeCounts: Array<{ postId: string | null; count: number }>;
  postCommentCounts: Array<{ postId: string; count: number }>;
  postShareCounts: Array<{ postId: string; count: number }>;
  parentCommentLikeCounts: Array<{ commentId: string | null; count: number }>;
  parentCommentReplyCounts: Array<{
    parentCommentId: string | null;
    count: number;
  }>;
  userPostLikes: string[];
  userPostShares: string[];
  userParentCommentLikes: string[];
  authorsUsers: UserRepliesFeedAuthorRow[];
};

export async function fetchUserRepliesFeedDbPayload(
  db: UserPostsFeedDb,
  canonicalUserId: string,
  viewerUserId: string | undefined
): Promise<UserRepliesFeedDbPayload> {
  const userComments = await db
    .select()
    .from(comments)
    .where(
      and(eq(comments.authorId, canonicalUserId), isNull(comments.deletedAt))
    )
    .orderBy(desc(comments.createdAt))
    .limit(100);

  if (userComments.length === 0) {
    return {
      userComments,
      postsData: [],
      parentCommentsData: [],
      likeCountsResult: [],
      replyCountsResult: [],
      userLikesCommentIds: [],
      postLikeCounts: [],
      postCommentCounts: [],
      postShareCounts: [],
      parentCommentLikeCounts: [],
      parentCommentReplyCounts: [],
      userPostLikes: [],
      userPostShares: [],
      userParentCommentLikes: [],
      authorsUsers: [],
    };
  }

  const commentIds = userComments.map((c) => c.id);
  const postIds = [...new Set(userComments.map((c) => c.postId))];
  const parentCommentIds = [
    ...new Set(
      userComments
        .map((c) => c.parentCommentId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const postsData = await db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(inArray(posts.id, postIds));

  let parentCommentsData: UserRepliesFeedDbPayload['parentCommentsData'] = [];
  if (parentCommentIds.length > 0) {
    parentCommentsData = await db
      .select({
        id: comments.id,
        content: comments.content,
        authorId: comments.authorId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(
        and(inArray(comments.id, parentCommentIds), isNull(comments.deletedAt))
      );
  }

  const likeCountsResult = await db
    .select({
      commentId: reactions.commentId,
      count: count(),
    })
    .from(reactions)
    .where(
      and(inArray(reactions.commentId, commentIds), eq(reactions.type, 'like'))
    )
    .groupBy(reactions.commentId);

  const replyCountsResult = await db
    .select({
      parentCommentId: comments.parentCommentId,
      count: count(),
    })
    .from(comments)
    .where(
      and(
        inArray(comments.parentCommentId, commentIds),
        isNull(comments.deletedAt)
      )
    )
    .groupBy(comments.parentCommentId);

  let userLikesCommentIds: string[] = [];
  if (viewerUserId) {
    const userLikes = await db
      .select({ commentId: reactions.commentId })
      .from(reactions)
      .where(
        and(
          inArray(reactions.commentId, commentIds),
          eq(reactions.userId, viewerUserId),
          eq(reactions.type, 'like')
        )
      );
    userLikesCommentIds = userLikes
      .map((l) => l.commentId)
      .filter((id): id is string => id !== null);
  }

  const [postLikeCounts, postCommentCounts, postShareCounts] =
    postIds.length > 0
      ? await Promise.all([
          db
            .select({
              postId: reactions.postId,
              count: count(),
            })
            .from(reactions)
            .where(
              and(
                inArray(reactions.postId, postIds),
                eq(reactions.type, 'like')
              )
            )
            .groupBy(reactions.postId),
          db
            .select({
              postId: comments.postId,
              count: count(),
            })
            .from(comments)
            .where(
              and(inArray(comments.postId, postIds), isNull(comments.deletedAt))
            )
            .groupBy(comments.postId),
          db
            .select({
              postId: shares.postId,
              count: count(),
            })
            .from(shares)
            .where(inArray(shares.postId, postIds))
            .groupBy(shares.postId),
        ])
      : [[], [], []];

  let parentCommentLikeCounts: UserRepliesFeedDbPayload['parentCommentLikeCounts'] =
    [];
  let parentCommentReplyCounts: UserRepliesFeedDbPayload['parentCommentReplyCounts'] =
    [];
  if (parentCommentIds.length > 0) {
    const [plc, prc] = await Promise.all([
      db
        .select({
          commentId: reactions.commentId,
          count: count(),
        })
        .from(reactions)
        .where(
          and(
            inArray(reactions.commentId, parentCommentIds),
            eq(reactions.type, 'like')
          )
        )
        .groupBy(reactions.commentId),
      db
        .select({
          parentCommentId: comments.parentCommentId,
          count: count(),
        })
        .from(comments)
        .where(
          and(
            inArray(comments.parentCommentId, parentCommentIds),
            isNull(comments.deletedAt)
          )
        )
        .groupBy(comments.parentCommentId),
    ]);
    parentCommentLikeCounts = plc;
    parentCommentReplyCounts = prc;
  }

  let userPostLikes: string[] = [];
  let userPostShares: string[] = [];
  let userParentCommentLikes: string[] = [];
  if (viewerUserId) {
    const [userPostLikesRows, userPostSharesRows, userParentCommentLikesRows] =
      await Promise.all([
        postIds.length > 0
          ? db
              .select({ postId: reactions.postId })
              .from(reactions)
              .where(
                and(
                  inArray(reactions.postId, postIds),
                  eq(reactions.userId, viewerUserId),
                  eq(reactions.type, 'like')
                )
              )
          : Promise.resolve([] as Array<{ postId: string | null }>),
        postIds.length > 0
          ? db
              .select({ postId: shares.postId })
              .from(shares)
              .where(
                and(
                  inArray(shares.postId, postIds),
                  eq(shares.userId, viewerUserId)
                )
              )
          : Promise.resolve([] as Array<{ postId: string }>),
        parentCommentIds.length > 0
          ? db
              .select({ commentId: reactions.commentId })
              .from(reactions)
              .where(
                and(
                  inArray(reactions.commentId, parentCommentIds),
                  eq(reactions.userId, viewerUserId),
                  eq(reactions.type, 'like')
                )
              )
          : Promise.resolve([] as Array<{ commentId: string | null }>),
      ]);
    userPostLikes = userPostLikesRows
      .map((l) => l.postId)
      .filter((id): id is string => id !== null);
    userPostShares = userPostSharesRows.map((s) => s.postId);
    userParentCommentLikes = userParentCommentLikesRows
      .map((l) => l.commentId)
      .filter((id): id is string => id !== null);
  }

  const parentCommentAuthorIds = [
    ...new Set(parentCommentsData.map((c) => c.authorId)),
  ];
  const allAuthorIds = [
    ...new Set([
      ...postsData.map((p) => p.authorId),
      ...parentCommentAuthorIds,
    ]),
  ];

  const authorsUsers =
    allAuthorIds.length > 0
      ? await db
          .select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(inArray(users.id, allAuthorIds))
      : [];

  return {
    userComments,
    postsData,
    parentCommentsData,
    likeCountsResult,
    replyCountsResult,
    userLikesCommentIds,
    postLikeCounts,
    postCommentCounts,
    postShareCounts,
    parentCommentLikeCounts,
    parentCommentReplyCounts,
    userPostLikes,
    userPostShares,
    userParentCommentLikes,
    authorsUsers,
  };
}

export type UserPostsFeedPostAuthorRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
};

export type UserPostsFeedDbPayload = {
  userPosts: Post[];
  likeCountsResult: Array<{ postId: string | null; count: number }>;
  commentCountsResult: Array<{ postId: string; count: number }>;
  shareCountsResult: Array<{ postId: string; count: number }>;
  userLikedPostIds: string[];
  userSharedPostIds: string[];
  postAuthor: UserPostsFeedPostAuthorRow | undefined;
  originalPosts: Post[];
  originalAuthorsUsers: UserPostsFeedPostAuthorRow[];
  originalPostReactions: Array<{ postId: string | null; count: number }>;
  originalPostComments: Array<{ postId: string; count: number }>;
  originalPostShares: Array<{ postId: string; count: number }>;
};

export async function fetchUserPostsFeedDbPayload(
  db: UserPostsFeedDb,
  canonicalUserId: string,
  viewerUserId: string | undefined,
  now: Date = new Date()
): Promise<UserPostsFeedDbPayload> {
  const userPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.authorId, canonicalUserId),
        isNull(posts.deletedAt),
        lte(posts.timestamp, now)
      )
    )
    .orderBy(desc(posts.timestamp))
    .limit(100);

  if (userPosts.length === 0) {
    return {
      userPosts,
      likeCountsResult: [],
      commentCountsResult: [],
      shareCountsResult: [],
      userLikedPostIds: [],
      userSharedPostIds: [],
      postAuthor: undefined,
      originalPosts: [],
      originalAuthorsUsers: [],
      originalPostReactions: [],
      originalPostComments: [],
      originalPostShares: [],
    };
  }

  const postIds = userPosts.map((p) => p.id);

  const [likeCountsResult, commentCountsResult, shareCountsResult] =
    await Promise.all([
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
        .where(
          and(inArray(comments.postId, postIds), isNull(comments.deletedAt))
        )
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

  let userLikedPostIds: string[] = [];
  let userSharedPostIds: string[] = [];
  if (viewerUserId) {
    const [userLikes, userShares] = await Promise.all([
      db
        .select({ postId: reactions.postId })
        .from(reactions)
        .where(
          and(
            inArray(reactions.postId, postIds),
            eq(reactions.userId, viewerUserId),
            eq(reactions.type, 'like')
          )
        ),
      db
        .select({ postId: shares.postId })
        .from(shares)
        .where(
          and(inArray(shares.postId, postIds), eq(shares.userId, viewerUserId))
        ),
    ]);
    userLikedPostIds = userLikes
      .map((l) => l.postId)
      .filter((id): id is string => id !== null);
    userSharedPostIds = userShares.map((s) => s.postId);
  }

  const [postAuthor] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, canonicalUserId))
    .limit(1);

  const originalPostIds = userPosts
    .filter((p) => p.originalPostId !== null)
    .map((p) => p.originalPostId)
    .filter((id): id is string => id !== null);

  let originalPosts: Post[] = [];
  let originalAuthorsUsers: UserPostsFeedPostAuthorRow[] = [];
  let originalPostReactions: UserPostsFeedDbPayload['originalPostReactions'] =
    [];
  let originalPostComments: UserPostsFeedDbPayload['originalPostComments'] = [];
  let originalPostShares: UserPostsFeedDbPayload['originalPostShares'] = [];

  if (originalPostIds.length > 0) {
    originalPosts = await db
      .select()
      .from(posts)
      .where(inArray(posts.id, originalPostIds));

    const originalPostAuthorIds = [
      ...new Set(originalPosts.map((p) => p.authorId)),
    ];

    if (originalPostAuthorIds.length > 0) {
      originalAuthorsUsers = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(inArray(users.id, originalPostAuthorIds));
    }

    const [
      originalPostReactionsRows,
      originalPostCommentsRows,
      originalPostSharesRows,
    ] = await Promise.all([
      db
        .select({
          postId: reactions.postId,
          count: count(),
        })
        .from(reactions)
        .where(
          and(
            inArray(reactions.postId, originalPostIds),
            eq(reactions.type, 'like')
          )
        )
        .groupBy(reactions.postId),
      db
        .select({
          postId: comments.postId,
          count: count(),
        })
        .from(comments)
        .where(inArray(comments.postId, originalPostIds))
        .groupBy(comments.postId),
      db
        .select({
          postId: shares.postId,
          count: count(),
        })
        .from(shares)
        .where(inArray(shares.postId, originalPostIds))
        .groupBy(shares.postId),
    ]);
    originalPostReactions = originalPostReactionsRows;
    originalPostComments = originalPostCommentsRows;
    originalPostShares = originalPostSharesRows;
  }

  return {
    userPosts,
    likeCountsResult,
    commentCountsResult,
    shareCountsResult,
    userLikedPostIds,
    userSharedPostIds,
    postAuthor,
    originalPosts,
    originalAuthorsUsers,
    originalPostReactions,
    originalPostComments,
    originalPostShares,
  };
}
