export const dynamic = 'force-dynamic';

/**
 * Admin Reports Statistics API
 *
 * @route GET /api/admin/reports/stats - Get report statistics
 * @access Admin
 *
 * @description
 * Returns comprehensive statistics about user reports including counts by
 * status, type breakdown, and recent activity. Admin only.
 *
 * @openapi
 * /api/admin/reports/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get report statistics
 *     description: Returns comprehensive report statistics (admin only)
 *     security:
 *       - OAuth3Auth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReports:
 *                   type: integer
 *                 pendingReports:
 *                   type: integer
 *                 resolvedReports:
 *                   type: integer
 *                 reportsByType:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const stats = await fetch('/api/admin/reports/stats', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * }).then(r => r.json());
 * ```
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { count, db, isNotNull, reports } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  logger.info(
    'Admin reports stats requested',
    {},
    'GET /api/admin/reports/stats'
  );

  // Get counts by status
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

  // Get counts by category
  const reportsByCategoryRaw = (await db
    .select({
      category: reports.category,
      reportCount: count(),
    })
    .from(reports)
    .groupBy(reports.category)) as unknown as Array<{
    category: string;
    reportCount: number;
  }>;

  const reportsByCategory = reportsByCategoryRaw.sort(
    (a, b) => b.reportCount - a.reportCount
  );

  // Get counts by priority
  const reportsByPriority = (await db
    .select({
      priority: reports.priority,
      reportCount: count(),
    })
    .from(reports)
    .groupBy(reports.priority)) as unknown as Array<{
    priority: string;
    reportCount: number;
  }>;

  // Get top reported users
  const topReportedUsersRaw = (await db
    .select({
      reportedUserId: reports.reportedUserId,
      reportCount: count(),
    })
    .from(reports)
    .where(isNotNull(reports.reportedUserId))
    .groupBy(reports.reportedUserId)) as unknown as Array<{
    reportedUserId: string | null;
    reportCount: number;
  }>;

  const topReportedUsers = topReportedUsersRaw
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 10);

  // Get user details for top reported users
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
        reportCount: item.reportCount,
      };
    })
  );

  // Get top reporters
  const topReportersRaw = (await db
    .select({
      reporterId: reports.reporterId,
      reportCount: count(),
    })
    .from(reports)
    .groupBy(reports.reporterId)) as unknown as Array<{
    reporterId: string;
    reportCount: number;
  }>;

  const topReporters = topReportersRaw
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 10);

  // Get user details for top reporters
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
        reportCount: item.reportCount,
      };
    })
  );

  // Get recent activity (last 7 days)
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

  return successResponse({
    totals: {
      total: totalReports,
      pending: pendingReports,
      reviewing: reviewingReports,
      resolved: resolvedReports,
      dismissed: dismissedReports,
    },
    byCategory: reportsByCategory.map((item) => ({
      category: item.category,
      count: item.reportCount,
    })),
    byPriority: reportsByPriority.map((item) => ({
      priority: item.priority,
      count: item.reportCount,
    })),
    topReportedUsers: topReportedUsersWithDetails,
    topReporters: topReportersWithDetails,
    recentActivity: {
      last7Days: recentReports,
      resolved7Days: recentResolved,
    },
  });
});
