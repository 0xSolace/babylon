/**
 * SQL for POST /api/admin/content-queue/[contentId] (approve / hide flagged content).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { posts } from './tables/posts';
import { reports } from './tables/reports';

type ContentQueueDb = DrizzleClient | Transaction;

export async function selectAdminContentQueuePostLookup(
  db: ContentQueueDb,
  contentId: string
): Promise<{ id: string; deletedAt: Date | null } | undefined> {
  const [row] = await db
    .select({ id: posts.id, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, contentId))
    .limit(1);
  return row;
}

export async function dismissReportsForReportedPostAdmin(
  db: ContentQueueDb,
  params: {
    contentId: string;
    adminId: string;
    resolution: string;
    now: Date;
  }
): Promise<void> {
  const { contentId, adminId, resolution, now } = params;
  await db
    .update(reports)
    .set({
      status: 'dismissed',
      resolution,
      resolvedBy: adminId,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.reportedPostId, contentId));
}

export async function softDeletePostAndResolveReportsAdmin(
  db: ContentQueueDb,
  params: {
    contentId: string;
    adminId: string;
    resolution: string;
    now: Date;
  }
): Promise<void> {
  const { contentId, adminId, resolution, now } = params;
  await db.update(posts).set({ deletedAt: now }).where(eq(posts.id, contentId));

  await db
    .update(reports)
    .set({
      status: 'resolved',
      resolution,
      resolvedBy: adminId,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.reportedPostId, contentId));
}

export async function selectAdminContentQueueCommentLookup(
  db: ContentQueueDb,
  contentId: string
): Promise<
  | {
      id: string;
      deletedAt: Date | null;
      postId: string;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: comments.id,
      deletedAt: comments.deletedAt,
      postId: comments.postId,
    })
    .from(comments)
    .where(eq(comments.id, contentId))
    .limit(1);
  return row;
}

export async function dismissReportsForReportedCommentAdmin(
  db: ContentQueueDb,
  params: {
    contentId: string;
    adminId: string;
    resolution: string;
    now: Date;
  }
): Promise<void> {
  const { contentId, adminId, resolution, now } = params;
  await db
    .update(reports)
    .set({
      status: 'dismissed',
      resolution,
      resolvedBy: adminId,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.reportedCommentId, contentId));
}

export async function softDeleteCommentAndResolveReportsAdmin(
  db: ContentQueueDb,
  params: {
    contentId: string;
    adminId: string;
    resolution: string;
    now: Date;
  }
): Promise<void> {
  const { contentId, adminId, resolution, now } = params;
  await db
    .update(comments)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(comments.id, contentId));

  await db
    .update(reports)
    .set({
      status: 'resolved',
      resolution,
      resolvedBy: adminId,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.reportedCommentId, contentId));
}
