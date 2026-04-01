/**
 * Shared Engagement Count Cache
 *
 * Provides a single cached source for post engagement counts (likes, comments,
 * shares) used across all feed pipelines. Eliminates the duplicated 3-CTE
 * engagement query that was previously copy-pasted in for-you, stories,
 * narrative, and hot feed endpoints.
 *
 * Uses getCacheBatchOrFetch for efficient batch Redis MGET + single DB query
 * for cache misses. TTL is 120s — longer than individual feed cache TTLs so
 * feeds can read from this cache without triggering their own CTE queries.
 */

import { db, sql } from '@babylon/db';
import { logger } from '@babylon/shared';
import { getCacheBatchOrFetch, invalidateCache } from './cache-service';

export interface EngagementCounts {
  likes: number;
  comments: number;
  shares: number;
}

const ENGAGEMENT_NAMESPACE = 'post:engagement';
const ENGAGEMENT_TTL = 120; // 2 minutes — longer than feed TTLs

/**
 * Batch-fetch engagement counts for a set of post IDs.
 *
 * Uses getCacheBatchOrFetch: MGET for cached entries, single CTE query for
 * misses. All feed pipelines should call this instead of running their own CTEs.
 *
 * Returns three separate Maps (reactionMap, commentMap, shareMap) to match
 * the existing interface that all feed pipelines expect.
 */
export async function getEngagementCounts(postIds: string[]): Promise<{
  reactionMap: Map<string, number>;
  commentMap: Map<string, number>;
  shareMap: Map<string, number>;
}> {
  if (postIds.length === 0) {
    return {
      reactionMap: new Map(),
      commentMap: new Map(),
      shareMap: new Map(),
    };
  }

  const engagementMap = await getCacheBatchOrFetch<EngagementCounts>(
    postIds,
    async (missingIds) => {
      const postIdsArray = sql`ARRAY[${sql.join(
        missingIds.map((id) => sql`${id}`),
        sql`, `
      )}]::text[]`;

      const rows = await db.execute(sql`
        WITH
        target_posts AS (
          SELECT unnest(${postIdsArray}) AS post_id
        ),
        reaction_counts AS (
          SELECT r."postId" AS post_id, COUNT(*) AS count
          FROM "Reaction" r
          INNER JOIN target_posts tp ON r."postId" = tp.post_id
          WHERE r.type = 'like'
          GROUP BY r."postId"
        ),
        comment_counts AS (
          SELECT c."postId" AS post_id, COUNT(*) AS count
          FROM "Comment" c
          INNER JOIN target_posts tp ON c."postId" = tp.post_id
          WHERE c."deletedAt" IS NULL
          GROUP BY c."postId"
        ),
        share_counts AS (
          SELECT s."postId" AS post_id, COUNT(*) AS count
          FROM "Share" s
          INNER JOIN target_posts tp ON s."postId" = tp.post_id
          GROUP BY s."postId"
        )
        SELECT
          tp.post_id,
          COALESCE(rc.count, 0) AS like_count,
          COALESCE(cc.count, 0) AS comment_count,
          COALESCE(sc.count, 0) AS share_count
        FROM target_posts tp
        LEFT JOIN reaction_counts rc ON tp.post_id = rc.post_id
        LEFT JOIN comment_counts cc ON tp.post_id = cc.post_id
        LEFT JOIN share_counts sc ON tp.post_id = sc.post_id
      `);

      const result = new Map<string, EngagementCounts>();
      for (const row of Array.isArray(rows)
        ? (rows as Record<string, unknown>[])
        : []) {
        const postId = String(row['post_id'] ?? '');
        if (!postId) continue;
        result.set(postId, {
          likes: Number(row['like_count'] ?? 0),
          comments: Number(row['comment_count'] ?? 0),
          shares: Number(row['share_count'] ?? 0),
        });
      }
      return result;
    },
    { namespace: ENGAGEMENT_NAMESPACE, ttl: ENGAGEMENT_TTL }
  );

  // Decompose into the three separate maps that all feed pipelines expect
  const reactionMap = new Map<string, number>();
  const commentMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  for (const [id, counts] of engagementMap) {
    reactionMap.set(id, counts.likes);
    commentMap.set(id, counts.comments);
    shareMap.set(id, counts.shares);
  }

  return { reactionMap, commentMap, shareMap };
}

/**
 * Invalidate engagement counts for specific posts.
 * Call from like/unlike, comment, and share handlers.
 * Uses exact key deletion (O(1)), not pattern SCAN.
 */
export async function invalidateEngagementCounts(
  postIds: string[]
): Promise<void> {
  if (postIds.length === 0) return;

  await Promise.all(
    postIds.map((id) =>
      invalidateCache(id, { namespace: ENGAGEMENT_NAMESPACE })
    )
  );

  logger.debug('Engagement counts invalidated', { postIds }, 'EngagementCache');
}
