/**
 * Reads/writes for `ActorSocialActions` (NPC invites / actor DMs from interaction history).
 *
 * **Why here:** `UserInteraction`, `GroupMember`, `Chat`, and `Message` SQL under `asSystem`.
 * Probabilities, templates, and `GroupChatService.recordInvite` stay in engine.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, eq, gte } from 'drizzle-orm';
import { asSystem } from './db';
import { chatParticipants } from './tables/chat-participants';
import type { Chat } from './tables/chats';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { userInteractions } from './tables/user-interactions';

export type ActorSocialRecentInteractionRow = {
  userId: string;
  npcId: string;
  qualityScore: number;
};

export async function listActorSocialRecentInteractionPairs(params: {
  since: Date;
}): Promise<ActorSocialRecentInteractionRow[]> {
  const { since } = params;

  return asSystem(
    async (c) =>
      c
        .selectDistinctOn([userInteractions.userId, userInteractions.npcId], {
          userId: userInteractions.userId,
          npcId: userInteractions.npcId,
          qualityScore: userInteractions.qualityScore,
        })
        .from(userInteractions)
        .where(gte(userInteractions.timestamp, since)),
    'actor-social-recent-interactions'
  );
}

export async function fetchUserActiveGroupMembershipForOwner(params: {
  userId: string;
  ownerId: string;
}): Promise<{ id: string } | undefined> {
  const { userId, ownerId } = params;

  const [row] = await asSystem(
    async (c) =>
      c
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .innerJoin(groups, eq(groups.id, groupMembers.groupId))
        .where(
          and(
            eq(groupMembers.userId, userId),
            eq(groupMembers.isActive, true),
            eq(groups.ownerId, ownerId)
          )
        )
        .limit(1),
    'actor-social-existing-membership'
  );

  return row;
}

export type ActorSocialDmParticipantRow = {
  chatId: string;
  participants: string;
};

export async function listActorSocialNonGroupChatParticipants(): Promise<
  ActorSocialDmParticipantRow[]
> {
  return asSystem(
    async (c) =>
      c
        .select({
          chatId: chats.id,
          participants: chatParticipants.userId,
        })
        .from(chats)
        .innerJoin(chatParticipants, eq(chatParticipants.chatId, chats.id))
        .where(eq(chats.isGroup, false)),
    'actor-social-dm-chats'
  );
}

export async function fetchActorSocialSampleContinuousGroupChat(): Promise<
  Chat | undefined
> {
  const [row] = await asSystem(
    async (c) =>
      c
        .select()
        .from(chats)
        .where(and(eq(chats.isGroup, true), eq(chats.gameId, 'continuous')))
        .limit(1),
    'actor-social-existing-game-chat'
  );

  return row;
}

export async function runActorSocialCreateDmWithMessage(params: {
  actorId: string;
  userId: string;
  messageContent: string;
  newChatSnowflakeId: string;
}): Promise<{ id: string; messageContent: string }> {
  const { actorId, userId, messageContent, newChatSnowflakeId } = params;

  return asSystem(async (c) => {
    const [existingChat] = await c
      .select()
      .from(chats)
      .where(eq(chats.id, `dm-${actorId}-${userId}`))
      .limit(1);

    let finalChatId = newChatSnowflakeId;

    if (existingChat) {
      finalChatId = existingChat.id;
    } else {
      await c.insert(chats).values({
        id: newChatSnowflakeId,
        name: null,
        isGroup: false,
        updatedAt: new Date(),
      });
    }

    const participantId1 = await generateSnowflakeId();
    const participantId2 = await generateSnowflakeId();

    const [existingParticipant1] = await c
      .select()
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.chatId, finalChatId),
          eq(chatParticipants.userId, actorId)
        )
      )
      .limit(1);

    if (!existingParticipant1) {
      await c.insert(chatParticipants).values({
        id: participantId1,
        chatId: finalChatId,
        userId: actorId,
      });
    }

    const [existingParticipant2] = await c
      .select()
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.chatId, finalChatId),
          eq(chatParticipants.userId, userId)
        )
      )
      .limit(1);

    if (!existingParticipant2) {
      await c.insert(chatParticipants).values({
        id: participantId2,
        chatId: finalChatId,
        userId,
      });
    }

    await c.insert(messages).values({
      id: await generateSnowflakeId(),
      chatId: finalChatId,
      senderId: actorId,
      content: messageContent,
    });

    return {
      id: finalChatId,
      messageContent,
    };
  }, 'actor-social-create-dm');
}
