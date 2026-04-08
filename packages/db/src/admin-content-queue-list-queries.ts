/**
 * SQL for GET /api/admin/content-queue (reported posts/comments + aggregate stats).
 */

import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { reports } from './tables/reports';
import { users } from './tables/user';

type ContentQueueListDb = DrizzleClient | Transaction;

export type AdminContentQueueStatsSlice = {
  pending: number;
  deleted: number;
};

export type AdminContentQueueReportedPostRow = {
  id: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  authorId: string;
  imageUrl: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorProfileImage: string | null;
  authorIsActor: boolean;
  reportCount: number;
};

export type AdminContentQueueReportedCommentRow = {
  id: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  postId: string;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorProfileImage: string | null;
  authorIsActor: boolean;
  reportCount: number;
};

export async function fetchAdminContentQueueBundle(
  db: ContentQueueListDb,
  params: {
    contentType: 'all' | 'posts' | 'comments';
    status: 'pending' | 'resolved';
    limit: number;
    offset: number;
  }
): Promise<{
  reportedPosts: AdminContentQueueReportedPostRow[];
  reportedComments: AdminContentQueueReportedCommentRow[];
  postStats: AdminContentQueueStatsSlice | undefined;
  commentStats: AdminContentQueueStatsSlice | undefined;
}> {
  const { contentType, status, limit, offset } = params;

  const reportedPostRows: AdminContentQueueReportedPostRow[] =
    contentType === 'comments'
      ? []
      : await selectReportedPostsForContentQueueAdmin(
          db,
          status,
          limit,
          offset
        );

  const reportedCommentRows: AdminContentQueueReportedCommentRow[] =
    contentType === 'posts'
      ? []
      : await selectReportedCommentsForContentQueueAdmin(
          db,
          status,
          limit,
          offset
        );

  const [postStatsRow] = await db
    .select({
      pending: sql<number>`COUNT(DISTINCT ${posts.id}) FILTER (WHERE ${posts.deletedAt} IS NULL)`,
      deleted: sql<number>`COUNT(DISTINCT ${posts.id}) FILTER (WHERE ${posts.deletedAt} IS NOT NULL)`,
    })
    .from(posts)
    .innerJoin(
      reports,
      and(eq(reports.reportedPostId, posts.id), eq(reports.status, 'pending'))
    );

  const [commentStatsRow] = await db
    .select({
      pending: sql<number>`COUNT(DISTINCT ${comments.id}) FILTER (WHERE ${comments.deletedAt} IS NULL)`,
      deleted: sql<number>`COUNT(DISTINCT ${comments.id}) FILTER (WHERE ${comments.deletedAt} IS NOT NULL)`,
    })
    .from(comments)
    .innerJoin(
      reports,
      and(
        eq(reports.reportedCommentId, comments.id),
        eq(reports.status, 'pending')
      )
    );

  return {
    reportedPosts: reportedPostRows,
    reportedComments: reportedCommentRows,
    postStats: postStatsRow
      ? {
          pending: Number(postStatsRow.pending ?? 0),
          deleted: Number(postStatsRow.deleted ?? 0),
        }
      : undefined,
    commentStats: commentStatsRow
      ? {
          pending: Number(commentStatsRow.pending ?? 0),
          deleted: Number(commentStatsRow.deleted ?? 0),
        }
      : undefined,
  };
}

async function selectReportedPostsForContentQueueAdmin(
  db: ContentQueueListDb,
  status: 'pending' | 'resolved',
  limit: number,
  offset: number
): Promise<AdminContentQueueReportedPostRow[]> {
  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      deletedAt: posts.deletedAt,
      authorId: posts.authorId,
      imageUrl: posts.imageUrl,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
      authorIsActor: users.isActor,
      reportCount: count(reports.id),
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(
      reports,
      and(eq(reports.reportedPostId, posts.id), eq(reports.status, status))
    )
    .where(status === 'pending' ? isNull(posts.deletedAt) : undefined)
    .groupBy(
      posts.id,
      posts.content,
      posts.createdAt,
      posts.deletedAt,
      posts.authorId,
      posts.imageUrl,
      users.username,
      users.displayName,
      users.profileImageUrl,
      users.isActor
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    reportCount: Number(r.reportCount),
  }));
}

async function selectReportedCommentsForContentQueueAdmin(
  db: ContentQueueListDb,
  status: 'pending' | 'resolved',
  limit: number,
  offset: number
): Promise<AdminContentQueueReportedCommentRow[]> {
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      postId: comments.postId,
      authorId: comments.authorId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
      authorIsActor: users.isActor,
      reportCount: count(reports.id),
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(
      reports,
      and(
        eq(reports.reportedCommentId, comments.id),
        eq(reports.status, status)
      )
    )
    .where(status === 'pending' ? isNull(comments.deletedAt) : undefined)
    .groupBy(
      comments.id,
      comments.content,
      comments.createdAt,
      comments.deletedAt,
      comments.postId,
      comments.authorId,
      users.username,
      users.displayName,
      users.profileImageUrl,
      users.isActor
    )
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    reportCount: Number(r.reportCount),
  }));
}
