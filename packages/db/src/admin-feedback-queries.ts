/**
 * SQL for GET /api/admin/feedback (filtered game feedback list + counts).
 */

import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { feedbacks } from './tables/feedbacks';
import { users } from './tables/user';
import type { JsonValue } from './types';

type FeedbackAdminDb = DrizzleClient | Transaction;

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export type AdminFeedbackListParams = {
  limit: number;
  offset: number;
  /** Caller must validate against allowed enum before passing. */
  feedbackType?: string;
  hasLinearIssue?: 'true' | 'false';
  search?: string;
  fromDate: Date | null;
  toDate: Date | null;
};

export type AdminFeedbackListItemRow = {
  id: string;
  score: number;
  comment: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
  fromUserId: string | null;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    email: string | null;
  } | null;
};

export type AdminFeedbackStatsByTypeRow = {
  feedbackType: string | null;
  count: number;
};

export async function fetchAdminGameFeedbackListBundle(
  db: FeedbackAdminDb,
  params: AdminFeedbackListParams
): Promise<{
  feedbackItems: AdminFeedbackListItemRow[];
  totalCount: number;
  statsByType: AdminFeedbackStatsByTypeRow[];
}> {
  const {
    limit,
    offset,
    feedbackType,
    hasLinearIssue,
    search,
    fromDate,
    toDate,
  } = params;

  const conditions = [eq(feedbacks.interactionType, 'general_game_feedback')];

  if (feedbackType) {
    conditions.push(
      sql`${feedbacks.metadata}->>'feedbackType' = ${feedbackType}`
    );
  }

  if (hasLinearIssue === 'true') {
    conditions.push(sql`${feedbacks.metadata}->>'linearIssueId' IS NOT NULL`);
  } else if (hasLinearIssue === 'false') {
    conditions.push(sql`${feedbacks.metadata}->>'linearIssueId' IS NULL`);
  }

  if (search) {
    conditions.push(ilike(feedbacks.comment, `%${escapeIlike(search)}%`));
  }

  if (fromDate) {
    conditions.push(gte(feedbacks.createdAt, fromDate));
  }

  if (toDate) {
    conditions.push(lte(feedbacks.createdAt, toDate));
  }

  const whereClause = and(...conditions);

  const [feedbackItemsRaw, countResult, statsResult] = await Promise.all([
    db
      .select({
        id: feedbacks.id,
        score: feedbacks.score,
        comment: feedbacks.comment,
        metadata: feedbacks.metadata,
        createdAt: feedbacks.createdAt,
        fromUserId: feedbacks.fromUserId,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
        },
      })
      .from(feedbacks)
      .leftJoin(users, eq(feedbacks.fromUserId, users.id))
      .where(whereClause)
      .orderBy(desc(feedbacks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(feedbacks)
      .where(whereClause),
    db
      .select({
        feedbackType: sql<string>`${feedbacks.metadata}->>'feedbackType'`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(feedbacks)
      .where(eq(feedbacks.interactionType, 'general_game_feedback'))
      .groupBy(sql`${feedbacks.metadata}->>'feedbackType'`),
  ]);

  const feedbackItems: AdminFeedbackListItemRow[] = feedbackItemsRaw.map(
    (row) => ({
      id: row.id,
      score: row.score,
      comment: row.comment,
      metadata: row.metadata,
      createdAt: row.createdAt,
      fromUserId: row.fromUserId,
      user: row.user?.id ? row.user : null,
    })
  );

  return {
    feedbackItems,
    totalCount: countResult[0]?.count ?? 0,
    statsByType: statsResult.map((s) => ({
      feedbackType: s.feedbackType,
      count: s.count,
    })),
  };
}
