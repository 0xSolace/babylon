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

import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { parseUnits } from 'viem'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Bonus period duration in days */
const BONUS_PERIOD_DAYS = 90

/** Points to BBLN conversion rate (1 BBLN per 10 points) */
const POINTS_TO_BBLN_RATE = 10n

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
} as const

/** ELIZA holder bonus multiplier (150 = 1.5x) */
const ELIZA_HOLDER_MULTIPLIER = 150

/** Minimum points to qualify for bonus */
const MIN_POINTS_FOR_BONUS = 100

// =============================================================================
// TYPES
// =============================================================================

export interface BonusPeriodConfig {
  launchDate: Date
  bonusPeriodEnd: Date
  snapshotDate: Date
  isActive: boolean
  daysRemaining: number
}

export interface UserBonusStatus {
  userId: string
  baseAllocation: bigint
  pointsAtLaunch: number
  pointsEarnedDuringBonus: number
  leaderboardPosition: number
  totalParticipants: number
  leaderboardMultiplier: bigint
  elizaMultiplier: number
  estimatedBonus: bigint
  totalEstimatedAllocation: bigint
  bonusPeriodActive: boolean
  daysRemaining: number
}

export interface LeaderboardEntry {
  userId: string
  username: string
  displayName: string
  profileImageUrl: string | null
  pointsEarned: number
  rank: number
  estimatedBonus: bigint
}

export interface BonusCalculationResult {
  userId: string
  pointsBonus: bigint
  leaderboardBonus: bigint
  elizaBonus: bigint
  totalBonus: bigint
}

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

interface UserRow {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  reputationPoints: number
  earnedPoints: number
  invitePoints: number
  bonusPoints: number
  walletAddress: string | null
  isActor: boolean
}

interface AirdropAllocationRow {
  id: string
  userId: string
  walletAddress: string
  totalAllocation: string
  bonusMultiplier: number
  snapshotPoints: number
  isElizaHolder: boolean
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// SERVICE
// =============================================================================

export class AirdropBonusService {
  private launchDate: Date | null = null

  /**
   * Initialize the bonus period with launch date
   */
  async initializeBonusPeriod(launchDate: Date): Promise<BonusPeriodConfig> {
    this.launchDate = launchDate
    const bonusPeriodEnd = new Date(launchDate)
    bonusPeriodEnd.setDate(bonusPeriodEnd.getDate() + BONUS_PERIOD_DAYS)

    const now = new Date()
    const isActive = now >= launchDate && now <= bonusPeriodEnd
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (bonusPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
    )

    logger.info(
      'Initialized bonus period',
      {
        launchDate: launchDate.toISOString(),
        bonusPeriodEnd: bonusPeriodEnd.toISOString(),
        isActive,
        daysRemaining,
      },
      'AirdropBonusService',
    )

    return {
      launchDate,
      bonusPeriodEnd,
      snapshotDate: launchDate,
      isActive,
      daysRemaining,
    }
  }

