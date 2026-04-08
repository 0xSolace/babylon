/**
 * SQL for `apps/web` `posts/[id]/comments` GET + POST.
 */

import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Comment as DbComment } from './tables/comments';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { users } from './tables/user';

type CommentRouteDb = DrizzleClient | Transaction;

export async function listCommentsForPostOrderCreatedAsc(
  db: CommentRouteDb,
  postId: string
): Promise<DbComment[]> {
  return db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));
}

export type CommentAuthorUserSlice = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
};

export async function selectUsersCommentAuthorSlicesByIds(
  db: CommentRouteDb,
  userIds: string[]
): Promise<CommentAuthorUserSlice[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export type CommentLikeCountRow = {
  commentId: string | null;
  count: number;
};

export async function countCommentLikesGroupedByCommentId(
  db: CommentRouteDb,
  commentIds: string[]
): Promise<CommentLikeCountRow[]> {
  if (commentIds.length === 0) return [];
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
  return rows.map((r) => ({
    commentId: r.commentId,
    count: Number(r.c),
  }));
}

export async function selectLikedCommentIdsForUserOnComments(
  db: CommentRouteDb,
  params: { commentIds: string[]; userId: string }
): Promise<string[]> {
  if (params.commentIds.length === 0) return [];
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
  const out: string[] = [];
  for (const r of rows) {
    if (r.commentId) out.push(r.commentId);
  }
  return out;
}

export async function selectPostIdDeletedAtById(
  db: CommentRouteDb,
  postId: string
): Promise<{ id: string; deletedAt: Date | null } | undefined> {
  const [row] = await db
    .select({ id: posts.id, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export async function insertGamePostStubForCommentRoute(
  db: CommentRouteDb,
  params: {
    id: string;
    content: string;
    authorId: string;
    gameId: string;
    timestamp: Date;
  }
): Promise<void> {
  await db.insert(posts).values({
    id: params.id,
    content: params.content,
    authorId: params.authorId,
    gameId: params.gameId,
    timestamp: params.timestamp,
  });
}

export async function selectCommentIdAndPostIdById(
  db: CommentRouteDb,
  commentId: string
): Promise<{ id: string; postId: string } | undefined> {
  const [row] = await db
    .select({ id: comments.id, postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export async function selectUserCommentAuthorSliceById(
  db: CommentRouteDb,
  userId: string
): Promise<CommentAuthorUserSlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectCommentAuthorIdById(
  db: CommentRouteDb,
  commentId: string
): Promise<{ authorId: string } | undefined> {
  const [row] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export type MentionUserRow = { id: string; username: string | null };

export async function selectUsersIdUsernameByUsernames(
  db: CommentRouteDb,
  usernames: string[]
): Promise<MentionUserRow[]> {
  if (usernames.length === 0) return [];
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, usernames));
}
