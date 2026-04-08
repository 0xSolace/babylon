/**
 * SQL for agent plugin CHECK_POST_DETAIL / CHECK_COMMENT_DETAIL actions.
 */

import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { shares } from './tables/shares';
import { users } from './tables/user';

type PostDetailDb = DrizzleClient | Transaction;

export type AgentPostDetailPostRow = {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorProfileImageUrl: string | null;
};

export async function selectPostWithAuthorForAgentDetail(
  db: PostDetailDb,
  postId: string
): Promise<AgentPostDetailPostRow | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      createdAt: posts.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorProfileImageUrl: users.profileImageUrl,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export type AgentPostDetailCommentRow = {
  id: string;
  content: string;
  authorId: string;
  parentCommentId: string | null;
  createdAt: Date;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorProfileImageUrl: string | null;
};

export async function selectCommentsForPostDetailWithAuthors(
  db: PostDetailDb,
  postId: string
): Promise<AgentPostDetailCommentRow[]> {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorProfileImageUrl: users.profileImageUrl,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
    .orderBy(desc(comments.createdAt));
}

export async function countSharesByPostId(
  db: PostDetailDb,
  postId: string
): Promise<number> {
  const [shareResult] = await db
    .select({ count: count() })
    .from(shares)
    .where(eq(shares.postId, postId));
  return Number(shareResult?.count ?? 0);
}

export type AgentCommentTargetRow = {
  id: string;
  content: string;
  authorId: string;
  parentCommentId: string | null;
  postId: string;
  createdAt: Date;
  authorUsername: string | null;
  authorDisplayName: string | null;
};

export async function selectCommentWithAuthorById(
  db: PostDetailDb,
  commentId: string
): Promise<AgentCommentTargetRow | undefined> {
  const [row] = await db
    .select({
      id: comments.id,
      content: comments.content,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      postId: comments.postId,
      createdAt: comments.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1);
  return row;
}

export type AgentCommentContextPostRow = {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
};

export async function selectPostWithAuthorByIdForCommentContext(
  db: PostDetailDb,
  postId: string
): Promise<AgentCommentContextPostRow | undefined> {
  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
}

export type AgentCommentThreadMapRow = {
  id: string;
  content: string;
  authorId: string;
  parentCommentId: string | null;
  createdAt: Date;
  authorUsername: string | null;
  authorDisplayName: string | null;
};

export async function selectCommentsOnPostForThreadMap(
  db: PostDetailDb,
  postId: string
): Promise<AgentCommentThreadMapRow[]> {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)));
}
