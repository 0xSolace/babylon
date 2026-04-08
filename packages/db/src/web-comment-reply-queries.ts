/**
 * SQL for `apps/web` POST /api/comments/[id]/replies.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Comment, NewComment } from './tables/comments';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { users } from './tables/user';

type ReplyDb = DrizzleClient | Transaction;

export async function selectCommentRowById(
  db: ReplyDb,
  commentId: string
): Promise<Comment | undefined> {
  const [row] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export async function insertGameGeneratedPostStubIfNotExists(
  db: ReplyDb,
  params: {
    postId: string;
    authorId: string;
    gameId: string;
    timestamp: Date;
  }
): Promise<void> {
  const [existing] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, params.postId))
    .limit(1);
  if (existing) return;
  await db.insert(posts).values({
    id: params.postId,
    content: '[Game-generated post]',
    authorId: params.authorId,
    gameId: params.gameId,
    timestamp: params.timestamp,
    createdAt: new Date(),
  });
}

export async function insertCommentReturning(
  db: ReplyDb,
  row: NewComment
): Promise<Comment | undefined> {
  const [created] = await db.insert(comments).values(row).returning();
  return created;
}

export type CommentReplyAuthorSlice = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
};

export async function selectCommentReplyAuthorSliceByUserId(
  db: ReplyDb,
  userId: string
): Promise<CommentReplyAuthorSlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}
