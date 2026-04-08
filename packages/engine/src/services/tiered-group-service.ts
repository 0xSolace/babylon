/**
 * Tiered Group Service
 *
 * Manages NPC group tiers for scalable access to the asymmetric information mechanic.
 * Uses the unified Group/GroupMember schema.
 *
 * Each NPC can have 3 tier groups:
 * - Tier 1 (Inner Circle): 12 members, full alpha
 * - Tier 2 (Community): 50 members, partial alpha
 * - Tier 3 (Followers): 500 members, public content
 */

import {
  countUserActiveNpcGroupMemberships,
  fetchActiveNpcTierMembership,
  fetchChatIdByGroupId,
  fetchGlobalNpcTierGroupCounts,
  fetchNpcTierGroupSlices,
  fillNpcTierGroupsParentIdWhereNull,
  findActiveNpcGroupMembershipId,
  insertNpcTierBootstrapBundle,
  listNpcTierMembershipsForDemotionScan,
  listPromotableNpcTierMemberships,
  runDemoteNpcTierTransaction,
  runPromoteNpcTierTransaction,
  runTierInviteMemberTransaction,
  withTransaction,
} from '@babylon/db';
import { GROUP_CONFIG, generateSnowflakeId, logger } from '@babylon/shared';

import { DistributedLockService } from './distributed-lock-service';
import { NPCInteractionTracker } from './npc-interaction-tracker';
import { StaticDataRegistry } from './static-data-registry';
import {
  ALL_TIERS,
  getEffectiveTierConfig,
  getHigherTier,
  getLowerTier,
  getNpcFocusWeights,
  getTierConfig,
  getTierForEngagementScore,
  getTierForEngagementScoreWithNpc,
  getTierGroupName,
  isEligibleForPromotion,
  isEligibleForPromotionWithNpc,
  isValidTier,
  shouldDemote,
  TIER_CONFIG,
  type TierLevel,
} from './tier-config';

export interface TierInfo {
  tier: TierLevel;
  groupId: string;
  chatId: string | null;
  groupName: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
}

export interface UserTierStatus {
  userId: string;
  npcId: string;
  currentTier: TierLevel | null;
  groupId: string | null;
  joinedAt: Date | null;
  engagementScore: number;
  eligibleTier: TierLevel | null;
  canBePromoted: boolean;
  promotionBlockedReason: string | null;
}

/**
 * Comprehensive membership status for a user in a tiered NPC group.
 */
export interface MembershipStatus {
  /** Whether user has an active membership */
  isMember: boolean;
  /** Current tier level (null if not a member) */
  tier: TierLevel | null;
  /** Group ID (null if not a member) */
  groupId: string | null;
  /** When user joined the current tier */
  joinedAt: Date | null;
  /** Days in current tier */
  daysInTier: number;
  /** Whether member was grandfathered (joined before threshold change) */
  isGrandfathered: boolean;
  /** When member was grandfathered (null if not grandfathered) */
  grandfatheredAt: Date | null;
  /** User's current engagement score */
  engagementScore: number;
  /** Social component of engagement score */
  socialScore: number;
  /** Trading component of engagement score */
  tradingScore: number;
  /** Tier user would qualify for based on current score */
  eligibleTier: TierLevel | null;
  /** Whether user can be promoted to a higher tier */
  canBePromoted: boolean;
  /** Reason promotion is blocked (null if can be promoted) */
  promotionBlockedReason: string | null;
  /** Whether user should be demoted (inactive too long) */
  shouldBeDemoted: boolean;
  /** Days since last activity in group */
  daysSinceLastActivity: number;
}

