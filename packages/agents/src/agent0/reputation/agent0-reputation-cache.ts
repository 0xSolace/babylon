/**
 * Agent0 Reputation Cache Service
 *
 * Caches ERC-8004/Agent0 reputation scores with 24-hour staleness check.
 * Recalculates reputation when cache is stale.
 */

import {
  selectAgentPerformanceMetricsActivitySliceByUserId,
  selectAgentPerformanceMetricsCacheSliceByUserId,
  selectAgentPerformanceMetricsReputationScoreOnlyByUserId,
  selectPointsTransferSentAmountsByUserId,
  selectUserAgent0ReputationCacheRowById,
  selectUserAgent0ScoreCalcSliceById,
  selectUserPointsOverspendingSliceById,
  updateAgentPerformanceMetricsReputationStaleAt,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { recalculateReputation } from '@babylon/engine';
import { logger } from '@babylon/shared';

const CACHE_STALE_HOURS = 24;
const CACHE_STALE_MS = CACHE_STALE_HOURS * 60 * 60 * 1000;

/**
 * Get cached reputation score for a user/agent
 * Returns cached value if fresh, otherwise recalculates
 */
export async function getCachedAgent0ReputationScore(
  userId: string
): Promise<number> {
  const user = await selectUserAgent0ReputationCacheRowById(db, userId);

  if (!user) {
    logger.warn(
      'User not found for reputation cache',
      { userId },
      'Agent0ReputationCache'
    );
    return 50; // Neutral default
  }

  // If banned, return 0
  if (user.isBanned) {
    return 0;
  }

  // If scammer or CSAM, return very low score (but not 0, to distinguish from banned)
  if (user.isScammer || user.isCSAM) {
    return 5; // Very low but not zero
  }

  const metrics = await selectAgentPerformanceMetricsCacheSliceByUserId(
    db,
    userId
  );

  // Check if we have cached data
  if (metrics) {
    const cacheAge = Date.now() - metrics.updatedAt.getTime();

    // If cache is fresh (< 24 hours), return cached score
    if (cacheAge < CACHE_STALE_MS) {
      logger.debug(
        'Using cached reputation score',
        {
          userId,
          score: metrics.reputationScore,
          cacheAgeHours: cacheAge / (60 * 60 * 1000),
        },
        'Agent0ReputationCache'
      );
      return metrics.reputationScore;
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
    'Agent0ReputationCache'
  );

  await recalculateReputation(userId);
  if (user.agent0TokenId) {
    logger.debug(
      'Agent0 token ID found, using local reputation calculation',
      {
        userId,
        agent0TokenId: user.agent0TokenId,
      },
      'Agent0ReputationCache'
    );
    // To fetch on-chain Agent0 reputation, use ReputationBridge or Agent0FeedbackService
  }

  const updatedMetrics =
    await selectAgentPerformanceMetricsReputationScoreOnlyByUserId(db, userId);

  return updatedMetrics?.reputationScore ?? 50; // Neutral default
}

/**
 * Invalidate reputation cache for a user
 * Forces recalculation on next access
 */
export async function invalidateReputationCache(userId: string): Promise<void> {
  await updateAgentPerformanceMetricsReputationStaleAt(
    db,
    userId,
    new Date(Date.now() - CACHE_STALE_MS - 1)
  );

  logger.info(
    'Invalidated reputation cache',
    { userId },
    'Agent0ReputationCache'
  );
}

/**
 * Check if user has sent more points than earned (reputation loss condition)
 */
export async function checkOverspending(userId: string): Promise<boolean> {
  const user = await selectUserPointsOverspendingSliceById(db, userId);

  if (!user) {
    return false;
  }

  const transactionsResult = await selectPointsTransferSentAmountsByUserId(
    db,
    userId
  );

  const totalSent = Math.abs(
    transactionsResult.reduce((sum, tx) => sum + Math.min(0, tx.amount), 0)
  );

  const totalEarned = user.earnedPoints + user.invitePoints + user.bonusPoints;

  return totalSent > totalEarned;
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
  userId: string
): Promise<number> {
  const user = await selectUserAgent0ScoreCalcSliceById(db, userId);

  if (!user) {
    return 50; // Neutral default
  }

  if (user.isBanned) {
    return 0;
  }

  if (user.isScammer || user.isCSAM) {
    return 5;
  }

  const metrics = await selectAgentPerformanceMetricsActivitySliceByUserId(
    db,
    userId
  );
  const hasActivity =
    metrics &&
    (metrics.gamesPlayed > 0 ||
      metrics.totalFeedbackCount > 0 ||
      metrics.lastActivityAt !== null);

  if (!hasActivity) {
    return 50;
  }

  const isOverspending = await checkOverspending(userId);
  if (isOverspending) {
    const overspendingRatio = await calculateOverspendingRatio(userId);
    const penalty = Math.min(30, overspendingRatio * 30);
    const baseScore = metrics?.averageFeedbackScore ?? 50;
    return Math.max(0, baseScore - penalty);
  }

  const updatedMetrics = await recalculateReputation(userId);
  return updatedMetrics?.reputationScore ?? 50;
}

/**
 * Calculate overspending ratio (0-1)
 */
async function calculateOverspendingRatio(userId: string): Promise<number> {
  const user = await selectUserPointsOverspendingSliceById(db, userId);

  if (!user) {
    return 0;
  }

  const transactionsResult = await selectPointsTransferSentAmountsByUserId(
    db,
    userId
  );

  const totalSent = Math.abs(
    transactionsResult.reduce((sum, tx) => sum + Math.min(0, tx.amount), 0)
  );
  const totalEarned = user.earnedPoints + user.invitePoints + user.bonusPoints;

  if (totalEarned === 0) {
    return totalSent > 0 ? 1 : 0;
  }

  return Math.min(1, totalSent / totalEarned);
}
