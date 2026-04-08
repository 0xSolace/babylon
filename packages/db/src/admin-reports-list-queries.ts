/**
 * SQL for GET /api/admin/reports (paginated reports + user joins + count).
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { reports } from './tables/reports';

type AdminReportsDb = DrizzleClient | Transaction;

export type AdminReportsListQueryParams = {
  limit: number;
  offset: number;
  status?: string;
  category?: string;
  priority?: string;
  reportType?: string;
  reporterId?: string;
  reportedUserId?: string;
  reportedPostId?: string;
  sortBy: 'created' | 'updated' | 'priority';
  sortOrder: 'asc' | 'desc';
};

export type AdminReportListJoinedRow = {
  id: string;
  reporterId: string;
  reportedUserId: string | null;
  reportedPostId: string | null;
  reportedCommentId: string | null;
  reportType: string;
  category: string;
  reason: string;
  evidence: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  reporterProfileImageUrl: string | null;
  reportedUserUsername: string | null;
  reportedUserDisplayName: string | null;
  reportedUserProfileImageUrl: string | null;
  reportedUserIsBanned: boolean | null;
  resolverUsername: string | null;
  resolverDisplayName: string | null;
};

function buildReportsWhere(params: AdminReportsListQueryParams) {
  const whereConditions = [];
  if (params.status) {
    whereConditions.push(eq(reports.status, params.status));
  }
  if (params.category) {
    whereConditions.push(eq(reports.category, params.category));
  }
  if (params.priority) {
    whereConditions.push(eq(reports.priority, params.priority));
  }
  if (params.reportType) {
    whereConditions.push(eq(reports.reportType, params.reportType));
  }
  if (params.reporterId) {
    whereConditions.push(eq(reports.reporterId, params.reporterId));
  }
  if (params.reportedUserId) {
    whereConditions.push(eq(reports.reportedUserId, params.reportedUserId));
  }
  if (params.reportedPostId) {
    whereConditions.push(eq(reports.reportedPostId, params.reportedPostId));
  }
  return whereConditions.length > 0 ? and(...whereConditions) : undefined;
}

function buildReportsOrderBy(params: AdminReportsListQueryParams) {
  const sortFn = params.sortOrder === 'asc' ? asc : desc;
  if (params.sortBy === 'created') {
    return sortFn(reports.createdAt);
  }
  if (params.sortBy === 'updated') {
    return sortFn(reports.updatedAt);
  }
  if (params.sortBy === 'priority') {
    return sortFn(reports.priority);
  }
  return desc(reports.createdAt);
}

export async function fetchAdminReportsListPageBundle(
  db: AdminReportsDb,
  params: AdminReportsListQueryParams
): Promise<{
  rows: AdminReportListJoinedRow[];
  total: number;
}> {
  const whereClause = buildReportsWhere(params);
  const orderByClause = buildReportsOrderBy(params);

  const reporterAlias = sql`"reporter"`;
  const reportedUserAlias = sql`"reportedUser"`;
  const resolverAlias = sql`"resolver"`;

  const [reportsQuery, countResult] = await Promise.all([
    db
      .select({
        id: reports.id,
        reporterId: reports.reporterId,
        reportedUserId: reports.reportedUserId,
        reportedPostId: reports.reportedPostId,
        reportedCommentId: reports.reportedCommentId,
        reportType: reports.reportType,
        category: reports.category,
        reason: reports.reason,
        evidence: reports.evidence,
        status: reports.status,
        priority: reports.priority,
        resolution: reports.resolution,
        resolvedBy: reports.resolvedBy,
        resolvedAt: reports.resolvedAt,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        reporterUsername: sql<string | null>`${reporterAlias}."username"`,
        reporterDisplayName: sql<string | null>`${reporterAlias}."displayName"`,
        reporterProfileImageUrl: sql<
          string | null
        >`${reporterAlias}."profileImageUrl"`,
        reportedUserUsername: sql<
          string | null
        >`${reportedUserAlias}."username"`,
        reportedUserDisplayName: sql<
          string | null
        >`${reportedUserAlias}."displayName"`,
        reportedUserProfileImageUrl: sql<
          string | null
        >`${reportedUserAlias}."profileImageUrl"`,
        reportedUserIsBanned: sql<
          boolean | null
        >`${reportedUserAlias}."isBanned"`,
        resolverUsername: sql<string | null>`${resolverAlias}."username"`,
        resolverDisplayName: sql<string | null>`${resolverAlias}."displayName"`,
      })
      .from(reports)
      .leftJoin(
        sql`"User" AS ${reporterAlias}`,
        sql`${reports.reporterId} = ${reporterAlias}."id"`
      )
      .leftJoin(
        sql`"User" AS ${reportedUserAlias}`,
        sql`${reports.reportedUserId} = ${reportedUserAlias}."id"`
      )
      .leftJoin(
        sql`"User" AS ${resolverAlias}`,
        sql`${reports.resolvedBy} = ${resolverAlias}."id"`
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(whereClause),
  ]);

  return {
    rows: reportsQuery,
    total: countResult[0]?.count ?? 0,
  };
}
