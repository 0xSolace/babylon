/**
 * Engagement Service
 *
 * @description Tracks daily user engagement for airdrop drip qualification.
 *
 * Qualification Tracks:
 * - Social Track: 2 of 3 actions (like, comment, non-spam post)
 * - Trading Track: Any trade (prediction market or perpetual)
 *
 * Timing:
 * - UTC daily reset
 * - 4-hour grace period after midnight (actions in last 20 hours count)
 *
 * When either track is complete, user qualifies for daily 2% drip.
 */

import {
  and,
  type DailyEngagement,
  dailyEngagement,
  db,
  eq,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grace period in hours after UTC midnight */
const GRACE_PERIOD_HOURS = 4;

/** Minimum actions required for social track (2 of 3) */
const SOCIAL_TRACK_REQUIRED = 2;

// =============================================================================
// TYPES
// =============================================================================

export interface EngagementStatus {
  dateKey: string;
  // Social track
  socialTrack: {
    liked: boolean;
    commented: boolean;
    posted: boolean;
    actionsComplete: number;
    required: number;
    complete: boolean;
  };
  // Trading track
  tradingTrack: {
    traded: boolean;
    tradeType: string | null;
    complete: boolean;
  };
  // Overall
  qualifiedForDrip: boolean;
  qualifiedAt: Date | null;
  dripClaimed: boolean;
  dripAmount: string | null;
  // Timing
  nextResetTime: Date;
  gracePeriodActive: boolean;
}

export interface PostQualificationResult {
  qualifies: boolean;
  reason?: string;
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get the current engagement date key, accounting for grace period.
 *
 * If we're within GRACE_PERIOD_HOURS of UTC midnight, actions still count
 * toward the previous day.
 */
function getEngagementDateKey(now: Date = new Date()): string {
  const utcHours = now.getUTCHours();

  // If we're in the grace period (first 4 hours of UTC day),
  // use the previous day's key
  if (utcHours < GRACE_PERIOD_HOURS) {
    const previousDay = new Date(now);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    return formatDateKey(previousDay);
  }

  return formatDateKey(now);
}

/**
 * Format a date as YYYY-MM-DD in UTC
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Get the next UTC midnight (reset time)
 */
function getNextResetTime(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0); // Next midnight UTC
  return next;
}

/**
 * Check if we're currently in the grace period
 */
function isInGracePeriod(now: Date = new Date()): boolean {
  return now.getUTCHours() < GRACE_PERIOD_HOURS;
}

// =============================================================================
// SPAM DETECTION
// =============================================================================

/**
 * Check if a post qualifies for engagement (not spam).
 *
 * Requirements:
 * - At least 20 characters
 * - Not all same character
 * - At least 5 different characters (letters/numbers)
 */
export function validatePostQualifies(
  content: string
): PostQualificationResult {
  // Trim and normalize
  const trimmed = content.trim();

  // Check minimum length
  if (trimmed.length < 20) {
    return {
      qualifies: false,
      reason: 'Post must be at least 20 characters',
    };
  }

  // Check if all same character
  const uniqueChars = new Set(trimmed.toLowerCase());
  if (uniqueChars.size === 1) {
    return {
      qualifies: false,
      reason: 'Post cannot be all the same character',
    };
  }

  // Check for at least 5 different alphanumeric characters
  const alphanumericChars = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const uniqueAlphanumeric = new Set(alphanumericChars);

  if (uniqueAlphanumeric.size < 5) {
    return {
      qualifies: false,
      reason: 'Post must contain at least 5 different letters or numbers',
    };
  }

  return { qualifies: true };
}

// =============================================================================
// ENGAGEMENT SERVICE
// =============================================================================

export class EngagementService {
  /**
   * Get or create engagement record for a user's current day.
   */
  static async getOrCreateEngagement(userId: string): Promise<DailyEngagement> {
    const dateKey = getEngagementDateKey();

    // Check for existing record
    const [existing] = await db
      .select()
      .from(dailyEngagement)
      .where(
        and(
          eq(dailyEngagement.userId, userId),
          eq(dailyEngagement.dateKey, dateKey)
        )
      )
      .limit(1);

    if (existing) {
      return existing as DailyEngagement;
    }

    // Create new record
    const id = await generateSnowflakeId();
    const now = new Date();

    await db.insert(dailyEngagement).values({
      id,
      userId,
      dateKey,
      hasLiked: false,
      hasCommented: false,
      hasPosted: false,
      socialActionsCount: 0,
      socialTrackComplete: false,
      hasTraded: false,
      tradingTrackComplete: false,
      qualifiedForDrip: false,
      dripClaimed: false,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(dailyEngagement)
      .where(eq(dailyEngagement.id, id))
      .limit(1);

    if (!created) {
      throw new Error(`Failed to create engagement record for user ${userId}`);
    }

    return created as DailyEngagement;
  }

  /**
   * Get user's current engagement status.
   */
  static async getEngagementStatus(userId: string): Promise<EngagementStatus> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);
    const now = new Date();

    return {
      dateKey: engagement.dateKey,
      socialTrack: {
        liked: engagement.hasLiked,
        commented: engagement.hasCommented,
        posted: engagement.hasPosted,
        actionsComplete: engagement.socialActionsCount,
        required: SOCIAL_TRACK_REQUIRED,
        complete: engagement.socialTrackComplete,
      },
      tradingTrack: {
        traded: engagement.hasTraded,
        tradeType: engagement.tradeType,
        complete: engagement.tradingTrackComplete,
      },
      qualifiedForDrip: engagement.qualifiedForDrip,
      qualifiedAt: engagement.qualifiedAt,
      dripClaimed: engagement.dripClaimed,
      dripAmount: engagement.dripAmount,
      nextResetTime: getNextResetTime(now),
      gracePeriodActive: isInGracePeriod(now),
    };
  }

  /**
   * Record a like action.
   */
  static async recordLike(
    userId: string,
    postId: string
  ): Promise<{ recorded: boolean; qualified: boolean }> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);

    // Already liked today
    if (engagement.hasLiked) {
      return { recorded: false, qualified: engagement.qualifiedForDrip };
    }

    const now = new Date();
    const newActionCount = engagement.socialActionsCount + 1;
    const socialComplete = newActionCount >= SOCIAL_TRACK_REQUIRED;
    const qualified = socialComplete || engagement.tradingTrackComplete;

    await db
      .update(dailyEngagement)
      .set({
        hasLiked: true,
        likedPostId: postId,
        likedAt: now,
        socialActionsCount: newActionCount,
        socialTrackComplete: socialComplete,
        qualifiedForDrip: qualified,
        qualifiedAt:
          qualified && !engagement.qualifiedForDrip
            ? now
            : engagement.qualifiedAt,
        updatedAt: now,
      })
      .where(eq(dailyEngagement.id, engagement.id));

    logger.info(
      'Recorded like engagement',
      {
        userId,
        postId,
        socialActions: newActionCount,
        qualified,
      },
      'EngagementService'
    );

    return { recorded: true, qualified };
  }

  /**
   * Record a comment action.
   */
  static async recordComment(
    userId: string,
    postId: string,
    commentId: string
  ): Promise<{ recorded: boolean; qualified: boolean }> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);

    // Already commented today
    if (engagement.hasCommented) {
      return { recorded: false, qualified: engagement.qualifiedForDrip };
    }

    const now = new Date();
    const newActionCount = engagement.socialActionsCount + 1;
    const socialComplete = newActionCount >= SOCIAL_TRACK_REQUIRED;
    const qualified = socialComplete || engagement.tradingTrackComplete;

    await db
      .update(dailyEngagement)
      .set({
        hasCommented: true,
        commentedPostId: postId,
        commentId,
        commentedAt: now,
        socialActionsCount: newActionCount,
        socialTrackComplete: socialComplete,
        qualifiedForDrip: qualified,
        qualifiedAt:
          qualified && !engagement.qualifiedForDrip
            ? now
            : engagement.qualifiedAt,
        updatedAt: now,
      })
      .where(eq(dailyEngagement.id, engagement.id));

    logger.info(
      'Recorded comment engagement',
      {
        userId,
        postId,
        commentId,
        socialActions: newActionCount,
        qualified,
      },
      'EngagementService'
    );

    return { recorded: true, qualified };
  }

  /**
   * Record a post action.
   * Validates post content against spam rules.
   */
  static async recordPost(
    userId: string,
    postId: string,
    content: string
  ): Promise<{
    recorded: boolean;
    qualified: boolean;
    validationError?: string;
  }> {
    // Validate post content
    const validation = validatePostQualifies(content);
    if (!validation.qualifies) {
      return {
        recorded: false,
        qualified: false,
        validationError: validation.reason,
      };
    }

    const engagement = await EngagementService.getOrCreateEngagement(userId);

    // Already posted today
    if (engagement.hasPosted) {
      return { recorded: false, qualified: engagement.qualifiedForDrip };
    }

    const now = new Date();
    const newActionCount = engagement.socialActionsCount + 1;
    const socialComplete = newActionCount >= SOCIAL_TRACK_REQUIRED;
    const qualified = socialComplete || engagement.tradingTrackComplete;

    await db
      .update(dailyEngagement)
      .set({
        hasPosted: true,
        postedId: postId,
        postedAt: now,
        socialActionsCount: newActionCount,
        socialTrackComplete: socialComplete,
        qualifiedForDrip: qualified,
        qualifiedAt:
          qualified && !engagement.qualifiedForDrip
            ? now
            : engagement.qualifiedAt,
        updatedAt: now,
      })
      .where(eq(dailyEngagement.id, engagement.id));

    logger.info(
      'Recorded post engagement',
      {
        userId,
        postId,
        socialActions: newActionCount,
        qualified,
      },
      'EngagementService'
    );

    return { recorded: true, qualified };
  }

  /**
   * Record a trade action.
   */
  static async recordTrade(
    userId: string,
    tradeId: string,
    tradeType: 'prediction' | 'perp'
  ): Promise<{ recorded: boolean; qualified: boolean }> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);

    // Already traded today
    if (engagement.hasTraded) {
      return { recorded: false, qualified: engagement.qualifiedForDrip };
    }

    const now = new Date();
    const qualified = true; // Trading track is complete with 1 trade

    await db
      .update(dailyEngagement)
      .set({
        hasTraded: true,
        tradeId,
        tradeType,
        tradedAt: now,
        tradingTrackComplete: true,
        qualifiedForDrip: qualified,
        qualifiedAt: !engagement.qualifiedForDrip
          ? now
          : engagement.qualifiedAt,
        updatedAt: now,
      })
      .where(eq(dailyEngagement.id, engagement.id));

    logger.info(
      'Recorded trade engagement',
      {
        userId,
        tradeId,
        tradeType,
        qualified,
      },
      'EngagementService'
    );

    return { recorded: true, qualified };
  }

  /**
   * Check if user qualifies for drip claim.
   */
  static async canClaimDrip(userId: string): Promise<{
    canClaim: boolean;
    reason: string;
    engagement: DailyEngagement | null;
  }> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);

    if (!engagement.qualifiedForDrip) {
      const socialNeeded =
        SOCIAL_TRACK_REQUIRED - engagement.socialActionsCount;
      return {
        canClaim: false,
        reason: `Complete social track (${socialNeeded} more action${socialNeeded !== 1 ? 's' : ''}) or make any trade`,
        engagement,
      };
    }

    if (engagement.dripClaimed) {
      return {
        canClaim: false,
        reason: 'Drip already claimed for today',
        engagement,
      };
    }

    return {
      canClaim: true,
      reason: 'Qualified for drip!',
      engagement,
    };
  }

  /**
   * Mark drip as claimed.
   */
  static async markDripClaimed(
    userId: string,
    dripAmount: bigint
  ): Promise<void> {
    const engagement = await EngagementService.getOrCreateEngagement(userId);
    const now = new Date();

    await db
      .update(dailyEngagement)
      .set({
        dripClaimed: true,
        dripAmount: dripAmount.toString(),
        dripClaimedAt: now,
        updatedAt: now,
      })
      .where(eq(dailyEngagement.id, engagement.id));

    logger.info(
      'Marked drip claimed',
      {
        userId,
        dateKey: engagement.dateKey,
        amount: dripAmount.toString(),
      },
      'EngagementService'
    );
  }

  /**
   * Get engagement history for a user.
   */
  static async getEngagementHistory(
    userId: string,
    limit = 30
  ): Promise<DailyEngagement[]> {
    return (await db
      .select()
      .from(dailyEngagement)
      .where(eq(dailyEngagement.userId, userId))
      .orderBy(dailyEngagement.dateKey)
      .limit(limit)) as DailyEngagement[];
  }

  /**
   * Get stats for today's engagement across all users.
   */
  static async getTodayStats(): Promise<{
    dateKey: string;
    totalUsers: number;
    qualified: number;
    claimed: number;
    socialComplete: number;
    tradingComplete: number;
  }> {
    const dateKey = getEngagementDateKey();

    const engagements = await db
      .select()
      .from(dailyEngagement)
      .where(eq(dailyEngagement.dateKey, dateKey));

    return {
      dateKey,
      totalUsers: engagements.length,
      qualified: engagements.filter((e) => e.qualifiedForDrip).length,
      claimed: engagements.filter((e) => e.dripClaimed).length,
      socialComplete: engagements.filter((e) => e.socialTrackComplete).length,
      tradingComplete: engagements.filter((e) => e.tradingTrackComplete).length,
    };
  }
}

// Export utility functions for use in other services
export {
  getEngagementDateKey,
  formatDateKey,
  getNextResetTime,
  isInGracePeriod,
};