export class TieredGroupService {
  /**
   * Ensure all 3 tier groups exist for an NPC
   *
   * Optimized: Uses batch queries with JOINs instead of N+1 pattern for existing tiers.
   */
  static async ensureAllTiersExist(npcId: string): Promise<TierInfo[]> {
    const actor = StaticDataRegistry.getActor(npcId);
    if (!actor) {
      logger.warn(
        `Cannot create tiers for unknown NPC: ${npcId}`,
        undefined,
        'TieredGroupService'
      );
      return [];
    }

    // Single batch query with JOINs for all existing tier data (member counts + chat IDs)
    const existingTiersWithData = await fetchNpcTierGroupSlices(npcId);

    const existingTierMap = new Map(
      existingTiersWithData
        .filter((g) => isValidTier(g.tier))
        .map((g) => [g.tier as TierLevel, g])
    );

    const result: TierInfo[] = [];
    let parentGroupId: string | null = existingTierMap.get(1)?.id ?? null;

    for (const tier of ALL_TIERS) {
      const existing = existingTierMap.get(tier);
      const config = getTierConfig(tier);

      if (existing) {
        const memberCount = existing.memberCount ?? 0;
        const maxMembers = existing.maxMembers ?? config.maxMembers;

        result.push({
          tier,
          groupId: existing.id,
          chatId: existing.chatId ?? null,
          groupName: existing.name,
          memberCount,
          maxMembers,
          isFull: memberCount >= maxMembers,
        });
      } else {
        // Create new tier group - batch generate all IDs upfront
        const [groupId, chatId, memberId, participantId] = await Promise.all([
          generateSnowflakeId(),
          generateSnowflakeId(),
          generateSnowflakeId(),
          generateSnowflakeId(),
        ]);
        const groupName = getTierGroupName(actor.name, tier);

        if (tier === 1) parentGroupId = groupId;

        await insertNpcTierBootstrapBundle({
          group: {
            id: groupId,
            name: groupName,
            type: 'npc',
            ownerId: npcId,
            createdById: npcId,
            updatedAt: new Date(),
            tier,
            maxMembers: config.maxMembers,
            parentGroupId,
          },
          chat: {
            id: chatId,
            name: groupName,
            isGroup: true,
            groupId,
            updatedAt: new Date(),
          },
          ownerMember: {
            id: memberId,
            groupId,
            userId: npcId,
            role: 'owner',
            tier,
          },
          ownerParticipant: {
            id: participantId,
            chatId,
            userId: npcId,
          },
        });

        logger.info(
          `Created tier ${tier} group for NPC`,
          { npcId, npcName: actor.name, groupId, groupName, tier },
          'TieredGroupService'
        );

        result.push({
          tier,
          groupId,
          chatId,
          groupName,
          memberCount: 1,
          maxMembers: config.maxMembers,
          isFull: false,
        });
      }
    }

    // Update parentGroupId for all tiers if needed
    if (parentGroupId) {
      await fillNpcTierGroupsParentIdWhereNull(npcId, parentGroupId);
    }

    return result;
  }

  /**
   * Get all tier groups for an NPC
   *
   * Optimized: Single query with LEFT JOINs and GROUP BY instead of N+1 pattern.
   */
  static async getNpcTiers(npcId: string): Promise<TierInfo[]> {
    // Single batch query with joins for member counts and chat IDs
    const tierGroupsWithData = await fetchNpcTierGroupSlices(npcId);

    const result: TierInfo[] = [];

    for (const g of tierGroupsWithData) {
      // Validate tier before processing
      if (!isValidTier(g.tier)) {
        logger.warn(
          `Invalid tier value ${g.tier} for group ${g.id}, skipping`,
          { groupId: g.id, tier: g.tier },
          'TieredGroupService'
        );
        continue;
      }

      const config = getTierConfig(g.tier);
      const maxMembers = g.maxMembers ?? config.maxMembers;
      const memberCount = g.memberCount ?? 0;

      result.push({
        tier: g.tier,
        groupId: g.id,
        chatId: g.chatId ?? null,
        groupName: g.name,
        memberCount,
        maxMembers,
        isFull: memberCount >= maxMembers,
      });
    }

    return result.sort((a, b) => a.tier - b.tier);
  }

