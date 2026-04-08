/**
 * Waitlist Service
 *
 * @description Manages waitlist signups, position tracking, and invite code
 * generation. Handles referral tracking, position calculations based on points,
 * and leaderboard rankings for waitlist participants.
 */

import {
  countActiveWaitlistUsers,
  fetchWaitlistPositionAggregate,
  finalizeWaitlistUser,
  graduateWaitlistUser,
  listTopWaitlistUsers,
  persistWaitlistReferralCompletion,
  selectMaxWaitlistPosition,
  selectReferrerByCodeForWaitlist,
  selectUserIdByReferralCode,
  selectWaitlistUserForMark,
  tryInsertWaitlistEmailBonus,
  tryInsertWaitlistWalletBonus,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger, POINTS } from '@babylon/shared';
import { nanoid } from 'nanoid';
import { NotFoundError } from '../errors';
import { PointsService } from './points-service';
import { getOrCreateReferralCode } from './referral-service';

export interface WaitlistMarkResult {
  success: boolean;
  waitlistPosition: number;
  inviteCode: string;
  points: number;
  referrerRewarded?: boolean;
  error?: string;
}

export interface WaitlistPosition {
  waitlistPosition: number; // Historical signup order (for records)
  leaderboardRank: number; // Actual position in line (dynamic, based on points)
  totalAhead: number; // How many people are ahead (by points)
  totalCount: number; // Total people on waitlist
  percentile: number; // Top X% of waitlist
  inviteCode: string;
  points: number;
  invitePoints: number;
  earnedPoints: number;
  bonusPoints: number;
  referralCount: number;
}

export class WaitlistService {
  /**
   * Generate a unique invite code
   */
  static generateInviteCode(): string {
    return nanoid(8).toUpperCase();
  }

