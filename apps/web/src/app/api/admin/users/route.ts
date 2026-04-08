/**
 * Admin User Management API
 *
 * @route GET /api/admin/users - Get user list
 * @access Admin
 *
 * @description
 * Returns paginated user list with comprehensive metrics, filtering, and sorting.
 * Includes moderation metrics, engagement stats, and user flags. Requires admin
 * authentication.
 *
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get user list
 *     description: Returns paginated user list with metrics and filtering (admin only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username or display name
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, actors, users, banned, admins]
 *           default: all
 *         description: Filter by user type
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created, balance, reputation, username, reports_received, blocks_received, mutes_received, report_ratio, block_ratio, bad_user_score]
 *           default: created
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: User list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                 total:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/admin/users?limit=20&filter=banned&sortBy=reports_received', {
 *   headers: { 'Authorization': `Bearer ${adminToken}` }
 * });
 * ```
 *
 * @see {@link /lib/api/admin-middleware} Admin middleware
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import {
  type AdminUsersListParams,
  fetchAdminUsersListBundle,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  filter: z.enum(['all', 'actors', 'users', 'banned', 'admins']).default('all'),
  sortBy: z
    .enum([
      'created',
      'balance',
      'reputation',
      'username',
      'reports_received',
      'blocks_received',
      'mutes_received',
      'report_ratio',
      'block_ratio',
      'bad_user_score',
    ])
    .default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const params = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
    search: searchParams.get('search') || undefined,
    filter: searchParams.get('filter') || 'all',
    sortBy: searchParams.get('sortBy') || 'created',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  logger.info('Admin users list requested', { params }, 'GET /api/admin/users');

  const listParams: AdminUsersListParams = {
    limit: params.limit,
    offset: params.offset,
    search: params.search,
    filter: params.filter,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };

  const {
    usersResult,
    total,
    commentCounts,
    reactionCounts,
    positionCounts,
    followerCounts,
    followingCounts,
    reportsReceived,
    blocksReceived,
    mutesReceived,
    reportsSent,
    whitelistedUsers,
  } = await asSystem(
    (tx) => fetchAdminUsersListBundle(tx, listParams),
    'admin-users-list'
  );

  // Build lookup maps
  const commentCountMap = new Map(
    commentCounts.filter((c) => c.userId).map((c) => [c.userId!, c.count])
  );
  const reactionCountMap = new Map(
    reactionCounts.filter((r) => r.userId).map((r) => [r.userId!, r.count])
  );
  const positionCountMap = new Map(
    positionCounts.filter((p) => p.userId).map((p) => [p.userId!, p.count])
  );
  const followerCountMap = new Map(
    followerCounts.filter((f) => f.userId).map((f) => [f.userId!, f.count])
  );
  const followingCountMap = new Map(
    followingCounts.filter((f) => f.userId).map((f) => [f.userId!, f.count])
  );
  const reportsReceivedMap = new Map(
    reportsReceived.filter((r) => r.userId).map((r) => [r.userId!, r.count])
  );
  const blocksReceivedMap = new Map(
    blocksReceived.filter((b) => b.userId).map((b) => [b.userId!, b.count])
  );
  const mutesReceivedMap = new Map(
    mutesReceived.filter((m) => m.userId).map((m) => [m.userId!, m.count])
  );
  const reportsSentMap = new Map(
    reportsSent.filter((r) => r.userId).map((r) => [r.userId!, r.count])
  );
  const whitelistedSet = new Set(whitelistedUsers.map((w) => w.userId));

  // Calculate moderation metrics and bad user scores
  const usersWithMetrics = usersResult.map((user) => {
    const followers = followerCountMap.get(user.id) || 0;
    const reportsReceivedCount = reportsReceivedMap.get(user.id) || 0;
    const blocksReceivedCount = blocksReceivedMap.get(user.id) || 0;
    const mutesReceivedCount = mutesReceivedMap.get(user.id) || 0;
    const reportsSentCount = reportsSentMap.get(user.id) || 0;

    // Calculate ratios (avoid division by zero)
    const reportRatio =
      followers > 0 ? reportsReceivedCount / followers : reportsReceivedCount;
    const blockRatio =
      followers > 0 ? blocksReceivedCount / followers : blocksReceivedCount;
    const muteRatio =
      followers > 0 ? mutesReceivedCount / followers : mutesReceivedCount;

    // Calculate combined bad user score
    const badUserScore = reportRatio * 5 + blockRatio * 3 + muteRatio * 1;

    return {
      ...user,
      isWhitelisted: whitelistedSet.has(user.id),
      _count: {
        comments: commentCountMap.get(user.id) || 0,
        reactions: reactionCountMap.get(user.id) || 0,
        positions: positionCountMap.get(user.id) || 0,
        following: followingCountMap.get(user.id) || 0,
        followedBy: followers,
        reportsReceived: reportsReceivedCount,
        blocksReceived: blocksReceivedCount,
        mutesReceived: mutesReceivedCount,
        reportsSent: reportsSentCount,
      },
      _moderation: {
        reportsReceived: reportsReceivedCount,
        blocksReceived: blocksReceivedCount,
        mutesReceived: mutesReceivedCount,
        reportsSent: reportsSentCount,
        reportRatio,
        blockRatio,
        muteRatio,
        badUserScore,
      },
    };
  });

  // Sort based on query parameter (for moderation metrics, we sort after fetching)
  //
  // KNOWN LIMITATION: Moderation-based sorting (reports_received, blocks_received,
  // mutes_received, report_ratio, block_ratio, bad_user_score) requires fetching
  // all users within the filter and sorting in-memory, ignoring the LIMIT parameter.
  // This is because moderation metrics are computed from aggregated counts across
  // multiple tables (reports, blocks, mutes) and cannot be efficiently sorted in SQL
  // without either:
  // 1. Pre-computing scores in a denormalized column (adds maintenance overhead)
  // 2. Using SQL window functions with CTEs (complex query, still full scan)
  //
  // For typical admin use cases with < 100k users, in-memory sorting is acceptable.
  // If performance becomes an issue, consider:
  // - Pre-computing badUserScore in a scheduled job
  // - Adding materialized views for moderation metrics
  // - Caching results with TTL for repeated queries
  if (params.sortBy === 'reports_received') {
    usersWithMetrics.sort((a, b) => {
      const diff =
        b._moderation.reportsReceived - a._moderation.reportsReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'blocks_received') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.blocksReceived - a._moderation.blocksReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'mutes_received') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.mutesReceived - a._moderation.mutesReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'report_ratio') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.reportRatio - a._moderation.reportRatio;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'block_ratio') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.blockRatio - a._moderation.blockRatio;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'bad_user_score') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.badUserScore - a._moderation.badUserScore;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  }

  return successResponse({
    users: usersWithMetrics.map((user) => ({
      ...user,
      virtualBalance: user.virtualBalance.toString(),
      totalDeposited: user.totalDeposited.toString(),
      totalWithdrawn: user.totalWithdrawn.toString(),
      lifetimePnL: user.lifetimePnL.toString(),
      _moderation: {
        reportsReceived: user._moderation.reportsReceived,
        blocksReceived: user._moderation.blocksReceived,
        mutesReceived: user._moderation.mutesReceived,
        reportsSent: user._moderation.reportsSent,
        reportRatio: Number(user._moderation.reportRatio.toFixed(2)),
        blockRatio: Number(user._moderation.blockRatio.toFixed(2)),
        muteRatio: Number(user._moderation.muteRatio.toFixed(2)),
        badUserScore: Number(user._moderation.badUserScore.toFixed(2)),
      },
    })),
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
    },
  });
});
