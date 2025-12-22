export const dynamic = 'force-dynamic';

/**
 * Current User Profile API
 *
 * @route GET /api/users/me
 * @access Authenticated
 *
 * @description
 * Returns the authenticated user's complete profile information including
 * profile status, social connections, reputation, and onboarding state.
 * Central endpoint for user session management and profile data.
 *
 * **Automatic User Creation:**
 * Creates a minimal user record in the database on first authentication if
 * one doesn't exist. This allows tracking of users through the onboarding
 * funnel and ensures a user record is always available for authenticated requests.
 *
 * @openapi
 * /api/users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user profile
 *     description: Returns the authenticated user complete profile including onboarding status, social connections, and reputation.
 *     security:
 *       - OAuth3Auth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 needsOnboarding:
 *                   type: boolean
 *                 needsOnchain:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 */

import {
  authenticate,
  cachedDb,
  InternalServerError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';

import { db, eq, users } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

const userSelectFields = {
  id: users.id,
  /** @deprecated Legacy field from Privy auth migration. Use oauth3Id instead. */
  privyId: users.privyId,
  oauth3Id: users.oauth3Id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  profileImageUrl: users.profileImageUrl,
  coverImageUrl: users.coverImageUrl,
  walletAddress: users.walletAddress,
  email: users.email,
  profileComplete: users.profileComplete,
  hasUsername: users.hasUsername,
  hasBio: users.hasBio,
  hasProfileImage: users.hasProfileImage,
  onChainRegistered: users.onChainRegistered,
  nftTokenId: users.nftTokenId,
  referralCode: users.referralCode,
  referredBy: users.referredBy,
  reputationPoints: users.reputationPoints,
  pointsAwardedForProfile: users.pointsAwardedForProfile,
  pointsAwardedForFarcasterFollow: users.pointsAwardedForFarcasterFollow,
  pointsAwardedForTwitterFollow: users.pointsAwardedForTwitterFollow,
  pointsAwardedForDiscordJoin: users.pointsAwardedForDiscordJoin,
  hasFarcaster: users.hasFarcaster,
  hasTwitter: users.hasTwitter,
  hasDiscord: users.hasDiscord,
  farcasterUsername: users.farcasterUsername,
  twitterUsername: users.twitterUsername,
  discordUsername: users.discordUsername,
  showTwitterPublic: users.showTwitterPublic,
  showFarcasterPublic: users.showFarcasterPublic,
  showWalletPublic: users.showWalletPublic,
  isAdmin: users.isAdmin,
  isActor: users.isActor,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  // oauth3Id is the primary identifier
  if (!authUser.oauth3Id && !authUser.userId) {
    throw new Error('User ID not found in authentication');
  }
  const oauth3Id = authUser.oauth3Id || authUser.userId;
  if (!authUser.dbUserId && !authUser.userId) {
    throw new Error('Database user ID not found in authentication');
  }
  const canonicalUserId = authUser.dbUserId || authUser.userId;
  const walletAddress = authUser.walletAddress
    ? authUser.walletAddress.toLowerCase()
    : null;

  // Extract referralCode from query params (passed from frontend)
  const { searchParams } = new URL(request.url);
  const referralCode = searchParams.get('ref') || null;

  logger.info(
    'Fetching user profile',
    { oauth3Id, dbUserId: authUser.dbUserId, hasReferralCode: !!referralCode },
    'GET /api/users/me'
  );

  // Primary lookup by oauth3Id
  let [dbUser] = await db
    .select(userSelectFields)
    .from(users)
    .where(eq(users.oauth3Id, oauth3Id))
    .limit(1);

  // @deprecated Fallback for users created before OAuth3 migration (privyId field)
  if (!dbUser) {
    [dbUser] = await db
      .select(userSelectFields)
      .from(users)
      .where(eq(users.privyId, oauth3Id))
      .limit(1);
  }

  // Create minimal user record on first authentication
  if (!dbUser) {
    // Resolve referrer if referralCode provided
    let resolvedReferrerId: string | null = null;
    if (referralCode) {
      const normalizedCode = referralCode.trim();

      // First, try to find referrer by username (legacy system)
      const [referrerByUsername] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.username, normalizedCode))
        .limit(1);

      if (referrerByUsername && referrerByUsername.id !== canonicalUserId) {
        resolvedReferrerId = referrerByUsername.id;

        logger.info(
          'Found valid referrer by username for new user',
          {
            referrerId: referrerByUsername.id,
            referrerUsername: referrerByUsername.username,
            referredUserId: canonicalUserId,
            referralCode: normalizedCode,
          },
          'GET /api/users/me'
        );
      } else if (
        referrerByUsername &&
        referrerByUsername.id === canonicalUserId
      ) {
        logger.warn(
          'Self-referral attempt blocked (username lookup)',
          { userId: canonicalUserId, referralCode: normalizedCode },
          'GET /api/users/me'
        );
      } else {
        // If not found by username, try by referralCode
        const [referrerByCode] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(eq(users.referralCode, normalizedCode))
          .limit(1);

        if (referrerByCode && referrerByCode.id !== canonicalUserId) {
          resolvedReferrerId = referrerByCode.id;

          logger.info(
            'Found valid referrer by referralCode for new user',
            {
              referrerId: referrerByCode.id,
              referrerUsername: referrerByCode.username,
              referredUserId: canonicalUserId,
              referralCode: normalizedCode,
            },
            'GET /api/users/me'
          );
        } else if (referrerByCode && referrerByCode.id === canonicalUserId) {
          logger.warn(
            'Self-referral attempt blocked (referralCode lookup)',
            { userId: canonicalUserId, referralCode: normalizedCode },
            'GET /api/users/me'
          );
        } else {
          logger.warn(
            'Invalid referral code provided (not found by username or referralCode)',
            { referralCode: normalizedCode, userId: canonicalUserId },
            'GET /api/users/me'
          );
        }
      }
    }

    logger.info(
      'Creating minimal user record on first authentication',
      {
        oauth3Id,
        userId: canonicalUserId,
        walletAddress,
        referredBy: resolvedReferrerId,
      },
      'GET /api/users/me'
    );

    const [newUser] = await db
      .insert(users)
      .values({
        id: canonicalUserId,
        oauth3Id,
        /** @deprecated Set for backward compatibility with legacy queries. */
        privyId: oauth3Id,
        walletAddress,
        referredBy: resolvedReferrerId,
        profileComplete: false,
        hasUsername: false,
        hasBio: false,
        hasProfileImage: false,
        updatedAt: new Date(),
      })
      .returning(userSelectFields);

    if (!newUser) {
      throw new InternalServerError('Failed to create user record');
    }
    dbUser = newUser;

    logger.info(
      'Minimal user record created',
      {
        userId: dbUser.id,
        oauth3Id,
        referredBy: dbUser.referredBy,
      },
      'GET /api/users/me'
    );
  } else if (referralCode && dbUser && !dbUser.profileComplete) {
    // User exists BUT profile not complete - update referredBy with latest referral code (latest wins!)
    const normalizedCode = referralCode.trim();

    // First, try to find referrer by username (legacy system)
    let [referrer] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.username, normalizedCode))
      .limit(1);

    // If not found by username, try by referralCode
    if (!referrer) {
      [referrer] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.referralCode, normalizedCode))
        .limit(1);
    }

    if (referrer && referrer.id !== dbUser.id) {
      const previousReferrer = dbUser.referredBy;

      const [updatedUser] = await db
        .update(users)
        .set({ referredBy: referrer.id })
        .where(eq(users.id, dbUser.id))
        .returning();

      if (!updatedUser) {
        throw new InternalServerError('Failed to update user record');
      }
      dbUser = updatedUser;

      if (previousReferrer && previousReferrer !== referrer.id) {
        logger.info(
          'Updated user with NEW referrer (latest referral wins)',
          {
            userId: dbUser.id,
            previousReferrer,
            newReferrer: referrer.id,
            referrerUsername: referrer.username,
            referralCode,
          },
          'GET /api/users/me'
        );
      } else if (!previousReferrer) {
        logger.info(
          'Updated existing user with referrer',
          {
            userId: dbUser.id,
            referrerId: referrer.id,
            referrerUsername: referrer.username,
            referralCode,
          },
          'GET /api/users/me'
        );
      }
    } else if (referrer?.id === dbUser.id) {
      logger.warn(
        'Self-referral attempt blocked for existing user',
        { userId: dbUser.id, referralCode },
        'GET /api/users/me'
      );
    }
  } else if (referralCode && dbUser && dbUser.profileComplete) {
    // User has completed profile - don't allow referral changes anymore
    logger.warn(
      'Referral change blocked - profile already complete',
      { userId: dbUser.id, referralCode, existingReferrer: dbUser.referredBy },
      'GET /api/users/me'
    );
  }

  // At this point dbUser should always be defined (either fetched or created)
  if (!dbUser) {
    throw new InternalServerError('Failed to create or find user record');
  }

  // Get cached profile stats
  const stats = await cachedDb.getUserProfileStats(dbUser.id);

  const responseUser = {
    id: dbUser.id,
    /** @deprecated Legacy field from Privy auth migration. Use oauth3Id instead. */
    privyId: dbUser.privyId,
    oauth3Id: dbUser.oauth3Id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    bio: dbUser.bio,
    profileImageUrl: dbUser.profileImageUrl,
    coverImageUrl: dbUser.coverImageUrl,
    walletAddress: dbUser.walletAddress,
    profileComplete: dbUser.profileComplete,
    hasUsername: dbUser.hasUsername,
    hasBio: dbUser.hasBio,
    hasProfileImage: dbUser.hasProfileImage,
    onChainRegistered: dbUser.onChainRegistered,
    nftTokenId: dbUser.nftTokenId,
    referralCode: dbUser.referralCode,
    referredBy: dbUser.referredBy,
    reputationPoints: dbUser.reputationPoints,
    pointsAwardedForProfile: dbUser.pointsAwardedForProfile,
    pointsAwardedForFarcasterFollow: dbUser.pointsAwardedForFarcasterFollow,
    pointsAwardedForTwitterFollow: dbUser.pointsAwardedForTwitterFollow,
    pointsAwardedForDiscordJoin: dbUser.pointsAwardedForDiscordJoin,
    hasFarcaster: dbUser.hasFarcaster,
    hasTwitter: dbUser.hasTwitter,
    hasDiscord: dbUser.hasDiscord,
    farcasterUsername: dbUser.farcasterUsername,
    twitterUsername: dbUser.twitterUsername,
    discordUsername: dbUser.discordUsername,
    showTwitterPublic: dbUser.showTwitterPublic,
    showFarcasterPublic: dbUser.showFarcasterPublic,
    showWalletPublic: dbUser.showWalletPublic,
    isAdmin: dbUser.isAdmin,
    isActor: dbUser.isActor,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    stats: stats ?? undefined,
  };

  const needsOnboarding = !dbUser.profileComplete;
  const needsOnchain = dbUser.profileComplete && !dbUser.onChainRegistered;

  logger.info(
    'Authenticated user profile fetched',
    {
      userId: dbUser.id,
      username: dbUser.username,
      profileComplete: dbUser.profileComplete,
      onChainRegistered: dbUser.onChainRegistered,
      nftTokenId: dbUser.nftTokenId,
      needsOnboarding,
      needsOnchain,
    },
    'GET /api/users/me'
  );

  return successResponse({
    authenticated: true,
    needsOnboarding,
    needsOnchain,
    user: responseUser,
  });
});
