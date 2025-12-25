// @ts-nocheck - Database query type inference issues, needs refactoring
import {
  and,
  chatParticipants,
  chats,
  db,
  desc,
  eq,
  groupChatMemberships,
  lt,
  pendingGroupInviteCandidates,
  userGroupInvites,
  users,
} from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { GroupInviteConfig } from '../config/group-chat-config'
import { engineEvents } from '../events'
import { NPCInteractionTracker } from './npc-interaction-tracker'
import { StaticDataRegistry } from './static-data-registry'

export type InviteTriggerType =
  | 'quality_reply'
  | 'follow'
  | 'trade'
  | 'share'
  | 'like_streak'
  | 'manual'

export interface QueueInviteParams {
  userId: string
  npcId: string
  triggerType: InviteTriggerType
  triggerId?: string
  engagementScore?: number
  priorityMultiplier?: number
}

export interface InviteProcessingResult {
  candidatesProcessed: number
  invitesSent: number
  skipped: number
  expired: number
  alreadyMembers: number
}

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern uses static methods for stateless operations
export class GroupInviteOrchestrator {
  static async queueInviteCandidate(
    params: QueueInviteParams,
  ): Promise<{ queued: boolean; reason?: string }> {
    const {
      userId,
      npcId,
      triggerType,
      triggerId,
      priorityMultiplier = 1.0,
    } = params

    type UserRow = { isActor: boolean }
    type IdRow = { id: string }
    const [[user], [existingMembership], [existingCandidate]] =
      (await Promise.all([
        db
          .select({ isActor: users.isActor })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
        db
          .select({ id: groupChatMemberships.id })
          .from(groupChatMemberships)
          .where(
            and(
              eq(groupChatMemberships.userId, userId),
              eq(groupChatMemberships.npcAdminId, npcId),
              eq(groupChatMemberships.isActive, true),
            ),
          )
          .limit(1),
        db
          .select({ id: pendingGroupInviteCandidates.id })
          .from(pendingGroupInviteCandidates)
          .where(
            and(
              eq(pendingGroupInviteCandidates.userId, userId),
              eq(pendingGroupInviteCandidates.npcId, npcId),
              eq(pendingGroupInviteCandidates.processed, false),
            ),
          )
          .limit(1),
      ])) as [UserRow[], IdRow[], IdRow[]]

    if (!user || user.isActor) {
      logger.debug(
        'Invite candidate rejected: not a user',
        { userId, npcId },
        'GroupInviteOrchestrator',
      )
      return { queued: false, reason: 'User is NPC or not found' }
    }
    if (existingMembership) {
      logger.debug(
        'Invite candidate rejected: already member',
        { userId, npcId },
        'GroupInviteOrchestrator',
      )
      return { queued: false, reason: 'Already a member' }
    }

    if (existingCandidate) {
      if (priorityMultiplier > 1.0) {
        await db
          .update(pendingGroupInviteCandidates)
          .set({ priorityMultiplier, triggerId, triggerType })
          .where(eq(pendingGroupInviteCandidates.id, existingCandidate.id))
        logger.debug(
          'Invite candidate priority updated',
          { userId, npcId, priorityMultiplier },
          'GroupInviteOrchestrator',
        )
      }
      return { queued: false, reason: 'Already queued (priority updated)' }
    }

    const limitCheck = await GroupInviteOrchestrator.checkUserLimits(userId)
    if (!limitCheck.eligible) {
      logger.debug(
        'Invite candidate rejected: limit check failed',
        { userId, reason: limitCheck.reason },
        'GroupInviteOrchestrator',
      )
      return { queued: false, reason: limitCheck.reason }
    }

    const engagementScore =
      params.engagementScore ??
      (await NPCInteractionTracker.calculateEngagementScore(userId, npcId))
        .engagementScore

    if (engagementScore < GroupInviteConfig.minEngagementScore) {
      logger.debug(
        'Invite candidate rejected: low engagement',
        { userId, npcId, engagementScore },
        'GroupInviteOrchestrator',
      )
      return { queued: false, reason: 'Engagement score too low' }
    }

    const [existingChat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.isGroup, true), eq(chats.npcAdminId, npcId)))
      .limit(1)

    const inserted = await db
      .insert(pendingGroupInviteCandidates)
      .values({
        id: await generateSnowflakeId(),
        userId,
        npcId,
        groupChatId: existingChat?.id ?? null,
        engagementScore,
        triggerType,
        triggerId,
        priorityMultiplier,
        queuedAt: new Date(),
        processed: false,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted.length === 0) {
      return { queued: false, reason: 'Already queued (concurrent)' }
    }

    logger.info(
      'Queued invite candidate',
      { userId, npcId, triggerType, engagementScore },
      'GroupInviteOrchestrator',
    )
    return { queued: true }
  }

  static async processQueuedInvites(): Promise<InviteProcessingResult> {
    const result: InviteProcessingResult = {
      candidatesProcessed: 0,
      invitesSent: 0,
      skipped: 0,
      expired: 0,
      alreadyMembers: 0,
    }

    const expiryThreshold = new Date(
      Date.now() - GroupInviteConfig.candidateExpiryHours * 60 * 60 * 1000,
    )
    const candidates = await db
      .select()
      .from(pendingGroupInviteCandidates)
      .where(eq(pendingGroupInviteCandidates.processed, false))
      // biome-ignore lint/style/noNonNullAssertion: Schema guarantees queuedAt is defined
      .orderBy(desc(pendingGroupInviteCandidates.queuedAt!))
      .limit(GroupInviteConfig.maxCandidatesPerTick)

    for (const candidate of candidates) {
      result.candidatesProcessed++

      // Extract typed values from candidate
      const candidateId = String(candidate.id)
      const candidateUserId = String(candidate.userId)
      const candidateNpcId = String(candidate.npcId)
      const candidateGroupChatId = candidate.groupChatId
        ? String(candidate.groupChatId)
        : null
      const candidateQueuedAt = candidate.queuedAt
        ? new Date(String(candidate.queuedAt))
        : new Date()
      const candidateEngagementScore = Number(candidate.engagementScore ?? 0)
      const candidatePriorityMultiplier = Number(
        candidate.priorityMultiplier ?? 1,
      )

      if (candidateQueuedAt < expiryThreshold) {
        await GroupInviteOrchestrator.markCandidateProcessed(
          candidateId,
          'expired',
        )
        result.expired++
        continue
      }

      const [membership] = await db
        .select({ id: groupChatMemberships.id })
        .from(groupChatMemberships)
        .where(
          and(
            eq(groupChatMemberships.userId, candidateUserId),
            eq(groupChatMemberships.npcAdminId, candidateNpcId),
            eq(groupChatMemberships.isActive, true),
          ),
        )
        .limit(1)

      if (membership) {
        await GroupInviteOrchestrator.markCandidateProcessed(
          candidateId,
          'already_member',
        )
        result.alreadyMembers++
        continue
      }

      const limitCheck =
        await GroupInviteOrchestrator.checkUserLimits(candidateUserId)
      if (!limitCheck.eligible) {
        await GroupInviteOrchestrator.markCandidateProcessed(
          candidateId,
          'skipped',
        )
        result.skipped++
        continue
      }

      const npcActor = StaticDataRegistry.getActor(candidateNpcId)
      const tierMultiplier =
        GroupInviteConfig.tierMultipliers[npcActor?.tier ?? 'NONE'] ?? 1.0
      const scoreMultiplier = Math.min(candidateEngagementScore / 50, 2.0)
      const probability =
        GroupInviteConfig.baseInviteProbability *
        scoreMultiplier *
        candidatePriorityMultiplier *
        tierMultiplier

      if (Math.random() >= probability) continue

      const inviteResult = await GroupInviteOrchestrator.createInvite(
        candidateUserId,
        candidateNpcId,
        candidateGroupChatId,
      )
      if (inviteResult.success) {
        await GroupInviteOrchestrator.markCandidateProcessed(
          candidateId,
          'invited',
        )
        result.invitesSent++
        logger.info(
          'Invite sent',
          {
            userId: candidateUserId,
            npcId: candidateNpcId,
            probability: probability.toFixed(3),
          },
          'GroupInviteOrchestrator',
        )
      } else {
        await GroupInviteOrchestrator.markCandidateProcessed(
          candidateId,
          'skipped',
        )
        result.skipped++
      }
    }

    if (result.invitesSent > 0) {
      logger.info('Processed invite queue', result, 'GroupInviteOrchestrator')
    }
    return result
  }

  private static async createInvite(
    userId: string,
    npcId: string,
    groupChatId: string | null,
  ): Promise<{ success: boolean; chatId?: string }> {
    const npcName = StaticDataRegistry.getActor(npcId)?.name ?? 'Unknown NPC'
    let chatId = groupChatId
    let chatName: string

    if (chatId) {
      type ChatRow = { name: string | null }
      const [chat] = (await db
        .select({ name: chats.name })
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1)) as ChatRow[]
      chatName = chat?.name ?? `${npcName}'s Circle`
    } else {
      const [existing] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.isGroup, true), eq(chats.npcAdminId, npcId)))
        .limit(1)

      if (existing) {
        chatId = String(existing.id)
        chatName = existing.name ? String(existing.name) : `${npcName}'s Circle`
      } else {
        chatId = await generateSnowflakeId()
        chatName = `${npcName}'s Circle`
        await db.insert(chats).values({
          id: chatId,
          name: chatName,
          isGroup: true,
          npcAdminId: npcId,
          updatedAt: new Date(),
        })
        await db
          .insert(chatParticipants)
          .values({ id: await generateSnowflakeId(), chatId, userId: npcId })
      }
    }

    const [existingInvite] = await db
      .select({ id: userGroupInvites.id })
      .from(userGroupInvites)
      .where(
        and(
          eq(userGroupInvites.groupId, chatId),
          eq(userGroupInvites.invitedUserId, userId),
          eq(userGroupInvites.status, 'pending'),
        ),
      )
      .limit(1)

    if (existingInvite) return { success: false }

    await db.insert(userGroupInvites).values({
      id: await generateSnowflakeId(),
      groupId: chatId,
      invitedUserId: userId,
      invitedBy: npcId,
      status: 'pending',
      message: `Join ${chatName}!`,
      invitedAt: new Date(),
    })

    // Emit invite event - listeners can send notifications
    engineEvents.emit('groupChatInvite', {
      userId,
      inviterId: npcId,
      chatId,
      chatName,
    })
    return { success: true, chatId }
  }

  private static async checkUserLimits(
    userId: string,
  ): Promise<{ eligible: boolean; reason?: string }> {
    const [activeCount, latestMembership] = await Promise.all([
      db.groupChatMembership.count({
        where: {
          AND: [{ userId }, { isActive: true }],
        },
      }),
      db.groupChatMembership.findFirst({
        where: {
          AND: [{ userId }, { isActive: true }],
        },
        select: { joinedAt: true },
        orderBy: { joinedAt: 'desc' },
      }),
    ])

    if (activeCount >= GroupInviteConfig.maxActiveUserGroups) {
      return { eligible: false, reason: 'At group limit' }
    }

    const cooldownMs = GroupInviteConfig.inviteCooldownHours * 60 * 60 * 1000
    if (
      latestMembership &&
      Date.now() - latestMembership.joinedAt.getTime() < cooldownMs
    ) {
      return { eligible: false, reason: 'In invite cooldown' }
    }

    return { eligible: true }
  }

  private static async markCandidateProcessed(
    id: string,
    outcome: string,
  ): Promise<void> {
    await db
      .update(pendingGroupInviteCandidates)
      .set({ processed: true, outcome, processedAt: new Date() })
      .where(eq(pendingGroupInviteCandidates.id, id))
  }

  static async cleanupProcessedCandidates(): Promise<number> {
    const cutoff = new Date(
      Date.now() - GroupInviteConfig.cleanupDays * 24 * 60 * 60 * 1000,
    )
    const deleted = await db
      .delete(pendingGroupInviteCandidates)
      .where(
        and(
          eq(pendingGroupInviteCandidates.processed, true),
          lt(pendingGroupInviteCandidates.processedAt, cutoff),
        ),
      )
      .returning()
    return deleted.length
  }

  static async expireOldInvites(): Promise<number> {
    const cutoff = new Date(
      Date.now() - GroupInviteConfig.inviteExpiryDays * 24 * 60 * 60 * 1000,
    )
    const updated = await db
      .update(userGroupInvites)
      .set({ status: 'expired', respondedAt: new Date() })
      .where(
        and(
          eq(userGroupInvites.status, 'pending'),
          lt(userGroupInvites.invitedAt, cutoff),
        ),
      )
      .returning()
    return updated.length
  }

  static async getInviteStats(): Promise<{
    pendingCandidates: number
    pendingInvites: number
    invitesLast24h: number
    acceptsLast24h: number
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [pendingCandidates, pendingInvites, invitesLast24h, acceptsLast24h] =
      await Promise.all([
        db.pendingGroupInviteCandidate.count({
          where: { processed: false },
        }),
        db.userGroupInvite.count({
          where: { status: 'pending' },
        }),
        db.userGroupInvite.count({
          where: { invitedAt: { gte: oneDayAgo } },
        }),
        db.userGroupInvite.count({
          where: {
            AND: [{ status: 'accepted' }, { respondedAt: { gte: oneDayAgo } }],
          },
        }),
      ])

    return {
      pendingCandidates,
      pendingInvites,
      invitesLast24h,
      acceptsLast24h,
    }
  }
}
