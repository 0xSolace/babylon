/**
 * Alpha Group Invite Service
 *
 * Invites users to NPC group chats based on engagement scores.
 * Uses tier-specific thresholds and per-NPC customization.
 *
 * Features:
 * - Tier-based invite probabilities (Tier 3: 10%, Tier 2: 2%, Tier 1: 0.5%)
 * - Trading activity included in engagement scoring
 * - Fast-track for high-value traders
 * - Invite decay for users who repeatedly decline
 * - Per-NPC threshold customization
 *
 * Runs on game ticks, processing a batch of NPCs each tick.
 */

import {
  countAlphaInviteActiveNpcGroupsForUser,
  countAlphaInviteUserInteractionsSince,
  countAlphaInviteWeeklyPendingOrAccepted,
  fetchAlphaInviteAggregateStats,
  fetchAlphaInviteDeclineAnalytics,
  fetchAlphaInviteExistingMembershipForNpc,
  fetchAlphaInviteLatestDeclinedForNpc,
  fetchAlphaInviteLatestNpcMembershipJoinedAt,
  runAlphaGroupInviteRecordDecline,
} from '@babylon/db';
import { GROUP_CONFIG, logger, type TierLevel } from '@babylon/shared';
import {
  ALPHA_GROUP_CONFIG,
  calculateNextEligibleDate,
  shouldResetDeclineCount,
} from '../config/alpha-group-config';
import { NPCInteractionTracker } from './npc-interaction-tracker';
import { StaticDataRegistry } from './static-data-registry';
import {
  getEffectiveTierConfig,
  getNpcFocusWeights,
  getTierForEngagementScoreWithNpc,
} from './tier-config';
import { TieredGroupService } from './tiered-group-service';

/**
 * Result of an alpha group invite.
 */
export interface AlphaInviteResult {
  npcId: string;
  npcName: string;
  userId: string;
  /** Tier the user was invited to */
  invitedToTier: TierLevel;
  /** Name of the chat/group */
  invitedToChat: string;
  /** User's engagement score (0-100) */
  engagementScore: number;
  /** Social component of engagement score */
  socialScore: number;
  /** Trading component of engagement score */
  tradingScore: number;
  /** Invite probability that was used */
  probability: number;
  /** Whether user was fast-tracked */
  fastTracked: boolean;
}

/**
 * Invite decay status for a user.
 */
interface InviteDecayStatus {
  canBeInvited: boolean;
  declineCount: number;
  nextEligibleAt: Date | null;
  reason?: string;
}

