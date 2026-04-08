/**
 * SQL for `apps/web` POST/DELETE /api/comments/[id]/like.
 */

import { and, count, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { reactions } from './tables/reactions';

type LikeDb = DrizzleClient | Transaction;

export async function selectCommentIdAuthorIdPostIdById(
  db: LikeDb,
  commentId: string
): Promise<{ id: string; authorId: string; postId: string } | undefined> {
  const [row] = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      postId: comments.postId,
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export async function selectCommentLikeReactionIdForUser(
  db: LikeDb,
  params: { commentId: string; userId: string }
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.commentId, params.commentId),
        eq(reactions.userId, params.userId),
        eq(reactions.type, 'like')
      )
    )
    .limit(1);
  return row;
}

export async function insertCommentLikeReactionReturning(
  db: LikeDb,
  params: { id: string; commentId: string; userId: string }
): Promise<{ id: string; createdAt: Date } | undefined> {
  const [row] = await db
    .insert(reactions)
    .values({
      id: params.id,
      commentId: params.commentId,
      userId: params.userId,
      type: 'like',
    })
    .returning({
      id: reactions.id,
      createdAt: reactions.createdAt,
    });
  return row;
}

export async function countLikesOnComment(
  db: LikeDb,
  commentId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(reactions)
    .where(and(eq(reactions.commentId, commentId), eq(reactions.type, 'like')));
  return Number(row?.c ?? 0);
}

export async function deleteReactionById(
  db: LikeDb,
  reactionId: string
): Promise<void> {
  await db.delete(reactions).where(eq(reactions.id, reactionId));
}
