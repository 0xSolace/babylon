/**
 * User Profile API Route
 *
 * @description Retrieves comprehensive user profile information including stats, social connections, and account details
 *
 * @route GET /api/users/[userId]/profile
 * @access Public (no authentication required)
 *
 * @openapi
 * /api/users/{userId}/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user profile
 *     description: Retrieves comprehensive profile information for a specific user including stats, social connections, and account details
 *     operationId: getUserProfile
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID, username, or wallet address
 *         example: "user_123abc"
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
 *                       description: Unique user identifier
 *                     username:
 *                       type: string
 *                       description: Username
 *                     displayName:
 *                       type: string
 *                       description: Display name
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                       description: User biography
 *                     profileImageUrl:
 *                       type: string
 *                       nullable: true
 *                       description: Profile image URL
 *                     coverImageUrl:
 *                       type: string
 *                       nullable: true
 *                       description: Cover image URL
 *                     walletAddress:
 *                       type: string
 *                       nullable: true
 *                       description: Blockchain wallet address
 *                     virtualBalance:
 *                       type: number
 *                       description: Virtual balance in game currency
 *                     lifetimePnL:
 *                       type: number
 *                       description: Lifetime profit and loss
 *                     reputationPoints:
 *                       type: integer
 *                       description: Reputation points earned
 *                     isActor:
 *                       type: boolean
 *                       description: Whether this is an NPC actor
 *                     profileComplete:
 *                       type: boolean
 *                       description: Whether profile setup is complete
 *                     onChainRegistered:
 *                       type: boolean
 *                       description: Whether registered on blockchain
 *                     hasFarcaster:
 *                       type: boolean
 *                       description: Whether Farcaster is linked
 *                     hasTwitter:
 *                       type: boolean
 *                       description: Whether Twitter is linked
 *                     stats:
 *                       type: object
 *                       description: User statistics
 *                       properties:
 *                         positions:
 *                           type: integer
 *                           description: Number of open positions
 *                         comments:
 *                           type: integer
 *                           description: Total comments made
 *                         reactions:
 *                           type: integer
 *                           description: Total reactions given
 *                         followers:
 *                           type: integer
 *                           description: Number of followers
 *                         following:
 *                           type: integer
 *                           description: Number of users/actors following
 *                         posts:
 *                           type: integer
 *                           description: Total posts created
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import {
  addPublicReadHeaders,
  findUserByIdentifierWithSelect,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { users } from '@babylon/db';
import { logger, UserIdParamSchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { getOptionalProfileStats } from '@/lib/users/profile-stats';

/**
 * GET Handler for User Profile
 *
 * @description Retrieves comprehensive user profile information including stats and social connections
 *
 * @param {NextRequest} request - Next.js request object
 * @param {Object} context - Route context containing dynamic parameters
 * @param {Promise<{userId: string}>} context.params - Dynamic route parameters
 *
 * @returns {Promise<NextResponse>} User profile data with stats
 *
 * @throws {NotFoundError} When user is not found
 * @throws {ValidationError} When userId parameter is invalid
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/users/johndoe/profile
 *
 * // Response
 * {
 *   "user": {
 *     "id": "user_123",
 *     "username": "johndoe",
 *     "displayName": "John Doe",
 *     "virtualBalance": 10000,
 *     "stats": {
 *       "followers": 150,
 *       "following": 75,
 *       "posts": 42
 *     }
 *   }
 * }
 * ```
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const { error, rateLimitInfo } = await publicRateLimit(request);
    if (error) return error;

    const params = await context.params;
    const { userId } = UserIdParamSchema.parse(params);

    // Get user profile - use findUserByIdentifierWithSelect to handle new Privy users gracefully
    // WHY findUserByIdentifierWithSelect instead of findUserByIdentifier with _select?
    // 1. Eliminates OR condition: Uses classification-based routing to execute exactly ONE indexed query
    //    (no OR condition that prevents optimal index usage)
    // 2. Better cache utilization: Caches the full user object instead of selected fields only
    //    This maximizes cache hit rate across different callers requesting different field combinations
    // 3. In-memory filtering: Filters requested fields in memory (microseconds) vs database query (milliseconds)
    // 4. Shares cache entries: Uses same cache keys as findUserByIdentifier, maximizing cache reuse
    // WHY type assertion? TypeScript infers T as { id: PgColumn, ... } (select object type),
    // but at runtime the function returns actual data values { id: string, ... }.
    // The function filters the full user object (which has data values) using Object.keys(select),
    // so the assertion correctly reflects the runtime return type.
    const dbUser = (await findUserByIdentifierWithSelect(userId, {
      id: users.id,
      walletAddress: users.walletAddress,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      coverImageUrl: users.coverImageUrl,
      isActor: users.isActor,
      isAgent: users.isAgent,
      managedBy: users.managedBy,
      profileComplete: users.profileComplete,
      hasUsername: users.hasUsername,
      hasBio: users.hasBio,
      hasProfileImage: users.hasProfileImage,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
      virtualBalance: users.virtualBalance,
      lifetimePnL: users.lifetimePnL,
      reputationPoints: users.reputationPoints,
      totalPoints: users.totalPoints,
      earnedPoints: users.earnedPoints,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
      referralCount: users.referralCount,
      referralCode: users.referralCode,
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
      usernameChangedAt: users.usernameChangedAt,
      createdAt: users.createdAt,
    })) as {
      // Type assertion: All 31 fields from the original query, correctly typed as runtime data values
      // WHY these specific types?
      // - Strings: id, walletAddress, username, displayName, bio, profileImageUrl, coverImageUrl, managedBy, referralCode, farcasterUsername, twitterUsername
      // - Nullable strings: Most text fields can be null (user hasn't set them yet)
      // - Booleans: isActor, isAgent, profileComplete, hasUsername, hasBio, hasProfileImage, onChainRegistered, hasFarcaster, hasTwitter
      // - Numbers: reputationPoints, earnedPoints, invitePoints, bonusPoints, referralCount (integers from schema)
      // - Nullable number: nftTokenId (user may not have NFT yet)
      // - Decimal strings: virtualBalance, lifetimePnL, totalPoints (decimal type in DB, stored as string, converted to Number in response)
      // - Dates: usernameChangedAt (nullable - only set when username changes), createdAt (always present)
      id: string;
      walletAddress: string | null;
      username: string | null;
      displayName: string | null;
      bio: string | null;
      profileImageUrl: string | null;
      coverImageUrl: string | null;
      isActor: boolean;
      isAgent: boolean;
      managedBy: string | null;
      profileComplete: boolean;
      hasUsername: boolean;
      hasBio: boolean;
      hasProfileImage: boolean;
      onChainRegistered: boolean;
      nftTokenId: number | null;
      virtualBalance: string; // Decimal type - converted to Number in response mapping
      lifetimePnL: string; // Decimal type - converted to Number in response mapping
      reputationPoints: number;
      totalPoints: string | null; // Decimal type - converted to Number in response mapping
      earnedPoints: number;
      invitePoints: number;
      bonusPoints: number;
      referralCount: number;
      referralCode: string | null;
      hasFarcaster: boolean;
      hasTwitter: boolean;
      farcasterUsername: string | null;
      twitterUsername: string | null;
      usernameChangedAt: Date | null; // Only set when username changes
      createdAt: Date; // Always present (defaults to now() in schema)
    } | null;

    // If user doesn't exist, findUserByIdentifierWithSelect returns null for non-existent users
    // WHY return { user: null } instead of throwing NotFoundError?
    // - This route is public (no auth required) and handles new Privy users gracefully
    // - New Privy users may authenticate before completing signup, so they won't exist in DB yet
    // - Returning null allows frontend to handle "user not found" vs "user needs onboarding" states
    if (!dbUser) {
      logger.info(
        "User not found - new Privy user who hasn't completed signup",
        { userId },
        'GET /api/users/[userId]/profile'
      );
      return successResponse({
        user: null,
      });
    }

    // Get cached profile stats (followers, following, posts, etc.)
    const stats = await getOptionalProfileStats(
      dbUser.id,
      'GET /api/users/[userId]/profile'
    );

    logger.info(
      'User profile fetched successfully',
      { userId, statsAvailable: Boolean(stats) },
      'GET /api/users/[userId]/profile'
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
        // WHY Number() conversion? virtualBalance, lifetimePnL, and totalPoints are decimal types
        // stored as strings in the database. We convert to numbers for JSON response.
        // WHY ?? 0 fallback? Defensive programming - if somehow null, default to 0
        virtualBalance: Number(dbUser.virtualBalance ?? 0),
        lifetimePnL: Number(dbUser.lifetimePnL ?? 0),
        reputationPoints: dbUser.reputationPoints,
        totalPoints: Number(dbUser.totalPoints ?? 0),
        earnedPoints: dbUser.earnedPoints,
        invitePoints: dbUser.invitePoints,
        bonusPoints: dbUser.bonusPoints,
        referralCount: dbUser.referralCount,
        referralCode: dbUser.referralCode,
        hasFarcaster: dbUser.hasFarcaster,
        hasTwitter: dbUser.hasTwitter,
        farcasterUsername: dbUser.farcasterUsername,
        twitterUsername: dbUser.twitterUsername,
        // WHY optional chaining for usernameChangedAt? Field is nullable (only set when username changes)
        // WHY || null? If toISOString() somehow returns empty string, return null instead
        usernameChangedAt: dbUser.usernameChangedAt?.toISOString() || null,
        // WHY no optional chaining for createdAt? Field is NOT NULL in schema (always present)
        createdAt: dbUser.createdAt.toISOString(),
        stats,
      },
    });
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  }
);
