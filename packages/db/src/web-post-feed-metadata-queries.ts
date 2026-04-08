/**
 * Consolidated CTE for post interaction counts + top comment previews (`GET /api/posts`).
 */

import { sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';

export type PostFeedCommentPreviewRow = {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  authorId: string;
  userName: string | null;
  userUsername: string | null;
  userAvatar: string | null;
  likeCount: number;
  rowNum: number;
};

/**
 * Fetch reaction/comment/share counts and ranked comment previews for many posts in one round trip.
 */
export async function fetchPostFeedMetadataConsolidated(
  client: DrizzleClient,
  postIds: string[]
): Promise<{
  reactionMap: Map<string, number>;
  commentMap: Map<string, number>;
  shareMap: Map<string, number>;
  commentPreviewMap: Map<string, PostFeedCommentPreviewRow[]>;
}> {
  if (postIds.length === 0) {
    return {
      reactionMap: new Map(),
      commentMap: new Map(),
      shareMap: new Map(),
      commentPreviewMap: new Map(),
    };
  }

  const postIdsArray = sql`ARRAY[${sql.join(
    postIds.map((id) => sql`${id}`),
    sql`, `
  )}]::text[]`;

  const result = await client.execute(sql`
    WITH 
    target_posts AS (
      SELECT unnest(${postIdsArray}) AS post_id
    ),
    reaction_counts AS (
      SELECT 
        r."postId" as post_id,
        COUNT(*) as count
      FROM "Reaction" r
      INNER JOIN target_posts tp ON r."postId" = tp.post_id
      WHERE r.type = 'like'
      GROUP BY r."postId"
    ),
    comment_counts AS (
      SELECT 
        c."postId" as post_id,
        COUNT(*) as count
      FROM "Comment" c
      INNER JOIN target_posts tp ON c."postId" = tp.post_id
      GROUP BY c."postId"
    ),
    share_counts AS (
      SELECT 
        s."postId" as post_id,
        COUNT(*) as count
      FROM "Share" s
      INNER JOIN target_posts tp ON s."postId" = tp.post_id
      GROUP BY s."postId"
    ),
    ranked_comments AS (
      SELECT 
        c.id,
        c."postId" as post_id,
        c.content,
        c."createdAt" as created_at,
        c."authorId" as author_id,
        u."displayName" as user_name,
        u.username as user_username,
        u."profileImageUrl" as user_avatar,
        COALESCE(cl.like_count, 0) as like_count,
        ROW_NUMBER() OVER (
          PARTITION BY c."postId" 
          ORDER BY COALESCE(cl.like_count, 0) DESC, c."createdAt" DESC
        ) as rn
      FROM "Comment" c
      INNER JOIN target_posts tp ON c."postId" = tp.post_id
      LEFT JOIN "User" u ON c."authorId" = u.id
      LEFT JOIN (
        SELECT r."commentId", COUNT(*) as like_count
        FROM "Reaction" r
        INNER JOIN "Comment" c2 ON r."commentId" = c2.id
        INNER JOIN target_posts tp2 ON c2."postId" = tp2.post_id
        WHERE r."commentId" IS NOT NULL AND r.type = 'like'
        GROUP BY r."commentId"
      ) cl ON c.id = cl."commentId"
      WHERE c."parentCommentId" IS NULL
    ),
    post_metadata AS (
      SELECT 
        tp.post_id,
        COALESCE(rc.count, 0) as like_count,
        COALESCE(cc.count, 0) as comment_count,
        COALESCE(sc.count, 0) as share_count
      FROM target_posts tp
      LEFT JOIN reaction_counts rc ON tp.post_id = rc.post_id
      LEFT JOIN comment_counts cc ON tp.post_id = cc.post_id
      LEFT JOIN share_counts sc ON tp.post_id = sc.post_id
    )
    SELECT 
      'metadata' as result_type,
      pm.post_id,
      pm.like_count::int,
      pm.comment_count::int,
      pm.share_count::int,
      NULL as comment_id,
      NULL as comment_content,
      NULL as comment_created_at,
      NULL as comment_author_id,
      NULL as comment_user_name,
      NULL as comment_user_username,
      NULL as comment_user_avatar,
      NULL::int as comment_like_count,
      NULL::int as comment_row_num
    FROM post_metadata pm
    UNION ALL
    SELECT 
      'comment' as result_type,
      rc.post_id,
      0 as like_count,
      0 as comment_count,
      0 as share_count,
      rc.id as comment_id,
      rc.content as comment_content,
      rc.created_at as comment_created_at,
      rc.author_id as comment_author_id,
      rc.user_name as comment_user_name,
      rc.user_username as comment_user_username,
      rc.user_avatar as comment_user_avatar,
      rc.like_count::int as comment_like_count,
      rc.rn::int as comment_row_num
    FROM ranked_comments rc
    WHERE rc.rn <= 3
  `);

  const reactionMap = new Map<string, number>();
  const commentMap = new Map<string, number>();
  const shareMap = new Map<string, number>();
  const commentPreviewMap = new Map<string, PostFeedCommentPreviewRow[]>();

  interface RawResultRow {
    result_type: string;
    post_id: string;
    like_count: number;
    comment_count: number;
    share_count: number;
    comment_id: string | null;
    comment_content: string | null;
    comment_created_at: Date | null;
    comment_author_id: string | null;
    comment_user_name: string | null;
    comment_user_username: string | null;
    comment_user_avatar: string | null;
    comment_like_count: number | null;
    comment_row_num: number | null;
  }

  function isRawResultRow(row: unknown): row is RawResultRow {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return (
      typeof r.result_type === 'string' &&
      typeof r.post_id === 'string' &&
      (r.result_type === 'metadata' || r.result_type === 'comment')
    );
  }

  const rows = Array.isArray(result) ? result : [];
  for (const row of rows) {
    if (!isRawResultRow(row)) continue;
    if (row.result_type === 'metadata') {
      reactionMap.set(row.post_id, Number(row.like_count));
      commentMap.set(row.post_id, Number(row.comment_count));
      shareMap.set(row.post_id, Number(row.share_count));
    } else if (row.result_type === 'comment' && row.comment_id) {
      const previews = commentPreviewMap.get(row.post_id) ?? [];
      previews.push({
        id: row.comment_id,
        postId: row.post_id,
        content: row.comment_content ?? '',
        createdAt: row.comment_created_at ?? new Date(),
        authorId: row.comment_author_id ?? '',
        userName: row.comment_user_name,
        userUsername: row.comment_user_username,
        userAvatar: row.comment_user_avatar,
        likeCount: row.comment_like_count ?? 0,
        rowNum: row.comment_row_num ?? 1,
      });
      commentPreviewMap.set(row.post_id, previews);
    }
  }

  for (const [postId, previews] of commentPreviewMap) {
    previews.sort((a, b) => Number(a.rowNum) - Number(b.rowNum));
    commentPreviewMap.set(postId, previews);
  }

  return { reactionMap, commentMap, shareMap, commentPreviewMap };
}
