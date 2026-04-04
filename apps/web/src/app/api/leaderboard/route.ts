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
 * @openapi
 * /api/leaderboard:
 *   get:
 *     tags:
 *       - Leaderboard
 *     summary: Get leaderboard (wallet or team)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [wallet, team]
 *           default: wallet
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Optional user ID to include their rank in the response
 */

import {
  findUserByIdentifier,
  getCache,
  optionalAuth,
  ReputationService,
  setCache,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { and, db, eq, follows, inArray } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { parseLeaderboardQuery } from './query';

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
  ReturnType<typeof ReputationService.getWalletLeaderboard>
>;
type TeamLeaderboardResult = Awaited<
  ReturnType<typeof ReputationService.getTeamLeaderboard>
>;
type LeaderboardResult = WalletLeaderboardResult | TeamLeaderboardResult;
type CachedLeaderboardEntry = {
  data: LeaderboardResult;
  generatedAt: string;
};

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await optionalAuth(request);
  const { searchParams } = new URL(request.url);
  const { page, pageSize, type, userId } = parseLeaderboardQuery(searchParams);
  const leaderboardType = type ?? 'wallet';
  let effectiveUserId = authUser?.dbUserId ?? authUser?.userId;

  if (userId) {
    const resolvedUser = await findUserByIdentifier(userId, { id: true });
    effectiveUserId = resolvedUser?.id ?? userId;
  }

  const cacheKey = `${leaderboardType}-${page}-${pageSize}`;

  let leaderboardData: LeaderboardResult | null = null;
  let generatedAt: string = new Date().toISOString();
  let cacheHit = false;

  if (CACHE_TTL_MS > 0) {
    const cached = await getCache<CachedLeaderboardEntry>(cacheKey, {
      namespace: CACHE_KEY_NAMESPACE,
    });
    if (cached?.data) {
      leaderboardData = cached.data;
      generatedAt = cached.generatedAt;
      cacheHit = true;
    }
  }

  if (!leaderboardData) {
    leaderboardData =
      leaderboardType === 'team'
        ? await ReputationService.getTeamLeaderboard(page, pageSize)
        : await ReputationService.getWalletLeaderboard(page, pageSize);
    generatedAt = new Date().toISOString();

    if (CACHE_TTL_MS > 0) {
      await setCache(
        cacheKey,
        { data: leaderboardData, generatedAt } satisfies CachedLeaderboardEntry,
        {
          namespace: CACHE_KEY_NAMESPACE,
          ttl: CACHE_TTL_SECONDS,
        }
      );
    }
  }

  let currentUser: Awaited<
    ReturnType<typeof ReputationService.getUserPosition>
  > = null;
  if (effectiveUserId) {
    try {
      currentUser = await ReputationService.getUserPosition(
        effectiveUserId,
        leaderboardType,
        pageSize
      );
    } catch (error) {
      logger.warn(
        'Failed to compute leaderboard currentUser; returning null',
        {
          effectiveUserId,
          leaderboardType,
          pageSize,
          error: error instanceof Error ? error.message : String(error),
        },
        'GET /api/leaderboard'
      );
    }
  }

  const authUserId = authUser?.dbUserId ?? authUser?.userId;
  const canResolveFollowingUserIds =
    authUserId !== undefined && (!userId || userId === authUserId);
  let followingUserIdsResolved = false;
  let followingUserIds: string[] = [];

  if (canResolveFollowingUserIds) {
    const leaderboardUserIds = leaderboardData.users
      .map((entry) => entry.id)
      .filter((id) => id !== authUserId);

    if (leaderboardUserIds.length > 0) {
      const followedUsers = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, authUserId),
            inArray(follows.followingId, leaderboardUserIds)
          )
        );

      followingUserIds = followedUsers.map((follow) => follow.followingId);
    }

    followingUserIdsResolved = true;
  }

  const isPersonalizedResponse = Boolean(
    effectiveUserId || followingUserIdsResolved
  );

  logger.info(
    'Leaderboard fetched successfully',
    {
      page,
      pageSize,
      leaderboardType,
      totalCount: leaderboardData.totalCount,
      cacheHit,
      hasUserId: !!effectiveUserId,
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
      followingUserIds,
      followingUserIdsResolved,
      generatedAt,
    },
    200,
    {
      'x-cache': cacheHit ? 'leaderboard-hit' : 'leaderboard-miss',
      'Cache-Control': isPersonalizedResponse
        ? 'private, no-store'
        : `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
      Vary: 'Accept-Encoding',
    }
  );
});
