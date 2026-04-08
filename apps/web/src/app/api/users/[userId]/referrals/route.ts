/**
 * User Referrals API
 *
 * @route GET /api/users/[userId]/referrals - Get referral stats and list
 * @access Authenticated (own profile only)
 *
 * @description
 * Returns referral statistics and list of referred users. Includes total count,
 * referred users list, and optional detailed stats.
 *
 * @openapi
 * /api/users/{userId}/referrals:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get referral stats
 *     description: Returns referral statistics and referred users list (own profile only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (must match authenticated user)
 *       - in: query
 *         name: includeStats
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed statistics
 *     responses:
 *       200:
 *         description: Referrals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 referrals:
 *                   type: array
 *                 total:
 *                   type: integer
 *                 stats:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot access another user's referrals
 *
 * @example
 * ```typescript
 * const { referrals, total } = await fetch(`/api/users/${userId}/referrals?includeStats=true`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * }).then(r => r.json());
 * ```
 */

import {
  AuthorizationError,
  authenticate,
  NotFoundError,
  requireUserByIdentifier,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  countCompletedReferralsForReferrerSince,
  selectCompletedReferralsByReferrerIdOrderCompletedDesc,
  selectFollowingIdsByFollowerAndFollowingIn,
  selectPendingReferredUsersIncompleteByReferrerId,
  selectReferredUsersCompletedSliceByIds,
  selectUserReferralDashboardSelfById,
  sumTradingFeesReferrerFeeByReferrerId,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import {
  logger,
  ReferralQuerySchema,
  UserIdParamSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * GET /api/users/[userId]/referrals
 * Get user's referral statistics and list of referred users
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    // Authenticate user
    const authUser = await authenticate(request);
    const params = await context.params;
    const { userId } = UserIdParamSchema.parse(params);

    // Check if the authenticated user has a database record
    if (!authUser.dbUserId) {
      throw new NotFoundError(
        'User profile not found. Please complete onboarding first.',
        'USER_NOT_FOUND',
        { userId }
      );
    }

    const targetUser = await requireUserByIdentifier(userId, { id: true });
    const canonicalUserId = targetUser.id;

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      userId,
      includeStats: searchParams.get('includeStats') || 'false',
    };
    ReferralQuerySchema.parse(queryParams);

    // Verify user is accessing their own referrals
    if (authUser.dbUserId !== canonicalUserId) {
      throw new AuthorizationError(
        'You can only access your own referrals',
        'referrals',
        'read'
      );
    }

    return asUser(authUser, async (db) => {
      const user = await selectUserReferralDashboardSelfById(
        db,
        canonicalUserId
      );

      if (!user) {
        throw new NotFoundError('User', canonicalUserId);
      }

      const completedReferralsData =
        await selectCompletedReferralsByReferrerIdOrderCompletedDesc(
          db,
          canonicalUserId
        );

      const completedReferredUserIds = completedReferralsData
        .map((r) => r.referredUserId)
        .filter((id): id is string => id !== null);

      const completedReferredUsersData =
        await selectReferredUsersCompletedSliceByIds(
          db,
          completedReferredUserIds
        );

      const completedUsersMap = new Map(
        completedReferredUsersData.map((u) => [u.id, u])
      );

      const pendingReferredUsers =
        await selectPendingReferredUsersIncompleteByReferrerId(
          db,
          canonicalUserId
        );

      const totalFeesEarned = await sumTradingFeesReferrerFeeByReferrerId(
        db,
        canonicalUserId
      );

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyReferralCount = await countCompletedReferralsForReferrerSince(
        db,
        canonicalUserId,
        oneWeekAgo
      );

      const completedUserIds = completedReferralsData
        .map((r) => r.referredUserId)
        .filter((id): id is string => id !== null);
      const pendingUserIds = pendingReferredUsers.map((u) => u.id);
      const allReferredUserIds = [...completedUserIds, ...pendingUserIds];

      const followStatuses = await selectFollowingIdsByFollowerAndFollowingIn(
        db,
        canonicalUserId,
        allReferredUserIds
      );
      const followingUserIds = new Set(
        followStatuses.map((f) => f.followingId)
      );

      // Format completed referred users with follow status
      const completedReferredUsers = completedReferralsData
        .filter(
          (r) => r.referredUserId && completedUsersMap.has(r.referredUserId)
        )
        .map((r) => {
          const userData = completedUsersMap.get(r.referredUserId!)!;
          return {
            id: userData.id,
            username: userData.username,
            displayName: userData.displayName,
            profileImageUrl: userData.profileImageUrl,
            createdAt: userData.createdAt,
            reputationPoints: userData.reputationPoints,
            isFollowing: followingUserIds.has(userData.id),
            joinedAt: r.completedAt,
            status: 'completed' as const,
          };
        });

      // Format pending referred users
      const formattedPendingUsers = pendingReferredUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        profileImageUrl: u.profileImageUrl,
        createdAt: u.createdAt,
        reputationPoints: u.reputationPoints,
        isFollowing: followingUserIds.has(u.id),
        joinedAt: null,
        status: 'pending' as const,
        email: u.email,
        farcasterUsername: u.farcasterUsername,
        twitterUsername: u.twitterUsername,
      }));

      // Use username as referral code (without @)
      const referralCode = user.username || null;
      const referralUrl = referralCode
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://babylon.market'}?ref=${referralCode}`
        : null;

      logger.info(
        'Referrals fetched successfully',
        {
          userId: canonicalUserId,
          completedReferrals: completedReferralsData.length,
          pendingReferrals: pendingReferredUsers.length,
        },
        'GET /api/users/[userId]/referrals'
      );

      return successResponse({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImageUrl: user.profileImageUrl,
          referralCode: referralCode,
          reputationPoints: user.reputationPoints,
          totalPoints: Number(user.totalPoints ?? 0),
          totalFeesEarned: user.totalFeesEarned,
          pointsAwardedForProfile: user.pointsAwardedForProfile,
          pointsAwardedForFarcaster: user.pointsAwardedForFarcaster,
          pointsAwardedForTwitter: user.pointsAwardedForTwitter,
          pointsAwardedForWallet: user.pointsAwardedForWallet,
          farcasterUsername: user.farcasterUsername,
          twitterUsername: user.twitterUsername,
          walletAddress: user.walletAddress,
          onChainRegistered: user.onChainRegistered,
        },
        stats: {
          totalReferrals: completedReferralsData.length,
          pendingReferrals: pendingReferredUsers.length,
          totalFeesEarned,
          feeShareRate: 0.5,
          followingCount: followingUserIds.size,
          weeklyReferralCount,
          weeklyLimit: 10,
        },
        referredUsers: completedReferredUsers,
        pendingReferredUsers: formattedPendingUsers,
        referralUrl,
      });
    });
  }
);
