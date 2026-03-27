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
import { and, count, eq, inArray } from '@babylon/db';
import {
  asPublic,
  asUser,
  comments,
  reactions,
  shares,
  users,
} from '@babylon/db/runtime';
import { getPostsByTag, StaticDataRegistry } from '@babylon/engine';
import { toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
      : authUser && authUser.userId
        ? await asUser(authUser, async (dbClient) => {
            return await dbClient
              .select({
                id: users.id,
                username: users.username,
                displayName: users.displayName,
                profileImageUrl: users.profileImageUrl,
                isActor: users.isActor,
              })
              .from(users)
              .where(inArray(users.id, authorIds));
          })
        : await asPublic(async (dbClient) => {
            return await dbClient
              .select({
                id: users.id,
                username: users.username,
                displayName: users.displayName,
                profileImageUrl: users.profileImageUrl,
                isActor: users.isActor,
              })
              .from(users)
              .where(inArray(users.id, authorIds));
          });

  const userMap = new Map(usersList.map((u) => [u.id, u]));

  const [likeCounts, commentCounts, shareCounts] =
    postIds.length > 0
      ? authUser && authUser.userId
        ? await asUser(authUser, async (dbClient) => {
            return await Promise.all([
              dbClient
                .select({ postId: reactions.postId, count: count() })
                .from(reactions)
                .where(
                  and(
                    inArray(reactions.postId, postIds),
                    eq(reactions.type, 'like')
                  )
                )
                .groupBy(reactions.postId),
              dbClient
                .select({ postId: comments.postId, count: count() })
                .from(comments)
                .where(inArray(comments.postId, postIds))
                .groupBy(comments.postId),
              dbClient
                .select({ postId: shares.postId, count: count() })
                .from(shares)
                .where(inArray(shares.postId, postIds))
                .groupBy(shares.postId),
            ]);
          })
        : await asPublic(async (dbClient) => {
            return await Promise.all([
              dbClient
                .select({ postId: reactions.postId, count: count() })
                .from(reactions)
                .where(
                  and(
                    inArray(reactions.postId, postIds),
                    eq(reactions.type, 'like')
                  )
                )
                .groupBy(reactions.postId),
              dbClient
                .select({ postId: comments.postId, count: count() })
                .from(comments)
                .where(inArray(comments.postId, postIds))
                .groupBy(comments.postId),
              dbClient
                .select({ postId: shares.postId, count: count() })
                .from(shares)
                .where(inArray(shares.postId, postIds))
                .groupBy(shares.postId),
            ]);
          })
      : [[], [], []];

  const likeMap = new Map(
    likeCounts.map((lc) => [lc.postId, lc.count ?? 0] as const)
  );
  const commentMap = new Map(
    commentCounts.map((cc) => [cc.postId, cc.count ?? 0] as const)
  );
  const shareMap = new Map(
    shareCounts.map((sc) => [sc.postId, sc.count ?? 0] as const)
  );

  let likedPostIds = new Set<string>();
  let sharedPostIds = new Set<string>();
  if (authUser?.userId && postIds.length > 0) {
    await asUser(authUser, async (dbClient) => {
      const uid = authUser.userId;
      const [likes, userShares] = await Promise.all([
        dbClient
          .select({ postId: reactions.postId })
          .from(reactions)
          .where(
            and(
              inArray(reactions.postId, postIds),
              eq(reactions.userId, uid),
              eq(reactions.type, 'like')
            )
          ),
        dbClient
          .select({ postId: shares.postId })
          .from(shares)
          .where(and(inArray(shares.postId, postIds), eq(shares.userId, uid))),
      ]);
      likedPostIds = new Set(
        likes
          .map((l) => l.postId)
          .filter((id): id is string => id !== null && id !== undefined)
      );
      sharedPostIds = new Set(userShares.map((s) => s.postId));
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
