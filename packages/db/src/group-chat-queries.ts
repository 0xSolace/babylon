/**
 * Reads/writes for `GroupChatService` (NPC group invites, membership, sweeps).
 *
 * **Why here:** Keeps group/follow/interaction/message SQL under `asSystem`.
 * Invite/kick probability and random rolls stay in `packages/engine`.
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { asSystem } from './db';
import { chats } from './tables/chats';
import { followStatuses } from './tables/follow-statuses';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { type Message, messages } from './tables/messages';
import { users } from './tables/user';
import { userInteractions } from './tables/user-interactions';

export type GroupChatInviteFollowRow = {
  isActive: boolean;
  followedAt: Date;
};

export type GroupChatInviteInteractionRow = {
  qualityScore: number;
  timestamp: Date;
};

/**
 * Loads follow status, NPC group membership, and post-follow interactions in one transaction.
 */
export async function fetchGroupChatInviteChanceContext(params: {
  userId: string;
  npcId: string;
}): Promise<{
  followStatus: GroupChatInviteFollowRow | null;
  hasNpcGroupMembership: boolean;
  interactionsSinceFollow: GroupChatInviteInteractionRow[];
}> {
  const { userId, npcId } = params;

  return asSystem(async (c) => {
    const [followRow] = await c
      .select({
        isActive: followStatuses.isActive,
        followedAt: followStatuses.followedAt,
      })
      .from(followStatuses)
      .where(
        and(eq(followStatuses.userId, userId), eq(followStatuses.npcId, npcId))
      )
      .limit(1);

    const followStatus = followRow ?? null;

    const existingMemberships = await c
      .select({ groupId: groups.id })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groups.ownerId, npcId),
          eq(groups.type, 'npc'),
          eq(groupMembers.isActive, true)
        )
      )
      .limit(1);

    const hasNpcGroupMembership = existingMemberships.length > 0;

    if (!followStatus) {
      return {
        followStatus: null,
        hasNpcGroupMembership,
        interactionsSinceFollow: [],
      };
    }

    const interactionsSinceFollow = await c
      .select({
        qualityScore: userInteractions.qualityScore,
        timestamp: userInteractions.timestamp,
      })
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          eq(userInteractions.npcId, npcId),
          gte(userInteractions.timestamp, followStatus.followedAt)
        )
      );

    return {
      followStatus,
      hasNpcGroupMembership,
      interactionsSinceFollow,
    };
  }, 'group-chat-invite-chance');
}

export type UserGroupChatMembershipRow = {
  groupId: string;
  chatId: string;
  groupName: string;
  ownerId: string;
  type: string;
  joinedAt: Date;
};

export async function listUserGroupChatMembershipRows(
  userId: string
): Promise<UserGroupChatMembershipRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          groupId: groups.id,
          chatId: chats.id,
          groupName: groups.name,
          ownerId: groups.ownerId,
          type: groups.type,
          joinedAt: groupMembers.joinedAt,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(chats, eq(chats.groupId, groups.id))
        .where(
          and(eq(groupMembers.userId, userId), eq(groupMembers.isActive, true))
        )
        .orderBy(groupMembers.joinedAt),
    'group-chat-user-chats'
  );
}

export async function checkUserOrAgentOwnerInGroupChat(params: {
  userId: string;
  chatId: string;
}): Promise<boolean> {
  const { userId, chatId } = params;

  return asSystem(async (c) => {
    const [directMembership] = await c
      .select({ id: groupMembers.id })
      .from(chats)
      .innerJoin(groupMembers, eq(chats.groupId, groupMembers.groupId))
      .where(
        and(
          eq(chats.id, chatId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true)
        )
      )
      .limit(1);

    if (directMembership) {
      return true;
    }

    const [userRecord] = await c
      .select({ managedBy: users.managedBy, isAgent: users.isAgent })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecord?.isAgent && userRecord?.managedBy) {
      const [ownerMembership] = await c
        .select({ id: groupMembers.id })
        .from(chats)
        .innerJoin(groupMembers, eq(chats.groupId, groupMembers.groupId))
        .where(
          and(
            eq(chats.id, chatId),
            eq(groupMembers.userId, userRecord.managedBy),
            eq(groupMembers.isActive, true)
          )
        )
        .limit(1);

      return !!ownerMembership;
    }

    return false;
  }, 'group-chat-is-in-chat');
}

