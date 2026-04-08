/**
 * NPC group chat onboarding — empty users → NPC group chat membership.
 *
 * **Why in `@babylon/db`:** Joins and filters over `users`, `groupMembers`, `chats`,
 * `messages`, etc. belong in one place so we do not duplicate SQL across engine ticks
 * and future callers.
 *
 * **Why `asSystem`:** Onboarding runs as a background/demo job, not as each target
 * user; RLS must not treat these inserts as the end-user’s session.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { users } from './tables/user';

export type NpcGroupChatOnboardingCandidateChat = {
  chatId: string;
  groupId: string;
  groupOwnerId: string;
  groupMaxMembers: number | null;
};

export type NpcGroupChatOnboardingReadResult =
  | { kind: 'no_users' }
  | { kind: 'no_chats'; userCount: number }
  | {
      kind: 'ok';
      userIds: string[];
      preferredChats: NpcGroupChatOnboardingCandidateChat[];
      participantCountMap: Map<string, number>;
    };

export type NpcGroupChatOnboardingReadParams = {
  batchSize: number;
  userIdAllowlist: string[] | null;
  chatIdAllowlist: string[] | null;
  /** When true, only `users.isTest === true` rows are considered. */
  restrictToTestUsers: boolean;
};

export async function npcGroupChatOnboardingRead(
  params: NpcGroupChatOnboardingReadParams
): Promise<NpcGroupChatOnboardingReadResult> {
  const baseUserFilter = and(
    eq(users.isActor, false),
    eq(users.isBanned, false),
    isNull(groupMembers.id)
  );
  const userFilter = params.restrictToTestUsers
    ? and(baseUserFilter, eq(users.isTest, true))
    : baseUserFilter;
  const finalUserFilter = params.userIdAllowlist
    ? and(userFilter, inArray(users.id, params.userIdAllowlist))
    : userFilter;

  const chatAllowlist = params.chatIdAllowlist;

  return asSystem(async (c) => {
    const emptyUsers = await c
      .select({ userId: users.id })
      .from(users)
      .leftJoin(
        groupMembers,
        and(eq(users.id, groupMembers.userId), eq(groupMembers.isActive, true))
      )
      .where(finalUserFilter)
      .limit(params.batchSize);

    const userIds = emptyUsers.map((u) => u.userId);
    if (userIds.length === 0) {
      return { kind: 'no_users' as const };
    }

    const candidateChats = await c
      .select({
        chatId: chats.id,
        groupId: groups.id,
        groupOwnerId: groups.ownerId,
        groupMaxMembers: groups.maxMembers,
      })
      .from(chats)
      .innerJoin(groups, eq(groups.id, chats.groupId))
      .where(
        and(
          eq(chats.isGroup, true),
          eq(groups.type, 'npc'),
          eq(chats.nftGated, false),
          ...(chatAllowlist ? [inArray(chats.id, chatAllowlist)] : [])
        )
      )
      .limit(200);

    if (candidateChats.length === 0) {
      return { kind: 'no_chats' as const, userCount: userIds.length };
    }

    const candidateChatIds = candidateChats.map((row) => row.chatId);
    const chatsWithMessages =
      candidateChatIds.length > 0
        ? await c
            .select({ chatId: messages.chatId })
            .from(messages)
            .where(inArray(messages.chatId, candidateChatIds))
            .groupBy(messages.chatId)
        : [];

    const chatsWithMessagesSet = new Set(
      chatsWithMessages.map((r) => r.chatId)
    );
    const preferredChats: NpcGroupChatOnboardingCandidateChat[] =
      chatsWithMessagesSet.size > 0
        ? candidateChats.filter((row) => chatsWithMessagesSet.has(row.chatId))
        : candidateChats;

    const preferredChatIds = preferredChats.map((row) => row.chatId);
    const participantCounts =
      preferredChatIds.length > 0
        ? await c
            .select({ chatId: chatParticipants.chatId, count: count() })
            .from(chatParticipants)
            .where(
              and(
                inArray(chatParticipants.chatId, preferredChatIds),
                eq(chatParticipants.isActive, true)
              )
            )
            .groupBy(chatParticipants.chatId)
        : [];

    const participantCountMap = new Map(
      participantCounts.map((row) => [row.chatId, row.count])
    );

    return {
      kind: 'ok' as const,
      userIds,
      preferredChats,
      participantCountMap,
    };
  }, 'npc-group-chat-onboarding-read');
}

export type NpcGroupChatOnboardingAssignment = {
  userId: string;
  chatId: string;
  groupId: string;
  invitedBy: string;
};

export async function npcGroupChatOnboardingWrite(
  assignments: NpcGroupChatOnboardingAssignment[],
  joinedAt: Date
): Promise<void> {
  if (assignments.length === 0) {
    return;
  }

  await asSystem(async (c) => {
    for (const a of assignments) {
      await c
        .insert(groupMembers)
        .values({
          id: await generateSnowflakeId(),
          groupId: a.groupId,
          userId: a.userId,
          role: 'member',
          addedBy: a.invitedBy,
          joinedAt,
          isActive: true,
          messageCount: 0,
          qualityScore: 1.0,
        })
        .onConflictDoUpdate({
          target: [groupMembers.groupId, groupMembers.userId],
          set: {
            isActive: true,
            role: 'member',
            addedBy: a.invitedBy,
            joinedAt,
            kickedAt: sql`NULL`,
            kickReason: sql`NULL`,
          },
        });

      await c
        .insert(chatParticipants)
        .values({
          id: await generateSnowflakeId(),
          chatId: a.chatId,
          userId: a.userId,
          joinedAt,
          invitedBy: a.invitedBy,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [chatParticipants.chatId, chatParticipants.userId],
          set: {
            isActive: true,
            joinedAt,
            invitedBy: a.invitedBy,
          },
        });
    }
  }, 'npc-group-chat-onboarding-write');
}
