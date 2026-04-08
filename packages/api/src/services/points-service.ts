/**
 * Points Service
 *
 * @description Centralized service for managing reputation points and rewards.
 * Tracks all point transactions and ensures no duplicate awards. Handles different
 * point types (reputation, invite, bonus) and provides leaderboard functionality.
 */

import {
  addUserVirtualBalanceAtomic,
  countActorStatesWithHigherReputation,
  countAgentsForManager,
  countNonActorNonAgentUsers,
  countTeamLeaderboardHigherThanUser,
  countUnqualifiedReferralsWithSignupAwarded,
  countUsersNonActor,
  countUsersWithHigherReputationNonActor,
  countWalletLeaderboardHigherThanUser,
  deductUserVirtualBalanceFloored,
  executeTeamLeaderboardPage,
  incrementUserReferralCount,
  incrementUserReferralCountAfterSignupAward,
  insertBalanceTransactionRow,
  insertPointsTransactionRow,
  type JsonValue,
  listRecentPointsTransactionsForUser,
  markReferralSignupPointsAwarded,
  type PointsAwardUserPatch,
  type PointsAwardUserStateRow,
  selectActorStatesMinReputation,
  selectAgentTotalPointsSumForManager,
  selectExistingBalanceTxByRelatedId,
  selectExistingPurchaseBalanceTx,
  selectLatestReferralIdBetweenUsers,
  selectLeaderboardUsersAllMinReputation,
  selectLeaderboardUsersByTotalPointsPage,
  selectLeaderboardUsersEarnedNonZero,
  selectLeaderboardUsersWithInvitePoints,
  selectOldestPendingReferralWithoutSignup,
  selectPointsAwardUserState,
  selectReferralQualificationRow,
  selectReferredUserSocialSlice,
  selectUserPointsSummary,
  selectUserPositionSlice,
  selectUserReferralIdentity,
  selectUserReputationAndActorFlag,
  selectUserReputationPointsOnly,
  selectUserVirtualBalance,
  selectWalletLeaderboardPage,
  updateReferralQualifiedAtNow,
  updateReferralSignupFields,
  updateUserPointsAwardPatch,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { StaticDataRegistry, TotalPointsService } from '@babylon/engine';
import {
  generateSnowflakeId,
  logger,
  POINTS,
  type PointsReason,
} from '@babylon/shared';

/**
 * Maximum number of unqualified referrals that can earn signup points at any time.
 * When a referral becomes qualified (user links social account), a slot opens for
 * pending referrals to receive their deferred signup points (FIFO order).
 */
const UNQUALIFIED_REFERRAL_LIMIT = 10;

/**
 * Leaderboard category type (legacy — used by existing getLeaderboard)
 */
type LeaderboardCategory = 'all' | 'earned' | 'referral' | 'total';

/**
 * New leaderboard types: per-wallet (individual wallets) or team (user + agents)
 */
type LeaderboardType = 'wallet' | 'team';

/**
 * Entry in the new wallet/team leaderboards
 */
interface LeaderboardEntry {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  totalPoints: number;
  balance: number;
  lifetimePnL: number;
  createdAt: Date;
  rank: number;
  isAgent: boolean;
  managedBy?: string | null;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  teamTotalPoints?: number;
  agentCount?: number;
  userPoints?: number;
  agentPoints?: number;
}

/**
 * Result of awarding points to a user
 *
 * @description Contains success status, points awarded, new total, and optional
 * error information.
 */
interface AwardPointsResult {
  success: boolean;
  pointsAwarded: number;
  newTotal: number;
  alreadyAwarded?: boolean;
  error?: string;
}

/**
 * Points Service Class
 *
 * @description Static service class for managing user points and rewards.
 * Provides methods for awarding points, checking duplicates, and retrieving
 * leaderboards.
 */
export class PointsService {
  /**
   * Award points to a user with transaction tracking
   */
  static async awardPoints(
    userId: string,
    amount: number,
    reason: PointsReason,
    metadata?: Record<string, JsonValue>
  ): Promise<AwardPointsResult> {
    const user = await selectPointsAwardUserState(db, userId);

    if (!user) {
      return {
        success: false,
        pointsAwarded: 0,
        newTotal: 0,
        error: 'User not found',
      };
    }

    // Check if points were already awarded for this reason
    const alreadyAwarded = PointsService.checkAlreadyAwarded(user, reason);
    if (alreadyAwarded) {
      return {
        success: true,
        pointsAwarded: 0,
        newTotal: user.reputationPoints,
        alreadyAwarded: true,
      };
    }

    const pointsBefore = user.reputationPoints;
    const pointsAfter = pointsBefore + amount;

    const updateData: PointsAwardUserPatch = {
      reputationPoints: pointsAfter,
    };

    // Set the appropriate tracking flag and update correct point type
    switch (reason) {
      case 'referral_signup':
        updateData.invitePoints = user.invitePoints + amount;
        break;
      case 'profile_completion':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForProfile = true;
        break;
      case 'farcaster_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForFarcaster = true;
        break;
      case 'farcaster_follow':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForFarcasterFollow = true;
        break;
      case 'twitter_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForTwitter = true;
        break;
      case 'twitter_follow':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForTwitterFollow = true;
        break;
      case 'discord_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForDiscord = true;
        break;
      case 'discord_join':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForDiscordJoin = true;
        break;
      case 'telegram_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForTelegram = true;
        break;
      case 'wallet_connect':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForWallet = true;
        break;
      case 'referral_bonus':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForReferralBonus = true;
        break;
      case 'share_action':
      case 'share_to_twitter':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForShare = true;
        break;
      case 'private_group_create':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForPrivateGroup = true;
        break;
      case 'private_channel_create':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForPrivateChannel = true;
        break;
      default:
        // For admin awards, purchases, etc - add to bonus
        updateData.bonusPoints = user.bonusPoints + amount;
        break;
    }

    await db.transaction(async (tx) => {
      await updateUserPointsAwardPatch(tx, userId, updateData);
      await insertPointsTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId,
        amount,
        pointsBefore,
        pointsAfter,
        reason,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    });

    logger.info(
      `Awarded ${amount} points to user ${userId} for ${reason}`,
      { userId, amount, reason, pointsBefore, pointsAfter },
      'PointsService'
    );

    // Reputation changed → mark totalPoints dirty for cron recompute
    TotalPointsService.markDirty(userId).catch((e) =>
      logger.warn(
        'Failed to mark user dirty after points award',
        { userId, error: e instanceof Error ? e.message : String(e) },
        'PointsService'
      )
    );

    return {
      success: true,
      pointsAwarded: amount,
      newTotal: pointsAfter,
    };
  }

  /**
   * Award points for profile completion (username + image + bio)
   */
  static async awardProfileCompletion(
    userId: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.PROFILE_COMPLETION,
      'profile_completion'
    );
  }

  /**
   * Award points for Farcaster link
   */
  static async awardFarcasterLink(
    userId: string,
    farcasterUsername?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.FARCASTER_LINK,
      'farcaster_link',
      farcasterUsername ? { farcasterUsername } : undefined
    );
  }

  /**
   * Award points for Farcaster follow
   */
  static async awardFarcasterFollow(
    userId: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.FARCASTER_FOLLOW,
      'farcaster_follow',
      { action: 'follow_playbabylon' }
    );
  }

  /**
   * Award points for Twitter follow
   */
  static async awardTwitterFollow(userId: string): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.TWITTER_FOLLOW,
      'twitter_follow',
      { action: 'follow_playbabylon' }
    );
  }

  static async awardDiscordLink(
    userId: string,
    discordUsername?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.DISCORD_LINK,
      'discord_link',
      discordUsername ? { discordUsername } : undefined
    );
  }

  static async awardDiscordJoin(
    userId: string,
    discordUsername?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.DISCORD_JOIN,
      'discord_join',
      discordUsername ? { discordUsername } : undefined
    );
  }

  static async awardTelegramLink(
    userId: string,
    telegramUsername?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.TELEGRAM_LINK,
      'telegram_link',
      telegramUsername ? { telegramUsername } : undefined
    );
  }

  /**
   * Award points for Twitter link
   */
  static async awardTwitterLink(
    userId: string,
    twitterUsername?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.TWITTER_LINK,
      'twitter_link',
      twitterUsername ? { twitterUsername } : undefined
    );
  }

  /**
   * Award points for wallet connection
   */
  static async awardWalletConnect(
    userId: string,
    walletAddress?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.WALLET_CONNECT,
      'wallet_connect',
      walletAddress ? { walletAddress } : undefined
    );
  }

  /**
   * Award points for share action
   */
  static async awardShareAction(
    userId: string,
    platform: string,
    contentType: string,
    contentId?: string
  ): Promise<AwardPointsResult> {
    const amount =
      platform === 'twitter' ? POINTS.SHARE_TO_TWITTER : POINTS.SHARE_ACTION;
    const reason = platform === 'twitter' ? 'share_to_twitter' : 'share_action';

    return PointsService.awardPoints(userId, amount, reason, {
      platform,
      contentType,
      ...(contentId ? { contentId } : {}),
    });
  }

  /**
   * Award points for creating a private group
   */
  static async awardPrivateGroupCreate(
    userId: string,
    groupId?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.PRIVATE_GROUP_CREATE,
      'private_group_create',
      groupId ? { groupId } : undefined
    );
  }

  /**
   * Award points for creating a private channel
   */
  static async awardPrivateChannelCreate(
    userId: string,
    channelId?: string
  ): Promise<AwardPointsResult> {
    return PointsService.awardPoints(
      userId,
      POINTS.PRIVATE_CHANNEL_CREATE,
      'private_channel_create',
      channelId ? { channelId } : undefined
    );
  }

  /**
   * Award points for referral signup
   * Enforces rolling limit of 10 unqualified referrals at any time
   * When limit is reached, referral is tracked but points are deferred until a slot opens
   * Checks IP addresses to detect self-referrals
   */
  static async awardReferralSignup(
    referrerId: string,
    referredUserId: string
  ): Promise<AwardPointsResult> {
    const unqualifiedCount = await countUnqualifiedReferralsWithSignupAwarded(
      db,
      referrerId
    );
    const shouldAwardPoints = unqualifiedCount < UNQUALIFIED_REFERRAL_LIMIT;

    if (!shouldAwardPoints) {
      logger.info(
        `Unqualified referral limit reached for user ${referrerId}. Points deferred.`,
        { referrerId, unqualifiedCount, limit: UNQUALIFIED_REFERRAL_LIMIT },
        'PointsService'
      );
      // Don't return error - we still track the referral, just defer points
    }

    const [referrer, referredUser] = await Promise.all([
      selectUserReferralIdentity(db, referrerId),
      selectUserReferralIdentity(db, referredUserId),
    ]);

    // Check if IP addresses match (potential self-referral)
    if (referrer?.registrationIpHash && referredUser?.registrationIpHash) {
      if (referrer.registrationIpHash === referredUser.registrationIpHash) {
        const timeDiff =
          referredUser.createdAt.getTime() - referrer.createdAt.getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Check if users have different identifiers
        const hasDifferentWallet =
          referrer.walletAddress &&
          referredUser.walletAddress &&
          referrer.walletAddress !== referredUser.walletAddress;
        const hasDifferentPrivyId =
          referrer.privyId &&
          referredUser.privyId &&
          referrer.privyId !== referredUser.privyId;
        const hasDifferentFarcaster =
          referrer.farcasterFid &&
          referredUser.farcasterFid &&
          referrer.farcasterFid !== referredUser.farcasterFid;
        const hasDifferentTwitter =
          referrer.twitterId &&
          referredUser.twitterId &&
          referrer.twitterId !== referredUser.twitterId;

        const hasDifferentIdentifiers =
          hasDifferentWallet ||
          hasDifferentPrivyId ||
          hasDifferentFarcaster ||
          hasDifferentTwitter;

        // Only block if same IP AND no different identifiers AND within 15 minutes
        if (
          timeDiff >= 0 &&
          timeDiff < fifteenMinutes &&
          !hasDifferentIdentifiers
        ) {
          logger.warn(
            'Self-referral detected: same IP within 15 minutes with no different identifiers',
            {
              referrerId,
              referredUserId,
              timeDiffMs: timeDiff,
              referrerWallet: referrer.walletAddress,
              referredWallet: referredUser.walletAddress,
              referrerPrivyId: referrer.privyId,
              referredPrivyId: referredUser.privyId,
            },
            'PointsService'
          );
          return {
            success: false,
            pointsAwarded: 0,
            newTotal: 0,
            error:
              'Self-referral detected: accounts created from same IP within 15 minutes with no different identifiers',
          };
        }

        // Same IP within 24 hours = flag for review (still award but mark suspicious)
        if (
          timeDiff >= 0 &&
          timeDiff < twentyFourHours &&
          !hasDifferentIdentifiers
        ) {
          logger.warn(
            'Potential self-referral: same IP within 24 hours with no different identifiers',
            {
              referrerId,
              referredUserId,
              timeDiffMs: timeDiff,
              referrerWallet: referrer.walletAddress,
              referredWallet: referredUser.walletAddress,
            },
            'PointsService'
          );
          // Continue to award points but mark as suspicious
        } else if (hasDifferentIdentifiers) {
          logger.info(
            'Allowing referral despite same IP: users have different identifiers',
            {
              referrerId,
              referredUserId,
              timeDiffMs: timeDiff,
              hasDifferentWallet,
              hasDifferentPrivyId,
              hasDifferentFarcaster,
              hasDifferentTwitter,
            },
            'PointsService'
          );
        }
      }
    }

    // Award points only if under the unqualified limit
    let result: AwardPointsResult;

    if (shouldAwardPoints) {
      result = await this.awardPoints(
        referrerId,
        POINTS.REFERRAL_SIGNUP,
        'referral_signup',
        {
          referredUserId,
          referrerIpHash: referrer?.registrationIpHash || null,
          referredIpHash: referredUser?.registrationIpHash || null,
          sameIp:
            referrer?.registrationIpHash === referredUser?.registrationIpHash,
        }
      );
    } else {
      const rep = await selectUserReputationPointsOnly(db, referrerId);
      result = {
        success: true,
        pointsAwarded: 0,
        newTotal: rep ?? 0,
      };
    }

    const referralRecordId = await selectLatestReferralIdBetweenUsers(
      db,
      referrerId,
      referredUserId
    );

    if (referralRecordId) {
      // Build update object
      const updateData: {
        signupPointsAwarded?: boolean;
        suspiciousReferralFlags?: JsonValue;
      } = {};

      // Mark signupPointsAwarded based on whether points were actually awarded
      updateData.signupPointsAwarded = shouldAwardPoints && result.success;

      // Check for suspicious flags if IPs match
      if (referrer?.registrationIpHash && referredUser?.registrationIpHash) {
        if (referrer.registrationIpHash === referredUser.registrationIpHash) {
          const timeDiff =
            referredUser.createdAt.getTime() - referrer.createdAt.getTime();
          const oneHour = 60 * 60 * 1000;
          const twentyFourHours = 24 * 60 * 60 * 1000;

          const isSuspicious = timeDiff >= 0 && timeDiff < twentyFourHours;
          const isBlocked = timeDiff >= 0 && timeDiff < oneHour;

          if (isSuspicious || isBlocked) {
            updateData.suspiciousReferralFlags = {
              sameIp: true,
              timeDiffMs: timeDiff,
              flaggedAt: new Date().toISOString(),
              blocked: isBlocked,
              flagged: isSuspicious && !isBlocked,
            };
          }
        }
      }

      await updateReferralSignupFields(db, referralRecordId, updateData);
    }

    if (shouldAwardPoints && result.success) {
      await incrementUserReferralCountAfterSignupAward(
        db,
        referrerId,
        referredUser?.registrationIpHash ?? null
      );
    }

    return result;
  }

  /**
   * Award pending referral signup points when a slot opens
   * Called when a referral becomes qualified, which frees up a slot for pending referrals
   * Uses FIFO ordering based on completedAt timestamp
   */
  static async awardPendingReferralSignupPoints(
    referrerId: string
  ): Promise<AwardPointsResult | null> {
    const unqualifiedCount = await countUnqualifiedReferralsWithSignupAwarded(
      db,
      referrerId
    );

    if (unqualifiedCount >= UNQUALIFIED_REFERRAL_LIMIT) {
      return null;
    }

    const pendingReferral = await selectOldestPendingReferralWithoutSignup(
      db,
      referrerId
    );

    if (!pendingReferral) {
      // No pending referrals waiting for points
      return null;
    }

    // Award the deferred signup points
    const result = await this.awardPoints(
      referrerId,
      POINTS.REFERRAL_SIGNUP,
      'referral_signup',
      {
        referredUserId: pendingReferral.referredUserId,
        deferredAward: true,
        originalCompletedAt: pendingReferral.completedAt?.toISOString() ?? null,
      }
    );

    if (result.success) {
      await markReferralSignupPointsAwarded(db, pendingReferral.id);
      await incrementUserReferralCount(db, referrerId);

      logger.info(
        `Awarded deferred referral signup points to user ${referrerId}`,
        {
          referrerId,
          referredUserId: pendingReferral.referredUserId,
          referralId: pendingReferral.id,
          pointsAwarded: result.pointsAwarded,
        },
        'PointsService'
      );
    }

    return result;
  }

  /**
   * Check and qualify referral when referred user links social account
   */
  static async checkAndQualifyReferral(
    referredUserId: string
  ): Promise<AwardPointsResult | null> {
    const user = await selectReferredUserSocialSlice(db, referredUserId);

    if (!user || !user.referredBy) {
      return null;
    }

    const hasSocialAccount =
      user.hasFarcaster || user.hasTwitter || !!user.walletAddress;
    if (!hasSocialAccount) {
      return null;
    }

    const referral = await selectReferralQualificationRow(
      db,
      user.referredBy,
      referredUserId
    );

    if (!referral) {
      logger.warn(
        `No referral record found for referrer ${user.referredBy} and referred user ${referredUserId}`,
        { referrerId: user.referredBy, referredUserId },
        'PointsService'
      );
      return null;
    }

    // Check if already qualified
    if (referral.qualifiedAt) {
      return null;
    }

    // Qualify the referral and award bonus points to referrer
    const qualificationResult = await PointsService.awardPoints(
      user.referredBy,
      POINTS.REFERRAL_QUALIFIED,
      'referral_qualified',
      {
        referredUserId,
        qualifiedAt: new Date().toISOString(),
      }
    );

    if (qualificationResult.success) {
      await updateReferralQualifiedAtNow(db, referral.id);

      logger.info(
        `Referral qualified: referrer ${user.referredBy} earned ${POINTS.REFERRAL_QUALIFIED} points for qualified referral`,
        {
          referrerId: user.referredBy,
          referredUserId,
          referralId: referral.id,
          pointsAwarded: qualificationResult.pointsAwarded,
        },
        'PointsService'
      );

      // When a referral becomes qualified, a slot opens for pending referrals
      // Award signup points to the oldest pending referral (FIFO)
      await this.awardPendingReferralSignupPoints(user.referredBy);
    }

    return qualificationResult;
  }

  /**
   * Purchase trading points (virtual balance) via payment (100 points = $1)
   *
   * Supports multiple payment providers:
   * - 'crypto': On-chain ETH payment via x402
   * - 'stripe': Credit card payment via Stripe Checkout
   *
   * NOTE: This adds to virtualBalance (trading balance), NOT reputationPoints.
   * Users buy trading points to trade on the platform.
   *
   * CONCURRENCY: Uses atomic SQL update to prevent race conditions.
   * IDEMPOTENCY: Checks paymentRequestId inside transaction to prevent duplicates.
   *
   * @param userId - User ID to credit points to
   * @param amountUSD - Amount paid in USD
   * @param paymentRequestId - Unique payment identifier (x402 request ID or Stripe session ID)
   * @param paymentTxHash - Optional transaction hash (blockchain tx or Stripe payment intent ID)
   * @param paymentProvider - Payment provider used ('crypto' or 'stripe')
   */
  static async purchasePoints(
    userId: string,
    amountUSD: number,
    paymentRequestId: string,
    paymentTxHash?: string,
    paymentProvider: 'crypto' | 'stripe' = 'crypto'
  ): Promise<AwardPointsResult> {
    const pointsAmount = Math.floor(amountUSD * 100);
    const transactionType = `${paymentProvider}_purchase`;
    // Use payment intent ID as relatedId for Stripe (enables dispute/refund lookups)
    // Fall back to session ID for crypto or when payment intent not available
    const relatedIdValue = paymentTxHash || paymentRequestId;

    const result = await db.transaction(async (tx) => {
      const duplicate = await selectExistingPurchaseBalanceTx(tx, {
        userId,
        transactionType,
        relatedIdValue,
      });

      if (duplicate) {
        return {
          success: true,
          pointsAwarded: 0,
          newTotal: 0,
          alreadyAwarded: true,
        };
      }

      const user = await selectUserVirtualBalance(tx, userId);

      if (!user) {
        return {
          success: false,
          pointsAwarded: 0,
          newTotal: 0,
          error: 'User not found',
        };
      }

      const balanceBefore = Number(user.virtualBalance ?? 0);
      const balanceAfter = balanceBefore + pointsAmount;

      await addUserVirtualBalanceAtomic(tx, userId, pointsAmount);

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId,
        type: transactionType,
        amount: String(pointsAmount),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        relatedId: relatedIdValue,
        description: JSON.stringify({
          amountUSD,
          pointsPerDollar: 100,
          purchasedAt: new Date().toISOString(),
          paymentProvider,
          paymentRequestId,
          paymentTxHash,
        }),
      });

      return {
        success: true,
        pointsAwarded: pointsAmount,
        newTotal: balanceAfter,
      };
    });

    if (result.alreadyAwarded) {
      logger.info(
        `Purchase already processed for paymentRequestId ${paymentRequestId}`,
        { userId, paymentRequestId, paymentProvider },
        'PointsService'
      );
    }

    if (result.success && !result.alreadyAwarded) {
      logger.info(
        `User ${userId} purchased ${pointsAmount} trading points for $${amountUSD} via ${paymentProvider}`,
        { userId, pointsAmount, amountUSD, paymentRequestId, paymentProvider },
        'PointsService'
      );
    }

    return result;
  }

  /**
   * Reverse a points purchase due to refund or dispute
   *
   * Deducts points from the user's trading balance (virtualBalance).
   * Used by Stripe webhook handlers for:
   * - charge.refunded: Full or partial refund processed
   * - charge.dispute.created: Customer initiated chargeback
   *
   * NOTE: Points are deducted from virtualBalance, floored at 0.
   * If user has already spent the points, they will have a 0 balance.
   *
   * CONCURRENCY: Uses atomic SQL update to prevent race conditions.
   * IDEMPOTENCY: Checks stripeEventId inside transaction to prevent duplicates.
   *
   * @param userId - User ID to deduct points from
   * @param paymentIntentId - Stripe Payment Intent ID to find original transaction
   * @param reason - 'refund' or 'dispute'
   * @param amountUSD - Amount being refunded/disputed in USD
   * @param stripeEventId - Stripe event ID for idempotency
   */
  static async reversePointsPurchase(
    userId: string,
    paymentIntentId: string,
    reason: 'refund' | 'dispute',
    amountUSD: number,
    stripeEventId: string
  ): Promise<AwardPointsResult> {
    const pointsToDeduct = Math.floor(amountUSD * 100);
    const transactionType =
      reason === 'refund' ? 'stripe_refund' : 'stripe_dispute';

    const reversalLog: {
      value: {
        actualDeduction: number;
        balanceBefore: number;
        balanceAfter: number;
      } | null;
    } = { value: null };

    const result = await db.transaction(async (tx) => {
      const duplicate = await selectExistingBalanceTxByRelatedId(
        tx,
        userId,
        stripeEventId
      );

      if (duplicate) {
        return {
          success: true,
          pointsAwarded: 0,
          newTotal: 0,
          alreadyAwarded: true,
        };
      }

      const user = await selectUserVirtualBalance(tx, userId);

      if (!user) {
        return {
          success: false,
          pointsAwarded: 0,
          newTotal: 0,
          error: 'User not found',
        };
      }

      const balanceBefore = Number(user.virtualBalance ?? 0);
      const balanceAfter = Math.max(0, balanceBefore - pointsToDeduct);
      const actualDeduction = balanceBefore - balanceAfter;

      await deductUserVirtualBalanceFloored(tx, userId, pointsToDeduct);

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId,
        type: transactionType,
        amount: String(-actualDeduction),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        relatedId: stripeEventId,
        description: JSON.stringify({
          amountUSD,
          pointsRequested: pointsToDeduct,
          pointsActuallyDeducted: actualDeduction,
          originalPaymentIntentId: paymentIntentId,
          reversalReason: reason,
          reversedAt: new Date().toISOString(),
        }),
      });

      reversalLog.value = { actualDeduction, balanceBefore, balanceAfter };

      return {
        success: true,
        pointsAwarded: -actualDeduction,
        newTotal: balanceAfter,
      };
    });

    if (result.alreadyAwarded) {
      logger.info(
        `Reversal already processed for event ${stripeEventId}`,
        { userId, stripeEventId, reason },
        'PointsService'
      );
    } else if (reversalLog.value) {
      const m = reversalLog.value;
      logger.info(
        `Reversed ${m.actualDeduction} trading points from user ${userId} due to ${reason}`,
        {
          userId,
          paymentIntentId,
          reason,
          pointsRequested: pointsToDeduct,
          pointsDeducted: m.actualDeduction,
          balanceBefore: m.balanceBefore,
          balanceAfter: m.balanceAfter,
          stripeEventId,
        },
        'PointsService'
      );
    } else if (!result.success && result.error === 'User not found') {
      logger.error(
        `Cannot reverse points: user not found`,
        { userId, paymentIntentId, reason },
        'PointsService'
      );
    }

    return result;
  }

  /**
   * Re-credit points after winning a dispute
   *
   * When a merchant wins a chargeback dispute, re-credit the points
   * that were previously deducted.
   *
   * CONCURRENCY: Uses atomic SQL update to prevent race conditions.
   * IDEMPOTENCY: Checks stripeEventId inside transaction to prevent duplicates.
   *
   * @param userId - User ID to credit points to
   * @param disputeId - Stripe Dispute ID
   * @param amountUSD - Original dispute amount in USD
   * @param stripeEventId - Stripe event ID for idempotency
   */
  static async creditDisputeWon(
    userId: string,
    disputeId: string,
    amountUSD: number,
    stripeEventId: string
  ): Promise<AwardPointsResult> {
    const pointsToCredit = Math.floor(amountUSD * 100);

    const disputeCreditLog: {
      value: { balanceBefore: number; balanceAfter: number } | null;
    } = { value: null };

    const result = await db.transaction(async (tx) => {
      const duplicate = await selectExistingBalanceTxByRelatedId(
        tx,
        userId,
        stripeEventId
      );

      if (duplicate) {
        return {
          success: true,
          pointsAwarded: 0,
          newTotal: 0,
          alreadyAwarded: true,
        };
      }

      const user = await selectUserVirtualBalance(tx, userId);

      if (!user) {
        return {
          success: false,
          pointsAwarded: 0,
          newTotal: 0,
          error: 'User not found',
        };
      }

      const balanceBefore = Number(user.virtualBalance ?? 0);
      const balanceAfter = balanceBefore + pointsToCredit;

      await addUserVirtualBalanceAtomic(tx, userId, pointsToCredit);

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId,
        type: 'stripe_dispute_won',
        amount: String(pointsToCredit),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        relatedId: stripeEventId,
        description: JSON.stringify({
          amountUSD,
          pointsCredited: pointsToCredit,
          disputeId,
          creditedAt: new Date().toISOString(),
        }),
      });

      disputeCreditLog.value = { balanceBefore, balanceAfter };

      return {
        success: true,
        pointsAwarded: pointsToCredit,
        newTotal: balanceAfter,
      };
    });

    if (result.alreadyAwarded) {
      logger.info(
        `Dispute win credit already processed for event ${stripeEventId}`,
        { userId, stripeEventId, disputeId },
        'PointsService'
      );
    } else if (disputeCreditLog.value) {
      const c = disputeCreditLog.value;
      logger.info(
        `Re-credited ${pointsToCredit} trading points to user ${userId} after winning dispute`,
        {
          userId,
          disputeId,
          pointsCredited: pointsToCredit,
          balanceBefore: c.balanceBefore,
          balanceAfter: c.balanceAfter,
          stripeEventId,
        },
        'PointsService'
      );
    } else if (!result.success && result.error === 'User not found') {
      logger.error(
        `Cannot credit dispute win: user not found`,
        { userId, disputeId },
        'PointsService'
      );
    }

    return result;
  }

  /**
   * Check if points were already awarded for a specific reason
   */
  private static checkAlreadyAwarded(
    user: Pick<
      PointsAwardUserStateRow,
      | 'pointsAwardedForProfile'
      | 'pointsAwardedForFarcaster'
      | 'pointsAwardedForFarcasterFollow'
      | 'pointsAwardedForTwitter'
      | 'pointsAwardedForTwitterFollow'
      | 'pointsAwardedForDiscord'
      | 'pointsAwardedForDiscordJoin'
      | 'pointsAwardedForWallet'
      | 'pointsAwardedForReferralBonus'
      | 'pointsAwardedForShare'
      | 'pointsAwardedForTelegram'
    >,
    reason: PointsReason
  ): boolean {
    switch (reason) {
      case 'profile_completion':
        return user.pointsAwardedForProfile;
      case 'farcaster_link':
        return user.pointsAwardedForFarcaster;
      case 'farcaster_follow':
        return user.pointsAwardedForFarcasterFollow;
      case 'twitter_link':
        return user.pointsAwardedForTwitter;
      case 'twitter_follow':
        return user.pointsAwardedForTwitterFollow;
      case 'discord_link':
        return user.pointsAwardedForDiscord;
      case 'discord_join':
        return user.pointsAwardedForDiscordJoin;
      case 'telegram_link':
        return user.pointsAwardedForTelegram;
      case 'wallet_connect':
        return user.pointsAwardedForWallet;
      case 'referral_bonus':
        return user.pointsAwardedForReferralBonus;
      case 'referral_qualified':
        return false;
      case 'share_action':
      case 'share_to_twitter':
        return user.pointsAwardedForShare;
      default:
        return false;
    }
  }

  /**
   * Get user's points and transaction history
   */
  static async getUserPoints(userId: string) {
    const user = await selectUserPointsSummary(db, userId);

    if (!user) {
      return null;
    }

    const transactions = await listRecentPointsTransactionsForUser(
      db,
      userId,
      50
    );

    return {
      points: user.reputationPoints,
      referralCount: user.referralCount,
      transactions,
    };
  }

  /**
   * Get leaderboard with pagination (includes both Users and Actors with pools)
   */
  static async getLeaderboard(
    page = 1,
    pageSize = 100,
    minPoints = 500,
    pointsCategory: LeaderboardCategory = 'all'
  ) {
    const skip = (page - 1) * pageSize;

    let usersResult: Awaited<
      ReturnType<typeof selectLeaderboardUsersAllMinReputation>
    >;
    let totalCountForTotal: number | null = null;
    if (pointsCategory === 'total') {
      totalCountForTotal = await countNonActorNonAgentUsers(db);

      usersResult = await selectLeaderboardUsersByTotalPointsPage(
        db,
        skip,
        pageSize
      );

      const usersWithRank = usersResult.map((user, index) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        allPoints: user.reputationPoints,
        invitePoints: user.invitePoints,
        earnedPoints: user.earnedPoints,
        bonusPoints: user.bonusPoints,
        totalPoints: Number(user.totalPoints ?? 0),
        referralCount: user.referralCount,
        balance: Number(user.virtualBalance ?? 0),
        lifetimePnL: Number(user.lifetimePnL ?? 0),
        createdAt: user.createdAt,
        isActor: false,
        tier: null as string | null,
        onChainRegistered: user.onChainRegistered,
        nftTokenId: user.nftTokenId,
        rank: skip + index + 1,
      }));

      return {
        users: usersWithRank,
        totalCount: totalCountForTotal,
        page,
        pageSize,
        totalPages: Math.ceil((totalCountForTotal ?? 0) / pageSize),
        pointsCategory,
      };
    } else if (pointsCategory === 'all') {
      usersResult = await selectLeaderboardUsersAllMinReputation(db, minPoints);
    } else if (pointsCategory === 'earned') {
      usersResult = await selectLeaderboardUsersEarnedNonZero(db);
    } else {
      usersResult = await selectLeaderboardUsersWithInvitePoints(db);
    }

    const combined = [
      ...usersResult.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        allPoints: user.reputationPoints,
        invitePoints: user.invitePoints,
        earnedPoints: user.earnedPoints,
        bonusPoints: user.bonusPoints,
        totalPoints: Number(user.totalPoints ?? 0),
        referralCount: user.referralCount,
        balance: Number(user.virtualBalance ?? 0),
        lifetimePnL: Number(user.lifetimePnL ?? 0),
        createdAt: user.createdAt,
        isActor: false,
        tier: null as string | null,
        onChainRegistered: user.onChainRegistered,
        nftTokenId: user.nftTokenId,
      })),
    ];

    if (pointsCategory === 'all') {
      const actorStates = await selectActorStatesMinReputation(db, minPoints);

      combined.push(
        ...actorStates
          .map((state) => {
            const staticActor = StaticDataRegistry.getActor(state.id);
            if (!staticActor) return null;
            return {
              id: state.id,
              username: state.id,
              displayName: staticActor.name,
              profileImageUrl:
                staticActor.profileImageUrl ?? (null as string | null),
              allPoints: state.reputationPoints,
              invitePoints: 0,
              earnedPoints: 0,
              bonusPoints: 0,
              totalPoints: 0,
              referralCount: 0,
              balance: 0,
              lifetimePnL: 0,
              createdAt: state.createdAt,
              isActor: true,
              tier: staticActor.tier,
              onChainRegistered: false,
              nftTokenId: null as number | null,
            };
          })
          .filter((a): a is NonNullable<typeof a> => a !== null)
      );
    }

    // `pointsCategory === 'total'` returns early above, so at this point the union
    // is narrowed to 'all' | 'earned' | 'referral'.
    const sortField: 'allPoints' | 'earnedPoints' | 'invitePoints' =
      pointsCategory === 'all'
        ? 'allPoints'
        : pointsCategory === 'earned'
          ? 'earnedPoints'
          : 'invitePoints';

    combined.sort((a, b) => {
      const comparison = b[sortField] - a[sortField];
      if (comparison !== 0) {
        return comparison;
      }

      if (pointsCategory === 'referral') {
        const referralComparison = b.referralCount - a.referralCount;
        if (referralComparison !== 0) {
          return referralComparison;
        }
      }

      if (pointsCategory === 'earned') {
        const pnlComparison = b.lifetimePnL - a.lifetimePnL;
        if (pnlComparison !== 0) {
          return pnlComparison;
        }
      }

      return b.allPoints - a.allPoints;
    });

    const totalCount = combined.length;
    const paginatedResults = combined.slice(skip, skip + pageSize);

    const resultsWithRank = paginatedResults.map((entry, index) => ({
      ...entry,
      rank: skip + index + 1,
    }));

    return {
      users: resultsWithRank,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      pointsCategory,
    };
  }

  /**
   * Get user's rank on leaderboard (including actors)
   */
  static async getUserRank(userId: string): Promise<number | null> {
    const user = await selectUserReputationAndActorFlag(db, userId);

    if (!user || user.isActor) {
      return null;
    }

    const higherUsersCount = await countUsersWithHigherReputationNonActor(
      db,
      user.reputationPoints
    );
    const higherActorsCount = await countActorStatesWithHigherReputation(
      db,
      user.reputationPoints
    );

    return higherUsersCount + higherActorsCount + 1;
  }

  /**
   * Per-wallet leaderboard: every wallet (users AND agents) ranked by totalPoints.
   */
  static async getWalletLeaderboard(page = 1, pageSize = 100) {
    const skip = (page - 1) * pageSize;

    const totalCount = await countUsersNonActor(db);
    const usersResult = await selectWalletLeaderboardPage(db, skip, pageSize);

    const usersWithRank = usersResult.map((user, index) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      totalPoints: Number(user.totalPoints ?? 0),
      balance: Number(user.virtualBalance ?? 0),
      lifetimePnL: Number(user.lifetimePnL ?? 0),
      createdAt: user.createdAt,
      isAgent: user.isAgent,
      managedBy: user.managedBy,
      onChainRegistered: user.onChainRegistered,
      nftTokenId: user.nftTokenId,
      rank: skip + index + 1,
    }));

    return {
      users: usersWithRank,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      leaderboardType: 'wallet' as const,
    };
  }

  /**
   * Team leaderboard: each user + their agents combined, ranked by sum of totalPoints.
   */
  static async getTeamLeaderboard(page = 1, pageSize = 100) {
    const skip = (page - 1) * pageSize;

    const totalCount = await countNonActorNonAgentUsers(db);
    const rows = await executeTeamLeaderboardPage(db, skip, pageSize);

    const usersWithRank = rows.map((team, index) => ({
      id: team.id,
      username: team.username,
      displayName: team.displayName,
      profileImageUrl: team.profileImageUrl,
      totalPoints: Number(team.userPoints ?? 0),
      teamTotalPoints: Number(team.teamTotalPoints ?? 0),
      userPoints: Number(team.userPoints ?? 0),
      agentPoints: Number(team.agentPoints ?? 0),
      agentCount: team.agentCount ?? 0,
      balance: Number(team.balance ?? 0),
      lifetimePnL: Number(team.lifetimePnL ?? 0),
      createdAt: team.createdAt,
      isAgent: false,
      onChainRegistered: team.onChainRegistered,
      nftTokenId: team.nftTokenId,
      rank: skip + index + 1,
    }));

    return {
      users: usersWithRank,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      leaderboardType: 'team' as const,
    };
  }

  /**
   * Get a user's position on either the wallet or team leaderboard.
   * For agents viewing the team leaderboard, resolves to their manager's team.
   */
  static async getUserPosition(
    userId: string,
    leaderboardType: LeaderboardType,
    pageSize = 100
  ): Promise<{
    rank: number;
    page: number;
    entry: LeaderboardEntry;
  } | null> {
    const userRow = await selectUserPositionSlice(db, userId);

    if (!userRow) return null;
    const user = userRow;

    const effectiveUserId =
      leaderboardType === 'team' && user.isAgent && user.managedBy
        ? user.managedBy
        : user.id;

    let effectiveUser = user;
    if (effectiveUserId !== user.id) {
      const managerRow = await selectUserPositionSlice(db, effectiveUserId);
      if (!managerRow) return null;
      effectiveUser = managerRow;
    }

    if (leaderboardType === 'wallet') {
      const effectiveTotalPoints = effectiveUser.totalPoints ?? '0';
      const higher = await countWalletLeaderboardHigherThanUser(db, {
        effectiveTotalPoints,
        effectiveCreatedAt: effectiveUser.createdAt,
        effectiveUserId: effectiveUser.id,
      });

      const rank = higher + 1;
      return {
        rank,
        page: Math.ceil(rank / pageSize),
        entry: {
          id: effectiveUser.id,
          username: effectiveUser.username,
          displayName: effectiveUser.displayName,
          profileImageUrl: effectiveUser.profileImageUrl,
          totalPoints: Number(effectiveUser.totalPoints ?? 0),
          balance: Number(effectiveUser.virtualBalance ?? 0),
          lifetimePnL: Number(effectiveUser.lifetimePnL ?? 0),
          createdAt: effectiveUser.createdAt,
          isAgent: effectiveUser.isAgent,
          managedBy: effectiveUser.managedBy,
          onChainRegistered: effectiveUser.onChainRegistered,
          nftTokenId: effectiveUser.nftTokenId,
          rank,
        },
      };
    }

    const agentSumTotal = await selectAgentTotalPointsSumForManager(
      db,
      effectiveUserId
    );

    const teamTotal =
      Number(effectiveUser.totalPoints) + Number(agentSumTotal ?? 0);

    const higherCount = await countTeamLeaderboardHigherThanUser(db, {
      teamTotal,
      effectiveUserCreatedAt: effectiveUser.createdAt,
      effectiveUserId,
    });

    const rank = higherCount + 1;

    const agentCount = await countAgentsForManager(db, effectiveUserId);

    return {
      rank,
      page: Math.ceil(rank / pageSize),
      entry: {
        id: effectiveUser.id,
        username: effectiveUser.username,
        displayName: effectiveUser.displayName,
        profileImageUrl: effectiveUser.profileImageUrl,
        totalPoints: Number(effectiveUser.totalPoints ?? 0),
        teamTotalPoints: teamTotal,
        userPoints: Number(effectiveUser.totalPoints ?? 0),
        agentPoints: Number(agentSumTotal ?? 0),
        agentCount,
        balance: Number(effectiveUser.virtualBalance ?? 0),
        lifetimePnL: Number(effectiveUser.lifetimePnL ?? 0),
        createdAt: effectiveUser.createdAt,
        isAgent: false,
        onChainRegistered: effectiveUser.onChainRegistered,
        nftTokenId: effectiveUser.nftTokenId,
        rank,
      },
    };
  }
}