  /**
   * Get comprehensive membership status for a user with an NPC.
   *
   * Includes grandfathering info, engagement breakdown, and demotion status.
   *
   * @param userId - User ID to check
   * @param npcId - NPC ID to check membership with
   * @returns MembershipStatus with all relevant info
   */
  static async getMembershipStatus(
    userId: string,
    npcId: string
  ): Promise<MembershipStatus> {
    const now = Date.now();

    // Get focus weights for NPC-specific engagement calculation
    const focusWeights = getNpcFocusWeights(npcId);

    // Find active membership
    const membership = await fetchActiveNpcTierMembership(userId, npcId);

    // Calculate engagement score with NPC-specific focus weights
    const interactionScore =
      await NPCInteractionTracker.calculateEngagementScore(
        userId,
        npcId,
        undefined,
        focusWeights
      );

    // Determine eligible tier using NPC-specific thresholds
    const eligibleTier = getTierForEngagementScoreWithNpc(
      interactionScore.engagementScore,
      npcId
    );

    // If not a member, return early
    if (!membership || !isValidTier(membership.tier)) {
      return {
        isMember: false,
        tier: null,
        groupId: null,
        joinedAt: null,
        daysInTier: 0,
        isGrandfathered: false,
        grandfatheredAt: null,
        engagementScore: interactionScore.engagementScore,
        socialScore: interactionScore.socialScore,
        tradingScore: interactionScore.tradingScore,
        eligibleTier,
        canBePromoted: false,
        promotionBlockedReason: 'Not a member',
        shouldBeDemoted: false,
        daysSinceLastActivity: 0,
      };
    }

    const currentTier = membership.tier;
    const daysInTier = Math.floor(
      (now - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const lastActivity = membership.lastMessageAt ?? membership.joinedAt;
    const daysSinceLastActivity = Math.floor(
      (now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check demotion status (grandfathered members can still be demoted for inactivity)
    const shouldBeDemotedFlag = shouldDemote(
      currentTier,
      daysSinceLastActivity
    );

    // Check promotion eligibility using NPC-specific thresholds
    let canBePromoted = false;
    let promotionBlockedReason: string | null = null;

    if (currentTier === 1) {
      promotionBlockedReason = 'Already at highest tier';
    } else {
      // Grandfathered members cannot be promoted until they meet current thresholds
      if (membership.isGrandfathered) {
        const currentTierConfig = getEffectiveTierConfig(currentTier, npcId);
        if (
          interactionScore.engagementScore <
          currentTierConfig.minEngagementScore
        ) {
          promotionBlockedReason = `Grandfathered: need score ${currentTierConfig.minEngagementScore}+ to promote (current: ${interactionScore.engagementScore.toFixed(0)})`;
        }
      }

      if (!promotionBlockedReason) {
        if (
          isEligibleForPromotionWithNpc(
            currentTier,
            interactionScore.engagementScore,
            daysInTier,
            npcId
          )
        ) {
          const higherTier = getHigherTier(currentTier);
          if (higherTier) {
            const tiers = await this.getNpcTiers(npcId);
            const targetTier = tiers.find((t) => t.tier === higherTier);
            if (targetTier && !targetTier.isFull) {
              canBePromoted = true;
            } else {
              promotionBlockedReason = `Tier ${higherTier} is full`;
            }
          }
        } else {
          const config = getEffectiveTierConfig(currentTier, npcId);
          const daysNeeded = config.promotionWaitDays - daysInTier;
          if (daysNeeded > 0) {
            promotionBlockedReason = `Need ${daysNeeded} more days in current tier`;
          } else {
            const higherTier = getHigherTier(currentTier);
            if (higherTier) {
              const targetConfig = getEffectiveTierConfig(higherTier, npcId);
              promotionBlockedReason = `Need engagement score ${targetConfig.minEngagementScore}+ (current: ${interactionScore.engagementScore.toFixed(0)})`;
            }
          }
        }
      }
    }

    return {
      isMember: true,
      tier: currentTier,
      groupId: membership.groupId,
      joinedAt: membership.joinedAt,
      daysInTier,
      isGrandfathered: membership.isGrandfathered ?? false,
      grandfatheredAt: membership.grandfatheredAt ?? null,
      engagementScore: interactionScore.engagementScore,
      socialScore: interactionScore.socialScore,
      tradingScore: interactionScore.tradingScore,
      eligibleTier,
      canBePromoted,
      promotionBlockedReason,
      shouldBeDemoted: shouldBeDemotedFlag,
      daysSinceLastActivity,
    };
  }

  /**
   * Get user's tier status with an NPC
   * @deprecated Use getMembershipStatus for more comprehensive info
   */
  static async getUserTierStatus(
    userId: string,
    npcId: string
  ): Promise<UserTierStatus> {
    // Find active membership
    const membership = await fetchActiveNpcTierMembership(userId, npcId);

    const interactionScore =
      await NPCInteractionTracker.calculateEngagementScore(userId, npcId);
    const engagementScore = interactionScore.engagementScore;

    const eligibleTier = getTierForEngagementScore(engagementScore);

    let canBePromoted = false;
    let promotionBlockedReason: string | null = null;

    if (membership && isValidTier(membership.tier)) {
      const currentTier = membership.tier;
      const daysInTier = Math.floor(
        (Date.now() - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (currentTier === 1) {
        promotionBlockedReason = 'Already at highest tier';
      } else if (
        isEligibleForPromotion(currentTier, engagementScore, daysInTier)
      ) {
        const higherTier = getHigherTier(currentTier);
        if (higherTier) {
          const tiers = await this.getNpcTiers(npcId);
          const targetTier = tiers.find((t) => t.tier === higherTier);
          if (targetTier && !targetTier.isFull) {
            canBePromoted = true;
          } else {
            promotionBlockedReason = `Tier ${higherTier} is full`;
          }
        }
      } else {
        const config = TIER_CONFIG[currentTier];
        const daysNeeded = config.promotionWaitDays - daysInTier;
        if (daysNeeded > 0) {
          promotionBlockedReason = `Need ${daysNeeded} more days in current tier`;
        } else {
          const higherTier = getHigherTier(currentTier);
          if (higherTier) {
            const needed = TIER_CONFIG[higherTier].minEngagementScore;
            promotionBlockedReason = `Need engagement score ${needed}+ (current: ${engagementScore.toFixed(0)})`;
          }
        }
      }
    }

    return {
      userId,
      npcId,
      currentTier: isValidTier(membership?.tier) ? membership.tier : null,
      groupId: membership?.groupId ?? null,
      joinedAt: membership?.joinedAt ?? null,
      engagementScore,
      eligibleTier,
      canBePromoted,
      promotionBlockedReason,
    };
  }

  /**
   * Invite user to appropriate tier based on engagement
   *
   * Uses distributed locking to prevent race conditions where multiple
   * concurrent invites could exceed group capacity.
   */
  static async inviteUserToTier(
    userId: string,
    npcId: string
  ): Promise<{ success: boolean; tier: TierLevel | null; reason: string }> {
    // Validate that npcId is a valid NPC
    const actor = StaticDataRegistry.getActor(npcId);
    if (!actor) {
      logger.warn(
        `inviteUserToTier called with invalid NPC ID: ${npcId}`,
        { userId, npcId },
        'TieredGroupService'
      );
      return {
        success: false,
        tier: null,
        reason: `Invalid NPC ID: ${npcId}`,
      };
    }

    // Check if already in a tier with this NPC (fast-fail before lock)
    const existing = await findActiveNpcGroupMembershipId(userId, npcId);

    if (existing) {
      return {
        success: false,
        tier: null,
        reason: 'Already in a group with this NPC',
      };
    }

    // Check group limit (fast-fail before lock)
    const npcGroupCount = await countUserActiveNpcGroupMemberships(userId);

    if (npcGroupCount >= GROUP_CONFIG.MAX_ACTIVE_USER_GROUPS) {
      return {
        success: false,
        tier: null,
        reason: `At maximum of ${GROUP_CONFIG.MAX_ACTIVE_USER_GROUPS} groups`,
      };
    }

    // Get engagement score (before lock to minimize lock duration)
    const interactionScore =
      await NPCInteractionTracker.calculateEngagementScore(userId, npcId);
    const engagementScore = interactionScore.engagementScore;

    // Ensure tiers exist (before lock)
    await this.ensureAllTiersExist(npcId);

    // Generate unique process ID for lock ownership
    const processId = `invite-${npcId}-${userId}-${Date.now()}`;
    const lockId = `tier-invite:${npcId}`;

    // Acquire distributed lock to prevent race condition on capacity check
    const lockAcquired = await DistributedLockService.acquireLock({
      lockId,
      durationMs: 10_000, // 10 second lock
      operation: 'tier-invite',
      processId,
    });

    if (!lockAcquired) {
      return {
        success: false,
        tier: null,
        reason: 'Another invite operation in progress, please retry',
      };
    }

    try {
      // Re-check capacity inside lock (critical section)
      const tiers = await this.getNpcTiers(npcId);
      let targetTier: TierInfo | null = null;

      for (const tier of ALL_TIERS) {
        // Use NPC-specific thresholds for tier eligibility
        const effectiveConfig = getEffectiveTierConfig(tier, npcId);
        if (engagementScore < effectiveConfig.minEngagementScore) continue;
        const tierInfo = tiers.find((t) => t.tier === tier);
        if (tierInfo && !tierInfo.isFull) {
          targetTier = tierInfo;
          break;
        }
      }

      if (!targetTier) {
        const tier3Config = getEffectiveTierConfig(3, npcId);
        return {
          success: false,
          tier: null,
          reason: `No available tier (score: ${engagementScore.toFixed(0)}, min: ${tier3Config.minEngagementScore})`,
        };
      }

      // Generate IDs before transaction to minimize transaction duration
      const memberId = await generateSnowflakeId();
      const participantId = targetTier.chatId
        ? await generateSnowflakeId()
        : null;

      // Wrap multi-step operation in transaction
      await withTransaction(async (tx) => {
        await runTierInviteMemberTransaction(tx, {
          groupMember: {
            id: memberId,
            groupId: targetTier.groupId,
            userId,
            role: 'member',
            addedBy: npcId,
            tier: targetTier.tier,
          },
          chatParticipant:
            targetTier.chatId && participantId
              ? {
                  id: participantId,
                  chatId: targetTier.chatId,
                  userId,
                  invitedBy: npcId,
                }
              : undefined,
        });
      });

      logger.info(
        'User invited to tier',
        {
          userId,
          npcId,
          tier: targetTier.tier,
          groupName: targetTier.groupName,
          engagementScore,
        },
        'TieredGroupService'
      );

      return {
        success: true,
        tier: targetTier.tier,
        reason: `Invited to ${targetTier.groupName}`,
      };
    } finally {
      // Always release lock
      await DistributedLockService.releaseLock(lockId, processId).catch(
        (err) => {
          logger.error(
            'Failed to release invite lock',
            { lockId, processId, error: String(err) },
            'TieredGroupService'
          );
        }
      );
    }
  }

  /**
   * Promote user to higher tier
   *
   * Uses distributed locking to prevent race conditions where multiple
   * concurrent promotions could exceed group capacity.
   */
  static async promoteUser(userId: string, npcId: string): Promise<boolean> {
    const status = await this.getUserTierStatus(userId, npcId);
    if (!status.currentTier || !status.groupId || !status.canBePromoted)
      return false;

    const higherTier = getHigherTier(status.currentTier);
    if (!higherTier) return false;

    // Generate unique process ID for lock ownership
    const processId = `promote-${npcId}-${userId}-${Date.now()}`;
    const lockId = `tier-promote:${npcId}`;

    // Acquire distributed lock to prevent race condition on capacity check
    const lockAcquired = await DistributedLockService.acquireLock({
      lockId,
      durationMs: 10_000, // 10 second lock
      operation: 'tier-promote',
      processId,
    });

    if (!lockAcquired) {
      logger.info(
        'Promote operation skipped - another promotion in progress',
        { userId, npcId },
        'TieredGroupService'
      );
      return false;
    }

    try {
      // Re-check capacity inside lock (critical section)
      const tiers = await this.getNpcTiers(npcId);
      const targetTier = tiers.find((t) => t.tier === higherTier);
      if (!targetTier || targetTier.isFull) return false;

      // Capture values for use in transaction (TypeScript narrowing doesn't carry into callbacks)
      const currentGroupId = status.groupId;
      const currentTier = status.currentTier;

      // Generate IDs before transaction to minimize transaction duration
      const newMemberId = await generateSnowflakeId();
      const newParticipantId = targetTier.chatId
        ? await generateSnowflakeId()
        : null;

      // Pre-fetch old chat ID before transaction
      const oldChatId = (await fetchChatIdByGroupId(currentGroupId)) ?? null;

      await withTransaction(async (tx) => {
        await runPromoteNpcTierTransaction(tx, {
          currentGroupId,
          userId,
          higherTier,
          oldChatId,
          newMemberId,
          targetGroupId: targetTier.groupId,
          npcId,
          currentTier,
          targetChatId: targetTier.chatId,
          newParticipantId,
        });
      });

      logger.info(
        'User promoted',
        { userId, npcId, fromTier: currentTier, toTier: higherTier },
        'TieredGroupService'
      );

      return true;
    } finally {
      // Always release lock
      await DistributedLockService.releaseLock(lockId, processId).catch(
        (err) => {
          logger.error(
            'Failed to release promotion lock',
            { lockId, processId, error: String(err) },
            'TieredGroupService'
          );
        }
      );
    }
  }

  /**
   * Process promotions for all NPC groups (run daily)
   *
   * Optimized: Single batch query for all NPC memberships instead of N+1 pattern.
   */
  static async processAllPromotions(): Promise<number> {
    let promotions = 0;
    const actors = StaticDataRegistry.getAllActors();
    const actorIds = actors.map((a) => a.id);

    if (actorIds.length === 0) return 0;

    // Batch query: Get all promotable memberships across all NPCs in one query
    const allMemberships = await listPromotableNpcTierMemberships(actorIds);

    // Process each membership (promoteUser still needs individual checks)
    for (const m of allMemberships) {
      if (await this.promoteUser(m.userId, m.npcId)) {
        promotions++;
      }
    }

    return promotions;
  }

  /**
   * Process demotions for inactive users (run daily)
   *
   * Optimized: Single batch query for all NPC memberships instead of N+1 pattern.
   */
  static async processAllDemotions(): Promise<number> {
    let demotions = 0;
    const actors = StaticDataRegistry.getAllActors();
    const actorIds = actors.map((a) => a.id);
    const now = Date.now();

    if (actorIds.length === 0) return 0;

    // Batch query: Get all memberships across all NPCs in one query
    const allMemberships =
      await listNpcTierMembershipsForDemotionScan(actorIds);

    for (const m of allMemberships) {
      // Validate tier (should be valid due to isNotNull filter, but be defensive)
      if (!isValidTier(m.tier)) {
        logger.warn(
          `Invalid tier value ${m.tier} for membership, skipping demotion check`,
          { userId: m.userId, groupId: m.groupId, tier: m.tier },
          'TieredGroupService'
        );
        continue;
      }
      const tier = m.tier;
      const lastActivity = m.lastMessageAt ?? m.joinedAt;
      const daysSince = Math.floor(
        (now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (shouldDemote(tier, daysSince)) {
        // Acquire distributed lock to prevent concurrent demotion of same user
        const lockId = `tier-op-${m.npcId}-${m.userId}`;
        const processId = `tiered-group-service-demotion-${await generateSnowflakeId()}`;
        const lockAcquired = await DistributedLockService.acquireLock({
          lockId,
          durationMs: 5000,
          operation: 'tier-op-demotion',
          processId,
        });

        if (!lockAcquired) {
          logger.warn(
            'Failed to acquire lock for demotion operation',
            { lockId, userId: m.userId, npcId: m.npcId },
            'TieredGroupService'
          );
          continue;
        }

        try {
          const lowerTier = getLowerTier(tier);
          const reason = `Inactive for ${daysSince} days`;

          // Pre-fetch data needed for transaction
          const tiers = lowerTier ? await this.getNpcTiers(m.npcId) : [];
          const targetTier = lowerTier
            ? tiers.find((t) => t.tier === lowerTier)
            : null;

          // Pre-fetch old chat ID before transaction
          const oldChatId = (await fetchChatIdByGroupId(m.groupId)) ?? null;

          const newMemberId =
            lowerTier && targetTier && !targetTier.isFull
              ? await generateSnowflakeId()
              : null;
          const newParticipantId =
            newMemberId && targetTier?.chatId
              ? await generateSnowflakeId()
              : null;

          await withTransaction(async (tx) => {
            await runDemoteNpcTierTransaction(tx, {
              currentGroupId: m.groupId,
              userId: m.userId,
              kickReason: reason,
              oldChatId,
              lowerTier,
              fromTier: tier,
              targetGroupId:
                lowerTier && targetTier && !targetTier.isFull
                  ? targetTier.groupId
                  : null,
              targetChatId:
                lowerTier && targetTier && !targetTier.isFull
                  ? targetTier.chatId
                  : null,
              newMemberId,
              newParticipantId,
            });
          });

          demotions++;
          logger.info(
            'User demoted',
            {
              userId: m.userId,
              npcId: m.npcId,
              fromTier: tier,
              toTier: lowerTier,
              reason,
            },
            'TieredGroupService'
          );
        } finally {
          await DistributedLockService.releaseLock(lockId, processId).catch(
            (err) => {
              logger.error(
                'Failed to release demotion lock',
                { lockId, processId, error: String(err) },
                'TieredGroupService'
              );
            }
          );
        }
      }
    }

    return demotions;
  }

  /**
   * Get global tier analytics
   *
   * Optimized to use batch queries instead of N+1 pattern.
   */
  static async getGlobalAnalytics(): Promise<{
    totalNpcs: number;
    totalGroups: number;
    totalMembers: number;
    totalCapacity: number;
    fillRate: number;
    tierBreakdown: {
      tier: TierLevel;
      members: number;
      capacity: number;
      fillRate: number;
    }[];
  }> {
    const actors = StaticDataRegistry.getAllActors();

    // Batch query 1: Get all NPC tier groups with member counts in a single query
    const tierGroupsWithCounts = await fetchGlobalNpcTierGroupCounts();

    // Track unique NPCs with groups
    const npcsWithGroups = new Set<string>();
    let totalGroups = 0;
    let totalMembers = 0;
    let totalCapacity = 0;

    const tierTotals: Record<TierLevel, { members: number; capacity: number }> =
      {
        1: { members: 0, capacity: 0 },
        2: { members: 0, capacity: 0 },
        3: { members: 0, capacity: 0 },
      };

    for (const g of tierGroupsWithCounts) {
      if (!isValidTier(g.tier)) continue;

      npcsWithGroups.add(g.ownerId);
      totalGroups++;

      const config = getTierConfig(g.tier);
      const maxMembers = g.maxMembers ?? config.maxMembers;
      const memberCount = g.memberCount;

      totalMembers += memberCount;
      totalCapacity += maxMembers;
      tierTotals[g.tier].members += memberCount;
      tierTotals[g.tier].capacity += maxMembers;
    }

    return {
      totalNpcs: actors.length,
      totalGroups,
      totalMembers,
      totalCapacity,
      fillRate: totalCapacity > 0 ? totalMembers / totalCapacity : 0,
      tierBreakdown: ALL_TIERS.map((tier) => ({
        tier,
        members: tierTotals[tier].members,
        capacity: tierTotals[tier].capacity,
        fillRate:
          tierTotals[tier].capacity > 0
            ? tierTotals[tier].members / tierTotals[tier].capacity
            : 0,
      })),
    };
  }
}