  /**
   * Mark an existing user as waitlisted
   *
   * @description Marks a user as waitlisted after they complete onboarding.
   * Users must be created through the normal onboarding flow before calling
   * this method. Handles referral code processing and initial point awards.
   *
   * @param {string} userId - User ID to mark as waitlisted
   * @param {string} [referralCode] - Optional referral code used during signup
   * @returns {Promise<WaitlistMarkResult>} Waitlist marking result with position and invite code
   */
  static async markAsWaitlisted(
    userId: string,
    referralCode?: string
  ): Promise<WaitlistMarkResult> {
    const user = await asSystem(
      (c) => selectWaitlistUserForMark(c, userId),
      'waitlist-mark-user'
    );

    if (!user) {
      throw new NotFoundError('User', undefined, {
        userId,
        message: 'User must complete onboarding before joining waitlist',
      });
    }

    // If user already marked as waitlisted, still check for referral code validation
    // but don't change their position or status
    if (user.waitlistPosition && user.isWaitlistActive) {
      // Still validate referral code if provided (for self-referral/double-referral checks)
      let referrerRewarded = false;

      if (referralCode) {
        const referrer = await asSystem(
          (c) => selectUserIdByReferralCode(c, referralCode),
          'waitlist-mark-referrer-already'
        );

        if (referrer) {
          // PREVENT SELF-REFERRAL: Can't refer yourself!
          if (referrer.id === userId) {
            logger.warn(
              `User ${userId} attempted self-referral`,
              {
                userId,
                referralCode,
              },
              'WaitlistService'
            );
            referrerRewarded = false;
          }
          // PREVENT DOUBLE-REFERRAL: Check if user was already referred
          else if (user.referredBy) {
            logger.warn(
              `User ${userId} already referred by ${user.referredBy}, ignoring new referral`,
              {
                userId,
                existingReferrer: user.referredBy,
                attemptedReferrer: referrer.id,
              },
              'WaitlistService'
            );
            referrerRewarded = false;
          }
          // Valid referral - but user already waitlisted, so don't reward again
          else {
            referrerRewarded = false;
            logger.info(
              `User ${userId} already waitlisted, referral code ${referralCode} ignored`,
              {
                userId,
                referralCode,
              },
              'WaitlistService'
            );
          }
        }
      }

      return {
        success: true,
        waitlistPosition: user.waitlistPosition,
        inviteCode: user.referralCode || '',
        points: user.reputationPoints,
        referrerRewarded,
      };
    }

    const lastPosition = await asSystem(
      (c) => selectMaxWaitlistPosition(c),
      'waitlist-mark-last-position'
    );

    const newPosition = (lastPosition || 0) + 1;

    // Generate invite code if user doesn't have one
    const inviteCode =
      user.referralCode || WaitlistService.generateInviteCode();

    // Handle referral rewards with validation
    let referrerRewarded = false;

    if (referralCode) {
      const referrer = await asSystem(
        (c) => selectReferrerByCodeForWaitlist(c, referralCode),
        'waitlist-mark-referrer'
      );

      if (referrer) {
        // PREVENT SELF-REFERRAL: Can't refer yourself!
        if (referrer.id === userId) {
          logger.warn(
            `User ${userId} attempted self-referral`,
            {
              userId,
              referralCode,
            },
            'WaitlistService'
          );
          referrerRewarded = false;
        }
        // PREVENT DOUBLE-REFERRAL: Check if user was already referred
        else if (user.referredBy) {
          logger.warn(
            `User ${userId} already referred by ${user.referredBy}, ignoring new referral`,
            {
              userId,
              existingReferrer: user.referredBy,
              attemptedReferrer: referrer.id,
            },
            'WaitlistService'
          );
          referrerRewarded = false;
        }
        // Valid referral - use referral system
        else {
          // Use PointsService.awardReferralSignup for referral processing
          // This handles weekly limits, IP checks, and creates proper Referral records
          const referralResult = await PointsService.awardReferralSignup(
            referrer.id,
            userId
          );

          if (referralResult.success) {
            await asSystem(async (c) => {
              await persistWaitlistReferralCompletion(c, {
                referralCode,
                referredUserId: userId,
                referrerId: referrer.id,
                newReferralRowId: await generateSnowflakeId(),
              });
            }, 'waitlist-mark-referral-persist');

            referrerRewarded = true;

            logger.info(
              `Rewarded referrer ${referrer.id} with ${referralResult.pointsAwarded} points via referral system`,
              {
                referrerId: referrer.id,
                pointsAwarded: referralResult.pointsAwarded,
                newTotal: referralResult.newTotal,
              },
              'WaitlistService'
            );
          } else {
            // Referral failed (weekly limit, IP check, etc.)
            logger.warn(
              `Failed to award referral points: ${referralResult.error}`,
              {
                referrerId: referrer.id,
                referredUserId: userId,
                error: referralResult.error,
              },
              'WaitlistService'
            );
            referrerRewarded = false;
          }
        }
      } else {
        logger.warn(
          `Invalid referral code: ${referralCode}`,
          {
            userId,
            referralCode,
          },
          'WaitlistService'
        );
      }
    }

    // Ensure user has a referral code
    if (!user.referralCode) {
      await getOrCreateReferralCode(userId);
    }

    await asSystem(
      (c) =>
        finalizeWaitlistUser(c, userId, {
          waitlistPosition: newPosition,
          inviteCode,
        }),
      'waitlist-mark-finalize'
    );

    logger.info(
      'User marked as waitlisted',
      {
        userId,
        position: newPosition,
        referrerRewarded,
      },
      'WaitlistService'
    );

    return {
      success: true,
      waitlistPosition: newPosition,
      inviteCode,
      points: user.reputationPoints,
      referrerRewarded,
    };
  }

  /**
   * Graduate a user from waitlist to full access
   */
  static async graduateFromWaitlist(userId: string): Promise<boolean> {
    await asSystem((c) => graduateWaitlistUser(c, userId), 'waitlist-graduate');

    logger.info('User graduated from waitlist', { userId }, 'WaitlistService');
    return true;
  }

