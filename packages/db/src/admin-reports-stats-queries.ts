/**
 * Aggregations for GET /api/admin/reports/stats (system RLS `DrizzleClient`).
 */

import { count, isNotNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { reports } from './tables/reports';

export type AdminReportsStatsPayload = {
  totals: {
    total: number;
    pending: number;
    reviewing: number;
    resolved: number;
    dismissed: number;
  };
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  topReportedUsers: {
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      profileImageUrl: string | null;
      isBanned: boolean;
    } | null;
    reportCount: number;
  }[];
  topReporters: {
    user: {
      id: string;
      username: string | null;
      displayName: string | null;
      profileImageUrl: string | null;
    } | null;
    reportCount: number;
  }[];
  recentActivity: {
    last7Days: number;
    resolved7Days: number;
  };
};

export async function fetchAdminReportsStatsPayload(
  db: DrizzleClient
): Promise<AdminReportsStatsPayload> {
  const [
    totalReports,
    pendingReports,
    reviewingReports,
    resolvedReports,
    dismissedReports,
  ] = await Promise.all([
    db.report.count(),
    db.report.count({ where: { status: 'pending' } }),
    db.report.count({ where: { status: 'reviewing' } }),
    db.report.count({ where: { status: 'resolved' } }),
    db.report.count({ where: { status: 'dismissed' } }),
  ]);

  const reportsByCategoryRaw = await db
    .select({
      category: reports.category,
      _count: count(),
    })
    .from(reports)
    .groupBy(reports.category);

  const reportsByCategory = reportsByCategoryRaw.sort(
    (a, b) => Number(b._count) - Number(a._count)
  );

  const reportsByPriority = await db
    .select({
      priority: reports.priority,
      _count: count(),
    })
    .from(reports)
    .groupBy(reports.priority);

  const topReportedUsersRaw = await db
    .select({
      reportedUserId: reports.reportedUserId,
      _count: count(),
    })
    .from(reports)
    .where(isNotNull(reports.reportedUserId))
    .groupBy(reports.reportedUserId);

  const topReportedUsers = topReportedUsersRaw
    .sort((a, b) => Number(b._count) - Number(a._count))
    .slice(0, 10);

  const topReportedUsersWithDetails = await Promise.all(
    topReportedUsers.map(async (item) => {
      const user = await db.user.findUnique({
        where: { id: item.reportedUserId! },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isBanned: true,
        },
      });
      return {
        user,
        reportCount: Number(item._count),
      };
    })
  );

  const topReportersRaw = await db
    .select({
      reporterId: reports.reporterId,
      _count: count(),
    })
    .from(reports)
    .groupBy(reports.reporterId);

  const topReporters = topReportersRaw
    .sort((a, b) => Number(b._count) - Number(a._count))
    .slice(0, 10);

  const topReportersWithDetails = await Promise.all(
    topReporters.map(async (item) => {
      const user = await db.user.findUnique({
        where: { id: String(item.reporterId) },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
        },
      });
      return {
        user,
        reportCount: Number(item._count),
      };
    })
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentReports = await db.report.count({
    where: {
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  const recentResolved = await db.report.count({
    where: {
      resolvedAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  return {
    totals: {
      total: totalReports,
      pending: pendingReports,
      reviewing: reviewingReports,
      resolved: resolvedReports,
      dismissed: dismissedReports,
    },
    byCategory: reportsByCategory.map((item) => ({
      category: item.category,
      count: Number(item._count),
    })),
    byPriority: reportsByPriority.map((item) => ({
      priority: item.priority,
      count: Number(item._count),
    })),
    topReportedUsers: topReportedUsersWithDetails,
    topReporters: topReportersWithDetails,
    recentActivity: {
      last7Days: recentReports,
      resolved7Days: recentResolved,
    },
  };
}
