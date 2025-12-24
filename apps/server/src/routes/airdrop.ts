import { airdropAllocations, db, eq } from '@babylon/db'
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
          .select()
          .from(airdropAllocations)
          .where(eq(airdropAllocations.userId, user.userId))
          .limit(1)

        const allocation = allocationResult[0]

        if (!allocation) {
          return {
            success: true,
            registered: false,
            message: 'Not registered for airdrop',
          }
        }

        const totalAllocation = BigInt(allocation.totalAllocation)
        const totalClaimed = BigInt(allocation.totalClaimed)
        const dripsUnlocked = allocation.dripsUnlocked
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
          .select()
          .from(airdropAllocations)
          .where(eq(airdropAllocations.userId, user.userId))
          .limit(1)

        const allocation = allocationResult[0]

        if (!allocation) {
          set.status = 400
          return { error: 'Not registered for airdrop' }
        }

        const totalDrips = TOTAL_DRIP_DAYS + 1
        if (allocation.dripsUnlocked >= totalDrips) {
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
        const isInitialClaim = allocation.dripsUnlocked === 0
        const dripPercent = isInitialClaim
          ? INITIAL_CLAIM_PERCENT
          : DAILY_DRIP_PERCENT
        const totalAllocation = BigInt(allocation.totalAllocation)
        const dripAmount = (totalAllocation * BigInt(dripPercent)) / 100n

        // Update allocation
        await db
          .update(airdropAllocations)
          .set({
            dripsUnlocked: allocation.dripsUnlocked + 1,
            totalClaimed: (
              BigInt(allocation.totalClaimed) + dripAmount
            ).toString(),
            lastDripTime: new Date(),
          })
          .where(eq(airdropAllocations.userId, user.userId))

        logger.info(
          'Drip claimed',
          {
            userId: user.userId,
            dripNumber: allocation.dripsUnlocked + 1,
            dripAmount: dripAmount.toString(),
            isInitialClaim,
          },
          'POST /api/airdrop/drip',
        )

        return {
          success: true,
          dripNumber: allocation.dripsUnlocked + 1,
          dripAmount: dripAmount.toString(),
          dripAmountFormatted: formatTokens(dripAmount),
          isInitialClaim,
          message: isInitialClaim
            ? 'Initial 10% claimed successfully!'
            : 'Daily 2% drip claimed successfully!',
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
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

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

        // TODO: Calculate allocation based on points snapshot
        // For now, return a placeholder
        logger.info(
          'Airdrop registration requested',
          { userId: user.userId },
          'POST /api/airdrop/register',
        )

        return {
          success: true,
          message: 'Registration submitted. Allocation will be calculated.',
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

        // TODO: Get actual engagement data from EngagementService
        const today = new Date()
        const dateKey = today.toISOString().split('T')[0]

        logger.info(
          'Engagement status fetched',
          { userId: user.userId },
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
          nextResetTime: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1,
          ).toISOString(),
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
        const { query } = ctx
        const limit = Math.min(Number.parseInt(query.limit || '50', 10), 100)
        const offset = Number.parseInt(query.offset || '0', 10)

        // TODO: Get actual leaderboard data
        logger.info(
          'Airdrop leaderboard fetched',
          { limit, offset },
          'GET /api/airdrop/leaderboard',
        )

        return {
          success: true,
          leaderboard: [],
          pagination: {
            limit,
            offset,
            total: 0,
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