export class AlphaGroupInviteService {
  /**
   * Process alpha group invites for one tick.
   * Checks all NPCs and their top engaged users.
   */
  static async processTickInvites(): Promise<AlphaInviteResult[]> {
    const startTime = Date.now();
    const invites: AlphaInviteResult[] = [];

    const allActors = StaticDataRegistry.getAllActors();
    const npcs = allActors.map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      tierOverrides: a.tierOverrides,
    }));

    logger.info(
      `Processing alpha invites for ${npcs.length} NPCs`,
      {
        maxInvitesPerTick: ALPHA_GROUP_CONFIG.maxInvitesPerTick,
        topUsersToConsider: ALPHA_GROUP_CONFIG.topUsersToConsider,
      },
      'AlphaGroupInviteService'
    );

    for (const npc of npcs) {
      if (invites.length >= ALPHA_GROUP_CONFIG.maxInvitesPerTick) {
        logger.debug(
          'Reached max invites per tick',
          { count: invites.length },
          'AlphaGroupInviteService'
        );
        break;
      }

      const npcInvites = await this.processNPCInvites(npc);
      invites.push(...npcInvites);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Alpha invite tick complete: ${invites.length} invites sent`,
      {
        duration,
        inviteCount: invites.length,
        npcsProcessed: npcs.length,
      },
      'AlphaGroupInviteService'
    );

    return invites;
  }

  /**
   * Process invites for a single NPC.
   */
  private static async processNPCInvites(npc: {
    id: string;
    name: string;
    domain?: string[];
  }): Promise<AlphaInviteResult[]> {
    const invites: AlphaInviteResult[] = [];

    const focusWeights = getNpcFocusWeights(npc.id);

    const topUsers = await NPCInteractionTracker.getTopEngagedUsers(
      npc.id,
      ALPHA_GROUP_CONFIG.topUsersToConsider,
      undefined,
      focusWeights
    );

    for (const userScore of topUsers) {
      const eligibleTier = this.getEligibleTier(
        userScore.engagementScore,
        npc.id,
        userScore.qualifiesForFastTrack
      );

      if (!eligibleTier) {
        continue;
      }

      if (ALPHA_GROUP_CONFIG.inviteDecayEnabled) {
        const decayStatus = await this.checkInviteDecay(
          userScore.userId,
          npc.id
        );
        if (!decayStatus.canBeInvited) {
          logger.debug(
            'User blocked by invite decay',
            {
              userId: userScore.userId,
              npcId: npc.id,
              declineCount: decayStatus.declineCount,
              reason: decayStatus.reason,
            },
            'AlphaGroupInviteService'
          );
          continue;
        }
      }

      const hasExistingMembership = await this.checkExistingMembership(
        userScore.userId,
        npc.id
      );
      if (hasExistingMembership) {
        continue;
      }

      const atGroupLimit = await this.checkGroupLimit(userScore.userId);
      if (atGroupLimit) {
        continue;
      }

      const inCooldown = await this.checkCooldown(userScore.userId);
      if (inCooldown) {
        continue;
      }

      const atWeeklyLimit = await this.checkWeeklyInviteLimit(userScore.userId);
      if (atWeeklyLimit) {
        continue;
      }

      const hasRecentActivity = await this.checkRecentActivity(
        userScore.userId
      );
      if (!hasRecentActivity) {
        continue;
      }

      const tierConfig = getEffectiveTierConfig(eligibleTier, npc.id);
      const adjustedProbability =
        tierConfig.inviteProbability *
        ALPHA_GROUP_CONFIG.inviteProbabilityMultiplier;

      const roll = Math.random();

      if (roll < adjustedProbability) {
        const result = await TieredGroupService.inviteUserToTier(
          userScore.userId,
          npc.id
        );

        if (result.success && result.tier !== null) {
          invites.push({
            npcId: npc.id,
            npcName: npc.name,
            userId: userScore.userId,
            invitedToTier: result.tier,
            invitedToChat: result.reason,
            engagementScore: userScore.engagementScore,
            socialScore: userScore.socialScore,
            tradingScore: userScore.tradingScore,
            probability: adjustedProbability,
            fastTracked: userScore.qualifiesForFastTrack,
          });

          logger.info(
            'User invited to alpha group',
            {
              userId: userScore.userId,
              npcId: npc.id,
              npcName: npc.name,
              tier: result.tier,
              engagementScore: userScore.engagementScore,
              socialScore: userScore.socialScore,
              tradingScore: userScore.tradingScore,
              fastTracked: userScore.qualifiesForFastTrack,
              probability: adjustedProbability,
              roll,
            },
            'AlphaGroupInviteService'
          );

          break;
        }
        logger.debug(
          'Invite failed',
          {
            userId: userScore.userId,
            npcId: npc.id,
            reason: result.reason,
          },
          'AlphaGroupInviteService'
        );
      }
    }

    return invites;
  }

  /**
   * Get eligible tier considering fast-track and NPC-specific thresholds.
   */
  private static getEligibleTier(
    engagementScore: number,
    npcId: string,
    qualifiesForFastTrack: boolean
  ): TierLevel | null {
    if (qualifiesForFastTrack) {
      const tier2Config = getEffectiveTierConfig(2, npcId);
      if (engagementScore >= tier2Config.minEngagementScore * 0.5) {
        return 2;
      }
      return 3;
    }

    return getTierForEngagementScoreWithNpc(engagementScore, npcId);
  }

  /**
   * Check invite decay status for a user with an NPC.
   */
  private static async checkInviteDecay(
    userId: string,
    npcId: string
  ): Promise<InviteDecayStatus> {
    const declinedInvites = await fetchAlphaInviteLatestDeclinedForNpc({
      userId,
      npcId,
    });

    if (declinedInvites.length === 0) {
      return { canBeInvited: true, declineCount: 0, nextEligibleAt: null };
    }

    const invite = declinedInvites[0]!;
    const { declineCount, lastDeclinedAt, nextEligibleAt } = invite;

    if (shouldResetDeclineCount(lastDeclinedAt)) {
      return { canBeInvited: true, declineCount: 0, nextEligibleAt: null };
    }

    if (declineCount >= ALPHA_GROUP_CONFIG.inviteDecayMaxDeclines) {
      return {
        canBeInvited: false,
        declineCount,
        nextEligibleAt: nextEligibleAt,
        reason: `Exceeded max declines (${declineCount}/${ALPHA_GROUP_CONFIG.inviteDecayMaxDeclines})`,
      };
    }

    if (nextEligibleAt && new Date() < nextEligibleAt) {
      return {
        canBeInvited: false,
        declineCount,
        nextEligibleAt,
        reason: `In cooldown until ${nextEligibleAt.toISOString()}`,
      };
    }

    return { canBeInvited: true, declineCount, nextEligibleAt };
  }

  /**
   * Check if user already has membership in any of this NPC's groups.
   */
  private static async checkExistingMembership(
    userId: string,
    npcId: string
  ): Promise<boolean> {
    const existing = await fetchAlphaInviteExistingMembershipForNpc({
      userId,
      npcId,
    });

    return !!existing;
  }

  /**
   * Check if user is at their NPC group limit.
   */
  private static async checkGroupLimit(userId: string): Promise<boolean> {
    const activeNpcGroups =
      await countAlphaInviteActiveNpcGroupsForUser(userId);

    if (activeNpcGroups >= GROUP_CONFIG.MAX_ACTIVE_USER_GROUPS) {
      logger.debug(
        'User at NPC group limit',
        {
          userId,
          activeNpcGroups,
          maxNpcGroups: GROUP_CONFIG.MAX_ACTIVE_USER_GROUPS,
        },
        'AlphaGroupInviteService'
      );
      return true;
    }

    return false;
  }

  /**
   * Check if user is in invite cooldown (recently joined a group).
   */
  private static async checkCooldown(userId: string): Promise<boolean> {
    const latestMembership =
      await fetchAlphaInviteLatestNpcMembershipJoinedAt(userId);

    if (!latestMembership) {
      return false;
    }

    const hoursSinceJoin =
      (Date.now() - latestMembership.joinedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceJoin < ALPHA_GROUP_CONFIG.inviteCooldownHours) {
      logger.debug(
        'User in invite cooldown',
        {
          userId,
          hoursSinceJoin: hoursSinceJoin.toFixed(2),
          cooldownRequired: ALPHA_GROUP_CONFIG.inviteCooldownHours,
        },
        'AlphaGroupInviteService'
      );
      return true;
    }

    return false;
  }

  /**
   * Check if user has exceeded their weekly invite limit.
   * Prevents spamming users with too many invites across all NPCs.
   */
  private static async checkWeeklyInviteLimit(
    userId: string
  ): Promise<boolean> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyInvites = await countAlphaInviteWeeklyPendingOrAccepted({
      userId,
      since: oneWeekAgo,
    });

    if (weeklyInvites >= ALPHA_GROUP_CONFIG.maxInvitesPerUserPerWeek) {
      logger.debug(
        'User at weekly invite limit',
        {
          userId,
          weeklyInvites,
          maxPerWeek: ALPHA_GROUP_CONFIG.maxInvitesPerUserPerWeek,
        },
        'AlphaGroupInviteService'
      );
      return true;
    }

    return false;
  }

  /**
   * Check if user has had recent activity (within configured days).
   * Prevents inviting inactive/churned users.
   */
  private static async checkRecentActivity(userId: string): Promise<boolean> {
    if (!ALPHA_GROUP_CONFIG.requireRecentActivity) {
      return true;
    }

    const activityWindowStart = new Date(
      Date.now() - ALPHA_GROUP_CONFIG.recentActivityDays * 24 * 60 * 60 * 1000
    );

    const recentInteractions = await countAlphaInviteUserInteractionsSince({
      userId,
      since: activityWindowStart,
    });

    if (recentInteractions === 0) {
      logger.debug(
        'User has no recent activity',
        {
          userId,
          activityWindowDays: ALPHA_GROUP_CONFIG.recentActivityDays,
        },
        'AlphaGroupInviteService'
      );
      return false;
    }

    return true;
  }

  /**
   * Record that a user declined an invite.
   * Updates the invite record with decay tracking.
   */
  static async recordDecline(inviteId: string): Promise<void> {
    const updated = await runAlphaGroupInviteRecordDecline({
      inviteId,
      nextEligibleForDeclineCount: calculateNextEligibleDate,
    });

    if (!updated) {
      logger.warn(
        'Invite not found for decline recording',
        { inviteId },
        'AlphaGroupInviteService'
      );
      return;
    }

    logger.info(
      'Invite declined with decay tracking',
      {
        inviteId,
        declineCount: updated.newDeclineCount,
        nextEligibleAt: updated.nextEligibleAt.toISOString(),
      },
      'AlphaGroupInviteService'
    );
  }

  /**
   * Get invite statistics for monitoring and analysis.
   */
  static async getInviteStats(): Promise<{
    totalInvites: number;
    activeGroups: number;
    invitesLast24h: number;
    tierBreakdown: { tier: TierLevel; count: number }[];
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await fetchAlphaInviteAggregateStats({
      joinedSince: oneDayAgo,
    });

    const tierBreakdown: { tier: TierLevel; count: number }[] = [];
    for (const tc of stats.tierCounts) {
      if (tc.tier === 1 || tc.tier === 2 || tc.tier === 3) {
        tierBreakdown.push({ tier: tc.tier as TierLevel, count: tc.count });
      }
    }

    return {
      totalInvites: stats.totalMembers,
      activeGroups: stats.activeMembers,
      invitesLast24h: stats.joinedLast24h,
      tierBreakdown,
    };
  }

  /**
   * Get detailed analytics for alpha group invites.
   */
  static async getDetailedAnalytics(): Promise<{
    inviteStats: Awaited<
      ReturnType<typeof AlphaGroupInviteService.getInviteStats>
    >;
    declineStats: {
      totalDeclined: number;
      avgDeclineCount: number;
      usersAtMaxDeclines: number;
    };
    configSnapshot: typeof ALPHA_GROUP_CONFIG;
  }> {
    const inviteStats = await this.getInviteStats();

    const { totalDeclined, usersAtMaxDeclines } =
      await fetchAlphaInviteDeclineAnalytics({
        inviteDecayMaxDeclines: ALPHA_GROUP_CONFIG.inviteDecayMaxDeclines,
      });

    return {
      inviteStats,
      declineStats: {
        totalDeclined,
        avgDeclineCount: 0,
        usersAtMaxDeclines,
      },
      configSnapshot: ALPHA_GROUP_CONFIG,
    };
  }
}
