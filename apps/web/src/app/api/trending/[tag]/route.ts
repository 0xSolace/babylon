/**
 * Trending Tag Detail API
 *
 * @route GET /api/trending/[tag] - Get posts by tag
 * @access Public (optional authentication for RLS)
 *
 * @description
 * Returns posts with a specific tag. Supports pagination. Optional authentication
 * applies RLS for personalized results.
 *
 * @openapi
 * /api/trending/{tag}:
 *   get:
 *     tags:
 *       - Trending
 *     summary: Get posts by tag
 *     description: Returns posts with specific tag (optional auth for RLS)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *         description: Tag name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Posts per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *       401:
 *         description: Unauthorized (optional)
 *
 * @example
 * ```typescript
 * const { posts } = await fetch('/api/trending/crypto?limit=20')
 *   .then(r => r.json());
 * ```
 */

import {
  addPublicReadHeaders,
  publicRateLimit,
  withErrorHandling,
} from '@babylon/api';
import {
  selectPostCommentCountsGroupedByPostIds,
  selectPostIdsLikedByUser,
  selectPostIdsSharedByUser,
  selectPostLikeReactionCountsGroupedByPostIds,
  selectPostShareCountsGroupedByPostIds,
  selectTrendingAuthorUserRowsByIds,
} from '@babylon/db';
import { getPostsByTag, StaticDataRegistry } from '@babylon/engine';
import { toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

function toPostCountMap(
  rows: { postId: string | null; count: number }[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.postId !== null && r.postId !== undefined) {
      m.set(r.postId, r.count);
    }
  }
  return m;
}

export const GET = withErrorHandling(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  const {
    error,
    user: authUser,
    rateLimitInfo,
  } = await publicRateLimit(request);
  if (error) return error;

  const { tag } = await params;
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get('limit') || '20');
  const offset = Number.parseInt(url.searchParams.get('offset') || '0');

  if (!tag) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tag parameter is required',
      },
      { status: 400 }
    );
  }

  const result = await getPostsByTag(tag, { limit, offset });

  if (!result.tag) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tag not found',
        posts: [],
        total: 0,
      },
      { status: 404 }
    );
  }

  const posts = result.posts;
  const postIds = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.authorId))];

  const usersList =
    authorIds.length === 0
      ? []
      : await runWithOptionalUserRls(authUser, async (dbClient) =>
          selectTrendingAuthorUserRowsByIds(dbClient, authorIds)
        );

  const userMap = new Map(usersList.map((u) => [u.id, u]));

  const [likeCounts, commentCounts, shareCounts] =
    postIds.length > 0
      ? await runWithOptionalUserRls(authUser, async (dbClient) =>
          Promise.all([
            selectPostLikeReactionCountsGroupedByPostIds(dbClient, postIds),
            selectPostCommentCountsGroupedByPostIds(dbClient, postIds),
            selectPostShareCountsGroupedByPostIds(dbClient, postIds),
          ])
        )
      : [[], [], []];

  const likeMap = toPostCountMap(likeCounts);
  const commentMap = toPostCountMap(commentCounts);
  const shareMap = toPostCountMap(shareCounts);

  let likedPostIds = new Set<string>();
  let sharedPostIds = new Set<string>();
  if (authUser?.userId && postIds.length > 0) {
    const uid = authUser.userId;
    await runWithOptionalUserRls(authUser, async (dbClient) => {
      const [likes, userShares] = await Promise.all([
        selectPostIdsLikedByUser(dbClient, { postIds, userId: uid }),
        selectPostIdsSharedByUser(dbClient, { postIds, userId: uid }),
      ]);
      likedPostIds = new Set(likes);
      sharedPostIds = new Set(userShares);
    });
  }

  const enrichedPosts = posts.map((post) => {
    const actor = StaticDataRegistry.getActor(post.authorId);
    const org = StaticDataRegistry.getOrganization(post.authorId);
    const user = userMap.get(post.authorId);

    const authorName =
      user?.displayName ||
      user?.username ||
      actor?.name ||
      org?.name ||
      'Unknown';
    const authorUsername = user?.username ?? null;
    const authorProfileImageUrl =
      user?.profileImageUrl || actor?.profileImageUrl || org?.imageUrl || null;

    return {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      authorName,
      authorUsername,
      authorProfileImageUrl,
      timestamp: toISO(post.timestamp),
      likeCount: likeMap.get(post.id) ?? 0,
      commentCount: commentMap.get(post.id) ?? 0,
      shareCount: shareMap.get(post.id) ?? 0,
      isLiked: likedPostIds.has(post.id),
      isShared: sharedPostIds.has(post.id),
    };
  });

  const res = NextResponse.json({
    success: true,
    tag: {
      name: result.tag.name,
      displayName: result.tag.displayName,
      category: result.tag.category,
    },
    posts: enrichedPosts,
    total: result.total,
  });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
