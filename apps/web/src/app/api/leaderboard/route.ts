/**
 * Leaderboard API
 *
 * Two leaderboard modes:
 * - **wallet**: Per-wallet ranking (users AND agents as individuals)
 * - **team**: User + their agents combined
 *
 * Supports optional `userId` param to return the requesting user's
 * rank/position alongside the page data. Leaderboard pages are cached
 * in Redis (shared); user positions are always computed fresh.
 *
 * @example
 * ```typescript
 * // Get top 50 users by reputation
 * const response = await fetch('/api/leaderboard?page=1&pageSize=50');
 * const { leaderboard, pagination } = await response.json();
 *
 * // Get referral leaders
 * const referralLeaders = await fetch('/api/leaderboard?pointsType=referral&minPoints=1000');
 *
 * // Display leaderboard
 * leaderboard.forEach(user => {
 *   console.log(`#${user.rank}: ${user.displayName} - ${user.points} points`);
 * });
 * ```
 *
 * @see {@link /lib/services/points-service} Points calculation
 * @see {@link /src/app/leaderboard/page.tsx} Leaderboard UI
 */

import {
  getCache,
  PointsService,
  setCache,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { LeaderboardQuerySchema, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

const CACHE_KEY_NAMESPACE = 'leaderboard';
const CACHE_TTL_MS = (() => {
  const raw = process.env.LEADERBOARD_CACHE_MS;
  if (raw === undefined) return 120_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 120_000;
})();
const CACHE_TTL_SECONDS = Math.floor(CACHE_TTL_MS / 1000);
const STALE_SECONDS = CACHE_TTL_SECONDS * 3;

type WalletLeaderboardResult = Awaited<
  ReturnType<typeof PointsService.getWalletLeaderboard>
>;
type TeamLeaderboardResult = Awaited<
  ReturnType<typeof PointsService.getTeamLeaderboard>
>;
type CachedLeaderboardData = WalletLeaderboardResult | TeamLeaderboardResult;

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());
  const validationResult = LeaderboardQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    throw validationResult.error;
  }

  const { page, pageSize, type, userId } = validationResult.data;
  const leaderboardType = type ?? 'wallet';

  const cacheKey = `${leaderboardType}-${page}-${pageSize}`;

  let leaderboardData: CachedLeaderboardData | null = null;
  let cacheHit = false;

  if (CACHE_TTL_MS > 0) {
    leaderboardData = await getCache<CachedLeaderboardData>(cacheKey, {
      namespace: CACHE_KEY_NAMESPACE,
    });
    if (leaderboardData) {
      cacheHit = true;
    }
  }

  if (!leaderboardData) {
    leaderboardData =
      leaderboardType === 'team'
        ? await PointsService.getTeamLeaderboard(page, pageSize)
        : await PointsService.getWalletLeaderboard(page, pageSize);

    if (CACHE_TTL_MS > 0) {
      await setCache(cacheKey, leaderboardData, {
        namespace: CACHE_KEY_NAMESPACE,
        ttl: CACHE_TTL_SECONDS,
      });
    }
  }

  let currentUser: Awaited<ReturnType<typeof PointsService.getUserPosition>> =
    null;
  if (userId) {
    currentUser = await PointsService.getUserPosition(
      userId,
      leaderboardType,
      pageSize
    );
  }

  logger.info(
    'Leaderboard fetched successfully',
    {
      page,
      pageSize,
      leaderboardType,
      totalCount: leaderboardData.totalCount,
      cacheHit,
      hasUserId: !!userId,
    },
    'GET /api/leaderboard'
  );

  return successResponse(
    {
      leaderboard: leaderboardData.users,
      pagination: {
        page: leaderboardData.page,
        pageSize: leaderboardData.pageSize,
        totalCount: leaderboardData.totalCount,
        totalPages: leaderboardData.totalPages,
      },
      leaderboardType,
      currentUser,
    },
    200,
    {
      'x-cache': cacheHit ? 'leaderboard-hit' : 'leaderboard-miss',
      'Cache-Control': userId
        ? 'private, no-store'
        : `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      Vary: 'Accept-Encoding',
    }
  );
});
