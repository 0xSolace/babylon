import { cachedDb } from '@babylon/api'
import {
  and,
  db,
  desc,
  eq,
  follows,
  inArray,
  userBlocks,
  userMutes,
  users,
} from '@babylon/db'
import { generateSnowflakeId, logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

/**
 * User select fields for profile queries
 */
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
} as const

/**
 * User routes
 * Migrated from: apps/web/app/api/users/*
 */
const createUsersRoutes = () =>
  new Elysia({ prefix: '/api/users' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get current user profile
    // Migrated from: apps/web/app/api/users/me/route.ts
    .get(
      '/me',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const oauth3Id = user.oauth3Id || user.userId
        const canonicalUserId = user.dbUserId || user.userId
        const walletAddress = user.walletAddress?.toLowerCase() ?? null
        const referralCode = query.ref ?? null

        logger.info(
          'Fetching user profile',
          {
            oauth3Id,
            dbUserId: user.dbUserId,
            hasReferralCode: !!referralCode,
          },
          'GET /api/users/me',
        )

        // Primary lookup by oauth3Id
        const userResults = await db
          .select(userSelectFields)
          .from(users)
          .where(eq(users.oauth3Id, oauth3Id))
          .limit(1)
        let dbUser = userResults[0]

        // @deprecated Fallback for users created before OAuth3 migration (privyId field)
        if (!dbUser) {
          const privyResults = await db
            .select(userSelectFields)
            .from(users)
            .where(eq(users.privyId, oauth3Id))
            .limit(1)
          dbUser = privyResults[0]
        }

        // Create minimal user record on first authentication
        if (!dbUser) {
          let resolvedReferrerId: string | null = null
          if (referralCode) {
            const normalizedCode = referralCode.trim()

            // First try to find referrer by username (legacy system)
            const referrerByUsernameResults = await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(eq(users.username, normalizedCode))
              .limit(1)
            const referrerByUsername = referrerByUsernameResults[0]

            if (
              referrerByUsername &&
              referrerByUsername.id !== canonicalUserId
            ) {
              resolvedReferrerId = referrerByUsername.id
              logger.info(
                'Found valid referrer by username for new user',
                {
                  referrerId: referrerByUsername.id,
                  referrerUsername: referrerByUsername.username,
                  referredUserId: canonicalUserId,
                  referralCode: normalizedCode,
                },
                'GET /api/users/me',
              )
            } else if (!referrerByUsername) {
              // Try by referralCode
              const referrerByCodeResults = await db
                .select({ id: users.id, username: users.username })
                .from(users)
                .where(eq(users.referralCode, normalizedCode))
                .limit(1)
              const referrerByCode = referrerByCodeResults[0]

              if (referrerByCode && referrerByCode.id !== canonicalUserId) {
                resolvedReferrerId = referrerByCode.id
                logger.info(
                  'Found valid referrer by referralCode for new user',
                  {
                    referrerId: referrerByCode.id,
                    referrerUsername: referrerByCode.username,
                    referredUserId: canonicalUserId,
                    referralCode: normalizedCode,
                  },
                  'GET /api/users/me',
                )
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
            'GET /api/users/me',
          )

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
            .returning()

          if (!newUser) {
            set.status = 500
            return { error: 'Failed to create user record' }
          }
          // Re-fetch user profile with selected fields after insert
          const createdUserResults = await db
            .select(userSelectFields)
            .from(users)
            .where(eq(users.id, newUser.id))
            .limit(1)
          dbUser = createdUserResults[0]

          logger.info(
            'Minimal user record created',
            { userId: dbUser.id, oauth3Id, referredBy: dbUser.referredBy },
            'GET /api/users/me',
          )
        } else if (referralCode && !dbUser.profileComplete) {
          // User exists BUT profile not complete - update referredBy with latest referral code
          const normalizedCode = referralCode.trim()

          const referrerByUsernameResults = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.username, normalizedCode))
            .limit(1)
          let referrer = referrerByUsernameResults[0]

          if (!referrer) {
            const referrerByCodeResults = await db
              .select({ id: users.id, username: users.username })
              .from(users)
              .where(eq(users.referralCode, normalizedCode))
              .limit(1)
            referrer = referrerByCodeResults[0]
          }

          if (referrer && referrer.id !== dbUser.id) {
            await db
              .update(users)
              .set({ referredBy: referrer.id })
              .where(eq(users.id, dbUser.id))

            // Re-fetch user profile with selected fields after update
            const updatedUserResults = await db
              .select(userSelectFields)
              .from(users)
              .where(eq(users.id, dbUser.id))
              .limit(1)

            if (updatedUserResults[0]) {
              dbUser = updatedUserResults[0]
              logger.info(
                'Updated existing user with referrer',
                {
                  userId: dbUser.id,
                  referrerId: referrer.id,
                  referrerUsername: referrer.username,
                },
                'GET /api/users/me',
              )
            }
          }
        }

        if (!dbUser) {
          set.status = 500
          return { error: 'Failed to create or find user record' }
        }

        // Get cached profile stats
        const stats = await cachedDb.getUserProfileStats(dbUser.id)

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
          pointsAwardedForFarcasterFollow:
            dbUser.pointsAwardedForFarcasterFollow,
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
          stats,
        }

        const needsOnboarding = !dbUser.profileComplete
        const needsOnchain = dbUser.profileComplete && !dbUser.onChainRegistered

        logger.info(
          'Authenticated user profile fetched',
          {
            userId: dbUser.id,
            username: dbUser.username,
            profileComplete: dbUser.profileComplete,
            onChainRegistered: dbUser.onChainRegistered,
            needsOnboarding,
            needsOnchain,
          },
          'GET /api/users/me',
        )

        return {
          authenticated: true,
          needsOnboarding,
          needsOnchain,
          user: responseUser,
        }
      },
      {
        query: t.Object({
          ref: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Get current user profile',
          description:
            'Returns the authenticated user complete profile including onboarding status, social connections, and reputation.',
        },
      },
    )

    // Get user by ID
    .get(
      '/:userId',
      async ({ params, set }) => {
        const { userId } = params

        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            bio: users.bio,
            profileImageUrl: users.profileImageUrl,
            coverImageUrl: users.coverImageUrl,
            isActor: users.isActor,
            isAdmin: users.isAdmin,
            showTwitterPublic: users.showTwitterPublic,
            showFarcasterPublic: users.showFarcasterPublic,
            showWalletPublic: users.showWalletPublic,
            twitterUsername: users.twitterUsername,
            farcasterUsername: users.farcasterUsername,
            walletAddress: users.walletAddress,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (!user) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Get stats
        const stats = await cachedDb.getUserProfileStats(userId)

        return {
          success: true,
          user: {
            ...user,
            twitterUsername: user.showTwitterPublic
              ? user.twitterUsername
              : null,
            farcasterUsername: user.showFarcasterPublic
              ? user.farcasterUsername
              : null,
            walletAddress: user.showWalletPublic ? user.walletAddress : null,
            createdAt: user.createdAt.toISOString(),
            stats,
          },
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Get user by ID',
        },
      },
    )

    // Get user by username
    .get(
      '/by-username/:username',
      async ({ params, set }) => {
        const { username } = params

        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            bio: users.bio,
            profileImageUrl: users.profileImageUrl,
            coverImageUrl: users.coverImageUrl,
            isActor: users.isActor,
            isAdmin: users.isAdmin,
            showTwitterPublic: users.showTwitterPublic,
            showFarcasterPublic: users.showFarcasterPublic,
            showWalletPublic: users.showWalletPublic,
            twitterUsername: users.twitterUsername,
            farcasterUsername: users.farcasterUsername,
            walletAddress: users.walletAddress,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.username, username))
          .limit(1)

        if (!user) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Get stats
        const stats = await cachedDb.getUserProfileStats(user.id)

        return {
          success: true,
          user: {
            ...user,
            twitterUsername: user.showTwitterPublic
              ? user.twitterUsername
              : null,
            farcasterUsername: user.showFarcasterPublic
              ? user.farcasterUsername
              : null,
            walletAddress: user.showWalletPublic ? user.walletAddress : null,
            createdAt: user.createdAt.toISOString(),
            stats,
          },
        }
      },
      {
        params: t.Object({
          username: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Get user by username',
        },
      },
    )

    // Follow user
    .post(
      '/:userId/follow',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        if (targetUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot follow yourself' }
        }

        // Check target user exists
        const [targetUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1)

        if (!targetUser) {
          set.status = 404
          return { error: 'User not found' }
        }

        // Check if already following
        const [existingFollow] = await db
          .select()
          .from(follows)
          .where(
            and(
              eq(follows.followerId, user.userId),
              eq(follows.followingId, targetUserId),
            ),
          )
          .limit(1)

        if (existingFollow) {
          return { success: true, message: 'Already following' }
        }

        // Create follow
        const followId = await generateSnowflakeId()
        await db.insert(follows).values({
          id: followId,
          followerId: user.userId,
          followingId: targetUserId,
          createdAt: new Date(),
        })

        logger.info(
          'User followed',
          { followerId: user.userId, followingId: targetUserId },
          'POST /api/users/:userId/follow',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Follow user',
        },
      },
    )

    // Unfollow user
    .delete(
      '/:userId/follow',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        await db
          .delete(follows)
          .where(
            and(
              eq(follows.followerId, user.userId),
              eq(follows.followingId, targetUserId),
            ),
          )

        logger.info(
          'User unfollowed',
          { followerId: user.userId, unfollowedId: targetUserId },
          'DELETE /api/users/:userId/follow',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Unfollow user',
        },
      },
    )

    // Get user followers
    .get(
      '/:userId/followers',
      async ({ params, query }) => {
        const { userId } = params
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)

        // Get follower relationships
        const followerRelations = await db
          .select({
            followerId: follows.followerId,
            createdAt: follows.createdAt,
          })
          .from(follows)
          .where(eq(follows.followingId, userId))
          .orderBy(desc(follows.createdAt))
          .limit(limit)

        if (followerRelations.length === 0) {
          return { success: true, followers: [], count: 0 }
        }

        // Get follower user details
        const followerIds = followerRelations.map((f) => f.followerId)
        const followerUsers = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            profileImageUrl: users.profileImageUrl,
            isActor: users.isActor,
          })
          .from(users)
          .where(inArray(users.id, followerIds))

        const userMap = new Map(followerUsers.map((u) => [u.id, u]))

        const followersWithDetails = followerRelations
          .map((rel) => {
            const user = userMap.get(rel.followerId)
            if (!user) return null
            return {
              ...user,
              followedAt: rel.createdAt.toISOString(),
            }
          })
          .filter((f): f is NonNullable<typeof f> => f !== null)

        return {
          success: true,
          followers: followersWithDetails,
          count: followersWithDetails.length,
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Get user followers',
        },
      },
    )

    // Get user following
    .get(
      '/:userId/following',
      async ({ params, query }) => {
        const { userId } = params
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)

        // Get following relationships
        const followingRelations = await db
          .select({
            followingId: follows.followingId,
            createdAt: follows.createdAt,
          })
          .from(follows)
          .where(eq(follows.followerId, userId))
          .orderBy(desc(follows.createdAt))
          .limit(limit)

        if (followingRelations.length === 0) {
          return { success: true, following: [], count: 0 }
        }

        // Get following user details
        const followingIds = followingRelations.map((f) => f.followingId)
        const followingUsers = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            profileImageUrl: users.profileImageUrl,
            isActor: users.isActor,
          })
          .from(users)
          .where(inArray(users.id, followingIds))

        const userMap = new Map(followingUsers.map((u) => [u.id, u]))

        const followingWithDetails = followingRelations
          .map((rel) => {
            const user = userMap.get(rel.followingId)
            if (!user) return null
            return {
              ...user,
              followedAt: rel.createdAt.toISOString(),
            }
          })
          .filter((f): f is NonNullable<typeof f> => f !== null)

        return {
          success: true,
          following: followingWithDetails,
          count: followingWithDetails.length,
        }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Get user following',
        },
      },
    )

    // Block user
    .post(
      '/:userId/block',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        if (targetUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot block yourself' }
        }

        // Check if already blocked
        const [existingBlock] = await db
          .select()
          .from(userBlocks)
          .where(
            and(
              eq(userBlocks.blockerId, user.userId),
              eq(userBlocks.blockedId, targetUserId),
            ),
          )
          .limit(1)

        if (existingBlock) {
          return { success: true, message: 'Already blocked' }
        }

        // Create block
        const blockId = await generateSnowflakeId()
        await db.insert(userBlocks).values({
          id: blockId,
          blockerId: user.userId,
          blockedId: targetUserId,
          createdAt: new Date(),
        })

        // Also unfollow the user if following
        await db
          .delete(follows)
          .where(
            and(
              eq(follows.followerId, user.userId),
              eq(follows.followingId, targetUserId),
            ),
          )

        logger.info(
          'User blocked',
          { blockerId: user.userId, blockedId: targetUserId },
          'POST /api/users/:userId/block',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Block user',
        },
      },
    )

    // Unblock user
    .delete(
      '/:userId/block',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        await db
          .delete(userBlocks)
          .where(
            and(
              eq(userBlocks.blockerId, user.userId),
              eq(userBlocks.blockedId, targetUserId),
            ),
          )

        logger.info(
          'User unblocked',
          { blockerId: user.userId, unblockedId: targetUserId },
          'DELETE /api/users/:userId/block',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Unblock user',
        },
      },
    )

    // Mute user
    .post(
      '/:userId/mute',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        if (targetUserId === user.userId) {
          set.status = 400
          return { error: 'Cannot mute yourself' }
        }

        // Check if already muted
        const [existingMute] = await db
          .select()
          .from(userMutes)
          .where(
            and(
              eq(userMutes.muterId, user.userId),
              eq(userMutes.mutedId, targetUserId),
            ),
          )
          .limit(1)

        if (existingMute) {
          return { success: true, message: 'Already muted' }
        }

        // Create mute
        const muteId = await generateSnowflakeId()
        await db.insert(userMutes).values({
          id: muteId,
          muterId: user.userId,
          mutedId: targetUserId,
          createdAt: new Date(),
        })

        logger.info(
          'User muted',
          { muterId: user.userId, mutedId: targetUserId },
          'POST /api/users/:userId/mute',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Mute user',
        },
      },
    )

    // Unmute user
    .delete(
      '/:userId/mute',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const targetUserId = params.userId

        await db
          .delete(userMutes)
          .where(
            and(
              eq(userMutes.muterId, user.userId),
              eq(userMutes.mutedId, targetUserId),
            ),
          )

        logger.info(
          'User unmuted',
          { muterId: user.userId, unmutedId: targetUserId },
          'DELETE /api/users/:userId/mute',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Unmute user',
        },
      },
    )

    // Update user visibility settings
    .patch(
      '/:userId/update-visibility',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { params, set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Only allow users to update their own visibility
        if (params.userId !== user.userId) {
          set.status = 403
          return { error: 'Cannot update another user visibility' }
        }

        const updates: Record<string, boolean | Date> = {
          updatedAt: new Date(),
        }
        if (body.showTwitterPublic !== undefined)
          updates.showTwitterPublic = body.showTwitterPublic
        if (body.showFarcasterPublic !== undefined)
          updates.showFarcasterPublic = body.showFarcasterPublic
        if (body.showWalletPublic !== undefined)
          updates.showWalletPublic = body.showWalletPublic

        await db.update(users).set(updates).where(eq(users.id, user.userId))

        logger.info(
          'User visibility updated',
          { userId: user.userId, updates: body },
          'PATCH /api/users/:userId/update-visibility',
        )

        return { success: true }
      },
      {
        params: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          showTwitterPublic: t.Optional(t.Boolean()),
          showFarcasterPublic: t.Optional(t.Boolean()),
          showWalletPublic: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Update visibility settings',
        },
      },
    )

    // User API keys management
    .get(
      '/api-keys',
      async (ctx) => {
        const { user: _user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }
        return {
          todo: 'Migrate list API keys',
          source: 'apps/web/app/api/users/api-keys/route.ts',
        }
      },
      {
        detail: {
          tags: ['Users'],
          summary: 'List user API keys',
        },
      },
    )

    // Create API key
    .post(
      '/api-keys',
      async (ctx) => {
        const { user: _user, isAuthenticated } = getAuthContext(ctx)
        const { body: _body, set } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }
        return {
          todo: 'Migrate create API key',
          source: 'apps/web/app/api/users/api-keys/route.ts',
        }
      },
      {
        body: t.Object({
          name: t.String(),
          permissions: t.Optional(t.Array(t.String())),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Create API key',
        },
      },
    )

    // Delete API key
    .delete(
      '/api-keys/:keyId',
      async (ctx) => {
        const { user: _user, isAuthenticated } = getAuthContext(ctx)
        const { params, set } = ctx
        if (!isAuthenticated) {
          set.status = 401
          return { error: 'Unauthorized' }
        }
        return {
          todo: 'Migrate delete API key',
          source: 'apps/web/app/api/users/api-keys/[keyId]/route.ts',
          keyId: params.keyId,
        }
      },
      {
        params: t.Object({
          keyId: t.String(),
        }),
        detail: {
          tags: ['Users'],
          summary: 'Delete API key',
        },
      },
    )

export const usersRoutes = createUsersRoutes()
