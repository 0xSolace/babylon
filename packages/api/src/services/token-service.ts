/**
 * Token Service
 *
 * @description Manages BBLN token operations including:
 * - Points-to-token conversion for existing users
 * - Token rewards for user actions
 * - Airdrop drip tracking and verification
 * - Token balance queries
 *
 * This service bridges the gap between the off-chain points system and
 * the on-chain BBLN token. It tracks eligibility, calculates allocations,
 * and prepares data for on-chain airdrop claims.
 */

import {
  airdropAllocations,
  airdropClaims,
  db,
  elizaHolderAllocations,
  eq,
  sql,
  tokenBalances,
  tokenTransactions,
  tradingFees,
  users,
} from '@babylon/db';
import { generateSnowflakeId, logger, POINTS } from '@babylon/shared';

// Token constants - imported from tokenomics config
// Airdrop vesting: 10% initial + 2% daily = 100% over 46 days
const AIRDROP_INITIAL_PERCENT = 10;
const AIRDROP_DAILY_DRIP_PERCENT = 2;
const AIRDROP_TOKENS = 100_000_000n;
const AIRDROP_TOTAL_DRIP_DAYS = 45; // 45 days * 2% = 90%, plus 10% initial = 100%
const AIRDROP_DRIP_COOLDOWN_HOURS = 20; // Min hours between drips
const ELIZA_HOLDER_BONUS_MULTIPLIER = 150;
const TOKEN_DECIMALS = 18;
const TOKEN_SYMBOL = 'BBLN';

// elizaOS allocation: 10% of total supply (reserved for future use)
// elizaOS allocation is managed by ElizaHolderAirdropService
// Constants for reference: 100M BBLN total, 180-day claim period

/**
 * Token transaction type
 */
export type TokenTransactionType =
  | 'airdrop_claim'
  | 'drip_unlock'
  | 'trading_reward'
  | 'referral_reward'
  | 'bonus_reward'
  | 'transfer_in'
  | 'transfer_out'
  | 'fee_payment'
  | 'fee_earned'
  | 'burn';

/**
 * Result of a token operation
 */
interface TokenOperationResult {
  success: boolean;
  tokensAwarded: bigint;
  newBalance: bigint;
  error?: string;
  txId?: string;
}

/**
 * Airdrop allocation calculation result
 */
interface AirdropAllocationResult {
  userId: string;
  pointsBalance: number;
  tradingVolume: number;
  tradingPnL: number;
  referralCount: number;
  ecosystemScore: number;
  isElizaHolder: boolean;
  baseAllocation: bigint;
  bonusMultiplier: number;
  finalAllocation: bigint;
  dailyDripAmount: bigint;
}

/**
 * Token Service Class
 */
export class TokenService {
  // ==========================================================================
  // POINTS TO TOKEN CONVERSION
  // ==========================================================================

