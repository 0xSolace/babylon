/**
 * Airdrop Bonus Service
 *
 * Manages the 90-day bonus period for the BBLN airdrop:
 * - Tracks points earned during bonus period
 * - Calculates leaderboard position bonuses
 * - Generates bonus allocations at period end
 *
 * Airdrop Mechanics:
 * 1. Base allocation from points snapshot (at TGE)
 * 2. Daily drip: 5% per day for 20 days when user performs qualifying action
 * 3. 90-day bonus: Additional allocation based on points earned + leaderboard position
 *
 * @packageDocumentation
 */

import { airdropAllocations, db, desc, eq, sql, users } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import { parseUnits } from 'viem';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Bonus period duration in days */
const BONUS_PERIOD_DAYS = 90;

/** Points to BBLN conversion rate (1 BBLN per 10 points) */
const POINTS_TO_BBLN_RATE = 10n;

/** Leaderboard bonus multipliers */
const LEADERBOARD_MULTIPLIERS = {
  /** Top 1% - 10x bonus */
  TOP_1_PERCENT: 10n,
  /** Top 10% - 5x bonus */
  TOP_10_PERCENT: 5n,
  /** Top 25% - 2x bonus */
  TOP_25_PERCENT: 2n,
  /** Others - 1x (no bonus) */
  DEFAULT: 1n,
} as const;

/** ELIZA holder bonus multiplier (150 = 1.5x) */
const ELIZA_HOLDER_MULTIPLIER = 150;

/** Minimum points to qualify for bonus */
const MIN_POINTS_FOR_BONUS = 100;

// =============================================================================
// TYPES
// =============================================================================

export interface BonusPeriodConfig {
  launchDate: Date;
  bonusPeriodEnd: Date;
  snapshotDate: Date;
  isActive: boolean;
  daysRemaining: number;
}

export interface UserBonusStatus {
  userId: string;
  baseAllocation: bigint;
  pointsAtLaunch: number;
  pointsEarnedDuringBonus: number;
  leaderboardPosition: number;
  totalParticipants: number;
  leaderboardMultiplier: bigint;
  elizaMultiplier: number;
  estimatedBonus: bigint;
  totalEstimatedAllocation: bigint;
  bonusPeriodActive: boolean;
  daysRemaining: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  pointsEarned: number;
  rank: number;
  estimatedBonus: bigint;
}

export interface BonusCalculationResult {
  userId: string;
  pointsBonus: bigint;
  leaderboardBonus: bigint;
  elizaBonus: bigint;
  totalBonus: bigint;
}

// =============================================================================
// SERVICE
// =============================================================================

export class AirdropBonusService {
  private launchDate: Date | null = null;

