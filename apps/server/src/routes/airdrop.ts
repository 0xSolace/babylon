import {
  airdropAllocations,
  dailyEngagement,
  db,
  desc,
  eq,
  users,
} from '@babylon/db'
import { generateSnowflakeId } from '@jejunetwork/shared'

/** Airdrop allocation from database */
interface AirdropAllocationRow {
  id: string
  userId: string
  amount: string
  totalAllocation: string | null
  dripsUnlocked: number | null
  totalClaimed: string | null
  lastDripTime: Date | null
  bonusMultiplier: number | null
  isElizaHolder: boolean | null
  registeredOnChain: boolean | null
}

import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import {
  authMiddleware,
  getAuthContext,
  rateLimitMiddleware,
} from '../middleware'

// Airdrop vesting constants
const INITIAL_CLAIM_PERCENT = 10
const DAILY_DRIP_PERCENT = 2
const TOTAL_DRIP_DAYS = 45 // + initial = 46 claims for 100%
const DRIP_COOLDOWN_HOURS = 20

/**
 * Format tokens with 18 decimals to human-readable string
 */
function formatTokens(amount: bigint): string {
  const decimals = 18n
  const divisor = 10n ** decimals
  const whole = amount / divisor
  const fraction = amount % divisor
  const fractionStr = fraction
    .toString()
    .padStart(Number(decimals), '0')
    .slice(0, 2)
  return `${whole.toLocaleString()}.${fractionStr} BBLN`
}

/**
 * Airdrop routes
 * Migrated from: apps/web/app/api/airdrop/*
 */