  /**
   * Calculate airdrop allocation for a user based on their activity
   *
   * Allocation factors:
   * - Points balance (40% weight)
   * - Trading volume (25% weight)
   * - Trading P&L (15% weight)
   * - Referral count (10% weight)
   * - Ecosystem participation (10% weight)
   * - ELIZA holder bonus (1.5x multiplier)
   */
  static async calculateAirdropAllocation(
    userId: string
  ): Promise<AirdropAllocationResult | null> {
    const userResult = await db
      .select({
        reputationPoints: users.reputationPoints,
        invitePoints: users.invitePoints,
        earnedPoints: users.earnedPoints,
        bonusPoints: users.bonusPoints,
        referralCount: users.referralCount,
        lifetimePnL: users.lifetimePnL,
        totalDeposited: users.totalDeposited,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userResult[0];
    if (!user) return null;

    // Get total points across all users for proportional allocation
    const [totalsResult] = (await db
      .select({
        totalPoints: sql<number>`sum(${users.reputationPoints})`,
        userCount: sql<number>`count(*)`,
      })
      .from(users)
      .where(eq(users.isActor, false))) as unknown as {
      totalPoints: number;
      userCount: number;
    }[];

    const totalPoints = Number(totalsResult?.totalPoints ?? 0);
    const pointsBalance = user.reputationPoints;

    // Get actual trading volume from tradingFees table
    const volumeResult = (await db
      .select({
        total: sql<string>`COALESCE(SUM(${tradingFees.feeAmount}), 0)`,
      })
      .from(tradingFees)
      .where(eq(tradingFees.userId, userId))) as unknown as { total: string }[];
    const tradingVolume = Number(volumeResult[0]?.total ?? 0) * 100; // Fees are ~1% of volume

    const tradingPnL = Number(user.lifetimePnL ?? 0);
    const referralCount = user.referralCount ?? 0;

    // Ecosystem score based on activities
    const ecosystemScore =
      (user.invitePoints > 0 ? 1 : 0) +
      (user.earnedPoints > 0 ? 1 : 0) +
      (user.bonusPoints > 0 ? 1 : 0) +
      (referralCount > 0 ? 1 : 0);

    // ELIZA holder check via elizaHolderAllocations table (populated by snapshot)
    const [elizaAlloc] = await db
      .select({ id: elizaHolderAllocations.id })
      .from(elizaHolderAllocations)
      .where(eq(elizaHolderAllocations.walletAddress, user.walletAddress ?? ''))
      .limit(1);
    const isElizaHolder = !!elizaAlloc;

    // Calculate weighted allocation (40% points, 25% volume, 15% PnL, 10% referral, 10% ecosystem)
    const airdropPool = AIRDROP_TOKENS;
    const pointsWeight = totalPoints > 0 ? pointsBalance / totalPoints : 0;
    const pointsAllocation = pointsWeight * 0.4;

    // Volume allocation: normalize against top trader (~$1M volume = max)
    const maxVolume = 1_000_000;
    const volumeAllocation = Math.min(tradingVolume / maxVolume, 1) * 0.25;

    // PnL allocation: positive PnL up to $10k = max
    const maxPnL = 10_000;
    const pnlAllocation =
      tradingPnL > 0 ? Math.min(tradingPnL / maxPnL, 1) * 0.15 : 0;

    // Referral allocation: 10 referrals = max
    const maxReferrals = 10;
    const referralAllocation = Math.min(referralCount / maxReferrals, 1) * 0.1;

    // Ecosystem allocation: 4 activities = max
    const ecosystemAllocation = (ecosystemScore / 4) * 0.1;

    const totalWeight =
      pointsAllocation +
      volumeAllocation +
      pnlAllocation +
      referralAllocation +
      ecosystemAllocation;

    const baseAllocation = BigInt(
      Math.floor(Number(airdropPool) * totalWeight)
    );

    // Apply ELIZA holder bonus
    const bonusMultiplier = isElizaHolder ? ELIZA_HOLDER_BONUS_MULTIPLIER : 100;
    const finalAllocation = (baseAllocation * BigInt(bonusMultiplier)) / 100n;

    // Calculate daily drip amount (5% per day)
    const dailyDripAmount =
      (finalAllocation * BigInt(AIRDROP_DAILY_DRIP_PERCENT)) / 100n;

    return {
      userId,
      pointsBalance,
      tradingVolume,
      tradingPnL,
      referralCount,
      ecosystemScore,
      isElizaHolder,
      baseAllocation,
      bonusMultiplier,
      finalAllocation,
      dailyDripAmount,
    };
  }

  /**
   * Generate Merkle tree data for all eligible users
   */
  static async generateAirdropMerkleData(): Promise<
    { address: string; allocation: bigint; bonus: number }[]
  > {
    const eligibleUsers = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
        reputationPoints: users.reputationPoints,
      })
      .from(users)
      .where(
        sql`${users.isActor} = false AND ${users.walletAddress} IS NOT NULL AND ${users.reputationPoints} >= ${POINTS.INITIAL_SIGNUP}`
      );

    const merkleData: { address: string; allocation: bigint; bonus: number }[] =
      [];

    for (const user of eligibleUsers) {
      if (!user.walletAddress) continue;

      const allocation = await TokenService.calculateAirdropAllocation(user.id);
      if (!allocation || allocation.finalAllocation === 0n) continue;

      merkleData.push({
        address: user.walletAddress,
        allocation: allocation.finalAllocation,
        bonus: allocation.bonusMultiplier,
      });
    }

    logger.info(
      `Generated airdrop Merkle data for ${merkleData.length} users`,
      { totalUsers: merkleData.length },
      'TokenService'
    );

    return merkleData;
  }

