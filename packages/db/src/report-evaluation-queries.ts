/**
 * DB reads/writes for `report-evaluation` moderation helper.
 */

import { count, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { messages } from './tables/messages';
import { posts } from './tables/posts';
import { reports } from './tables/reports';
import { users } from './tables/user';

type ReDb = DrizzleClient | Transaction;

export type ReportEvaluationMessageRow = {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
};

export type ReportEvaluationPostRow = {
  id: string;
  content: string;
  createdAt: Date;
};

export type ReportEvaluationContextPayload = {
  reporter: {
    id: string;
    username: string | null;
    displayName: string | null;
    recentReportsSent: number;
    recentReportsReceived: number;
    earnedPoints: number;
    totalDeposited: number;
    totalWithdrawn: number;
    lifetimePnL: number;
  };
  reported: {
    id: string;
    username: string | null;
    displayName: string | null;
    recentReportsReceived: number;
    recentReportsSent: number;
    earnedPoints: number;
    totalDeposited: number;
    totalWithdrawn: number;
    lifetimePnL: number;
  };
  report: {
    id: string;
    category: string;
    reason: string;
    evidence: string | null;
    createdAt: Date;
  };
  chatMessages: ReportEvaluationMessageRow[];
  posts: ReportEvaluationPostRow[];
};

export async function loadReportEvaluationContext(
  c: ReDb,
  reportId: string
): Promise<ReportEvaluationContextPayload | null> {
  const [report] = await c
    .select({
      id: reports.id,
      reporterId: reports.reporterId,
      reportedUserId: reports.reportedUserId,
      category: reports.category,
      reason: reports.reason,
      evidence: reports.evidence,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report || !report.reportedUserId) {
    return null;
  }

  const [reporter] = await c
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      earnedPoints: users.earnedPoints,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, report.reporterId))
    .limit(1);

  if (!reporter) {
    return null;
  }

  const [reportedUser] = await c
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      earnedPoints: users.earnedPoints,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, report.reportedUserId))
    .limit(1);

  const reporterId = report.reporterId;
  const reportedId = report.reportedUserId;

  const sortedIds = [reporterId, reportedId].sort();
  const chatId = `dm-${sortedIds.join('-')}`;

  const chatMessages = await c
    .select({
      id: messages.id,
      senderId: messages.senderId,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  const reporterPosts = await c
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, reporterId))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  const reportedPosts = await c
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, reportedId))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  const [reporterReportsSentResult] = await c
    .select({ count: count() })
    .from(reports)
    .where(eq(reports.reporterId, reporterId));

  const [reporterReportsReceivedResult] = await c
    .select({ count: count() })
    .from(reports)
    .where(eq(reports.reportedUserId, reporterId));

  const [reportedReportsSentResult] = await c
    .select({ count: count() })
    .from(reports)
    .where(eq(reports.reporterId, reportedId));

  const [reportedReportsReceivedResult] = await c
    .select({ count: count() })
    .from(reports)
    .where(eq(reports.reportedUserId, reportedId));

  return {
    reporter: {
      id: reporterId,
      username: reporter.username,
      displayName: reporter.displayName,
      recentReportsSent: reporterReportsSentResult?.count ?? 0,
      recentReportsReceived: reporterReportsReceivedResult?.count ?? 0,
      earnedPoints: reporter.earnedPoints,
      totalDeposited: Number(reporter.totalDeposited),
      totalWithdrawn: Number(reporter.totalWithdrawn),
      lifetimePnL: Number(reporter.lifetimePnL),
    },
    reported: {
      id: reportedId,
      username: reportedUser?.username ?? null,
      displayName: reportedUser?.displayName ?? null,
      recentReportsReceived: reportedReportsReceivedResult?.count ?? 0,
      recentReportsSent: reportedReportsSentResult?.count ?? 0,
      earnedPoints: reportedUser?.earnedPoints ?? 0,
      totalDeposited: reportedUser ? Number(reportedUser.totalDeposited) : 0,
      totalWithdrawn: reportedUser ? Number(reportedUser.totalWithdrawn) : 0,
      lifetimePnL: reportedUser ? Number(reportedUser.lifetimePnL) : 0,
    },
    report: {
      id: report.id,
      category: report.category,
      reason: report.reason,
      evidence: report.evidence,
      createdAt: report.createdAt,
    },
    chatMessages,
    posts: [...reporterPosts, ...reportedPosts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    ),
  };
}

export async function selectReportPartiesForNotification(
  c: ReDb,
  reportId: string
): Promise<{ reporterId: string; reportedUserId: string | null } | undefined> {
  const [row] = await c
    .select({
      reporterId: reports.reporterId,
      reportedUserId: reports.reportedUserId,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  return row;
}

export async function updateReportStoredEvaluation(
  c: ReDb,
  reportId: string,
  args: {
    resolutionJson: string;
    status: 'resolved' | 'reviewing';
  }
): Promise<void> {
  await c
    .update(reports)
    .set({
      resolution: args.resolutionJson,
      status: args.status,
      updatedAt: new Date(),
    })
    .where(eq(reports.id, reportId));
}
