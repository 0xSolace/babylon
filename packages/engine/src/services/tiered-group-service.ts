/**
 * Tiered Group Service - manages NPC group tiers, invitations, promotions, and demotions.
 *
 * Architecture Notes:
 * - Each NPC has 3 tier groups: Inner Circle (12), Community (50), Followers (500)
 * - Users can only be in one tier per NPC at a time
 * - Promotions/demotions are processed probabilistically (~once/day)
 *
 * Concurrency: This service is designed for single-instance processing per tick.
 * If running multiple game-tick instances, consider adding distributed locking
 * for processAllPromotions/processAllDemotions to prevent over-admission.
 */

import {
  and,
  chatParticipants,
  chats,
  count,
  db,
  eq,
  groupChatMemberships,
  gte,
  isNotNull,
  isNull,
  ne,
  users,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';

import { NPCInteractionTracker } from './npc-interaction-tracker';
import { StaticDataRegistry } from './static-data-registry';
import {
  ALL_TIERS,
  getHigherTier,
  getLowerTier,
  getTierConfig,
  getTierForEngagementScore,
  getTierGroupName,
  INVITE_COOLDOWN_HOURS,
  isEligibleForPromotion,
  MAX_ACTIVE_USER_GROUPS,
  shouldDemote,
  TIER_CONFIG,
  type TierLevel,
} from './tier-config';

export interface TierInfo {
  tier: TierLevel;
  chatId: string;
  chatName: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
}

export interface UserTierStatus {
  userId: string;
  npcId: string;
  currentTier: TierLevel | null;
  chatId: string | null;
  joinedAt: Date | null;
  engagementScore: number;
  eligibleTier: TierLevel | null;
  canBePromoted: boolean;
  promotionBlockedReason: string | null;
}

export interface InviteResult {
  success: boolean;
  tier: TierLevel | null;
  chatId: string | null;
  chatName: string | null;
  reason: string;
}

export interface PromotionResult {
  userId: string;
  npcId: string;
  fromTier: TierLevel;
  toTier: TierLevel;
  newChatId: string;
}

export interface DemotionResult {
  userId: string;
  npcId: string;
  fromTier: TierLevel;
  toTier: TierLevel | null; // null = removed entirely
  newChatId: string | null;
  reason: string;
}

export class TieredGroupService {
  /** Ensure all three tiers exist for an NPC, creating missing ones */
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

    const existingTiers = await db
      .select({
        id: chats.id,
        tier: chats.tier,
        name: chats.name,
        maxMembers: chats.maxMembers,
      })
      .from(chats)
      .where(and(eq(chats.npcAdminId, npcId), isNotNull(chats.tier)));

    const existingTierMap = new Map(
      existingTiers
        .filter((t) => t.tier !== null)
        .map((t) => [t.tier as TierLevel, t])
    );

    const result: TierInfo[] = [];
    let parentGroupId: string | null = null;

    // Get or create parent group ID (from Tier 1 or first tier created)
    const tier1 = existingTierMap.get(1);
    if (tier1) {
      parentGroupId = tier1.id;
    }

    for (const tier of ALL_TIERS) {
      const existing = existingTierMap.get(tier);

      if (existing) {
        // Get member count for existing tier
        const [countResult] = await db
          .select({ count: count() })
          .from(chatParticipants)
          .where(
            and(
              eq(chatParticipants.chatId, existing.id),
              eq(chatParticipants.isActive, true)
            )
          );

        const memberCount = countResult?.count ?? 0;
        const config = getTierConfig(tier);

        result.push({
          tier,
          chatId: existing.id,
          chatName: existing.name ?? getTierGroupName(actor.name, tier),
          memberCount,
          maxMembers: existing.maxMembers ?? config.maxMembers,
          isFull: memberCount >= (existing.maxMembers ?? config.maxMembers),
        });
      } else {
        // Create new tier
        const config = getTierConfig(tier);
        const chatId = await generateSnowflakeId();
        const chatName = getTierGroupName(actor.name, tier);

        // Set parent group ID if this is Tier 1
        if (tier === 1) {
          parentGroupId = chatId;
        }

        await db.insert(chats).values({
          id: chatId,
          name: chatName,
          isGroup: true,
          npcAdminId: npcId,
          tier,
          tierName: config.name,
          maxMembers: config.maxMembers,
          parentGroupId: parentGroupId,
          updatedAt: new Date(),
        });

        // Add NPC as participant
        await db.insert(chatParticipants).values({
          id: await generateSnowflakeId(),
          chatId,
          userId: npcId,
        });

        logger.info(
          `Created tier ${tier} group for NPC`,
          { npcId, npcName: actor.name, chatId, chatName, tier },
          'TieredGroupService'
        );

        result.push({
          tier,
          chatId,
          chatName,
          memberCount: 1, // Just the NPC
          maxMembers: config.maxMembers,
          isFull: false,
        });
      }
    }

    // Update parentGroupId for all tiers if needed
    if (parentGroupId) {
      await db
        .update(chats)
        .set({ parentGroupId })
        .where(
          and(
            eq(chats.npcAdminId, npcId),
            isNotNull(chats.tier),
            isNull(chats.parentGroupId)
          )
        );
    }

    return result;
  }

  /** Get tier information for an NPC */
  static async getNpcTiers(npcId: string): Promise<TierInfo[]> {
    const tiers = await db
      .select({
        id: chats.id,
        tier: chats.tier,
        name: chats.name,
        maxMembers: chats.maxMembers,
      })
      .from(chats)
      .where(and(eq(chats.npcAdminId, npcId), isNotNull(chats.tier)));

    const result: TierInfo[] = [];

    for (const t of tiers) {
      // tier is guaranteed non-null by isNotNull filter above
      const [countResult] = await db
        .select({ count: count() })
        .from(chatParticipants)
        .where(
          and(
            eq(chatParticipants.chatId, t.id),
            eq(chatParticipants.isActive, true)
          )
        );

      const memberCount = countResult?.count ?? 0;
      const config = getTierConfig(t.tier as TierLevel);
      const maxMembers = t.maxMembers ?? config.maxMembers;

      result.push({
        tier: t.tier as TierLevel,
        chatId: t.id,
        chatName: t.name ?? '',
        memberCount,
        maxMembers,
        isFull: memberCount >= maxMembers,
      });
    }

    return result.sort((a, b) => a.tier - b.tier);
  }

  /** Get a user's tier status with a specific NPC */
  static async getUserTierStatus(
    userId: string,
    npcId: string
  ): Promise<UserTierStatus> {
    // Get current membership
    const [membership] = await db
      .select({
        chatId: groupChatMemberships.chatId,
        tier: groupChatMemberships.tier,
        joinedAt: groupChatMemberships.joinedAt,
      })
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.npcAdminId, npcId),
          eq(groupChatMemberships.isActive, true)
        )
      )
      .limit(1);

    // Calculate engagement score
    const interactionScore =
      await NPCInteractionTracker.calculateEngagementScore(userId, npcId);
    const engagementScore = interactionScore.engagementScore;

    // Determine eligible tier based on engagement
    let eligibleTier: TierLevel | null = null;
    for (const tier of ALL_TIERS) {
      if (engagementScore >= TIER_CONFIG[tier].minEngagementScore) {
        eligibleTier = tier;
        break;
      }
    }

    // Check promotion eligibility
    let canBePromoted = false;
    let promotionBlockedReason: string | null = null;

    if (membership && membership.tier !== null) {
      const currentTier = membership.tier as TierLevel;
      const daysInTier = Math.floor(
        (Date.now() - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (currentTier === 1) {
        promotionBlockedReason = 'Already at highest tier';
      } else if (
        isEligibleForPromotion(currentTier, engagementScore, daysInTier)
      ) {
        // Check if higher tier has space
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
      currentTier: membership?.tier as TierLevel | null,
      chatId: membership?.chatId ?? null,
      joinedAt: membership?.joinedAt ?? null,
      engagementScore,
      eligibleTier,
      canBePromoted,
      promotionBlockedReason,
    };
  }

  /** Get all tiers a user is in across all NPCs */
  static async getUserAllTiers(userId: string): Promise<
    {
      npcId: string;
      npcName: string;
      tier: TierLevel;
      chatId: string;
      chatName: string;
      joinedAt: Date;
    }[]
  > {
    const memberships = await db
      .select({
        npcAdminId: groupChatMemberships.npcAdminId,
        chatId: groupChatMemberships.chatId,
        tier: groupChatMemberships.tier,
        joinedAt: groupChatMemberships.joinedAt,
      })
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.isActive, true),
          isNotNull(groupChatMemberships.tier)
        )
      );

    const result = [];

    for (const m of memberships) {
      // tier is guaranteed non-null by isNotNull filter above
      const actor = StaticDataRegistry.getActor(m.npcAdminId);
      const [chat] = await db
        .select({ name: chats.name })
        .from(chats)
        .where(eq(chats.id, m.chatId))
        .limit(1);

      result.push({
        npcId: m.npcAdminId,
        npcName: actor?.name ?? m.npcAdminId,
        tier: m.tier as TierLevel,
        chatId: m.chatId,
        chatName: chat?.name ?? '',
        joinedAt: m.joinedAt,
      });
    }

    return result;
  }

  /** Find the best available tier for a user with an NPC */
  static async findAvailableTier(
    npcId: string,
    engagementScore: number
  ): Promise<TierInfo | null> {
    const tiers = await this.getNpcTiers(npcId);
    if (tiers.length === 0) return null;

    // Find highest tier user qualifies for that has space
    for (const tier of ALL_TIERS) {
      const config = TIER_CONFIG[tier];
      if (engagementScore < config.minEngagementScore) continue;

      const tierInfo = tiers.find((t) => t.tier === tier);
      if (tierInfo && !tierInfo.isFull) {
        return tierInfo;
      }
    }

    return null;
  }

  /** Check if user can be invited to any tier */
  static async canInviteUser(
    userId: string,
    npcId: string
  ): Promise<{ canInvite: boolean; reason: string }> {
    // Check if already in a tier with this NPC
    const [existingMembership] = await db
      .select()
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.npcAdminId, npcId),
          eq(groupChatMemberships.isActive, true)
        )
      )
      .limit(1);

    if (existingMembership) {
      return { canInvite: false, reason: 'Already in a group with this NPC' };
    }

    // Check total group count
    const [groupCount] = await db
      .select({ count: count() })
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.isActive, true)
        )
      );

    if ((groupCount?.count ?? 0) >= MAX_ACTIVE_USER_GROUPS) {
      return {
        canInvite: false,
        reason: `At maximum of ${MAX_ACTIVE_USER_GROUPS} groups`,
      };
    }

    // Check cooldown
    const cooldownTime = new Date(
      Date.now() - INVITE_COOLDOWN_HOURS * 60 * 60 * 1000
    );
    const [recentJoin] = await db
      .select()
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          gte(groupChatMemberships.joinedAt, cooldownTime)
        )
      )
      .limit(1);

    if (recentJoin) {
      return {
        canInvite: false,
        reason: `In cooldown (${INVITE_COOLDOWN_HOURS}h between invites)`,
      };
    }

    return { canInvite: true, reason: '' };
  }

  /** Invite a user to the appropriate tier */
  static async inviteUserToTier(
    userId: string,
    npcId: string
  ): Promise<InviteResult> {
    // Check if can invite
    const canInvite = await this.canInviteUser(userId, npcId);
    if (!canInvite.canInvite) {
      return {
        success: false,
        tier: null,
        chatId: null,
        chatName: null,
        reason: canInvite.reason,
      };
    }

    // Get engagement score
    const interactionScore =
      await NPCInteractionTracker.calculateEngagementScore(userId, npcId);
    const engagementScore = interactionScore.engagementScore;

    // Ensure tiers exist
    await this.ensureAllTiersExist(npcId);

    // Find available tier
    const tierInfo = await this.findAvailableTier(npcId, engagementScore);
    if (!tierInfo) {
      return {
        success: false,
        tier: null,
        chatId: null,
        chatName: null,
        reason: `No available tier (score: ${engagementScore.toFixed(0)}, min required: ${TIER_CONFIG[3].minEngagementScore})`,
      };
    }

    // Add to chat participants
    await db.insert(chatParticipants).values({
      id: await generateSnowflakeId(),
      chatId: tierInfo.chatId,
      userId,
      invitedBy: npcId,
    });

    // Record membership
    await db.insert(groupChatMemberships).values({
      id: await generateSnowflakeId(),
      userId,
      chatId: tierInfo.chatId,
      npcAdminId: npcId,
      tier: tierInfo.tier,
    });

    logger.info(
      'User invited to tier',
      {
        userId,
        npcId,
        tier: tierInfo.tier,
        tierName: tierInfo.chatName,
        engagementScore,
      },
      'TieredGroupService'
    );

    // Send notification
    const { notifyGroupChatInvite } = await import('@babylon/api');
    await notifyGroupChatInvite(
      userId,
      npcId,
      tierInfo.chatId,
      tierInfo.chatName
    );

    return {
      success: true,
      tier: tierInfo.tier,
      chatId: tierInfo.chatId,
      chatName: tierInfo.chatName,
      reason: `Invited to ${tierInfo.chatName} (Tier ${tierInfo.tier})`,
    };
  }

  /** Promote a user to the next higher tier */
  static async promoteUser(
    userId: string,
    npcId: string
  ): Promise<PromotionResult | null> {
    const status = await this.getUserTierStatus(userId, npcId);

    if (!status.currentTier || !status.chatId) {
      logger.warn(
        'Cannot promote user not in any tier',
        { userId, npcId },
        'TieredGroupService'
      );
      return null;
    }

    if (!status.canBePromoted) {
      logger.debug(
        'User not eligible for promotion',
        { userId, npcId, reason: status.promotionBlockedReason },
        'TieredGroupService'
      );
      return null;
    }

    const higherTier = getHigherTier(status.currentTier);
    if (!higherTier) return null;

    const tiers = await this.getNpcTiers(npcId);
    const targetTierInfo = tiers.find((t) => t.tier === higherTier);
    if (!targetTierInfo || targetTierInfo.isFull) {
      return null;
    }

    // Remove from current tier
    await db
      .update(groupChatMemberships)
      .set({
        isActive: false,
        sweepReason: `Promoted to Tier ${higherTier}`,
        removedAt: new Date(),
      })
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.chatId, status.chatId),
          eq(groupChatMemberships.isActive, true)
        )
      );

    await db
      .update(chatParticipants)
      .set({ isActive: false, kickedAt: new Date(), kickReason: 'Promoted' })
      .where(
        and(
          eq(chatParticipants.userId, userId),
          eq(chatParticipants.chatId, status.chatId),
          eq(chatParticipants.isActive, true)
        )
      );

    // Add to higher tier
    await db.insert(chatParticipants).values({
      id: await generateSnowflakeId(),
      chatId: targetTierInfo.chatId,
      userId,
      invitedBy: npcId,
    });

    await db.insert(groupChatMemberships).values({
      id: await generateSnowflakeId(),
      userId,
      chatId: targetTierInfo.chatId,
      npcAdminId: npcId,
      tier: higherTier,
      previousTier: status.currentTier,
      promotedAt: new Date(),
    });

    logger.info(
      'User promoted',
      {
        userId,
        npcId,
        fromTier: status.currentTier,
        toTier: higherTier,
        newChatName: targetTierInfo.chatName,
      },
      'TieredGroupService'
    );

    // Send notification
    const { notifyTierPromotion } = await import('@babylon/api');
    await notifyTierPromotion(
      userId,
      npcId,
      targetTierInfo.chatId,
      targetTierInfo.chatName,
      status.currentTier,
      higherTier
    );

    return {
      userId,
      npcId,
      fromTier: status.currentTier,
      toTier: higherTier,
      newChatId: targetTierInfo.chatId,
    };
  }

  /** Process promotions for all users in an NPC's groups */
  static async processNpcPromotions(npcId: string): Promise<PromotionResult[]> {
    const results: PromotionResult[] = [];

    // Get all active memberships for this NPC (excluding Tier 1)
    const memberships = await db
      .select({
        userId: groupChatMemberships.userId,
        tier: groupChatMemberships.tier,
      })
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.npcAdminId, npcId),
          eq(groupChatMemberships.isActive, true),
          isNotNull(groupChatMemberships.tier),
          ne(groupChatMemberships.tier, 1) // Exclude Tier 1 (already at top)
        )
      );

    for (const m of memberships) {
      const result = await this.promoteUser(m.userId, npcId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /** Demote a user to the next lower tier (or remove if at Tier 3) */
  static async demoteUser(
    userId: string,
    npcId: string,
    reason: string
  ): Promise<DemotionResult | null> {
    const status = await this.getUserTierStatus(userId, npcId);

    if (!status.currentTier || !status.chatId) {
      return null;
    }

    const lowerTier = getLowerTier(status.currentTier);

    // Remove from current tier
    await db
      .update(groupChatMemberships)
      .set({
        isActive: false,
        sweepReason: reason,
        removedAt: new Date(),
      })
      .where(
        and(
          eq(groupChatMemberships.userId, userId),
          eq(groupChatMemberships.chatId, status.chatId),
          eq(groupChatMemberships.isActive, true)
        )
      );

    await db
      .update(chatParticipants)
      .set({ isActive: false, kickedAt: new Date(), kickReason: reason })
      .where(
        and(
          eq(chatParticipants.userId, userId),
          eq(chatParticipants.chatId, status.chatId),
          eq(chatParticipants.isActive, true)
        )
      );

    if (!lowerTier) {
      // At Tier 3, remove entirely
      logger.info(
        'User removed from all tiers',
        { userId, npcId, reason },
        'TieredGroupService'
      );

      return {
        userId,
        npcId,
        fromTier: status.currentTier,
        toTier: null,
        newChatId: null,
        reason,
      };
    }

    // Add to lower tier
    const tiers = await this.getNpcTiers(npcId);
    const targetTierInfo = tiers.find((t) => t.tier === lowerTier);
    if (!targetTierInfo) {
      logger.error(
        'Lower tier not found',
        { userId, npcId, targetTier: lowerTier },
        'TieredGroupService'
      );
      return null;
    }

    // Check if lower tier has space
    if (targetTierInfo.isFull) {
      logger.warn(
        'Lower tier is full, removing user entirely',
        { userId, npcId, targetTier: lowerTier },
        'TieredGroupService'
      );
      return {
        userId,
        npcId,
        fromTier: status.currentTier,
        toTier: null,
        newChatId: null,
        reason: `${reason} (Tier ${lowerTier} full)`,
      };
    }

    await db.insert(chatParticipants).values({
      id: await generateSnowflakeId(),
      chatId: targetTierInfo.chatId,
      userId,
      invitedBy: npcId,
    });

    await db.insert(groupChatMemberships).values({
      id: await generateSnowflakeId(),
      userId,
      chatId: targetTierInfo.chatId,
      npcAdminId: npcId,
      tier: lowerTier,
      previousTier: status.currentTier,
      demotedAt: new Date(),
    });

    logger.info(
      'User demoted',
      {
        userId,
        npcId,
        fromTier: status.currentTier,
        toTier: lowerTier,
        reason,
      },
      'TieredGroupService'
    );

    // Send notification
    const { notifyTierDemotion } = await import('@babylon/api');
    await notifyTierDemotion(
      userId,
      npcId,
      targetTierInfo.chatId,
      status.currentTier,
      lowerTier,
      reason
    );

    return {
      userId,
      npcId,
      fromTier: status.currentTier,
      toTier: lowerTier,
      newChatId: targetTierInfo.chatId,
      reason,
    };
  }

  /** Process demotions for inactive users in an NPC's groups */
  static async processNpcDemotions(npcId: string): Promise<DemotionResult[]> {
    const results: DemotionResult[] = [];

    // Get all active memberships for this NPC
    const memberships = await db
      .select({
        userId: groupChatMemberships.userId,
        tier: groupChatMemberships.tier,
        lastMessageAt: groupChatMemberships.lastMessageAt,
        joinedAt: groupChatMemberships.joinedAt,
      })
      .from(groupChatMemberships)
      .where(
        and(
          eq(groupChatMemberships.npcAdminId, npcId),
          eq(groupChatMemberships.isActive, true),
          isNotNull(groupChatMemberships.tier)
        )
      );

    const now = Date.now();

    for (const m of memberships) {
      // tier is guaranteed non-null by isNotNull filter above
      const tier = m.tier as TierLevel;
      const lastActivity = m.lastMessageAt ?? m.joinedAt;
      const daysSinceActivity = Math.floor(
        (now - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (shouldDemote(tier, daysSinceActivity)) {
        const result = await this.demoteUser(
          m.userId,
          npcId,
          `Inactive for ${daysSinceActivity} days`
        );
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /** Process invitations for all NPCs during a tick */
  static async processTickInvitations(): Promise<{
    invites: InviteResult[];
    errors: number;
  }> {
    const invites: InviteResult[] = [];
    let errors = 0;

    const actors = StaticDataRegistry.getAllActors();

    if (actors.length === 0) {
      logger.debug(
        'No actors in StaticDataRegistry, skipping tier invitations',
        undefined,
        'TieredGroupService'
      );
      return { invites, errors };
    }

    for (const actor of actors) {
      // Ensure tiers exist for this NPC
      await this.ensureAllTiersExist(actor.id);

      // Get top engaged users not in this NPC's groups
      const eligibleUsers = await this.getEligibleUsersForNpc(actor.id);

      for (const user of eligibleUsers) {
        // Roll probability based on tier
        const eligibleTier = getTierForEngagementScore(user.engagementScore);
        if (!eligibleTier) continue;

        const config = TIER_CONFIG[eligibleTier];
        if (Math.random() > config.inviteProbability) continue;

        const result = await this.inviteUserToTier(user.userId, actor.id);
        if (result.success) {
          invites.push(result);
        } else {
          errors++;
        }

        // Only one invite per NPC per tick
        break;
      }
    }

    return { invites, errors };
  }

  /** Process all promotions across all NPCs (run daily) */
  static async processAllPromotions(): Promise<PromotionResult[]> {
    const results: PromotionResult[] = [];
    const actors = StaticDataRegistry.getAllActors();

    for (const actor of actors) {
      const npcResults = await this.processNpcPromotions(actor.id);
      results.push(...npcResults);
    }

    return results;
  }

  /** Process all demotions across all NPCs (run daily) */
  static async processAllDemotions(): Promise<DemotionResult[]> {
    const results: DemotionResult[] = [];
    const actors = StaticDataRegistry.getAllActors();

    for (const actor of actors) {
      const npcResults = await this.processNpcDemotions(actor.id);
      results.push(...npcResults);
    }

    return results;
  }

  /** Get analytics for all NPC tiers */
  static async getGlobalAnalytics(): Promise<{
    totalNpcs: number;
    totalTiers: number;
    totalMembers: number;
    totalCapacity: number;
    overallFillRate: number;
    tierBreakdown: {
      tier: TierLevel;
      totalMembers: number;
      totalCapacity: number;
      fillRate: number;
    }[];
  }> {
    const actors = StaticDataRegistry.getAllActors();
    let totalTiers = 0;
    let totalMembers = 0;
    let totalCapacity = 0;

    const tierTotals: Record<TierLevel, { members: number; capacity: number }> =
      {
        1: { members: 0, capacity: 0 },
        2: { members: 0, capacity: 0 },
        3: { members: 0, capacity: 0 },
      };

    for (const actor of actors) {
      const tiers = await this.getNpcTiers(actor.id);
      totalTiers += tiers.length;

      for (const t of tiers) {
        totalMembers += t.memberCount;
        totalCapacity += t.maxMembers;
        tierTotals[t.tier].members += t.memberCount;
        tierTotals[t.tier].capacity += t.maxMembers;
      }
    }

    return {
      totalNpcs: actors.length,
      totalTiers,
      totalMembers,
      totalCapacity,
      overallFillRate: totalCapacity > 0 ? totalMembers / totalCapacity : 0,
      tierBreakdown: ALL_TIERS.map((tier) => ({
        tier,
        totalMembers: tierTotals[tier].members,
        totalCapacity: tierTotals[tier].capacity,
        fillRate:
          tierTotals[tier].capacity > 0
            ? tierTotals[tier].members / tierTotals[tier].capacity
            : 0,
      })),
    };
  }

  /** Get eligible users for NPC invitation (private) */
  private static async getEligibleUsersForNpc(
    npcId: string
  ): Promise<{ userId: string; engagementScore: number }[]> {
    // Get users NOT already in a group with this NPC (single query with LEFT JOIN)
    const candidateUsers = await db
      .selectDistinct({ userId: users.id })
      .from(users)
      .leftJoin(
        groupChatMemberships,
        and(
          eq(groupChatMemberships.userId, users.id),
          eq(groupChatMemberships.npcAdminId, npcId),
          eq(groupChatMemberships.isActive, true)
        )
      )
      .where(
        and(
          eq(users.isActor, false),
          isNotNull(users.walletAddress),
          isNull(groupChatMemberships.id) // Not in any group with this NPC
        )
      )
      .limit(50); // Reduce to 50 since we calculate engagement for each

    // Calculate engagement scores in parallel (batch of 10 at a time)
    const results: { userId: string; engagementScore: number }[] = [];
    const batchSize = 10;

    for (let i = 0; i < candidateUsers.length; i += batchSize) {
      const batch = candidateUsers.slice(i, i + batchSize);
      const scores = await Promise.all(
        batch.map((user) =>
          NPCInteractionTracker.calculateEngagementScore(user.userId, npcId)
        )
      );

      scores.forEach((score, j) => {
        const user = batch[j];
        if (
          user &&
          score.engagementScore >= TIER_CONFIG[3].minEngagementScore
        ) {
          results.push({
            userId: user.userId,
            engagementScore: score.engagementScore,
          });
        }
      });
    }

    return results.sort((a, b) => b.engagementScore - a.engagementScore);
  }
}