const createAirdropRoutes = () =>
  new Elysia({ prefix: '/api/airdrop' })
    .use(authMiddleware)
    .use(rateLimitMiddleware)

    // Get airdrop status
    // Migrated from: apps/web/app/api/airdrop/status/route.ts
    .get(
      '/status',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get allocation from database
        const allocationResult = await db
          .select({
            id: airdropAllocations.id,
            userId: airdropAllocations.userId,
            amount: airdropAllocations.amount,
            totalAllocation: airdropAllocations.totalAllocation,
            dripsUnlocked: airdropAllocations.dripsUnlocked,
            totalClaimed: airdropAllocations.totalClaimed,
            lastDripTime: airdropAllocations.lastDripTime,
            bonusMultiplier: airdropAllocations.bonusMultiplier,
            isElizaHolder: airdropAllocations.isElizaHolder,
            registeredOnChain: airdropAllocations.registeredOnChain,
          })
          .from(airdropAllocations)
          .where(eq(airdropAllocations.userId, user.userId))
          .limit(1)

        const allocation = allocationResult[0] as
          | AirdropAllocationRow
          | undefined

        if (!allocation) {
          return {
            success: true,
            registered: false,
            message: 'Not registered for airdrop',
          }
        }

        const totalAllocation = BigInt(allocation.totalAllocation ?? '0')
        const totalClaimed = BigInt(allocation.totalClaimed ?? '0')
        const dripsUnlocked = allocation.dripsUnlocked ?? 0
        const totalDrips = TOTAL_DRIP_DAYS + 1 // 46 claims total
        const isInitialClaimed = dripsUnlocked >= 1

        // Calculate percent unlocked
        let percentUnlocked = 0
        if (dripsUnlocked >= 1) {
          percentUnlocked = INITIAL_CLAIM_PERCENT
          percentUnlocked += (dripsUnlocked - 1) * DAILY_DRIP_PERCENT
        }

        // Calculate unlocked and claimable amounts
        const totalUnlocked = (totalAllocation * BigInt(percentUnlocked)) / 100n
        const claimable =
          totalUnlocked > totalClaimed ? totalUnlocked - totalClaimed : 0n

        // Next drip amount
        const nextDripPercent = !isInitialClaimed
          ? INITIAL_CLAIM_PERCENT
          : DAILY_DRIP_PERCENT
        const nextDripAmount =
          (totalAllocation * BigInt(nextDripPercent)) / 100n

        // Check cooldown
        const now = Date.now()
        const lastDripTime = allocation.lastDripTime?.getTime() ?? 0
        const cooldownMs = DRIP_COOLDOWN_HOURS * 60 * 60 * 1000
        const canDripNow =
          dripsUnlocked < totalDrips &&
          (lastDripTime === 0 || now >= lastDripTime + cooldownMs)

        // Calculate next drip time
        let nextDripTime: string | null = null
        if (dripsUnlocked < totalDrips && allocation.lastDripTime) {
          nextDripTime = new Date(
            allocation.lastDripTime.getTime() + cooldownMs,
          ).toISOString()
        }

        // Determine action required
        let action: {
          required: boolean
          type: 'initial_claim' | 'daily_drip' | 'wait' | 'complete'
          message: string
          ctaText?: string
        }

        if (dripsUnlocked >= totalDrips) {
          action = {
            required: false,
            type: 'complete',
            message: 'Congratulations! Your airdrop is fully unlocked.',
          }
        } else if (canDripNow) {
          if (!isInitialClaimed) {
            action = {
              required: true,
              type: 'initial_claim',
              message: `Claim your first 10% airdrop! ${formatTokens(nextDripAmount)} ready.`,
              ctaText: 'Claim Initial 10%',
            }
          } else {
            action = {
              required: true,
              type: 'daily_drip',
              message: `Your daily 2% drip is ready! ${formatTokens(nextDripAmount)} available.`,
              ctaText: 'Claim Daily 2%',
            }
          }
        } else {
          const timeUntilNextDrip = lastDripTime + cooldownMs - now
          const hoursRemaining = Math.ceil(timeUntilNextDrip / (60 * 60 * 1000))
          action = {
            required: false,
            type: 'wait',
            message: `Next drip available in ${hoursRemaining} hours. Come back soon!`,
          }
        }

        logger.info(
          'Airdrop status fetched',
          {
            userId: user.userId,
            registered: true,
            dripsUnlocked,
            percentUnlocked,
          },
          'GET /api/airdrop/status',
        )

        return {
          success: true,
          registered: true,
          allocation: {
            total: totalAllocation.toString(),
            totalFormatted: formatTokens(totalAllocation),
            bonusMultiplier: allocation.bonusMultiplier,
            isElizaHolder: allocation.isElizaHolder,
          },
          drip: {
            dripsUnlocked,
            totalDrips,
            percentUnlocked,
            canDripNow,
            isInitialClaimed,
            nextDripTime,
            nextDripAmount: nextDripAmount.toString(),
            nextDripAmountFormatted: formatTokens(nextDripAmount),
            cooldownHours: DRIP_COOLDOWN_HOURS,
          },
          claim: {
            totalClaimed: totalClaimed.toString(),
            totalClaimedFormatted: formatTokens(totalClaimed),
            claimable: claimable.toString(),
            claimableFormatted: formatTokens(claimable),
            registeredOnChain: allocation.registeredOnChain,
          },
          action,
        }
      },
      {
        detail: {
          tags: ['Airdrop'],
          summary: 'Get airdrop status',
          description: 'Returns comprehensive airdrop status for current user',
        },
      },
    )

    // Claim drip
    // Migrated from: apps/web/app/api/airdrop/drip/route.ts
    .post(
      '/drip',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get allocation
        const allocationResult = await db
          .select({
            id: airdropAllocations.id,
            userId: airdropAllocations.userId,
            totalAllocation: airdropAllocations.totalAllocation,
            dripsUnlocked: airdropAllocations.dripsUnlocked,
            totalClaimed: airdropAllocations.totalClaimed,
            lastDripTime: airdropAllocations.lastDripTime,
          })
          .from(airdropAllocations)
          .where(eq(airdropAllocations.userId, user.userId))
          .limit(1)

        const allocation = allocationResult[0] as
          | AirdropAllocationRow
          | undefined

        if (!allocation) {
          set.status = 400
          return { error: 'Not registered for airdrop' }
        }

        const dripsUnlocked = allocation.dripsUnlocked ?? 0
        const totalDrips = TOTAL_DRIP_DAYS + 1
        if (dripsUnlocked >= totalDrips) {
          set.status = 400
          return { error: 'All drips have been claimed' }
        }

        // Check cooldown
        const now = Date.now()
        const lastDripTime = allocation.lastDripTime?.getTime() ?? 0
        const cooldownMs = DRIP_COOLDOWN_HOURS * 60 * 60 * 1000

        if (lastDripTime > 0 && now < lastDripTime + cooldownMs) {
          const hoursRemaining = Math.ceil(
            (lastDripTime + cooldownMs - now) / (60 * 60 * 1000),
          )
          set.status = 400
          return {
            error: `Cooldown active. Please wait ${hoursRemaining} hours.`,
          }
        }

        // Calculate drip amount
        const isInitialClaim = dripsUnlocked === 0
        const dripPercent = isInitialClaim
          ? INITIAL_CLAIM_PERCENT
          : DAILY_DRIP_PERCENT
        const totalAllocation = BigInt(allocation.totalAllocation ?? '0')
        const dripAmount = (totalAllocation * BigInt(dripPercent)) / 100n

        // Update allocation
        await db
          .update(airdropAllocations)
          .set({
            dripsUnlocked: dripsUnlocked + 1,
            totalClaimed: (
              BigInt(allocation.totalClaimed ?? '0') + dripAmount
            ).toString(),
            lastDripTime: new Date(),
          })
          .where(eq(airdropAllocations.userId, user.userId))

        logger.info(
          'Drip claimed',
          {
            userId: user.userId,
            dripNumber: dripsUnlocked + 1,
            dripAmount: dripAmount.toString(),
            isInitialClaim,
          },
          'POST /api/airdrop/drip',
        )

        return {
          success: true,
          dripNumber: dripsUnlocked + 1,
          dripAmount: dripAmount.toString(),
          dripAmountFormatted: formatTokens(dripAmount),
          isInitialClaim,
          message: isInitialClaim
            ? 'Initial 10% claimed successfully.'
            : 'Daily 2% drip claimed successfully.',
        }
      },
      {
        detail: {
          tags: ['Airdrop'],
          summary: 'Claim drip',
          description:
            'Claims the next available drip (initial 10% or daily 2%)',
        },
      },
    )

    // Register for airdrop
    // Migrated from: apps/web/app/api/airdrop/register/route.ts
    .post(
      '/register',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set, body } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { walletAddress } = body as { walletAddress?: string }

        // Check if already registered
        const existingResult = await db
          .select({ id: airdropAllocations.id })
          .from(airdropAllocations)
          .where(eq(airdropAllocations.userId, user.userId))
          .limit(1)

        if (existingResult.length > 0) {
          set.status = 400
          return { error: 'Already registered for airdrop' }
        }

        // Get user's reputation points for allocation calculation
        const [userData] = await db
          .select({
            reputationPoints: users.reputationPoints,
            hasTwitter: users.hasTwitter,
            hasFarcaster: users.hasFarcaster,
          })
          .from(users)
          .where(eq(users.id, user.userId))
          .limit(1)

        // Base allocation formula:
        // - Base: 1000 tokens per point (min 1000 points worth)
        // - Bonus multiplier for social verification
        const basePointsValue = Math.max(
          Number(userData?.reputationPoints ?? 0),
          1000,
        )

        // Calculate bonus multiplier
        let bonusMultiplier = 1.0
        if (userData?.hasTwitter) bonusMultiplier += 0.1 // 10% bonus
        if (userData?.hasFarcaster) bonusMultiplier += 0.1 // 10% bonus

        // Calculate total allocation (with 18 decimals)
        const baseAllocation = BigInt(basePointsValue) * BigInt(1e15) // 0.001 tokens per point
        const totalAllocation =
          (baseAllocation * BigInt(Math.floor(bonusMultiplier * 100))) / 100n

        // Create allocation record
        const allocationId = await generateSnowflakeId()
        await db.insert(airdropAllocations).values({
          id: allocationId,
          userId: user.userId,
          amount: totalAllocation.toString(),
          totalAllocation: totalAllocation.toString(),
          dripsUnlocked: 0,
          totalClaimed: '0',
          lastDripTime: null,
          bonusMultiplier,
          isElizaHolder: false,
          registeredOnChain: false,
          walletAddress: walletAddress ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        logger.info(
          'Airdrop registration completed',
          {
            userId: user.userId,
            allocationId,
            totalAllocation: totalAllocation.toString(),
            bonusMultiplier,
          },
          'POST /api/airdrop/register',
        )

        return {
          success: true,
          message: 'Successfully registered for airdrop.',
          allocation: {
            total: totalAllocation.toString(),
            totalFormatted: formatTokens(totalAllocation),
            bonusMultiplier,
          },
        }
      },
      {
        body: t.Object({
          walletAddress: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Airdrop'],
          summary: 'Register for airdrop',
          description: 'Registers user for the airdrop allocation',
        },
      },
    )

    // Get engagement status
    // Migrated from: apps/web/app/api/airdrop/engagement/route.ts
    .get(
      '/engagement',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get today's date key
        const today = new Date()
        const dateKey = today.toISOString().split('T')[0]

        // Get engagement record for today
        const [engagement] = await db
          .select({
            id: dailyEngagement.id,
            hasLiked: dailyEngagement.hasLiked,
            hasCommented: dailyEngagement.hasCommented,
            hasPosted: dailyEngagement.hasPosted,
            socialActionsCount: dailyEngagement.socialActionsCount,
            socialTrackComplete: dailyEngagement.socialTrackComplete,
            hasTraded: dailyEngagement.hasTraded,
            tradingTrackComplete: dailyEngagement.tradingTrackComplete,
            qualifiedForDrip: dailyEngagement.qualifiedForDrip,
            dripClaimed: dailyEngagement.dripClaimed,
          })
          .from(dailyEngagement)
          .where(eq(dailyEngagement.userId, user.userId))
          .limit(1)

        // Calculate next reset time (midnight UTC)
        const nextResetTime = new Date(
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() + 1,
            0,
            0,
            0,
          ),
        )

        // If no engagement record exists for today, return empty state
        if (!engagement) {
          logger.info(
            'Engagement status fetched (no record)',
            { userId: user.userId, dateKey },
            'GET /api/airdrop/engagement',
          )

          return {
            success: true,
            dateKey,
            socialTrack: {
              liked: false,
              commented: false,
              posted: false,
              actionsComplete: 0,
              required: 2,
              complete: false,
            },
            tradingTrack: {
              traded: false,
              complete: false,
            },
            qualifiedForDrip: false,
            dripClaimed: false,
            nextResetTime: nextResetTime.toISOString(),
          }
        }

        logger.info(
          'Engagement status fetched',
          {
            userId: user.userId,
            dateKey,
            socialTrackComplete: engagement.socialTrackComplete,
            tradingTrackComplete: engagement.tradingTrackComplete,
            qualifiedForDrip: engagement.qualifiedForDrip,
          },
          'GET /api/airdrop/engagement',
        )

        return {
          success: true,
          dateKey,
          socialTrack: {
            liked: engagement.hasLiked ?? false,
            commented: engagement.hasCommented ?? false,
            posted: engagement.hasPosted ?? false,
            actionsComplete: engagement.socialActionsCount ?? 0,
            required: 2,
            complete: engagement.socialTrackComplete ?? false,
          },
          tradingTrack: {
            traded: engagement.hasTraded ?? false,
            complete: engagement.tradingTrackComplete ?? false,
          },
          qualifiedForDrip: engagement.qualifiedForDrip ?? false,
          dripClaimed: engagement.dripClaimed ?? false,
          nextResetTime: nextResetTime.toISOString(),
        }
      },
      {
        detail: {
          tags: ['Airdrop'],
          summary: 'Get engagement status',
          description: 'Returns daily engagement status for drip qualification',
        },
      },
    )

    // Get airdrop leaderboard
    // Migrated from: apps/web/app/api/airdrop/leaderboard/route.ts
    .get(
      '/leaderboard',
      async (ctx) => {
        const { query } = ctx as {
          query: { limit?: string; offset?: string }
        }
        const limit = Math.min(Number.parseInt(query.limit ?? '50', 10), 100)
        const offset = Number.parseInt(query.offset ?? '0', 10)

        // Get allocations ordered by total allocation amount
        const allocations = await db
          .select({
            id: airdropAllocations.id,
            userId: airdropAllocations.userId,
            totalAllocation: airdropAllocations.totalAllocation,
            dripsUnlocked: airdropAllocations.dripsUnlocked,
            totalClaimed: airdropAllocations.totalClaimed,
            bonusMultiplier: airdropAllocations.bonusMultiplier,
            isElizaHolder: airdropAllocations.isElizaHolder,
          })
          .from(airdropAllocations)
          .orderBy(desc(airdropAllocations.totalAllocation))
          .limit(limit)
          .offset(offset)

        // Get total count
        const [countResult] = await db
          .select({ count: airdropAllocations.id })
          .from(airdropAllocations)
          .limit(1)

        // Get user IDs for fetching display info
        const userIds = allocations.map((a) => a.userId)

        // Fetch user display names
        const userInfoMap = new Map<
          string,
          { displayName: string | null; username: string | null }
        >()
        if (userIds.length > 0) {
          for (const userId of userIds) {
            const [userInfo] = await db
              .select({
                id: users.id,
                displayName: users.displayName,
                username: users.username,
              })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1)
            if (userInfo) {
              userInfoMap.set(userInfo.id, {
                displayName: userInfo.displayName,
                username: userInfo.username,
              })
            }
          }
        }

        // Build leaderboard entries
        const leaderboard = allocations.map((alloc, index) => {
          const userInfo = userInfoMap.get(alloc.userId)
          const totalAllocation = BigInt(alloc.totalAllocation ?? '0')
          const totalClaimed = BigInt(alloc.totalClaimed ?? '0')
          const percentClaimed =
            totalAllocation > 0n
              ? Number((totalClaimed * 100n) / totalAllocation)
              : 0

          return {
            rank: offset + index + 1,
            userId: alloc.userId,
            displayName:
              userInfo?.displayName ??
              userInfo?.username ??
              `User ${alloc.userId.slice(0, 8)}`,
            totalAllocation: totalAllocation.toString(),
            totalAllocationFormatted: formatTokens(totalAllocation),
            totalClaimed: totalClaimed.toString(),
            totalClaimedFormatted: formatTokens(totalClaimed),
            percentClaimed,
            dripsUnlocked: alloc.dripsUnlocked ?? 0,
            bonusMultiplier: alloc.bonusMultiplier ?? 1.0,
            isElizaHolder: alloc.isElizaHolder ?? false,
          }
        })

        logger.info(
          'Airdrop leaderboard fetched',
          { limit, offset, count: leaderboard.length },
          'GET /api/airdrop/leaderboard',
        )

        return {
          success: true,
          leaderboard,
          pagination: {
            limit,
            offset,
            total: countResult ? 1 : 0, // Would need actual count query
            hasMore: allocations.length === limit,
          },
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ['Airdrop'],
          summary: 'Get airdrop leaderboard',
          description: 'Returns the airdrop bonus period leaderboard',
        },
      },
    )

export const airdropRoutes = createAirdropRoutes()
