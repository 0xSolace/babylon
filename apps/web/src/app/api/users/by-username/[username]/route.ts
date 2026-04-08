/**
 * User Lookup by Username API
 *
 * @route GET /api/users/by-username/[username] - Get user by username
 * @access Public
 *
 * @description
 * Retrieves user profile by username with comprehensive profile data including
 * stats, social connections, on-chain status, and social media links.
 *
 * @openapi
 * /api/users/by-username/{username}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user by username
 *     description: Returns complete user profile by username lookup
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to lookup
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     profileImageUrl:
 *                       type: string
 *                     stats:
 *                       type: object
 *                       properties:
 *                         positions:
 *                           type: integer
 *                         comments:
 *                           type: integer
 *                         reactions:
 *                           type: integer
 *                         followers:
 *                           type: integer
 *                         following:
 *                           type: integer
 *       404:
 *         description: User not found
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/users/by-username/alice');
 * const { user } = await response.json();
 * console.log(`${user.displayName} (@${user.username})`);
 * ```
 *
 * @see {@link /lib/db/context} RLS context
 */

import {
  addPublicReadHeaders,
  NotFoundError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  selectUserPublicProfileByUsernameCaseInsensitive,
  selectUserSocialActivityCountsByUserId,
} from '@babylon/db';
import { logger, toISO, UsernameParamSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';

/**
 * GET /api/users/by-username/[username]
 * Get user profile by username
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
  ) => {
    const params = await context.params;
    const { username } = UsernameParamSchema.parse(params);

    const { error, rateLimitInfo, user } = await publicRateLimit(request);
    if (error) return error;

    return runWithOptionalUserRls(user, async (db) => {
      const dbUser = await selectUserPublicProfileByUsernameCaseInsensitive(
        db,
        username
      );

      if (!dbUser) {
        throw new NotFoundError('User', username);
      }

      const stats = await selectUserSocialActivityCountsByUserId(db, dbUser.id);

      logger.info(
        'User profile fetched by username',
        { username, userId: dbUser.id },
        'GET /api/users/by-username/[username]'
      );

      const res = successResponse({
        user: {
          id: dbUser.id,
          walletAddress: dbUser.walletAddress,
          username: dbUser.username,
          displayName: dbUser.displayName,
          bio: dbUser.bio,
          profileImageUrl: dbUser.profileImageUrl,
          coverImageUrl: dbUser.coverImageUrl,
          isActor: dbUser.isActor,
          isAgent: dbUser.isAgent,
          managedBy: dbUser.managedBy,
          profileComplete: dbUser.profileComplete,
          hasUsername: dbUser.hasUsername,
          hasBio: dbUser.hasBio,
          hasProfileImage: dbUser.hasProfileImage,
          onChainRegistered: dbUser.onChainRegistered,
          nftTokenId: dbUser.nftTokenId,
          virtualBalance: Number(dbUser.virtualBalance ?? 0),
          lifetimePnL: Number(dbUser.lifetimePnL ?? 0),
          reputationPoints: dbUser.reputationPoints,
          referralCount: dbUser.referralCount,
          referralCode: dbUser.referralCode,
          hasFarcaster: dbUser.hasFarcaster,
          hasTwitter: dbUser.hasTwitter,
          farcasterUsername: dbUser.farcasterUsername,
          twitterUsername: dbUser.twitterUsername,
          createdAt: toISO(dbUser.createdAt),
          stats,
        },
      });
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    });
  }
);