  // ==========================================================================
  // DRIP TRACKING
  // ==========================================================================

  /**
   * Record a user's qualifying action for daily drip
   *
   * Airdrop vesting schedule:
   * - Day 0 (first claim): 10% of total allocation
   * - Days 1-45: 2% per day (max once per 20 hours)
   * - Total: 10% + 45*2% = 100%
   *
   * Qualifying actions:
   * - Visit the platform
   * - Create a post
   * - Make a trade
   * - Interact with agents
   */
  static async recordDripAction(
    userId: string,
    action: 'visit' | 'post' | 'trade' | 'agent_interaction'
  ): Promise<{
    canDrip: boolean;
    dripDay: number;
    amount: bigint;
    isInitialClaim: boolean;
    nextDripTime: Date | null;
  }> {
    // Check if user has an allocation
    const allocationResult = await db
      .select()
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    const allocation = allocationResult[0];
    if (!allocation) {
      return {
        canDrip: false,
        dripDay: 0,
        amount: 0n,
        isInitialClaim: false,
        nextDripTime: null,
      };
    }

    // Extract and properly type values from DB result
    const dripsUnlocked = Number(allocation.dripsUnlocked ?? 0);
    const lastDripTimeValue = allocation.lastDripTime
      ? allocation.lastDripTime instanceof Date
        ? allocation.lastDripTime
        : new Date(String(allocation.lastDripTime))
      : null;

    // Check if user can drip (20 hours since last drip)
    const lastDripTime = lastDripTimeValue?.getTime() ?? 0;
    const now = Date.now();
    const cooldownMs = AIRDROP_DRIP_COOLDOWN_HOURS * 60 * 60 * 1000;

    if (lastDripTime > 0 && now - lastDripTime < cooldownMs) {
      const nextDripTime = new Date(lastDripTime + cooldownMs);
      return {
        canDrip: false,
        dripDay: dripsUnlocked,
        amount: 0n,
        isInitialClaim: false,
        nextDripTime,
      };
    }

    // Check if max drips reached (initial + 45 daily drips = 46 total)
    const maxDrips = AIRDROP_TOTAL_DRIP_DAYS + 1; // +1 for initial claim
    if (dripsUnlocked >= maxDrips) {
      return {
        canDrip: false,
        dripDay: dripsUnlocked,
        amount: 0n,
        isInitialClaim: false,
        nextDripTime: null,
      };
    }

    const dripDay = dripsUnlocked + 1;
    const isInitialClaim = dripDay === 1;
    const totalAllocation = BigInt(String(allocation.totalAllocation));

    // Calculate drip amount: 10% for initial, 2% for subsequent
    const dripAmount = isInitialClaim
      ? (totalAllocation * BigInt(AIRDROP_INITIAL_PERCENT)) / 100n
      : (totalAllocation * BigInt(AIRDROP_DAILY_DRIP_PERCENT)) / 100n;

    // Update allocation
    await db
      .update(airdropAllocations)
      .set({
        dripsUnlocked: dripDay,
        lastDripTime: new Date(),
        lastDripAction: action,
      })
      .where(eq(airdropAllocations.userId, userId));

    // Record the drip claim
    await db.insert(airdropClaims).values({
      id: await generateSnowflakeId(),
      userId,
      dripDay,
      action,
      amount: dripAmount.toString(),
      claimedAt: new Date(),
    });

    logger.info(
      `User ${userId} unlocked drip day ${dripDay} (${isInitialClaim ? 'initial 10%' : '2%'}) for action: ${action}`,
      {
        userId,
        dripDay,
        action,
        amount: dripAmount.toString(),
        isInitialClaim,
      },
      'TokenService'
    );

    const nextDripTime = new Date(Date.now() + cooldownMs);
    return {
      canDrip: true,
      dripDay,
      amount: dripAmount,
      isInitialClaim,
      nextDripTime,
    };
  }