export type GroupChatKickChatRow = {
  id: string;
  groupId: string | null;
};

export type GroupChatKickMembershipRow = {
  userId: string;
  joinedAt: Date;
  qualityScore: number;
  messageCount: number;
  isActive: boolean;
};

export async function fetchGroupChatKickEvaluationData(params: {
  userId: string;
  chatId: string;
}): Promise<{
  chat: GroupChatKickChatRow | null;
  membership: GroupChatKickMembershipRow | null;
  userMessagesNewestFirst: Message[];
}> {
  const { userId, chatId } = params;

  return asSystem(async (c) => {
    const [chat] = await c
      .select({
        id: chats.id,
        groupId: chats.groupId,
      })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat?.groupId) {
      return {
        chat: chat ?? null,
        membership: null,
        userMessagesNewestFirst: [],
      };
    }

    const [membership] = await c
      .select({
        userId: groupMembers.userId,
        joinedAt: groupMembers.joinedAt,
        qualityScore: groupMembers.qualityScore,
        messageCount: groupMembers.messageCount,
        isActive: groupMembers.isActive,
      })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, chat.groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership?.isActive) {
      return {
        chat,
        membership: membership ?? null,
        userMessagesNewestFirst: [],
      };
    }

    const userMessagesNewestFirst = await c
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.senderId, userId)))
      .orderBy(desc(messages.createdAt));

    return { chat, membership, userMessagesNewestFirst };
  }, 'group-chat-kick-chance');
}

export async function deactivateGroupChatMember(params: {
  userId: string;
  chatId: string;
  reason: string;
}): Promise<void> {
  const { userId, chatId, reason } = params;

  await asSystem(async (c) => {
    const [chat] = await c
      .select({ groupId: chats.groupId })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat?.groupId) return;

    await c
      .update(groupMembers)
      .set({
        isActive: false,
        kickReason: reason,
        kickedAt: new Date(),
      })
      .where(
        and(
          eq(groupMembers.groupId, chat.groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true)
        )
      );
  }, 'group-chat-remove');
}

export type GroupMemberActiveRow = {
  userId: string;
};

export async function listActiveGroupMemberUserIdsForChat(
  chatId: string
): Promise<GroupMemberActiveRow[] | null> {
  return asSystem(async (c) => {
    const [ch] = await c
      .select({ groupId: chats.groupId })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!ch?.groupId) return null;

    const rows = await c
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, ch.groupId),
          eq(groupMembers.isActive, true)
        )
      );

    return rows;
  }, 'group-chat-sweep-load');
}

export async function listGroupChatIds(): Promise<{ id: string }[]> {
  return asSystem(
    async (c) =>
      c.select({ id: chats.id }).from(chats).where(eq(chats.isGroup, true)),
    'group-chat-sweep-all-ids'
  );
}

export async function updateGroupMemberMessageQuality(params: {
  userId: string;
  chatId: string;
  newMessageQuality: number;
}): Promise<void> {
  const { userId, chatId, newMessageQuality } = params;

  await asSystem(async (c) => {
    const [chat] = await c
      .select({ groupId: chats.groupId })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat?.groupId) return;

    const [membership] = await c
      .select({
        messageCount: groupMembers.messageCount,
        qualityScore: groupMembers.qualityScore,
      })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, chat.groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) return;

    const totalMessages = membership.messageCount + 1;
    const newAvgQuality =
      (membership.qualityScore * membership.messageCount + newMessageQuality) /
      totalMessages;

    await c
      .update(groupMembers)
      .set({
        messageCount: totalMessages,
        qualityScore: newAvgQuality,
        lastMessageAt: new Date(),
      })
      .where(
        and(
          eq(groupMembers.groupId, chat.groupId),
          eq(groupMembers.userId, userId)
        )
      );
  }, 'group-chat-update-quality');
}