  /**
   * Take snapshot of user points at launch
   */
  async takePointsSnapshot(): Promise<{
    usersProcessed: number
    totalPoints: number
  }> {
    const allUsers = await db.query<UserRow>(
      `SELECT "id", "reputationPoints", "earnedPoints", "invitePoints", "bonusPoints", "walletAddress", "isActor"
       FROM "User"
       WHERE "isActor" = false`,
    )

    let totalPoints = 0
    let usersProcessed = 0

    for (const user of allUsers) {
      if (!user.walletAddress) continue

      const totalUserPoints =
        Number(user.reputationPoints) +
        Number(user.earnedPoints) +
        Number(user.invitePoints) +
        Number(user.bonusPoints)

      // Check for existing allocation
      const existingAlloc = await db.queryOne<AirdropAllocationRow>(
        `SELECT * FROM "AirdropAllocation" WHERE "userId" = $1 LIMIT 1`,
        [user.id],
      )

      if (!existingAlloc) {
        const newId = await generateSnowflakeId()
        const now = new Date().toISOString()
        await db.exec(
          `INSERT INTO "AirdropAllocation" ("id", "userId", "walletAddress", "totalAllocation", "bonusMultiplier", "snapshotPoints", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newId,
            user.id,
            user.walletAddress,
            '0',
            100,
            totalUserPoints,
            now,
            now,
          ],
        )
      } else {
        await db.exec(
          `UPDATE "AirdropAllocation" SET "snapshotPoints" = $1, "updatedAt" = $2 WHERE "userId" = $3`,
          [totalUserPoints, new Date().toISOString(), user.id],
        )
      }

      totalPoints += totalUserPoints
      usersProcessed++
    }

    logger.info(
      'Points snapshot completed',
      { usersProcessed, totalPoints },
      'AirdropBonusService',
    )

    return { usersProcessed, totalPoints }
  }

  /**
   * Calculate base allocation for a user based on their points snapshot
   */
  async calculateBaseAllocation(userId: string): Promise<bigint> {
    const allocation = await db.queryOne<AirdropAllocationRow>(
      `SELECT * FROM "AirdropAllocation" WHERE "userId" = $1 LIMIT 1`,
      [userId],
    )

    if (!allocation) return 0n

    // Get total points across all users for proportional allocation
    const totals = await db.queryOne<{ totalPoints: string | number | null }>(
      `SELECT SUM("snapshotPoints") as "totalPoints" FROM "AirdropAllocation"`,
    )

    const totalPoints = Number(totals?.totalPoints ?? 0)
    if (totalPoints === 0) return 0n

    // Airdrop pool: 10% of 1B = 100M BBLN
    const AIRDROP_POOL = parseUnits('100000000', 18)
    const userShare =
      (BigInt(allocation.snapshotPoints) * AIRDROP_POOL) / BigInt(totalPoints)

    // Apply ELIZA holder multiplier if applicable
    const multiplier = allocation.isElizaHolder ? ELIZA_HOLDER_MULTIPLIER : 100
    const baseAllocation = (userShare * BigInt(multiplier)) / 100n

    return baseAllocation
  }

  /**
   * Get current leaderboard for bonus period
   */
  async getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
    // Get users ordered by reputation points
    const leaderboard = await db.query<{
      userId: string
      username: string | null
      displayName: string | null
      profileImageUrl: string | null
      currentPoints: number
    }>(
      `SELECT "id" as "userId", "username", "displayName", "profileImageUrl", "reputationPoints" as "currentPoints"
       FROM "User"
       WHERE "isActor" = false
       ORDER BY "reputationPoints" DESC
       LIMIT $1`,
      [limit],
    )

    // Get snapshot points for all users in the leaderboard
    const userIds = leaderboard.map((u) => u.userId)
    if (userIds.length === 0) return []

    // Build IN clause with proper parameterization
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ')
    const snapshots = await db.query<{
      userId: string
      snapshotPoints: number
    }>(
      `SELECT "userId", "snapshotPoints" FROM "AirdropAllocation" WHERE "userId" IN (${placeholders})`,
      userIds,
    )

    const snapshotMap = new Map(
      snapshots.map((s) => [s.userId, Number(s.snapshotPoints)]),
    )

    return leaderboard.map((user, index) => {
      const snapshotPoints = snapshotMap.get(user.userId) ?? 0
      const pointsEarned = Math.max(
        0,
        Number(user.currentPoints) - snapshotPoints,
      )

      return {
        userId: user.userId,
        username: user.username ?? '',
        displayName: user.displayName ?? '',
        profileImageUrl: user.profileImageUrl,
        pointsEarned,
        rank: index + 1,
        estimatedBonus: this.calculatePointsBonus(pointsEarned),
      }
    })
  }

  /**
   * Calculate bonus allocation for points earned
   */
  private calculatePointsBonus(pointsEarned: number): bigint {
    if (pointsEarned < MIN_POINTS_FOR_BONUS) return 0n

    // 1 BBLN per 10 points earned
    const bblnAmount = BigInt(pointsEarned) / POINTS_TO_BBLN_RATE
    return bblnAmount * parseUnits('1', 18)
  }

  /**
   * Get leaderboard multiplier based on position
   */
  private getLeaderboardMultiplier(
    position: number,
    totalParticipants: number,
  ): bigint {
    if (totalParticipants === 0) return LEADERBOARD_MULTIPLIERS.DEFAULT

    const percentile = position / totalParticipants

    if (percentile <= 0.01) return LEADERBOARD_MULTIPLIERS.TOP_1_PERCENT
    if (percentile <= 0.1) return LEADERBOARD_MULTIPLIERS.TOP_10_PERCENT
    if (percentile <= 0.25) return LEADERBOARD_MULTIPLIERS.TOP_25_PERCENT
    return LEADERBOARD_MULTIPLIERS.DEFAULT
  }

  /**
   * Get user's current bonus status
   */
  async getUserBonusStatus(userId: string): Promise<UserBonusStatus | null> {
    const user = await db.queryOne<UserRow>(
      `SELECT * FROM "User" WHERE "id" = $1 LIMIT 1`,
      [userId],
    )

    if (!user) return null

    const allocation = await db.queryOne<AirdropAllocationRow>(
      `SELECT * FROM "AirdropAllocation" WHERE "userId" = $1 LIMIT 1`,
      [userId],
    )

    if (!allocation) return null

    // Get total participants
    const countResult = await db.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM "AirdropAllocation"`,
    )
    const totalParticipants = Number(countResult?.count ?? 0)

    // Get user's leaderboard position
    const pointsEarned = Math.max(
      0,
      Number(user.reputationPoints) - Number(allocation.snapshotPoints ?? 0),
    )

    // Count users with more reputation points to determine rank
    const rankResult = await db.queryOne<{ rank: string | number }>(
      `SELECT COUNT(*) + 1 as rank FROM "User" WHERE "reputationPoints" > $1 AND "isActor" = false`,
      [user.reputationPoints],
    )
    const rank = Number(rankResult?.rank ?? totalParticipants)

    const leaderboardMultiplier = this.getLeaderboardMultiplier(
      rank,
      totalParticipants,
    )
    const baseAllocation = await this.calculateBaseAllocation(userId)
    const pointsBonus = this.calculatePointsBonus(pointsEarned)
    const elizaMultiplier = allocation.isElizaHolder
      ? ELIZA_HOLDER_MULTIPLIER
      : 100
    const estimatedBonus =
      (pointsBonus * leaderboardMultiplier * BigInt(elizaMultiplier)) / 100n

    // Check if bonus period is active
    const now = new Date()
    const launchDate = this.launchDate ?? new Date()
    const bonusPeriodEnd = new Date(launchDate)
    bonusPeriodEnd.setDate(bonusPeriodEnd.getDate() + BONUS_PERIOD_DAYS)
    const bonusPeriodActive = now >= launchDate && now <= bonusPeriodEnd
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (bonusPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
    )

    return {
      userId,
      baseAllocation,
      pointsAtLaunch: Number(allocation.snapshotPoints ?? 0),
      pointsEarnedDuringBonus: pointsEarned,
      leaderboardPosition: rank,
      totalParticipants,
      leaderboardMultiplier,
      elizaMultiplier,
      estimatedBonus,
      totalEstimatedAllocation: baseAllocation + estimatedBonus,
      bonusPeriodActive,
      daysRemaining,
    }
  }

  /**
   * Calculate final bonus allocations at end of period
   */
  async calculateFinalBonuses(): Promise<{
    processed: number
    totalBonusAllocated: bigint
    results: BonusCalculationResult[]
  }> {
    const leaderboard = await this.getLeaderboard(10000) // Get all participants
    const results: BonusCalculationResult[] = []
    let totalBonusAllocated = 0n

    for (const [i, entry] of leaderboard.entries()) {
      const allocation = await db.queryOne<AirdropAllocationRow>(
        `SELECT * FROM "AirdropAllocation" WHERE "userId" = $1 LIMIT 1`,
        [entry.userId],
      )

      if (!allocation) continue

      const pointsBonus = this.calculatePointsBonus(entry.pointsEarned)
      const leaderboardMultiplier = this.getLeaderboardMultiplier(
        i + 1,
        leaderboard.length,
      )
      const leaderboardBonus = pointsBonus * (leaderboardMultiplier - 1n)
      const elizaBonus = allocation.isElizaHolder
        ? (pointsBonus * BigInt(ELIZA_HOLDER_MULTIPLIER - 100)) / 100n
        : 0n
      const totalBonus = pointsBonus + leaderboardBonus + elizaBonus

      results.push({
        userId: entry.userId,
        pointsBonus,
        leaderboardBonus,
        elizaBonus,
        totalBonus,
      })

      totalBonusAllocated += totalBonus

      // Update allocation with bonus
      const currentAllocation = BigInt(allocation.totalAllocation)
      const newAllocation = (currentAllocation + totalBonus).toString()
      await db.exec(
        `UPDATE "AirdropAllocation" SET "totalAllocation" = $1, "updatedAt" = $2 WHERE "userId" = $3`,
        [newAllocation, new Date().toISOString(), entry.userId],
      )
    }

    logger.info(
      'Calculated final bonuses',
      {
        processed: results.length,
        totalBonusAllocated: totalBonusAllocated.toString(),
      },
      'AirdropBonusService',
    )

    return {
      processed: results.length,
      totalBonusAllocated,
      results,
    }
  }

  /**
   * Check if a user has ELIZA token holdings
   * (Would integrate with on-chain check)
   */
  async checkElizaHoldings(userId: string): Promise<boolean> {
    const user = await db.queryOne<{ walletAddress: string | null }>(
      `SELECT "walletAddress" FROM "User" WHERE "id" = $1 LIMIT 1`,
      [userId],
    )

    if (!user?.walletAddress) return false

    // Check allocation table (set by ElizaHolderAirdropService after on-chain verification)
    const allocation = await db.queryOne<{ isElizaHolder: boolean }>(
      `SELECT "isElizaHolder" FROM "AirdropAllocation" WHERE "userId" = $1 LIMIT 1`,
      [userId],
    )

    return allocation?.isElizaHolder ?? false
  }

  /**
   * Mark user as ELIZA holder (called after on-chain verification)
   */
  async markAsElizaHolder(userId: string): Promise<void> {
    await db.exec(
      `UPDATE "AirdropAllocation" SET "isElizaHolder" = true, "bonusMultiplier" = $1, "updatedAt" = $2 WHERE "userId" = $3`,
      [ELIZA_HOLDER_MULTIPLIER, new Date().toISOString(), userId],
    )

    logger.info(
      `Marked user as ELIZA holder`,
      { userId },
      'AirdropBonusService',
    )
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let airdropBonusService: AirdropBonusService | null = null

export function getAirdropBonusService(): AirdropBonusService {
  if (!airdropBonusService) {
    airdropBonusService = new AirdropBonusService()
  }
  return airdropBonusService
}

export function resetAirdropBonusService(): void {
  airdropBonusService = null
}
