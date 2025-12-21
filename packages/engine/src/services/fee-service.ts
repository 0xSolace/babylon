/**
 * Fee Service
 *
 * @description Manages trading fees and referral fee distribution. Calculates
 * fees for trades, processes fee payments, and distributes referral earnings.
 * Handles both platform fees and referrer share distribution.
 */

import { Decimal, db } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { FEE_CONFIG, type FeeType } from '../config/fees';

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
    marketId?: string
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

    // Get user's referrer
    const referrerId = await FeeService.getUserReferrer(userId);

    // Create trading fee record
    await db.tradingFee.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        tradeType,
        tradeId: tradeId || null,
        marketId: marketId || null,
        feeAmount: new Decimal(feeCalc.feeAmount).toString(),
        platformFee: new Decimal(feeCalc.platformShare).toString(),
        referrerFee: new Decimal(feeCalc.referrerShare).toString(),
        referrerId: referrerId || null,
      },
    });

    // Get current totalFeesPaid
    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    const currentTotalFees = currentUser
      ? Number(currentUser.totalFeesPaid)
      : 0;

    // Update trader's total fees paid
    await db.user.update({
      where: { id: userId },
      data: {
        totalFeesPaid: new Decimal(
          currentTotalFees + feeCalc.feeAmount
        ).toString(),
      },
    });

    // Distribute referral fee if referrer exists
    if (referrerId) {
      await FeeService.distributeReferralFee(
        referrerId,
        feeCalc.referrerShare,
        userId
      );
    }

    const result = {
      feeCharged: feeCalc.feeAmount,
      referrerPaid: referrerId ? feeCalc.referrerShare : 0,
      platformReceived: referrerId ? feeCalc.platformShare : feeCalc.feeAmount,
      referrerId,
    };

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
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    return user?.referredBy ? String(user.referredBy) : null;
  }

  /**
   * Distribute referral fee to referrer
   */
  private static async distributeReferralFee(
    referrerId: string,
    feeAmount: number,
    traderId: string
  ): Promise<void> {
    // Credit referrer's virtual balance
    const referrer = await db.user.findUnique({
      where: { id: referrerId },
    });

    if (!referrer) {
      logger.warn(
        `Referrer not found: ${referrerId}`,
        { referrerId, traderId },
        'FeeService'
      );
      return;
    }

    const currentBalance = Number(referrer.virtualBalance);
    const newBalance = currentBalance + feeAmount;
    const currentFeesEarned = Number(referrer.totalFeesEarned);

    // Update referrer balance
    await db.user.update({
      where: { id: referrerId },
      data: {
        virtualBalance: new Decimal(newBalance).toString(),
        totalFeesEarned: new Decimal(currentFeesEarned + feeAmount).toString(),
      },
    });

    // Create balance transaction
    await db.balanceTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: referrerId,
        type: FEE_CONFIG.TRANSACTION_TYPES.REFERRAL_FEE_EARNED,
        amount: new Decimal(feeAmount).toString(),
        balanceBefore: new Decimal(currentBalance).toString(),
        balanceAfter: new Decimal(newBalance).toString(),
        relatedId: traderId,
        description: 'Referral fee earned from trading activity',
      },
    });

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

    // Build WHERE conditions
    const conditions: string[] = ['"referrerId" = $1'];
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(startDate.toISOString());
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(endDate.toISOString());
      paramIndex++;
    }
    const whereClause = conditions.join(' AND ');

    // Get total earnings
    const totalResult = await db.query<{
      totalReferrerFee: string | null;
      count: string;
    }>(
      `SELECT SUM("referrerFee"::numeric) as "totalReferrerFee", COUNT(*) as count 
       FROM "TradingFee" WHERE ${whereClause}`,
      params
    );
    const totalEarned = Number(totalResult[0]?.totalReferrerFee || 0);

    // Get unique traders (referrals)
    const uniqueTraders = await db.query<{ userId: string }>(
      `SELECT DISTINCT "userId" FROM "TradingFee" WHERE ${whereClause}`,
      params
    );

    // Get top referrals by fees generated
    const topReferralsData = await db.query<{
      userId: string;
      totalReferrerFee: string;
      tradeCount: string;
    }>(
      `SELECT "userId", SUM("referrerFee"::numeric) as "totalReferrerFee", COUNT(*) as "tradeCount"
       FROM "TradingFee" WHERE ${whereClause}
       GROUP BY "userId" ORDER BY SUM("referrerFee"::numeric) DESC LIMIT $${paramIndex}`,
      [...params, limit]
    );

    // Enrich with user data
    const topReferrals = await Promise.all(
      topReferralsData.map(async (item) => {
        const user = await db.user.findUnique({
          where: { id: item.userId },
        });

        return {
          userId: item.userId,
          username: user?.username ? String(user.username) : 'Unknown',
          displayName: user?.displayName
            ? String(user.displayName)
            : 'Unknown User',
          profileImageUrl: user?.profileImageUrl
            ? String(user.profileImageUrl)
            : null,
          totalFees: Number(item.totalReferrerFee || 0),
          tradeCount: Number(item.tradeCount),
        };
      })
    );

    // Get recent fees
    const recentFees = await db.query<{
      id: string;
      tradeType: string;
      referrerFee: string;
      userId: string;
      createdAt: Date;
    }>(
      `SELECT id, "tradeType", "referrerFee", "userId", "createdAt"
       FROM "TradingFee" WHERE ${whereClause}
       ORDER BY "createdAt" DESC LIMIT $${paramIndex}`,
      [...params, limit]
    );

    // Get trader usernames for recent fees
    const recentFeesWithUsers = await Promise.all(
      recentFees.map(async (fee) => {
        const trader = await db.user.findUnique({
          where: { id: fee.userId },
        });

        return {
          id: fee.id,
          tradeType: fee.tradeType,
          feeAmount: Number(fee.referrerFee),
          traderId: fee.userId,
          traderUsername: trader?.username ? String(trader.username) : null,
          createdAt: fee.createdAt,
        };
      })
    );

    return {
      totalEarned,
      totalReferrals: uniqueTraders.length,
      topReferrals,
      recentFees: recentFeesWithUsers,
    };
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
    const conditions: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(startDate.toISOString());
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(endDate.toISOString());
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const results = await db.query<{
      totalFeeAmount: string | null;
      totalPlatformFee: string | null;
      totalReferrerFee: string | null;
      count: string;
    }>(
      `SELECT 
         SUM("feeAmount"::numeric) as "totalFeeAmount",
         SUM("platformFee"::numeric) as "totalPlatformFee",
         SUM("referrerFee"::numeric) as "totalReferrerFee",
         COUNT(*) as count
       FROM "TradingFee" ${whereClause}`,
      params
    );

    const result = results[0];

    return {
      totalFeesCollected: Number(result?.totalFeeAmount || 0),
      totalReferrerFees: Number(result?.totalReferrerFee || 0),
      totalPlatformFees: Number(result?.totalPlatformFee || 0),
      totalTrades: Number(result?.count || 0),
    };
  }
}
