/**
 * SQL for GET /api/admin/analytics (time-bucketed signup/post/comment/reaction/follow counts).
 */

import { and, count, gte, lte, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { users } from './tables/user';

type AnalyticsDb = DrizzleClient | Transaction;

export type AdminAnalyticsPeriod = 'day' | 'week' | 'month';

export type AdminAnalyticsDateCountRow = {
  date: string;
  count: number;
};

export async function fetchAdminAnalyticsTimeseriesBundle(
  db: AnalyticsDb,
  params: {
    period: AdminAnalyticsPeriod;
    start: Date;
    end: Date;
    maxDataPoints: number;
  }
): Promise<{
  userSignups: AdminAnalyticsDateCountRow[];
  postsCreated: AdminAnalyticsDateCountRow[];
  commentsCreated: AdminAnalyticsDateCountRow[];
  reactionsCreated: AdminAnalyticsDateCountRow[];
  followsCreated: AdminAnalyticsDateCountRow[];
}> {
  const { period, start, end, maxDataPoints } = params;
  const isMonth = period === 'month';

  const [
    userSignups,
    postsCreated,
    commentsCreated,
    reactionsCreated,
    followsCreated,
  ] = await Promise.all([
    db
      .select({
        date: (isMonth
          ? sql<string>`TO_CHAR(DATE_TRUNC('month', ${users.createdAt}), 'YYYY-MM')`
          : sql<string>`DATE(${users.createdAt})`
        ).as('date'),
        count: count(),
      })
      .from(users)
      .where(and(gte(users.createdAt, start), lte(users.createdAt, end)))
      .groupBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${users.createdAt})`
          : sql`DATE(${users.createdAt})`
      )
      .orderBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${users.createdAt})`
          : sql`DATE(${users.createdAt})`
      )
      .limit(maxDataPoints),

    db
      .select({
        date: (isMonth
          ? sql<string>`TO_CHAR(DATE_TRUNC('month', ${posts.createdAt}), 'YYYY-MM')`
          : sql<string>`DATE(${posts.createdAt})`
        ).as('date'),
        count: count(),
      })
      .from(posts)
      .where(and(gte(posts.createdAt, start), lte(posts.createdAt, end)))
      .groupBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${posts.createdAt})`
          : sql`DATE(${posts.createdAt})`
      )
      .orderBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${posts.createdAt})`
          : sql`DATE(${posts.createdAt})`
      )
      .limit(maxDataPoints),

    db
      .select({
        date: (isMonth
          ? sql<string>`TO_CHAR(DATE_TRUNC('month', ${comments.createdAt}), 'YYYY-MM')`
          : sql<string>`DATE(${comments.createdAt})`
        ).as('date'),
        count: count(),
      })
      .from(comments)
      .where(and(gte(comments.createdAt, start), lte(comments.createdAt, end)))
      .groupBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${comments.createdAt})`
          : sql`DATE(${comments.createdAt})`
      )
      .orderBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${comments.createdAt})`
          : sql`DATE(${comments.createdAt})`
      )
      .limit(maxDataPoints),

    db
      .select({
        date: (isMonth
          ? sql<string>`TO_CHAR(DATE_TRUNC('month', ${reactions.createdAt}), 'YYYY-MM')`
          : sql<string>`DATE(${reactions.createdAt})`
        ).as('date'),
        count: count(),
      })
      .from(reactions)
      .where(
        and(gte(reactions.createdAt, start), lte(reactions.createdAt, end))
      )
      .groupBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${reactions.createdAt})`
          : sql`DATE(${reactions.createdAt})`
      )
      .orderBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${reactions.createdAt})`
          : sql`DATE(${reactions.createdAt})`
      )
      .limit(maxDataPoints),

    db
      .select({
        date: (isMonth
          ? sql<string>`TO_CHAR(DATE_TRUNC('month', ${follows.createdAt}), 'YYYY-MM')`
          : sql<string>`DATE(${follows.createdAt})`
        ).as('date'),
        count: count(),
      })
      .from(follows)
      .where(and(gte(follows.createdAt, start), lte(follows.createdAt, end)))
      .groupBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${follows.createdAt})`
          : sql`DATE(${follows.createdAt})`
      )
      .orderBy(
        isMonth
          ? sql`DATE_TRUNC('month', ${follows.createdAt})`
          : sql`DATE(${follows.createdAt})`
      )
      .limit(maxDataPoints),
  ]);

  const mapRows = (rows: { date: string; count: number }[]) =>
    rows.map((r) => ({ date: r.date, count: Number(r.count) }));

  return {
    userSignups: mapRows(userSignups),
    postsCreated: mapRows(postsCreated),
    commentsCreated: mapRows(commentsCreated),
    reactionsCreated: mapRows(reactionsCreated),
    followsCreated: mapRows(followsCreated),
  };
}