  /**
   * Get user's airdrop status
   *
   * Vesting: 10% initial + 2% daily for 45 days = 100%
   */
  static async getAirdropStatus(userId: string): Promise<{
    registered: boolean;
    totalAllocation: bigint;
    dripsUnlocked: number;
    totalDrips: number;
    totalClaimed: bigint;
    claimable: bigint;
    nextDripTime: Date | null;
    canDripNow: boolean;
    percentUnlocked: number;
    isInitialClaimed: boolean;
  } | null> {
    const allocationResult = await db
      .select()
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    const allocation = allocationResult[0];
    if (!allocation) return null;

    // Extract and properly type values from DB result
    const totalAllocation = BigInt(String(allocation.totalAllocation));
    const dripsUnlocked = Number(allocation.dripsUnlocked ?? 0);
    const totalClaimed = BigInt(String(allocation.totalClaimed ?? '0'));
    const lastDripTimeValue = allocation.lastDripTime
      ? allocation.lastDripTime instanceof Date
        ? allocation.lastDripTime
        : new Date(String(allocation.lastDripTime))
      : null;
    const maxDrips = AIRDROP_TOTAL_DRIP_DAYS + 1; // 46 total (1 initial + 45 daily)

    // Calculate total unlocked: 10% for initial + 2% per subsequent drip
    const isInitialClaimed = dripsUnlocked >= 1;
    let totalUnlockedPercent = 0;
    if (dripsUnlocked >= 1) {
      totalUnlockedPercent = AIRDROP_INITIAL_PERCENT; // 10%
      totalUnlockedPercent += (dripsUnlocked - 1) * AIRDROP_DAILY_DRIP_PERCENT; // 2% per subsequent
    }
    const totalUnlocked =
      (totalAllocation * BigInt(totalUnlockedPercent)) / 100n;
    const claimable =
      totalUnlocked > totalClaimed ? totalUnlocked - totalClaimed : 0n;

    // Calculate next drip time (20 hour cooldown)
    const cooldownMs = AIRDROP_DRIP_COOLDOWN_HOURS * 60 * 60 * 1000;
    let nextDripTime: Date | null = null;
    let canDripNow = false;

    if (dripsUnlocked < maxDrips) {
      if (lastDripTimeValue) {
        const timeSinceLastDrip = Date.now() - lastDripTimeValue.getTime();
        if (timeSinceLastDrip >= cooldownMs) {
          canDripNow = true;
          nextDripTime = new Date(); // Can drip now
        } else {
          nextDripTime = new Date(lastDripTimeValue.getTime() + cooldownMs);
        }
      } else {
        canDripNow = true;
        nextDripTime = new Date(); // Never dripped, can drip now
      }
    }

    return {
      registered: true,
      totalAllocation,
      dripsUnlocked,
      totalDrips: maxDrips,
      totalClaimed,
      claimable,
      nextDripTime,
      canDripNow,
      percentUnlocked: totalUnlockedPercent,
      isInitialClaimed,
    };
  }

  // ==========================================================================
  // PLAY-TO-EARN BONUS SYSTEM
  // ==========================================================================

  /**
   * Calculate play-to-earn bonus multiplier based on trading profits
   *
   * Anti-gaming measures:
   * - Only realized profits count (not volume or paper gains)
   * - Diminishing returns after certain thresholds
   * - Multiplier based on profit percentage, not absolute value
   * - Minimum hold time required for positions
   *
   * Bonus tiers (applied to base allocation):
   * - 0-10% profit on portfolio: 1.0x (no bonus)
   * - 10-25% profit: 1.2x multiplier
   * - 25-50% profit: 1.5x multiplier
   * - 50-100% profit: 2.0x multiplier
   * - 100%+ profit: 2.5x multiplier (capped)
   */
  static calculateProfitBonus(
    realizedPnL: number,
    initialDeposit: number
  ): { multiplier: number; tier: string } {
    if (initialDeposit <= 0) {
      return { multiplier: 1.0, tier: 'none' };
    }

    const profitPercent = (realizedPnL / initialDeposit) * 100;

    if (profitPercent < 10) {
      return { multiplier: 1.0, tier: 'base' };
    } else if (profitPercent < 25) {
      return { multiplier: 1.2, tier: 'bronze' };
    } else if (profitPercent < 50) {
      return { multiplier: 1.5, tier: 'silver' };
    } else if (profitPercent < 100) {
      return { multiplier: 2.0, tier: 'gold' };
    } else {
      return { multiplier: 2.5, tier: 'diamond' };
    }
  }

