/**
 * SQL for `apps/web` GET/PATCH/DELETE /api/comments/[id] (thread, post context, edit, cascade delete).
 */

import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Comment } from './tables/comments';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';
import type { CommentReplyAuthorSlice } from './web-comment-reply-queries';

type CommentDetailDb = DrizzleClient | Transaction;

export type PostCoreSlice = {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
};

export type CommentParentChainRow = {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
  parentCommentId: string | null;
};

export async function selectPostCoreById(
  db: CommentDetailDb,
  postId: string
): Promise<PostCoreSlice | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function countPostLikes(
  db: CommentDetailDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(reactions)
    .where(and(eq(reactions.postId, postId), eq(reactions.type, 'like')));
  return Number(row?.c ?? 0);
}

export async function countCommentsOnPost(
  db: CommentDetailDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(comments)
    .where(eq(comments.postId, postId));
  return Number(row?.c ?? 0);
}

export async function countSharesOnPost(
  db: CommentDetailDb,
  postId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(shares)
    .where(eq(shares.postId, postId));
  return Number(row?.c ?? 0);
}

export async function selectUserPostLikeExists(
  db: CommentDetailDb,
  params: { postId: string; userId: string }
): Promise<boolean> {
  const [row] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.postId, params.postId),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    )
    .limit(1);
  return !!row;
}

export async function selectUserPostShareExists(
  db: CommentDetailDb,
  params: { postId: string; userId: string }
): Promise<boolean> {
  const [row] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(eq(shares.postId, params.postId), eq(shares.userId, params.userId))
    )
    .limit(1);
  return !!row;
}

export async function selectDirectChildCommentsOrderCreatedAsc(
  db: CommentDetailDb,
  parentCommentId: string
): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(eq(comments.parentCommentId, parentCommentId))
    .orderBy(asc(comments.createdAt));
}

export async function selectUsersAuthorDisplayByIds(
  db: CommentDetailDb,
  userIds: string[]
): Promise<CommentReplyAuthorSlice[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export async function selectGroupedCommentLikeCountsForCommentIds(
  db: CommentDetailDb,
  commentIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (commentIds.length === 0) return map;
  const rows = await db
    .select({
      commentId: reactions.commentId,
      c: count(),
    })
    .from(reactions)
    .where(
      and(inArray(reactions.commentId, commentIds), eq(reactions.type, 'like'))
    )
    .groupBy(reactions.commentId);
  for (const row of rows) {
    if (row.commentId !== null) {
      map.set(row.commentId, Number(row.c));
    }
  }
  return map;
}

export async function selectCommentIdsInListLikedByUser(
  db: CommentDetailDb,
  params: { commentIds: string[]; userId: string }
): Promise<Set<string>> {
  if (params.commentIds.length === 0) return new Set();
  const rows = await db
    .select({ commentId: reactions.commentId })
    .from(reactions)
    .where(
      and(
        inArray(reactions.commentId, params.commentIds),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    );
  return new Set(
    rows.map((r) => r.commentId).filter((id): id is string => id !== null)
  );
}

/**
 * Walks from `startFromCommentId` upward via `parentCommentId` (immediate parent first step).
 * Returns oldest → newest (root first), same order as legacy `getParentChain`.
 */
export async function selectCommentAncestorChainOldestFirst(
  db: CommentDetailDb,
  params: { startFromCommentId: string; maxDepth: number }
): Promise<CommentParentChainRow[]> {
  const parents: CommentParentChainRow[] = [];
  let currentId: string | null = params.startFromCommentId;
  let depth = 0;

  while (currentId && depth < params.maxDepth) {
    const [parent] = await db
      .select({
        id: comments.id,
        content: comments.content,
        authorId: comments.authorId,
        createdAt: comments.createdAt,
        parentCommentId: comments.parentCommentId,
      })
      .from(comments)
      .where(eq(comments.id, currentId))
      .limit(1);

    if (!parent) break;

    parents.unshift(parent);
    currentId = parent.parentCommentId;
    depth++;
  }

  return parents;
}

/**
 * Per-root BFS count of descendant comments, capped at `maxReplyCount` per root (matches legacy).
 */
export async function countReplySubtreesBfsCappedPerRoot(
  db: CommentDetailDb,
  params: { rootCommentIds: string[]; maxReplyCount: number }
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();
  for (const id of params.rootCommentIds) {
    countMap.set(id, 0);
  }

  for (const rootId of params.rootCommentIds) {
    let replyTotal = 0;
    let currentLevel = [rootId];

    while (currentLevel.length > 0 && replyTotal < params.maxReplyCount) {
      const replies = await db
        .select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.parentCommentId, currentLevel));

      replyTotal += replies.length;

      if (replyTotal >= params.maxReplyCount) {
        replyTotal = params.maxReplyCount;
        break;
      }

      currentLevel = replies.map((r) => r.id);
    }

    countMap.set(rootId, replyTotal);
  }

  return countMap;
}

export async function updateCommentContentByIdReturning(
  db: CommentDetailDb,
  params: { commentId: string; content: string; updatedAt: Date }
): Promise<Comment | undefined> {
  const [row] = await db
    .update(comments)
    .set({
      content: params.content,
      updatedAt: params.updatedAt,
    })
    .where(eq(comments.id, params.commentId))
    .returning();
  return row;
}

export async function countDirectChildCommentsByParentId(
  db: CommentDetailDb,
  parentCommentId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(comments)
    .where(eq(comments.parentCommentId, parentCommentId));
  return Number(row?.c ?? 0);
}

export async function selectDirectChildCommentIdsByParentId(
  db: CommentDetailDb,
  parentCommentId: string
): Promise<string[]> {
  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentCommentId, parentCommentId));
  return rows.map((r) => r.id);
}

export async function deleteReactionsForCommentIds(
  db: CommentDetailDb,
  commentIds: string[]
): Promise<void> {
  if (commentIds.length === 0) return;
  await db.delete(reactions).where(inArray(reactions.commentId, commentIds));
}

export async function deleteCommentsWithParentCommentId(
  db: CommentDetailDb,
  parentCommentId: string
): Promise<void> {
  await db
    .delete(comments)
    .where(eq(comments.parentCommentId, parentCommentId));
}

export async function deleteReactionsForCommentId(
  db: CommentDetailDb,
  commentId: string
): Promise<void> {
  await db.delete(reactions).where(eq(reactions.commentId, commentId));
}

export async function deleteCommentById(
  db: CommentDetailDb,
  commentId: string
): Promise<void> {
  await db.delete(comments).where(eq(comments.id, commentId));
}
