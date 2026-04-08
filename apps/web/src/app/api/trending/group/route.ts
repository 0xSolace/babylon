/**
 * Grouped Trending API
 *
 * @route GET /api/trending/group - Get posts for multiple trending tags
 * @access Public
 *
 * @description
 * Returns posts for a group of trending tags. Used when displaying grouped
 * trends (e.g., "OpenAGI" + "Sam Altman" as one trending topic).
 *
 * @openapi
 * /api/trending/group:
 *   get:
 *     tags:
 *       - Trending
 *     summary: Get posts for grouped trending tags
 *     description: Returns posts that match any of the provided tag slugs
 *     parameters:
 *       - in: query
 *         name: tags
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated tag slugs (e.g., "openagi,sam-altman")
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of posts to return
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       category:
 *                         type: string
 *       400:
 *         description: Invalid parameters
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/trending/group?tags=openagi,sam-altman');
 * const { posts, tags } = await response.json();
 * ```
 */

import {
  addPublicReadHeaders,
  publicRateLimit,
  withErrorHandling,
} from '@babylon/api';
import {
  selectPostCommentCountsGroupedByPostIds,
  selectPostReactionCountsGroupedByPostIds,
  selectPostShareCountsGroupedByPostIds,
  selectPostTagsWithPostsForTagIdsOrderCreatedDescLimit,
  selectTagsByNames,
  selectTrendingGroupAuthorRowsByIds,
} from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const {
    error,
    user: authUser,
    rateLimitInfo,
  } = await publicRateLimit(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const tagsParam = searchParams.get('tags');
  const limitParam = searchParams.get('limit');

  if (!tagsParam) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: tags' },
      { status: 400 }
    );
  }

  const tagSlugs = tagsParam
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => slug.length > 0);

  if (tagSlugs.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid tags parameter' },
      { status: 400 }
    );
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

  logger.info(
    'Fetching grouped trending posts',
    { tagSlugs, limit },
    'GET /api/trending/group'
  );

  const tagsList = await runWithOptionalUserRls(authUser, async (db) =>
    selectTagsByNames(db, tagSlugs)
  );

  const tagIds = tagsList.map((t) => t.id);

  if (tagIds.length === 0) {
    return NextResponse.json({
      success: true,
      posts: [],
      tags: [],
    });
  }

  const postTagRelations = await runWithOptionalUserRls(authUser, async (db) =>
    selectPostTagsWithPostsForTagIdsOrderCreatedDescLimit(db, {
      tagIds,
      limit: limit * 2,
    })
  );

  const seenPostIds = new Set<string>();
  const uniquePosts = postTagRelations
    .filter((pt) => {
      if (seenPostIds.has(pt.postId)) {
        return false;
      }
      seenPostIds.add(pt.postId);
      return true;
    })
    .slice(0, limit);

  const postIds = uniquePosts.map((pt) => pt.postId);

  const authorIds = [...new Set(uniquePosts.map((pt) => pt.post.authorId))];
  const usersList = await runWithOptionalUserRls(authUser, async (db) =>
    selectTrendingGroupAuthorRowsByIds(db, authorIds)
  );

  const userMap = new Map(usersList.map((u) => [u.id, u]));
  const actorMap = new Map(
    authorIds
      .map((id) => StaticDataRegistry.getActor(id))
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .map((a) => [a.id, { id: a.id, name: a.name }])
  );
  const orgMap = new Map(
    authorIds
      .map((id) => StaticDataRegistry.getOrganization(id))
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .map((o) => [o.id, { id: o.id, name: o.name }])
  );

  const [likeCounts, commentCounts, shareCounts] =
    postIds.length > 0
      ? await runWithOptionalUserRls(authUser, async (db) =>
          Promise.all([
            selectPostReactionCountsGroupedByPostIds(db, postIds),
            selectPostCommentCountsGroupedByPostIds(db, postIds),
            selectPostShareCountsGroupedByPostIds(db, postIds),
          ])
        )
      : [[], [], []];

  const likeMap = new Map(
    likeCounts
      .filter((lc) => lc.postId != null)
      .map((lc) => [lc.postId as string, lc.count])
  );
  const commentMap = new Map(
    commentCounts
      .filter((cc) => cc.postId != null)
      .map((cc) => [cc.postId as string, cc.count])
  );
  const shareMap = new Map(
    shareCounts
      .filter((sc) => sc.postId != null)
      .map((sc) => [sc.postId as string, sc.count])
  );

  const formattedPosts = uniquePosts.map((pt) => {
    const user = userMap.get(pt.post.authorId);
    const actor = actorMap.get(pt.post.authorId);
    const org = orgMap.get(pt.post.authorId);

    let authorName = pt.post.authorId;
    let authorUsername: string | null = null;

    if (user) {
      authorName = user.displayName || user.username || pt.post.authorId;
      authorUsername = user.username;
    } else if (actor) {
      authorName = actor.name;
    } else if (org) {
      authorName = org.name || pt.post.authorId;
    }

    return {
      id: pt.post.id,
      content: pt.post.content,
      authorId: pt.post.authorId,
      authorName,
      authorUsername,
      timestamp: toISO(pt.post.timestamp),
      likeCount: likeMap.get(pt.post.id) || 0,
      commentCount: commentMap.get(pt.post.id) || 0,
      shareCount: shareMap.get(pt.post.id) || 0,
      type: pt.post.type,
      articleTitle: pt.post.articleTitle,
      byline: pt.post.byline,
      biasScore: pt.post.biasScore,
      category: pt.post.category,
    };
  });

  logger.info(
    'Grouped trending posts retrieved',
    {
      tagCount: tagsList.length,
      postCount: formattedPosts.length,
    },
    'GET /api/trending/group'
  );

  const res = NextResponse.json({
    success: true,
    posts: formattedPosts,
    tags: tagsList,
  });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