  /**
   * Get user's waitlist position and stats
   * CRITICAL: Position is based on INVITE POINTS (leaderboard rank), not signup order!
   * This creates the viral loop incentive.
   */
  static async getWaitlistPosition(
    userId: string
  ): Promise<WaitlistPosition | null> {
    const positionData = await asSystem(
      (c) => fetchWaitlistPositionAggregate(c, userId),
      'waitlist-position'
    );

    if (!positionData) {
      return null;
    }

    const { user, usersAhead, totalCount } = positionData;

    const leaderboardRank = usersAhead + 1;

    // Calculate percentile (Top X% - what percentile you're in from the top)
    const percentile =
      totalCount > 0 ? Math.round((leaderboardRank / totalCount) * 100) : 100;

    return {
      waitlistPosition: user.waitlistPosition || 0, // Historical record
      leaderboardRank, // What users see!
      totalAhead: usersAhead,
      totalCount,
      percentile,
      inviteCode: user.referralCode || '',
      points: user.reputationPoints,
      invitePoints: user.invitePoints,
      earnedPoints: user.earnedPoints,
      bonusPoints: user.bonusPoints,
      referralCount: user.referralCount,
    };
  }

  /**
   * Award bonus points for wallet connection
   */
  static async awardWalletBonus(
    userId: string,
    walletAddress: string
  ): Promise<boolean> {
    const bonusAmount = 300;
    const awarded = await asSystem(async (c) => {
      return tryInsertWaitlistWalletBonus(c, {
        userId,
        walletAddress,
        pointsTransactionId: await generateSnowflakeId(),
        bonusAmount,
      });
    }, 'waitlist-wallet-bonus');

    if (!awarded) {
      return false;
    }

    logger.info(
      `Awarded wallet bonus to user ${userId}`,
      {
        userId,
        bonusAmount,
      },
      'WaitlistService'
    );

    return true;
  }

  /**
   * Award bonus points for providing an email address (one-time bonus).
   * Saves the email and sets pointsAwardedForEmail to prevent double-awarding.
   */
  static async awardEmailBonus(
    userId: string,
    email: string
  ): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const bonusAmount = POINTS.EMAIL_SUBMIT;

    const awarded = await asSystem(async (c) => {
      return tryInsertWaitlistEmailBonus(c, {
        userId,
        normalizedEmail,
        pointsTransactionId: await generateSnowflakeId(),
        bonusAmount,
      });
    }, 'waitlist-email-bonus');

    if (!awarded) {
      return false;
    }

    logger.info(
      `Awarded email bonus to user ${userId}`,
      { userId, bonusAmount },
      'WaitlistService'
    );

    return true;
  }

  /**
   * Get total waitlist count
   */
  static async getTotalWaitlistCount(): Promise<number> {
    return asSystem((c) => countActiveWaitlistUsers(c), 'waitlist-total-count');
  }

  /**
   * Get top waitlist users (leaderboard)
   * Sorted by invite points (most invites = best position)
   * Supports pagination with offset
   */
  static async getTopWaitlistUsers(
    limit = 10,
    offset = 0,
    pointsType: 'total' | 'invite' = 'invite'
  ) {
    // Ensure limit is reasonable
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    const usersResult = await asSystem(
      (c) =>
        listTopWaitlistUsers(c, {
          limit: safeLimit,
          offset: safeOffset,
          pointsType,
        }),
      'waitlist-top-users'
    );

    return usersResult.map((user, index) => ({
      id: user.id, // For frontend compatibility (TopUser interface expects 'id')
      userId: user.id, // Keep for backward compatibility
      username: user.username,
      displayName: user.displayName,
      // profileImageUrl removed - fetch on-demand when profile is clicked to reduce bandwidth
      points:
        pointsType === 'total' ? user.reputationPoints : user.invitePoints, // Keep for backward compatibility
      invitePoints: user.invitePoints, // For frontend TopUser interface
      reputationPoints: user.reputationPoints, // For frontend TopUser interface
      referralCount: user.referralCount,
      rank: safeOffset + index + 1, // Adjust rank based on offset
    }));
  }
}
