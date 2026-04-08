/**
 * Admin Fees API
 *
 * @route GET /api/admin/fees - Get fee statistics
 * @access Admin
 *
 * @description
 * Returns comprehensive fee statistics including global totals, breakdown by type,
 * top fee payers, and recent transactions. Supports date range filtering.
 * Requires admin authentication.
 *
 * @openapi
 * /api/admin/fees:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get fee statistics
 *     description: Returns comprehensive fee statistics and analytics (admin only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit for recent transactions
 *     responses:
 *       200:
 *         description: Fee statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                 breakdown:
 *                   type: object
 *                 topPayers:
 *                   type: array
 *                 recentTransactions:
 *                   type: array
 *       400:
 *         description: Invalid date parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const stats = await fetch('/api/admin/fees?startDate=2024-01-01&limit=50', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * }).then(r => r.json());
 * ```
 *
 * @see {@link /lib/api/admin-middleware} Admin middleware
 * @see {@link /lib/services/fee-service} Fee service
 */

import {
  applyRateLimit,
  errorResponse,
  MAX_DATE_RANGE_DAYS,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  requireAdmin,
  successResponse,
  validateDateRange,
  withErrorHandling,
} from '@babylon/api';
import {
  selectAdminFeeTrendFeeRows,
  selectAdminPoolsTotalFeesCollectedSum,
  selectAdminRecentFeesWithUserJoin,
  selectAdminTopFeePayers,
  selectAdminTopReferralEarners,
  selectAdminTradingFeesGroupedByType,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { FeeService, StaticDataRegistry } from '@babylon/engine';
import { toISO, toISOOrNull } from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * GET /api/admin/fees
 * Fetch comprehensive fee statistics
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify admin access
  const admin = await requireAdmin(request);

  // Apply rate limiting to prevent abuse of expensive stats queries
  const rateLimitResult = applyRateLimit(
    admin.userId,
    RATE_LIMIT_CONFIGS.ADMIN_STATS
  );
  if (!rateLimitResult.allowed) {
    return rateLimitError(rateLimitResult.retryAfter);
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const limitParam = searchParams.get('limit');

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  if (startDateParam && startDate && Number.isNaN(startDate.getTime())) {
    return errorResponse(
      'Invalid startDate parameter. Expected an ISO 8601 date string.',
      'INVALID_QUERY_PARAM',
      400,
      { startDate: startDateParam }
    );
  }

  const endDate = endDateParam ? new Date(endDateParam) : undefined;
  if (endDateParam && endDate && Number.isNaN(endDate.getTime())) {
    return errorResponse(
      'Invalid endDate parameter. Expected an ISO 8601 date string.',
      'INVALID_QUERY_PARAM',
      400,
      { endDate: endDateParam }
    );
  }

  // Validate date range to prevent heavy queries
  const dateRangeError = validateDateRange(startDate, endDate);
  if (dateRangeError) {
    return errorResponse(dateRangeError, 'INVALID_DATE_RANGE', 400, {
      maxDays: MAX_DATE_RANGE_DAYS,
    });
  }

  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10;
  if (limitParam && (Number.isNaN(parsedLimit) || parsedLimit <= 0)) {
    return errorResponse(
      'Invalid limit parameter. Expected a positive integer.',
      'INVALID_QUERY_PARAM',
      400,
      { limit: limitParam }
    );
  }

  const limit = Math.min(parsedLimit, 100);

  // Get platform-wide fee statistics (user fees from TradingFee table)
  const platformStats = await FeeService.getPlatformFeeStats(
    startDate,
    endDate
  );

  const totalNPCFees = await asSystem(
    (tx) => selectAdminPoolsTotalFeesCollectedSum(tx),
    'admin-fees-pools'
  );

  // Combine user and NPC fees for total
  const totalFeesCollected = platformStats.totalFeesCollected + totalNPCFees;

  const feesByType = await asSystem(
    (tx) =>
      selectAdminTradingFeesGroupedByType(tx, {
        startDate,
        endDate,
      }),
    'admin-fees-by-type'
  );

  const topFeePayers = await asSystem(
    (tx) =>
      selectAdminTopFeePayers(tx, {
        startDate,
        endDate,
        limit,
      }),
    'admin-fees-top-payers'
  );

  const payerUserIds = [...new Set(topFeePayers.map((item) => item.userId))];
  const payerUsers =
    payerUserIds.length === 0
      ? []
      : await asSystem(
          (tx) =>
            tx.user.findMany({
              where: { id: { in: payerUserIds } },
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
                isActor: true,
              },
            }),
          'admin-fees-payer-users'
        );
  const payerUserMap = new Map(payerUsers.map((u) => [u.id, u]));

  const enrichedTopFeePayers = topFeePayers.map((item) => {
    const user = payerUserMap.get(item.userId);

    if (user) {
      return {
        userId: item.userId,
        username: user.username || 'Unknown',
        displayName: user.displayName || 'Unknown User',
        profileImageUrl: user.profileImageUrl || null,
        isNPC: user.isActor,
        totalFees: Number(item.feeAmountSum || 0),
        tradeCount: Number(item._count),
      };
    }

    const actor = StaticDataRegistry.getActor(item.userId);

    return {
      userId: item.userId,
      username: actor?.name || 'Unknown NPC',
      displayName: actor?.name || 'Unknown NPC',
      profileImageUrl: actor?.profileImageUrl || null,
      isNPC: true,
      totalFees: Number(item.feeAmountSum || 0),
      tradeCount: item._count,
    };
  });

  const topReferralEarners = await asSystem(
    (tx) =>
      selectAdminTopReferralEarners(tx, {
        startDate,
        endDate,
        limit,
      }),
    'admin-fees-top-referrers'
  );

  const referrerUserIds = [
    ...new Set(
      topReferralEarners
        .map((item) => item.referrerId)
        .filter((id): id is string => id != null)
    ),
  ];
  const referrerUsers =
    referrerUserIds.length === 0
      ? []
      : await asSystem(
          (tx) =>
            tx.user.findMany({
              where: { id: { in: referrerUserIds } },
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
              },
            }),
          'admin-fees-referrer-users'
        );
  const referrerUserMap = new Map(referrerUsers.map((u) => [u.id, u]));

  const enrichedTopReferralEarners = topReferralEarners.map((item) => {
    const refId = item.referrerId;
    if (!refId) {
      return {
        userId: '',
        username: 'Unknown',
        displayName: 'Unknown User',
        profileImageUrl: null,
        totalEarned: Number(item.referrerFeeSum || 0),
        referralCount: Number(item._count),
      };
    }
    const user = referrerUserMap.get(refId);
    return {
      userId: refId,
      username: user?.username || 'Unknown',
      displayName: user?.displayName || 'Unknown User',
      profileImageUrl: user?.profileImageUrl || null,
      totalEarned: Number(item.referrerFeeSum || 0),
      referralCount: Number(item._count),
    };
  });

  const recentFeesQuery = await asSystem(
    (tx) =>
      selectAdminRecentFeesWithUserJoin(tx, {
        startDate,
        endDate,
        limit,
      }),
    'admin-fees-recent'
  );

  // Enrich recent fees with actor data for NPCs (user data already joined)
  const enrichedRecentFees = recentFeesQuery.map((fee) => {
    // User data comes from the JOIN. isActor being null means no user row matched (LEFT JOIN)
    const userJoinSucceeded = fee.isActor !== null;
    let username = fee.username;
    let displayName = fee.displayName;
    let profileImageUrl = fee.profileImageUrl;
    let isActor = fee.isActor ?? false;

    // If LEFT JOIN didn't find a user, try to find actor data
    if (!userJoinSucceeded) {
      const actor = StaticDataRegistry.getActor(fee.userId);

      if (actor) {
        username = actor.name;
        displayName = actor.name;
        profileImageUrl = actor.profileImageUrl ?? null;
        isActor = true;
      }
    }

    return {
      id: fee.id,
      userId: fee.userId,
      username: username || 'Unknown',
      displayName: displayName || 'Unknown',
      profileImageUrl: profileImageUrl || null,
      isNPC: isActor,
      tradeType: fee.tradeType,
      feeAmount: Number(fee.feeAmount),
      platformFee: Number(fee.platformFee),
      referrerFee: Number(fee.referrerFee),
      createdAt: toISO(fee.createdAt),
    };
  });

  // Get fee trend data (daily aggregates for the past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trendStartDate =
    startDate && startDate > thirtyDaysAgo ? startDate : thirtyDaysAgo;

  const dailyFeeRecords = await asSystem(
    (tx) =>
      selectAdminFeeTrendFeeRows(tx, {
        trendStartDate,
        endDate,
      }),
    'admin-fees-trend'
  );

  const trendMap = new Map<string, { totalFees: number; tradeCount: number }>();

  for (const record of dailyFeeRecords) {
    const dayKey = toISOOrNull(record.createdAt)?.split('T')[0];
    if (!dayKey) continue;
    const existing = trendMap.get(dayKey) ?? { totalFees: 0, tradeCount: 0 };

    existing.totalFees += Number(record.feeAmount || 0);
    existing.tradeCount += 1;

    trendMap.set(dayKey, existing);
  }

  const feeTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, values]) => ({
      date,
      totalFees: Number(values.totalFees.toFixed(2)),
      tradeCount: values.tradeCount,
    }));

  return successResponse({
    platformStats: {
      totalFeesCollected, // Combined user + NPC fees
      totalUserFees: platformStats.totalFeesCollected,
      totalNPCFees,
      totalPlatformFees: platformStats.totalPlatformFees + totalNPCFees, // NPCs have no referrers, all goes to platform
      totalReferrerFees: platformStats.totalReferrerFees,
      totalTrades: platformStats.totalTrades,
    },
    feesByType: feesByType.map((item) => ({
      tradeType: item.tradeType,
      totalFees: Number(item.feeAmountSum || 0),
      platformFees: Number(item.platformFeeSum || 0),
      referrerFees: Number(item.referrerFeeSum || 0),
      tradeCount: Number(item._count),
    })),
    topFeePayers: enrichedTopFeePayers,
    topReferralEarners: enrichedTopReferralEarners,
    recentFees: enrichedRecentFees,
    feeTrend,
  });
});
