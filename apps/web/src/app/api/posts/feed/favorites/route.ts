/**
 * Favorites Feed API
 *
 * @route GET /api/posts/feed/favorites - Get posts from favorited profiles
 * @access Authenticated (optional, returns empty if not authenticated)
 *
 * @description
 * Returns posts from profiles the user has favorited. Optimized with batch queries
 * to prevent N+1 problems. Includes interaction counts and user interaction state.
 *
 * @openapi
 * /api/posts/feed/favorites:
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get favorites feed
 *     description: Returns posts from favorited profiles with interaction counts
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Posts per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Favorites feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       authorId:
 *                         type: string
 *                       interactions:
 *                         type: object
 *                         properties:
 *                           likeCount:
 *                             type: integer
 *                           commentCount:
 *                             type: integer
 *                           shareCount:
 *                             type: integer
 *                           isLiked:
 *                             type: boolean
 *                           isShared:
 *                             type: boolean
 *                 total:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       401:
 *         description: Unauthorized (returns empty feed)
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/posts/feed/favorites?limit=20&page=1', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { posts, total, hasMore } = await response.json();
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import { optionalAuth, successResponse, withErrorHandling } from '@babylon/api';
import {
  countCommentsGroupedByPostIds,
  countFavoritesFeedPostsTotal,
  countPostLikesGroupedByPostIds,
  countSharesGroupedByPostIds,
  selectFavoritesFeedPostPage,
  selectFavoriteTargetUserIdsByFavoriter,
  selectLikedPostIdsForUserInPostIds,
  selectSharedPostIdsForUserInPostIds,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { logger, PostFeedQuerySchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * GET /api/posts/feed/favorites
 * Get posts from profiles the user has favorited
 * Query params:
 * - limit: number of posts to return (default 20, max 100)
 * - offset: pagination offset (default 0)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Optional authentication - returns null if not authenticated
  const user = await optionalAuth(request);

  // If not authenticated, return empty array
  if (!user) {
    logger.info(
      'Unauthenticated request for favorites feed',
      {},
      'GET /api/posts/feed/favorites'
    );
    return successResponse({
      posts: [],
      total: 0,
      hasMore: false,
    });
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    limit: searchParams.get('limit'),
    page: searchParams.get('page'),
  };
  const validatedQuery = PostFeedQuerySchema.partial().parse(queryParams);
  const limit = Math.min(validatedQuery.limit || 20, 100);
  const offset = validatedQuery.page ? (validatedQuery.page - 1) * limit : 0;

  // Get favorites feed with RLS
  const result = await asUser(user, async (dbClient) => {
    const favoritedUserIds = await selectFavoriteTargetUserIdsByFavoriter(
      dbClient,
      user.userId
    );

    // If no favorites, return empty array
    if (favoritedUserIds.length === 0) {
      return { posts: [], totalCount: 0, hasMore: false };
    }

    const now = new Date();
    const postList = await selectFavoritesFeedPostPage(dbClient, {
      authorIds: favoritedUserIds,
      now,
      offset,
      fetchLimit: limit + 1,
    });

    const hasMore = postList.length > limit;
    const postsToReturn = hasMore ? postList.slice(0, limit) : postList;

    const totalCount = await countFavoritesFeedPostsTotal(dbClient, {
      authorIds: favoritedUserIds,
      now,
    });

    const postIds = postsToReturn.map((p) => p.id);

    const [allReactions, allComments, allShares, likedIds, sharedIds] =
      await Promise.all([
        countPostLikesGroupedByPostIds(dbClient, postIds),
        countCommentsGroupedByPostIds(dbClient, postIds),
        countSharesGroupedByPostIds(dbClient, postIds),
        selectLikedPostIdsForUserInPostIds(dbClient, {
          postIds,
          userId: user.userId,
        }),
        selectSharedPostIdsForUserInPostIds(dbClient, {
          postIds,
          userId: user.userId,
        }),
      ]);

    const reactionMap = new Map(
      allReactions.flatMap((r) =>
        r.postId ? ([[r.postId, r.count]] as const) : []
      )
    );
    const commentMap = new Map(
      allComments.flatMap((c) =>
        c.postId ? ([[c.postId, c.count]] as const) : []
      )
    );
    const shareMap = new Map(
      allShares.flatMap((s) =>
        s.postId ? ([[s.postId, s.count]] as const) : []
      )
    );
    const userReactionSet = new Set(likedIds);
    const userShareSet = new Set(sharedIds);

    const transformedPosts = postsToReturn.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      timestamp: post.timestamp,
      authorId: post.authorId,
      gameId: post.gameId,
      dayNumber: post.dayNumber,
      interactions: {
        likeCount: reactionMap.get(post.id) ?? 0,
        commentCount: commentMap.get(post.id) ?? 0,
        shareCount: shareMap.get(post.id) ?? 0,
        isLiked: userReactionSet.has(post.id),
        isShared: userShareSet.has(post.id),
      },
    }));

    return { posts: transformedPosts, totalCount, hasMore };
  });

  logger.info(
    'Favorites feed fetched successfully',
    {
      userId: user.userId,
      count: result.posts.length,
      total: result.totalCount,
    },
    'GET /api/posts/feed/favorites'
  );

  return successResponse({
    posts: result.posts,
    total: result.totalCount,
    hasMore: result.hasMore,
    limit,
    offset,
  });
});
