/**
 * Stats Widget API
 *
 * @route GET /api/feed/widgets/stats - Get platform statistics
 * @access Public
 *
 * @description
 * Returns platform-wide statistics including active players, AI agents, total posts,
 * and points in circulation. Aggregates data from users and actors with RLS support.
 *
 * @openapi
 * /api/feed/widgets/stats:
 *   get:
 *     tags:
 *       - Feed
 *     summary: Get platform statistics
 *     description: Returns platform-wide stats including players, agents, posts, and points
 *     parameters:
 *       - in: query
 *         name: includeMarkets
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include market statistics
 *       - in: query
 *         name: includeUsers
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include user statistics
 *       - in: query
 *         name: includePools
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include pool statistics
 *       - in: query
 *         name: includeVolume
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include volume statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     activePlayers:
 *                       type: integer
 *                       description: Active users in last 7 days
 *                     aiAgents:
 *                       type: integer
 *                       description: Total AI agents/actors
 *                     totalHoots:
 *                       type: integer
 *                       description: Total posts
 *                     pointsInCirculation:
 *                       type: string
 *                       description: Formatted points in circulation
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/feed/widgets/stats');
 * const { stats } = await response.json();
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import { optionalAuth, successResponse, withErrorHandling } from '@babylon/api';
import { selectFeedWidgetPlatformStatsAggregates } from '@babylon/db';
import { StaticDataRegistry } from '@babylon/engine';
import { logger, StatsQuerySchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

interface BabylonStats {
  activePlayers: number;
  aiAgents: number;
  totalHoots: number;
  pointsInCirculation: string;
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    includeMarkets: searchParams.get('includeMarkets') || 'true',
    includeUsers: searchParams.get('includeUsers') || 'true',
    includePools: searchParams.get('includePools') || 'true',
    includeVolume: searchParams.get('includeVolume') || 'true',
  };
  StatsQuerySchema.parse(queryParams);

  const authUser = await optionalAuth(request).catch(() => null);

  const statsResult = await runWithOptionalUserRls(authUser, async (db) => {
    const aggregates = await selectFeedWidgetPlatformStatsAggregates(db);
    return {
      ...aggregates,
      aiAgents: StaticDataRegistry.getAllActors().length,
    };
  });

  const totalPoints =
    Number(statsResult.userPoints) + Number(statsResult.actorPoints);
  const pointsInCirculation = formatPoints(BigInt(totalPoints));

  const finalStats: BabylonStats = {
    activePlayers: statsResult.activePlayers,
    aiAgents: statsResult.aiAgents,
    totalHoots: statsResult.totalHoots,
    pointsInCirculation,
  };

  logger.info(
    'Babylon stats fetched successfully',
    finalStats,
    'GET /api/feed/widgets/stats'
  );

  return successResponse({
    success: true,
    stats: finalStats,
  });
});

function formatPoints(points: bigint): string {
  const num = Number(points);

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M pts`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K pts`;
  }

  return `${num.toLocaleString()} pts`;
}
