/**
 * Fee Service
 *
 * @description Manages trading fees and referral fee distribution. Calculates
 * fees for trades, processes fee payments, and distributes referral earnings.
 * Handles both platform fees and referrer share distribution.
 */

import {
  creditReferrerReferralFeeInTx,
  type DrizzleClient,
  fetchFeePlatformStats,
  fetchFeeReferralEarnings,
  fetchUserReferredBy,
  incrementUserTotalFeesPaid,
  insertTradingFeeRow,
  selectUserReferredBy,
  type Transaction,
  withTransaction,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { FEE_CONFIG, type FeeType } from '../config/fees';

/**
 * Transaction context type - either an existing transaction or the db client
 * Used to avoid nested transactions which can cause deadlocks
 */
export type TransactionContext = Transaction | DrizzleClient;

/**
 * Execute a function within a transaction context
 * If an existing transaction is provided, uses it directly; otherwise creates a new one
 * This prevents nested transaction deadlocks
 */
async function runInTransaction<T>(
  existingTx: TransactionContext | undefined,
  fn: (tx: TransactionContext) => Promise<T>
): Promise<T> {
  return existingTx ? fn(existingTx) : withTransaction(fn);
}

/**
 * Fee calculation result
 *
 * @description Contains calculated fee amounts and distribution breakdown.
 */
export interface FeeCalculation {
  feeAmount: number;
  netAmount: number; // Amount after fee deduction
  platformShare: number;
  referrerShare: number;
}

/**
 * Fee distribution result
 *
 * @description Result of processing a trading fee, including amounts charged
 * and distributed to platform and referrer.
 */
export interface FeeDistributionResult {
  feeCharged: number;
  referrerPaid: number;
  platformReceived: number;
  referrerId: string | null;
}

/**
 * Referral earnings information
 *
 * @description Comprehensive referral earnings data including totals, top
 * referrals, and recent fee history.
 */
export interface ReferralEarnings {
  totalEarned: number;
  totalReferrals: number;
  topReferrals: Array<{
    userId: string;
    username: string;
    displayName: string;
    profileImageUrl: string | null;
    totalFees: number;
    tradeCount: number;
  }>;
  recentFees: Array<{
    id: string;
    tradeType: string;
    feeAmount: number;
    traderId: string;
    traderUsername: string | null;
    createdAt: Date;
  }>;
}

/**
 * Fee Service Class
 *
 * @description Static service class for managing trading fees and referral
 * distributions. Provides methods for calculating fees, processing payments,
 * and retrieving referral earnings.
 */
export class FeeService {
  /**
   * Calculate fee for a trade amount
   *
   * @description Calculates trading fee based on configured fee rate (0.1%).
   * Returns fee amount, net amount after fee, and distribution breakdown.
   *
   * @param {number} tradeAmount - Trade amount to calculate fee for
   * @returns {FeeCalculation} Fee calculation with amounts and distribution
   *
   * @example
   * ```typescript
   * const calc = FeeService.calculateFee(1000);
   * // Returns: { feeAmount: 1, netAmount: 999, platformShare: 0.5, referrerShare: 0.5 }
   * ```
   */
  static calculateFee(tradeAmount: number): FeeCalculation {
    const feeAmount = tradeAmount * FEE_CONFIG.TRADING_FEE_RATE;
    const netAmount = tradeAmount - feeAmount;
    const platformShare = feeAmount * FEE_CONFIG.PLATFORM_SHARE;
    const referrerShare = feeAmount * FEE_CONFIG.REFERRER_SHARE;

    return {
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      platformShare: Number(platformShare.toFixed(2)),
      referrerShare: Number(referrerShare.toFixed(2)),
    };
  }

  /**
   * Calculate fee on proceeds (for selling)
   *
   * @description Calculates fee on sale proceeds. Alias for calculateFee
   * for semantic clarity when processing sell transactions.
   *
   * @param {number} proceeds - Sale proceeds amount
   * @returns {FeeCalculation} Fee calculation with amounts and distribution
   */
  static calculateFeeOnProceeds(proceeds: number): FeeCalculation {
    return FeeService.calculateFee(proceeds);
  }

  /**
   * Process trading fee - charge user and distribute to platform/referrer
   *
   * @description Processes a trading fee by charging the user, creating a fee
   * record, and distributing referral fees if applicable. Skips fees below
   * minimum threshold. Executes atomically in a transaction.
   *
   * @param {string} userId - User ID who made the trade
   * @param {FeeType} tradeType - Type of trade (pred_buy, pred_sell, etc.)
   * @param {number} tradeAmount - Trade amount
   * @param {string} [tradeId] - Optional trade ID for reference
   * @param {string} [marketId] - Optional market ID for reference
   * @param {TransactionContext} [existingTx] - Optional existing transaction/client to reuse (avoids nested transactions)
   * @returns {Promise<FeeDistributionResult>} Fee distribution result
   *
   * @example
   * ```typescript
   * const result = await FeeService.processTradingFee(
   *   userId,
   *   'pred_buy',
   *   1000,
   *   tradeId,
   *   marketId
   * );
   * ```
   */
  static async processTradingFee(
    userId: string,
    tradeType: FeeType,
    tradeAmount: number,
    tradeId?: string,
    marketId?: string,
    existingTx?: TransactionContext
  ): Promise<FeeDistributionResult> {
    const feeCalc = FeeService.calculateFee(tradeAmount);

    // Skip if fee is below minimum
    if (feeCalc.feeAmount < FEE_CONFIG.MIN_FEE_AMOUNT) {
      logger.debug(
        `Fee ${feeCalc.feeAmount} below minimum, skipping`,
        {
          userId,
          tradeType,
          tradeAmount,
        },
        'FeeService'
      );

      return {
        feeCharged: 0,
        referrerPaid: 0,
        platformReceived: 0,
        referrerId: null,
      };
    }

    // Get user's referrer (use existing tx if provided to avoid deadlock)
    const referrerId = existingTx
      ? await selectUserReferredBy(existingTx, userId)
      : await fetchUserReferredBy(userId);

    // Core fee processing logic
    const processFee = async (tx: TransactionContext) => {
      await insertTradingFeeRow(tx, {
        userId,
        tradeType,
        tradeId: tradeId ?? null,
        marketId: marketId ?? null,
        feeAmount: feeCalc.feeAmount,
        platformShare: feeCalc.platformShare,
        referrerShare: feeCalc.referrerShare,
        referrerId,
      });

      await incrementUserTotalFeesPaid(tx, userId, feeCalc.feeAmount);

      if (referrerId) {
        await FeeService.distributeReferralFeeInTx(
          referrerId,
          feeCalc.referrerShare,
          userId,
          tx
        );
      }

      return {
        feeCharged: feeCalc.feeAmount,
        referrerPaid: referrerId ? feeCalc.referrerShare : 0,
        platformReceived: referrerId
          ? feeCalc.platformShare
          : feeCalc.feeAmount,
        referrerId,
      };
    };

    // Use existing transaction if provided, otherwise create a new one
    const result = await runInTransaction(existingTx, processFee);

    logger.info(
      'Trading fee processed',
      {
        userId,
        tradeType,
        feeCharged: result.feeCharged,
        referrerPaid: result.referrerPaid,
        referrerId: result.referrerId,
      },
      'FeeService'
    );

    return result;
  }

  /**
   * Get user's referrer
   */
  static async getUserReferrer(userId: string): Promise<string | null> {
    return fetchUserReferredBy(userId);
  }

  /**
   * Distribute referral fee to referrer (within transaction)
   */
  private static async distributeReferralFeeInTx(
    referrerId: string,
    feeAmount: number,
    traderId: string,
    tx: TransactionContext
  ): Promise<void> {
    const credited = await creditReferrerReferralFeeInTx(tx, {
      referrerId,
      feeAmount,
      traderId,
      balanceTransactionType: FEE_CONFIG.TRANSACTION_TYPES.REFERRAL_FEE_EARNED,
      description: 'Referral fee earned from trading activity',
    });

    if (!credited) {
      logger.warn(
        `Referrer not found: ${referrerId}`,
        { referrerId, traderId },
        'FeeService'
      );
      return;
    }

    logger.info(
      'Referral fee distributed',
      {
        referrerId,
        traderId,
        feeAmount,
      },
      'FeeService'
    );
  }

  /**
   * Get referral fee earnings for a user
   */
  static async getReferralEarnings(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<ReferralEarnings> {
    const { startDate, endDate, limit = 10 } = options || {};

    return fetchFeeReferralEarnings({
      referrerUserId: userId,
      startDate,
      endDate,
      limit,
    });
  }

  /**
   * Get fee statistics for the platform
   */
  static async getPlatformFeeStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalFeesCollected: number;
    totalReferrerFees: number;
    totalPlatformFees: number;
    totalTrades: number;
  }> {
    return fetchFeePlatformStats({ startDate, endDate });
  }
}
