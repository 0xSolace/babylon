/**
 * Agent0 Reputation Cache Service
 *
 * Caches ERC-8004/Agent0 reputation scores with 24-hour staleness check.
 * Recalculates reputation when cache is stale.
 */

import { db } from '@babylon/db'
import { recalculateReputation } from '@babylon/engine'
import { logger } from '@babylon/shared'

const CACHE_STALE_HOURS = 24
const CACHE_STALE_MS = CACHE_STALE_HOURS * 60 * 60 * 1000

/**
 * Get cached reputation score for a user/agent
 * Returns cached value if fresh, otherwise recalculates
 */
export async function getCachedAgent0ReputationScore(
  userId: string,
): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      earnedPoints: true,
      reputationPoints: true,
    },
  })

  if (!user) {
    logger.warn(
      'User not found for reputation cache',
      { userId },
      'Agent0ReputationCache',
    )
    return 50 // Neutral default
  }

  // If banned, return 0
  if (user.isBanned) {
    return 0
  }

  // If scammer or CSAM, return very low score (but not 0, to distinguish from banned)
  if (user.isScammer || user.isCSAM) {
    return 5 // Very low but not zero
  }

  // Get performance metrics separately
  const metrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
    select: {
      reputationScore: true,
      lastActivityAt: true,
      updatedAt: true,
    },
  })

  // Check if we have cached data
  if (metrics) {
    const updatedAt =
      metrics.updatedAt instanceof Date
        ? metrics.updatedAt
        : new Date(String(metrics.updatedAt))
    const cacheAge = Date.now() - updatedAt.getTime()

    // If cache is fresh (< 24 hours), return cached score
    if (cacheAge < CACHE_STALE_MS) {
      const score = Number(metrics.reputationScore)
      logger.debug(
        'Using cached reputation score',
        {
          userId,
          score,
          cacheAgeHours: cacheAge / (60 * 60 * 1000),
        },
        'Agent0ReputationCache',
      )
      return score
    }
  }

  // Cache is stale or missing, recalculate
  logger.info(
    'Recalculating stale reputation score',
    {
      userId,
      agent0TokenId: user.agent0TokenId,
      hasMetrics: !!metrics,
    },
    'Agent0ReputationCache',
  )

  await recalculateReputation(userId)
  if (user.agent0TokenId) {
    logger.debug(
      'Agent0 token ID found, using local reputation calculation',
      {
        userId,
        agent0TokenId: user.agent0TokenId,
      },
      'Agent0ReputationCache',
    )
    // To fetch on-chain Agent0 reputation, use ReputationBridge or Agent0FeedbackService
  }

  // Return local reputation if Agent0 fetch failed or no token ID
  const updatedMetrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
    select: { reputationScore: true },
  })

  return updatedMetrics ? Number(updatedMetrics.reputationScore) : 50 // Neutral default
}

/**
 * Invalidate reputation cache for a user
 * Forces recalculation on next access
 */
export async function invalidateReputationCache(userId: string): Promise<void> {
  await db.agentPerformanceMetrics.update({
    where: { userId },
    data: {
      updatedAt: new Date(Date.now() - CACHE_STALE_MS - 1), // Make it stale
    },
  })

  logger.info(
    'Invalidated reputation cache',
    { userId },
    'Agent0ReputationCache',
  )
}

/**
 * Check if user has sent more points than earned (reputation loss condition)
 */
export async function checkOverspending(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      earnedPoints: true,
      invitePoints: true,
      bonusPoints: true,
    },
  })

  if (!user) {
    return false
  }

  // Get points transactions for transfer_sent
  const transactions = await db.pointsTransaction.findMany({
    where: {
      userId,
      reason: 'transfer_sent',
    },
    select: { amount: true },
  })

  // Calculate total points sent (negative amounts)
  const totalSent = Math.abs(
    transactions.reduce((sum, tx) => sum + Math.min(0, Number(tx.amount)), 0),
  )

  // Total earned = earnedPoints + invitePoints + bonusPoints
  const totalEarned =
    Number(user.earnedPoints) +
    Number(user.invitePoints) +
    Number(user.bonusPoints)

  // If sent more than earned, they're overspending
  return totalSent > totalEarned
}

/**
 * Calculate reputation score based on activity and behavior
 *
 * Rules:
 * - Neutral (50) for inactivity
 * - Loss for overspending (sending more than earned)
 * - 0 for bans
 * - Very low (5) for scammers/CSAM
 */
export async function calculateAgent0ReputationScore(
  userId: string,
): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      earnedPoints: true,
    },
  })

  if (!user) {
    return 50 // Neutral default
  }

  // Banned users get 0
  if (user.isBanned) {
    return 0
  }

  // Scammers/CSAM get very low score (but not 0)
  if (user.isScammer || user.isCSAM) {
    return 5
  }

  // Get performance metrics
  const metrics = await db.agentPerformanceMetrics.findUnique({
    where: { userId },
    select: {
      gamesPlayed: true,
      totalFeedbackCount: true,
      averageFeedbackScore: true,
      normalizedPnL: true,
      lastActivityAt: true,
    },
  })

  const hasActivity =
    metrics &&
    (Number(metrics.gamesPlayed) > 0 ||
      Number(metrics.totalFeedbackCount) > 0 ||
      metrics.lastActivityAt !== null)

  // No activity = neutral score (50)
  if (!hasActivity) {
    return 50
  }

  // Check for overspending
  const isOverspending = await checkOverspending(userId)
  if (isOverspending) {
    // Reduce reputation based on overspending ratio
    const overspendingRatio = await calculateOverspendingRatio(userId)
    // Penalty: reduce score by up to 30 points based on overspending
    const penalty = Math.min(30, overspendingRatio * 30)
    const baseScore = metrics ? Number(metrics.averageFeedbackScore) : 50
    return Math.max(0, baseScore - penalty)
  }

  // Use standard reputation calculation
  const updatedMetrics = await recalculateReputation(userId)
  return Number(updatedMetrics?.reputationScore ?? 50)
}

/**
 * Calculate overspending ratio (0-1)
 */
async function calculateOverspendingRatio(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      earnedPoints: true,
      invitePoints: true,
      bonusPoints: true,
    },
  })

  if (!user) {
    return 0
  }

  // Get points transactions for transfer_sent
  const transactions = await db.pointsTransaction.findMany({
    where: {
      userId,
      reason: 'transfer_sent',
    },
    select: { amount: true },
  })

  const totalSent = Math.abs(
    transactions.reduce((sum, tx) => sum + Math.min(0, Number(tx.amount)), 0),
  )
  const totalEarned =
    Number(user.earnedPoints) +
    Number(user.invitePoints) +
    Number(user.bonusPoints)

  if (totalEarned === 0) {
    return totalSent > 0 ? 1 : 0 // If they sent anything without earning, ratio is 1
  }

  return Math.min(1, totalSent / totalEarned)
}
