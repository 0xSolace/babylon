/**
 * Earned Points Service
 *
 * @description Converts P&L from trading into earned points. Provides methods
 * for calculating points from P&L, syncing earned points, and awarding incremental
 * points for trades.
 */

import {
  awardBonusPointsAsSystem,
  awardEarnedPointsForPnLAsSystem,
  awardEarnedPointsForPnLWithClient,
  type DrizzleClient,
  awardBonusPointsWithClient as dbAwardBonusPointsWithClient,
  syncEarnedPointsFromPnl as dbSyncEarnedPointsFromPnl,
  listNonActorUserIds,
  type Transaction,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { TotalPointsService } from './total-points-service';

/**
 * Earned Points Service Class
 *
 * @description Static service class for managing earned points from trading P&L.
 * Provides methods for converting P&L to points and syncing earned points.
 */
export class EarnedPointsService {
  /** Base reputation points for all users */
  private static readonly BASE_POINTS = 100;

  private static readonly earnedPointsDbDeps = {
    pnlToPoints: (pnl: number) => EarnedPointsService.pnlToPoints(pnl),
    calculateReputationPoints: (
      invitePoints: number,
      earnedPoints: number,
      bonusPoints: number
    ) =>
      EarnedPointsService.totalReputationPoints(
        invitePoints,
        earnedPoints,
        bonusPoints
      ),
  } as const;

  /** Exposed for `@babylon/db` earned-points query helpers (same formula as reputation updates). */
  static totalReputationPoints(
    invitePoints: number,
    earnedPoints: number,
    bonusPoints: number
  ): number {
    return (
      EarnedPointsService.BASE_POINTS +
      invitePoints +
      earnedPoints +
      bonusPoints
    );
  }

  /**
   * Convert P&L to earned points
   *
   * @description Converts trading P&L to earned points using formula: 1 point
   * per $10 of realized P&L. Minimum is -100 points to limit downside risk and
   * encourage trading.
   *
   * Formula: 1 point per $10 of realized P&L
   * Minimum: -100 points (can't go below -100)
   *
   * @param {number} pnl - Profit and loss amount
   * @returns {number} Earned points (capped at -100 minimum)
   *
   * @example
   * ```typescript
   * const points = EarnedPointsService.pnlToPoints(100); // Returns: 10
   * const negative = EarnedPointsService.pnlToPoints(-2000); // Returns: -100 (capped)
   * ```
   */
  static pnlToPoints(pnl: number): number {
    const points = Math.floor(pnl / 10);
    // Cap negative points at -100 to avoid extreme penalties
    return Math.max(points, -100);
  }

  /**
   * Update earned points based on current lifetime P&L
   *
   * @description Recalculates earned points from scratch based on lifetimePnL.
   * Updates user's earned points and total reputation points. Only updates if
   * earned points have changed.
   *
   * @param {string} userId - User ID to sync points for
   * @returns {Promise<void>}
   * @throws {Error} If user not found
   */
  static async syncEarnedPointsFromPnL(userId: string): Promise<void> {
    await dbSyncEarnedPointsFromPnl(
      userId,
      EarnedPointsService.earnedPointsDbDeps
    );
  }

  /**
   * Award earned points for a specific P&L amount (for incremental updates)
   *
   * @description Awards earned points incrementally when recording a trade's P&L.
   * Calculates the difference between previous and new P&L and updates earned
   * points accordingly. Creates a points transaction record.
   *
   * Use this when recording a trade's P&L for incremental updates.
   *
   * @param {string} userId - User ID
   * @param {number} newLifetimePnL - New lifetime P&L (after this trade)
   * @param {string} tradeType - Type of trade (for transaction record)
   * @param {string} [relatedId] - Optional related entity ID (trade ID, etc.)
   * @param {Transaction} [tx] - Optional transaction client for atomic operations
   * @returns {Promise<number>} Points awarded (can be negative)
   * @throws {Error} If user not found
   */
  static async awardEarnedPointsForPnL(
    userId: string,
    newLifetimePnL: number,
    tradeType: string,
    relatedId?: string,
    tx?: Transaction
  ): Promise<number> {
    if (tx) {
      return awardEarnedPointsForPnLWithClient(
        tx,
        userId,
        newLifetimePnL,
        tradeType,
        relatedId,
        EarnedPointsService.earnedPointsDbDeps
      );
    }
    return awardEarnedPointsForPnLAsSystem(
      userId,
      newLifetimePnL,
      tradeType,
      relatedId,
      EarnedPointsService.earnedPointsDbDeps
    );
  }

  /**
   * Award bonus points to a user
   *
   * @description Awards bonus points for actions like onboarding completion,
   * referrals, special events, etc. Updates bonusPoints and recalculates
   * total reputationPoints.
   *
   * @param {string} userId - User ID to award points to
   * @param {number} points - Number of bonus points to award (must be finite and non-negative)
   * @param {string} reason - Reason for the bonus (e.g., 'onboarding_welcome')
   * @param {Transaction} [tx] - Optional transaction for atomic operations
   * @returns {Promise<number>} New total bonus points
   * @throws {Error} If points is not a finite non-negative number
   */
  private static async awardBonusPointsWithClient(
    client: Transaction | DrizzleClient,
    userId: string,
    points: number,
    reason: string
  ): Promise<number> {
    const newBonusPoints = await dbAwardBonusPointsWithClient(
      client,
      userId,
      points,
      reason,
      EarnedPointsService.earnedPointsDbDeps
    );

    TotalPointsService.markDirty(userId).catch((e) =>
      logger.warn(
        'Failed to mark user dirty after bonus points',
        { userId, error: e instanceof Error ? e.message : String(e) },
        'EarnedPointsService'
      )
    );

    return newBonusPoints;
  }

  static async awardBonusPoints(
    userId: string,
    points: number,
    reason: string,
    tx?: Transaction
  ): Promise<number> {
    if (!Number.isFinite(points)) {
      throw new Error(
        `Invalid points value: ${points}. Points must be a finite number.`
      );
    }
    if (points < 0) {
      throw new Error(
        `Invalid points value: ${points}. Bonus points must be non-negative.`
      );
    }

    if (points === 0) {
      return 0;
    }

    if (tx) {
      return EarnedPointsService.awardBonusPointsWithClient(
        tx,
        userId,
        points,
        reason
      );
    }

    const newBonusPoints = await awardBonusPointsAsSystem(
      userId,
      points,
      reason,
      EarnedPointsService.earnedPointsDbDeps
    );
    TotalPointsService.markDirty(userId).catch((e) =>
      logger.warn(
        'Failed to mark user dirty after bonus points',
        { userId, error: e instanceof Error ? e.message : String(e) },
        'EarnedPointsService'
      )
    );
    return newBonusPoints;
  }

  /**
   * Bulk sync earned points for all users
   * Useful for migration or recalculation
   * Note: Individual user errors are caught to allow continuation
   */
  static async bulkSyncAllUsers(): Promise<{
    success: number;
    errors: number;
  }> {
    const usersList = await listNonActorUserIds();

    logger.info(
      `Syncing earned points for ${usersList.length} users`,
      {},
      'EarnedPointsService'
    );

    let successCount = 0;
    const errorCount = 0;

    for (const user of usersList) {
      await EarnedPointsService.syncEarnedPointsFromPnL(user.id);
      successCount++;
    }

    logger.info(
      'Bulk sync complete',
      {
        total: usersList.length,
        success: successCount,
        errors: errorCount,
      },
      'EarnedPointsService'
    );

    return { success: successCount, errors: errorCount };
  }
}
