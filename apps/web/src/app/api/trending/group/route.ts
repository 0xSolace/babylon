export const dynamic = 'force-dynamic';

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
  type AuthenticatedUser,
  optionalAuth,
  withErrorHandling,
} from '@babylon/api';
import { asPublic, asUser, type DbClient } from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Types for raw query results
interface PostTagRow {
  postId: string;
  tagId: string;
  createdAt: Date;
  post_id: string;
  post_content: string;
  post_authorId: string;
  post_timestamp: Date;
  post_type: string;
  post_articleTitle: string | null;
  post_byline: string | null;
  post_biasScore: number | null;
  post_category: string | null;
  post_deletedAt: Date | null;
}

interface CountRow {
  postId: string;
  count: number | string;
}

export const GET = withErrorHandling(async (request: NextRequest) => {
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

  // Optional auth for RLS
  const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(
    () => null
  );

  // Helper function to execute DB operations
  const executeDbOperation = async <T>(
    operation: (db: DbClient) => Promise<T>
  ): Promise<T> => {
    if (authUser && authUser.userId) {
      return asUser(authUser, operation);
    }
    return asPublic(operation);
  };

  // Get tag information by slug (name)
  const tagsList = await executeDbOperation(async (db) => {
    return db.tag.findMany({
      where: { name: { in: tagSlugs } },
    });
  });

  // Extract tag IDs for the post lookup
  const tagIds = tagsList.map((t) => t.id);

  if (tagIds.length === 0) {
    return NextResponse.json({
      success: true,
      posts: [],
      tags: [],
    });
  }

  // Get posts that have any of these tags using raw SQL with JOIN
  // Filter out deleted posts to match what users can actually see
  const postTagRelations = await executeDbOperation(async (db) => {
    const tagPlaceholders = tagIds.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      SELECT 
        pt."postId", 
        pt."tagId", 
        pt."createdAt",
        p."id" as "post_id",
        p."content" as "post_content",
        p."authorId" as "post_authorId",
        p."timestamp" as "post_timestamp",
        p."type" as "post_type",
        p."articleTitle" as "post_articleTitle",
        p."byline" as "post_byline",
        p."biasScore" as "post_biasScore",
        p."category" as "post_category",
        p."deletedAt" as "post_deletedAt"
      FROM "PostTag" pt
      INNER JOIN "Post" p ON pt."postId" = p."id"
      WHERE pt."tagId" IN (${tagPlaceholders})
        AND p."deletedAt" IS NULL
      ORDER BY pt."createdAt" DESC
      LIMIT ${limit * 2}
    `;
    return db.query<PostTagRow>(sql, tagIds);
  });

  // Deduplicate posts (same post might have multiple tags from the group)
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

  // Get interaction counts for posts
  const postIds = uniquePosts.map((pt) => pt.postId);

  // Get user info for authors
  const authorIds = [
    ...new Set(uniquePosts.map((pt) => pt.post_authorId)),
  ].filter(Boolean);

  const usersList =
    authorIds.length > 0
      ? await executeDbOperation(async (db) => {
          return db.user.findMany({
            where: { id: { in: authorIds } },
          });
        })
      : [];

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

  // Get interaction counts using raw SQL
  const [likeCounts, commentCounts, shareCounts] =
    postIds.length > 0
      ? await executeDbOperation(async (db) => {
          const postPlaceholders = postIds
            .map((_, i) => `$${i + 1}`)
            .join(', ');

          const [likes, comments, shares] = await Promise.all([
            db.query<CountRow>(
              `SELECT "postId", COUNT(*) as count FROM "Reaction" WHERE "postId" IN (${postPlaceholders}) GROUP BY "postId"`,
              postIds
            ),
            db.query<CountRow>(
              `SELECT "postId", COUNT(*) as count FROM "Comment" WHERE "postId" IN (${postPlaceholders}) GROUP BY "postId"`,
              postIds
            ),
            db.query<CountRow>(
              `SELECT "postId", COUNT(*) as count FROM "Share" WHERE "postId" IN (${postPlaceholders}) GROUP BY "postId"`,
              postIds
            ),
          ]);

          return [likes, comments, shares];
        })
      : [[], [], []];

  const likeMap = new Map(
    likeCounts.map((lc) => [lc.postId, Number(lc.count) || 0])
  );
  const commentMap = new Map(
    commentCounts.map((cc) => [cc.postId, Number(cc.count) || 0])
  );
  const shareMap = new Map(
    shareCounts.map((sc) => [sc.postId, Number(sc.count) || 0])
  );

  // Format posts
  const formattedPosts = uniquePosts.map((pt) => {
    const user = userMap.get(pt.post_authorId);
    const actor = actorMap.get(pt.post_authorId);
    const org = orgMap.get(pt.post_authorId);

    let authorName = pt.post_authorId;
    let authorUsername: string | null = null;

    if (user) {
      authorName = user.displayName || user.username || pt.post_authorId;
      authorUsername = user.username;
    } else if (actor) {
      authorName = actor.name;
    } else if (org) {
      authorName = org.name || pt.post_authorId;
    }

    return {
      id: pt.post_id,
      content: pt.post_content,
      authorId: pt.post_authorId,
      authorName,
      authorUsername,
      timestamp: new Date(pt.post_timestamp).toISOString(),
      likeCount: likeMap.get(pt.post_id) || 0,
      commentCount: commentMap.get(pt.post_id) || 0,
      shareCount: shareMap.get(pt.post_id) || 0,
      type: pt.post_type,
      articleTitle: pt.post_articleTitle,
      byline: pt.post_byline,
      biasScore: pt.post_biasScore,
      category: pt.post_category,
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

  return NextResponse.json({
    success: true,
    posts: formattedPosts,
    tags: tagsList.map((t) => ({
      id: t.id,
      name: t.name,
      displayName: t.displayName,
      category: t.category,
    })),
  });
});