  /**
   * Initialize the bonus period with launch date
   */
  async initializeBonusPeriod(launchDate: Date): Promise<BonusPeriodConfig> {
    this.launchDate = launchDate;
    const bonusPeriodEnd = new Date(launchDate);
    bonusPeriodEnd.setDate(bonusPeriodEnd.getDate() + BONUS_PERIOD_DAYS);

    const now = new Date();
    const isActive = now >= launchDate && now <= bonusPeriodEnd;
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (bonusPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    logger.info(
      'Initialized bonus period',
      {
        launchDate: launchDate.toISOString(),
        bonusPeriodEnd: bonusPeriodEnd.toISOString(),
        isActive,
        daysRemaining,
      },
      'AirdropBonusService'
    );

    return {
      launchDate,
      bonusPeriodEnd,
      snapshotDate: launchDate,
      isActive,
      daysRemaining,
    };
  }

  /**
   * Take snapshot of user points at launch
   */
  async takePointsSnapshot(): Promise<{
    usersProcessed: number;
    totalPoints: number;
  }> {
    const allUsers = await db
      .select({
        id: users.id,
        reputationPoints: users.reputationPoints,
        earnedPoints: users.earnedPoints,
        invitePoints: users.invitePoints,
        bonusPoints: users.bonusPoints,
        walletAddress: users.walletAddress,
        isActor: users.isActor,
      })
      .from(users)
      .where(eq(users.isActor, false));

    let totalPoints = 0;
    let usersProcessed = 0;

    for (const user of allUsers) {
      if (!user.walletAddress) continue;

      const totalUserPoints =
        user.reputationPoints +
        user.earnedPoints +
        user.invitePoints +
        user.bonusPoints;

      // Create or update airdrop allocation
      const existingAlloc = await db
        .select()
        .from(airdropAllocations)
        .where(eq(airdropAllocations.userId, user.id))
        .limit(1);

      if (existingAlloc.length === 0) {
        await db.insert(airdropAllocations).values({
          id: await generateSnowflakeId(),
          userId: user.id,
          walletAddress: user.walletAddress,
          totalAllocation: '0',
          bonusMultiplier: 100,
          snapshotPoints: totalUserPoints,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        await db
          .update(airdropAllocations)
          .set({
            snapshotPoints: totalUserPoints,
            updatedAt: new Date(),
          })
          .where(eq(airdropAllocations.userId, user.id));
      }

      totalPoints += totalUserPoints;
      usersProcessed++;
    }

    logger.info(
      'Points snapshot completed',
      { usersProcessed, totalPoints },
      'AirdropBonusService'
    );

    return { usersProcessed, totalPoints };
  }

  /**
   * Calculate base allocation for a user based on their points snapshot
   */
  async calculateBaseAllocation(userId: string): Promise<bigint> {
    const [allocation] = await db
      .select()
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    if (!allocation) return 0n;

    // Get total points across all users for proportional allocation
    const [totals] = await db
      .select({
        totalPoints: sql<number>`sum(${airdropAllocations.snapshotPoints})`,
      })
      .from(airdropAllocations);

    const totalPoints = totals?.totalPoints ?? 0;
    if (totalPoints === 0) return 0n;

    // Airdrop pool: 10% of 1B = 100M BBLN
    const AIRDROP_POOL = parseUnits('100000000', 18);
    const userShare =
      (BigInt(allocation.snapshotPoints) * AIRDROP_POOL) / BigInt(totalPoints);

    // Apply ELIZA holder multiplier if applicable
    const multiplier = allocation.isElizaHolder ? ELIZA_HOLDER_MULTIPLIER : 100;
    const baseAllocation = (userShare * BigInt(multiplier)) / 100n;

    return baseAllocation;
  }

  /**
   * Get current leaderboard for bonus period
   */
  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    // Calculate points earned since launch
    const leaderboard = await db
      .select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        currentPoints: users.reputationPoints,
      })
      .from(users)
      .where(eq(users.isActor, false))
      .orderBy(desc(users.reputationPoints))
      .limit(limit);

    // Get snapshot points for comparison
    const userIds = leaderboard.map((u) => u.userId);
    const snapshots = await db
      .select({
        userId: airdropAllocations.userId,
        snapshotPoints: airdropAllocations.snapshotPoints,
      })
      .from(airdropAllocations)
      .where(
        sql`${airdropAllocations.userId} IN (${sql.join(
          userIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    const snapshotMap = new Map(
      snapshots.map((s) => [s.userId, s.snapshotPoints])
    );

    return leaderboard.map((user, index) => {
      const snapshotPoints = snapshotMap.get(user.userId) ?? 0;
      const pointsEarned = Math.max(0, user.currentPoints - snapshotPoints);

      return {
        userId: user.userId,
        username: user.username ?? '',
        displayName: user.displayName ?? '',
        profileImageUrl: user.profileImageUrl,
        pointsEarned,
        rank: index + 1,
        estimatedBonus: this.calculatePointsBonus(pointsEarned),
      };
    });
  }

  /**
   * Calculate bonus allocation for points earned
   */
  private calculatePointsBonus(pointsEarned: number): bigint {
    if (pointsEarned < MIN_POINTS_FOR_BONUS) return 0n;

    // 1 BBLN per 10 points earned
    const bblnAmount = BigInt(pointsEarned) / POINTS_TO_BBLN_RATE;
    return bblnAmount * parseUnits('1', 18);
  }

  /**
   * Get leaderboard multiplier based on position
   */
  private getLeaderboardMultiplier(
    position: number,
    totalParticipants: number
  ): bigint {
    if (totalParticipants === 0) return LEADERBOARD_MULTIPLIERS.DEFAULT;

    const percentile = position / totalParticipants;

    if (percentile <= 0.01) return LEADERBOARD_MULTIPLIERS.TOP_1_PERCENT;
    if (percentile <= 0.1) return LEADERBOARD_MULTIPLIERS.TOP_10_PERCENT;
    if (percentile <= 0.25) return LEADERBOARD_MULTIPLIERS.TOP_25_PERCENT;
    return LEADERBOARD_MULTIPLIERS.DEFAULT;
  }

  /**
   * Get user's current bonus status
   */
  async getUserBonusStatus(userId: string): Promise<UserBonusStatus | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    const [allocation] = await db
      .select()
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    if (!allocation) return null;

    // Get total participants and user's rank
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(airdropAllocations);
    const totalParticipants = countResult[0]?.count ?? 0;

    // Get user's leaderboard position
    const pointsEarned = Math.max(
      0,
      user.reputationPoints - (allocation.snapshotPoints ?? 0)
    );

    const rankResult = await db
      .select({
        rank: sql<number>`count(*) + 1`,
      })
      .from(users)
      .where(
        sql`${users.reputationPoints} > ${user.reputationPoints} AND ${users.isActor} = false`
      );
    const rank = rankResult[0]?.rank ?? totalParticipants;

    const leaderboardMultiplier = this.getLeaderboardMultiplier(
      rank,
      totalParticipants
    );
    const baseAllocation = await this.calculateBaseAllocation(userId);
    const pointsBonus = this.calculatePointsBonus(pointsEarned);
    const elizaMultiplier = allocation.isElizaHolder
      ? ELIZA_HOLDER_MULTIPLIER
      : 100;
    const estimatedBonus =
      (pointsBonus * leaderboardMultiplier * BigInt(elizaMultiplier)) / 100n;

    // Check if bonus period is active
    const now = new Date();
    const launchDate = this.launchDate ?? new Date();
    const bonusPeriodEnd = new Date(launchDate);
    bonusPeriodEnd.setDate(bonusPeriodEnd.getDate() + BONUS_PERIOD_DAYS);
    const bonusPeriodActive = now >= launchDate && now <= bonusPeriodEnd;
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (bonusPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    return {
      userId,
      baseAllocation,
      pointsAtLaunch: allocation.snapshotPoints ?? 0,
      pointsEarnedDuringBonus: pointsEarned,
      leaderboardPosition: rank,
      totalParticipants,
      leaderboardMultiplier,
      elizaMultiplier,
      estimatedBonus,
      totalEstimatedAllocation: baseAllocation + estimatedBonus,
      bonusPeriodActive,
      daysRemaining,
    };
  }

  /**
   * Calculate final bonus allocations at end of period
   */
  async calculateFinalBonuses(): Promise<{
    processed: number;
    totalBonusAllocated: bigint;
    results: BonusCalculationResult[];
  }> {
    const leaderboard = await this.getLeaderboard(10000); // Get all participants
    const results: BonusCalculationResult[] = [];
    let totalBonusAllocated = 0n;

    for (const [i, entry] of leaderboard.entries()) {
      const [allocation] = await db
        .select()
        .from(airdropAllocations)
        .where(eq(airdropAllocations.userId, entry.userId))
        .limit(1);

      if (!allocation) continue;

      const pointsBonus = this.calculatePointsBonus(entry.pointsEarned);
      const leaderboardMultiplier = this.getLeaderboardMultiplier(
        i + 1,
        leaderboard.length
      );
      const leaderboardBonus = pointsBonus * (leaderboardMultiplier - 1n);
      const elizaBonus = allocation.isElizaHolder
        ? (pointsBonus * BigInt(ELIZA_HOLDER_MULTIPLIER - 100)) / 100n
        : 0n;
      const totalBonus = pointsBonus + leaderboardBonus + elizaBonus;

      results.push({
        userId: entry.userId,
        pointsBonus,
        leaderboardBonus,
        elizaBonus,
        totalBonus,
      });

      totalBonusAllocated += totalBonus;

      // Update allocation with bonus
      const currentAllocation = BigInt(allocation.totalAllocation);
      await db
        .update(airdropAllocations)
        .set({
          totalAllocation: (currentAllocation + totalBonus).toString(),
          updatedAt: new Date(),
        })
        .where(eq(airdropAllocations.userId, entry.userId));
    }

    logger.info(
      'Calculated final bonuses',
      {
        processed: results.length,
        totalBonusAllocated: totalBonusAllocated.toString(),
      },
      'AirdropBonusService'
    );

    return {
      processed: results.length,
      totalBonusAllocated,
      results,
    };
  }

  /**
   * Check if a user has ELIZA token holdings
   * (Would integrate with on-chain check)
   */
  async checkElizaHoldings(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.walletAddress) return false;

    // Check allocation table (set by ElizaHolderAirdropService after on-chain verification)
    // On-chain balance check requires ELIZA token addresses to be configured
    const [allocation] = await db
      .select({ isElizaHolder: airdropAllocations.isElizaHolder })
      .from(airdropAllocations)
      .where(eq(airdropAllocations.userId, userId))
      .limit(1);

    return allocation?.isElizaHolder ?? false;
  }

  /**
   * Mark user as ELIZA holder (called after on-chain verification)
   */
  async markAsElizaHolder(userId: string): Promise<void> {
    await db
      .update(airdropAllocations)
      .set({
        isElizaHolder: true,
        bonusMultiplier: ELIZA_HOLDER_MULTIPLIER,
        updatedAt: new Date(),
      })
      .where(eq(airdropAllocations.userId, userId));

    logger.info(
      `Marked user as ELIZA holder`,
      { userId },
      'AirdropBonusService'
    );
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let airdropBonusService: AirdropBonusService | null = null;

export function getAirdropBonusService(): AirdropBonusService {
  if (!airdropBonusService) {
    airdropBonusService = new AirdropBonusService();
  }
  return airdropBonusService;
}

export function resetAirdropBonusService(): void {
  airdropBonusService = null;
}