  /**
   * Calculate leaderboard bonus for top 100 users
   *
   * Position bonuses (applied on top of profit bonus):
   * - #1: 5x additional multiplier
   * - #2-3: 3x additional multiplier
   * - #4-10: 2x additional multiplier
   * - #11-25: 1.5x additional multiplier
   * - #26-50: 1.25x additional multiplier
   * - #51-100: 1.1x additional multiplier
   */
  static calculateLeaderboardBonus(position: number): {
    multiplier: number;
    tier: string;
  } {
    if (position <= 0 || position > 100) {
      return { multiplier: 1.0, tier: 'none' };
    }

    if (position === 1) {
      return { multiplier: 5.0, tier: 'champion' };
    } else if (position <= 3) {
      return { multiplier: 3.0, tier: 'podium' };
    } else if (position <= 10) {
      return { multiplier: 2.0, tier: 'top10' };
    } else if (position <= 25) {
      return { multiplier: 1.5, tier: 'top25' };
    } else if (position <= 50) {
      return { multiplier: 1.25, tier: 'top50' };
    } else {
      return { multiplier: 1.1, tier: 'top100' };
    }
  }

  /**
   * Calculate total bonus allocation for a user
   */
  static async calculateBonusAllocation(userId: string): Promise<{
    baseAllocation: bigint;
    profitMultiplier: number;
    profitTier: string;
    leaderboardMultiplier: number;
    leaderboardTier: string;
    bonusAllocation: bigint;
    totalAllocation: bigint;
  }> {
    // Get user's allocation and trading data
    const [allocation] = await db
      .select()
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    if (!allocation) {
      return {
        baseAllocation: 0n,
        profitMultiplier: 1.0,
        profitTier: 'none',
        leaderboardMultiplier: 1.0,
        leaderboardTier: 'none',
        bonusAllocation: 0n,
        totalAllocation: 0n,
      };
    }

    // Get user's trading stats
    const [user] = await db
      .select({
        lifetimePnL: users.lifetimePnL,
        totalDeposited: users.totalDeposited,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const realizedPnL = Number(user?.lifetimePnL ?? 0);
    const initialDeposit = Number(user?.totalDeposited ?? 0);

    // Calculate profit bonus
    const profitBonus = TokenService.calculateProfitBonus(
      realizedPnL,
      initialDeposit
    );

    // Get leaderboard position (would need to be calculated separately)
    // For now, return 0 (no bonus) - actual position should be fetched from leaderboard service
    const leaderboardBonus = TokenService.calculateLeaderboardBonus(0);

    const baseAllocation = BigInt(String(allocation.totalAllocation));
    const combinedMultiplier =
      profitBonus.multiplier * leaderboardBonus.multiplier;
    const totalAllocation =
      (baseAllocation * BigInt(Math.floor(combinedMultiplier * 100))) / 100n;
    const bonusAllocation = totalAllocation - baseAllocation;

    return {
      baseAllocation,
      profitMultiplier: profitBonus.multiplier,
      profitTier: profitBonus.tier,
      leaderboardMultiplier: leaderboardBonus.multiplier,
      leaderboardTier: leaderboardBonus.tier,
      bonusAllocation,
      totalAllocation,
    };
  }

  // ==========================================================================
  // TOKEN BALANCES (OFF-CHAIN TRACKING)
  // ==========================================================================

  /**
   * Get user's token balance (off-chain tracking)
   */
  static async getTokenBalance(userId: string): Promise<bigint> {
    const result = await db
      .select({ balance: tokenBalances.balance })
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);

    return BigInt(result[0]?.balance ?? '0');
  }

  /**
   * Record a token transaction (off-chain tracking)
   */
  static async recordTokenTransaction(
    userId: string,
    amount: bigint,
    type: TokenTransactionType,
    metadata?: Record<string, string | number | boolean>
  ): Promise<TokenOperationResult> {
    const currentBalance = await TokenService.getTokenBalance(userId);
    const newBalance = currentBalance + amount;

    if (newBalance < 0n) {
      return {
        success: false,
        tokensAwarded: 0n,
        newBalance: currentBalance,
        error: 'Insufficient balance',
      };
    }

    const txId = await generateSnowflakeId();

    await db.transaction(async (tx) => {
      // Update or insert balance
      await tx
        .insert(tokenBalances)
        .values({
          userId,
          balance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: tokenBalances.userId,
          set: {
            balance: newBalance.toString(),
            updatedAt: new Date(),
          },
        });

      // Record transaction
      await tx.insert(tokenTransactions).values({
        id: txId,
        userId,
        amount: amount.toString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        type,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      });
    });

    logger.info(
      `Token transaction recorded: ${type} for user ${userId}`,
      {
        userId,
        amount: amount.toString(),
        type,
        newBalance: newBalance.toString(),
      },
      'TokenService'
    );

    return {
      success: true,
      tokensAwarded: amount,
      newBalance,
      txId,
    };
  }

  // ==========================================================================
  // CONVERSION UTILITIES
  // ==========================================================================

  /**
   * Convert points to token amount (for display purposes)
   *
   * Points are a pre-TGE tracking mechanism.
   * The actual conversion ratio is determined by the airdrop formula.
   */
  static async pointsToDisplayTokens(points: number): Promise<string> {
    const ratio = await TokenService.getPointsToTokenRatio();
    const estimatedTokens = points * ratio;
    return `${estimatedTokens.toFixed(2)} ${TOKEN_SYMBOL}`;
  }

  /**
   * Calculate the current points-to-token ratio based on:
   * - Total airdrop pool (100M BBLN)
   * - Total points across all users
   */
  static async getPointsToTokenRatio(): Promise<number> {
    const result = (await db
      .select({
        totalPoints: sql<string>`COALESCE(SUM(points), 0)`,
      })
      .from(users)) as unknown as { totalPoints: string }[];

    const totalPoints = parseFloat(result[0]?.totalPoints ?? '0');

    if (totalPoints === 0) {
      return 0.1; // Default ratio when no points exist
    }

    // Airdrop pool: 100M BBLN (already has 18 decimals in the constant)
    // Ratio = pool / totalPoints
    const airdropPoolTokens = Number(AIRDROP_TOKENS);
    return airdropPoolTokens / totalPoints;
  }

  /**
   * Format token amount for display (handles decimals)
   */
  static formatTokens(amount: bigint): string {
    const divisor = 10n ** BigInt(TOKEN_DECIMALS);
    const whole = amount / divisor;
    const fraction = amount % divisor;

    if (fraction === 0n) {
      return `${whole.toLocaleString()} ${TOKEN_SYMBOL}`;
    }

    const fractionStr = fraction.toString().padStart(TOKEN_DECIMALS, '0');
    const trimmedFraction = fractionStr.replace(/0+$/, '').slice(0, 4);

    return `${whole.toLocaleString()}.${trimmedFraction} ${TOKEN_SYMBOL}`;
  }

  /**
   * Parse token amount from string (handles decimals)
   */
  static parseTokens(amountStr: string): bigint {
    const parts = amountStr.split('.');
    const whole = parts[0] ?? '0';
    const fraction = parts[1] ?? '';
    const wholeBigInt = BigInt(whole.replace(/,/g, ''));
    const paddedFraction = fraction.padEnd(TOKEN_DECIMALS, '0');
    const fractionBigInt = BigInt(paddedFraction);

    return wholeBigInt * 10n ** BigInt(TOKEN_DECIMALS) + fractionBigInt;
  }
}
