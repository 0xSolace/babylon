/**
 * Admin System Statistics API
 *
 * @route GET /api/admin/stats - Get system statistics
 * @access Admin
 *
 * @description
 * Returns comprehensive system-wide statistics including user metrics, market data,
 * trading activity, social engagement, financial metrics, pools, and top users.
 * Requires admin authentication.
 *
 * @openapi
 * /api/admin/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get system statistics
 *     description: Returns comprehensive system-wide statistics (admin only)
 *     security:
 *       - PrivyAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: object
 *                 markets:
 *                   type: object
 *                 trading:
 *                   type: object
 *                 social:
 *                   type: object
 *                 financial:
 *                   type: object
 *                 pools:
 *                   type: object
 *                 engagement:
 *                   type: object
 *                 topUsers:
 *                   type: object
 *                 recentSignups:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/stats', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * });
 * const { users, markets, financial } = await response.json();
 * ```
 *
 * @see {@link /lib/api/admin-middleware} Admin middleware
 */

import {
  applyRateLimit,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';

import { asSystem } from '@babylon/db/engine-storage';
import { StaticDataRegistry } from '@babylon/engine';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  const admin = await requireAdmin(request);

  // Apply rate limiting to prevent abuse of expensive stats queries
  const rateLimitResult = applyRateLimit(
    admin.userId,
    RATE_LIMIT_CONFIGS.ADMIN_STATS
  );
  if (!rateLimitResult.allowed) {
    return rateLimitError(rateLimitResult.retryAfter);
  }

  logger.info('Admin stats requested', {}, 'GET /api/admin/stats');

  // Get current date for time-based queries
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  return await asSystem(async (tx) => {
    const [
      totalUsers,
      totalActors,
      totalRealUsers,
      bannedUsers,
      adminUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      totalMarkets,
      activeMarkets,
      resolvedMarkets,
      totalPositions,
      totalBalanceTransactions,
      totalNPCTrades,
      totalPosts,
      totalComments,
      totalReactions,
      postsToday,
      totalVirtualBalance,
      totalDeposited,
      totalWithdrawn,
      totalLifetimePnL,
      totalPools,
      activePools,
      totalPoolDeposits,
      totalReferrals,
      totalPointsTransactions,
    ] = await Promise.all([
      tx.user.count(),
      StaticDataRegistry.getAllActors().length,
      tx.user.count({ where: { isActor: false } }),
      tx.user.count({ where: { isBanned: true } }),
      tx.user.count({ where: { isAdmin: true } }),
      tx.user.count({ where: { createdAt: { gte: today } } }),
      tx.user.count({ where: { createdAt: { gte: lastWeek } } }),
      tx.user.count({ where: { createdAt: { gte: lastMonth } } }),
      tx.market.count(),
      tx.market.count({ where: { resolved: false, endDate: { gte: now } } }),
      tx.market.count({ where: { resolved: true } }),
      tx.position.count(),
      tx.balanceTransaction.count(),
      tx.npcTrade.count(),
      tx.post.count(),
      tx.comment.count(),
      tx.reaction.count(),
      tx.post.count({ where: { createdAt: { gte: today } } }),
      tx.user.aggregate({
        _sum: { virtualBalance: true },
      }),
      tx.user.aggregate({
        _sum: { totalDeposited: true },
      }),
      tx.user.aggregate({
        _sum: { totalWithdrawn: true },
      }),
      tx.user.aggregate({
        _sum: { lifetimePnL: true },
      }),
      tx.pool.count(),
      tx.pool.count({ where: { isActive: true } }),
      tx.poolDeposit.count(),
      tx.referral.count(),
      tx.pointsTransaction.count(),
    ]);

    const [topUsersByBalance, topUsersByReputation, recentSignups] =
      await Promise.all([
        tx.user.findMany({
          where: { isActor: false },
          orderBy: { virtualBalance: 'desc' },
          take: 10,
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            virtualBalance: true,
            lifetimePnL: true,
          },
        }),
        tx.user.findMany({
          where: { isActor: false },
          orderBy: { reputationPoints: 'desc' },
          take: 10,
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            reputationPoints: true,
          },
        }),
        tx.user.findMany({
          where: { isActor: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            walletAddress: true,
            createdAt: true,
            onChainRegistered: true,
            hasFarcaster: true,
            hasTwitter: true,
          },
        }),
      ]);

    return successResponse({
      users: {
        total: totalUsers,
        actors: totalActors,
        realUsers: totalRealUsers,
        banned: bannedUsers,
        admins: adminUsers,
        signups: {
          today: usersToday,
          thisWeek: usersThisWeek,
          thisMonth: usersThisMonth,
        },
      },
      markets: {
        total: totalMarkets,
        active: activeMarkets,
        resolved: resolvedMarkets,
        positions: totalPositions,
      },
      trading: {
        balanceTransactions: totalBalanceTransactions,
        npcTrades: totalNPCTrades,
      },
      social: {
        posts: totalPosts,
        postsToday: postsToday,
        comments: totalComments,
        reactions: totalReactions,
      },
      financial: {
        totalVirtualBalance:
          totalVirtualBalance._sum?.virtualBalance?.toString() || '0',
        totalDeposited: totalDeposited._sum?.totalDeposited?.toString() || '0',
        totalWithdrawn: totalWithdrawn._sum?.totalWithdrawn?.toString() || '0',
        totalLifetimePnL: totalLifetimePnL._sum?.lifetimePnL?.toString() || '0',
      },
      pools: {
        total: totalPools,
        active: activePools,
        deposits: totalPoolDeposits,
      },
      engagement: {
        referrals: totalReferrals,
        pointsTransactions: totalPointsTransactions,
      },
      topUsers: {
        byBalance: topUsersByBalance.map((u) => ({
          ...u,
          virtualBalance: u.virtualBalance.toString(),
          lifetimePnL: u.lifetimePnL.toString(),
        })),
        byReputation: topUsersByReputation,
      },
      recentSignups,
    });
  }, 'admin-stats-dashboard');
});
