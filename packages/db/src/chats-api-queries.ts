/**
 * SQL for GET/POST /api/chats (list + create). Callers pass a client from `asUser` / `asSystem`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type ChatParticipant,
  chatParticipants,
} from './tables/chat-participants';
import { type Chat, chats } from './tables/chats';
import { type GroupMember, groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import type { Message } from './tables/messages';
import { messages } from './tables/messages';
import { users } from './tables/user';

type ChatsApiDb = DrizzleClient | Transaction;

export type ChatWithMessageStats = Chat & {
  _messageCount: number;
  _latestMessages: Message[];
};

export async function selectContinuousGameGroupChatsWithMessageStats(
  db: ChatsApiDb
): Promise<ChatWithMessageStats[]> {
  const chatList = await db
    .select()
    .from(chats)
    .where(and(eq(chats.isGroup, true), eq(chats.gameId, 'continuous')))
    .orderBy(chats.createdAt);

  const chatIds = chatList.map((c) => c.id);
  if (chatIds.length === 0) {
    return chatList.map((chat) => ({
      ...chat,
      _messageCount: 0,
      _latestMessages: [] as Message[],
    }));
  }

  const messageCountResults = await db
    .select({
      chatId: messages.chatId,
      count: count(messages.id),
    })
    .from(messages)
    .where(inArray(messages.chatId, chatIds))
    .groupBy(messages.chatId);

  const countMap = new Map(
    messageCountResults.map((mc) => [mc.chatId, mc.count])
  );

  const latestMessages = await Promise.all(
    chatIds.map(async (chatId) => {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      return { chatId, messages: msgs };
    })
  );

  const messagesMap = new Map(
    latestMessages.map(({ chatId, messages: msgs }) => [chatId, msgs])
  );

  return chatList.map((chat) => ({
    ...chat,
    _messageCount: countMap.get(chat.id) ?? 0,
    _latestMessages: messagesMap.get(chat.id) || [],
  }));
}

export type UserChatsListRawData = {
  filteredMemberships: GroupMember[];
  filteredGroupChatsForAccess: Chat[];
  groupIdToChatId: Map<string | null, string>;
  chatDetailsMap: Map<string, Chat>;
  groupMessagesMap: Map<string, Message[]>;
  dmParticipantsList: ChatParticipant[];
  dmChatsDetails: Chat[];
  participantsByChatId: Map<string, ChatParticipant[]>;
  messagesByChatId: Map<string, Message[]>;
};

export async function selectUserChatsListRawData(
  db: ChatsApiDb,
  params: {
    userId: string;
    gatedChatId: string | undefined;
    canAccessNftGatedChat: boolean;
  }
): Promise<UserChatsListRawData> {
  const { userId, gatedChatId, canAccessNftGatedChat } = params;

  const teamGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.type, 'team'), eq(groups.ownerId, userId)));
  const teamGroupIds = new Set(teamGroups.map((g) => g.id));

  const memberships = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.userId, userId), eq(groupMembers.isActive, true))
    )
    .orderBy(desc(groupMembers.lastMessageAt));

  const gatedChatGroupId =
    gatedChatId && canAccessNftGatedChat === false
      ? (
          await db
            .select({ groupId: chats.groupId })
            .from(chats)
            .where(eq(chats.id, gatedChatId))
            .limit(1)
        )[0]?.groupId
      : undefined;

  const filteredMemberships =
    gatedChatGroupId && canAccessNftGatedChat === false
      ? memberships.filter((m) => m.groupId !== gatedChatGroupId)
      : memberships;

  const groupIds = filteredMemberships.map((m) => m.groupId);
  const groupChatsWithGroupId =
    groupIds.length > 0
      ? await db.select().from(chats).where(inArray(chats.groupId, groupIds))
      : [];

  const filteredGroupChats =
    teamGroupIds.size > 0
      ? groupChatsWithGroupId.filter(
          (c) => !c.groupId || !teamGroupIds.has(c.groupId)
        )
      : groupChatsWithGroupId;

  const filteredGroupChatsForAccess =
    gatedChatId && canAccessNftGatedChat === false
      ? filteredGroupChats.filter((c) => c.id !== gatedChatId)
      : filteredGroupChats;

  const groupChatIds = filteredGroupChatsForAccess.map((c) => c.id);
  const groupIdToChatId = new Map(
    filteredGroupChatsForAccess.map((c) => [c.groupId, c.id])
  );
  const chatDetailsMap = new Map(
    filteredGroupChatsForAccess.map((c) => [c.id, c])
  );

  const groupChatMessages = await Promise.all(
    groupChatIds.map(async (chatId) => {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      return { chatId, messages: msgs };
    })
  );
  const groupMessagesMap = new Map(
    groupChatMessages.map(({ chatId, messages: msgs }) => [chatId, msgs])
  );

  const dmParticipantsList = await db
    .select()
    .from(chatParticipants)
    .where(eq(chatParticipants.userId, userId));

  const dmChatIds = dmParticipantsList.map((p) => p.chatId);
  const dmChatsDetails =
    dmChatIds.length > 0
      ? await db
          .select()
          .from(chats)
          .where(and(inArray(chats.id, dmChatIds), eq(chats.isGroup, false)))
      : [];

  const [allParticipants, allMessages] = await Promise.all([
    dmChatIds.length > 0
      ? db
          .select()
          .from(chatParticipants)
          .where(inArray(chatParticipants.chatId, dmChatIds))
      : Promise.resolve([] as ChatParticipant[]),
    dmChatIds.length > 0
      ? Promise.all(
          dmChatIds.map(async (chatId) => {
            const msgs = await db
              .select()
              .from(messages)
              .where(eq(messages.chatId, chatId))
              .orderBy(desc(messages.createdAt))
              .limit(1);
            return { chatId, messages: msgs };
          })
        )
      : Promise.resolve([] as Array<{ chatId: string; messages: Message[] }>),
  ]);

  const participantsByChatId = new Map<string, ChatParticipant[]>();
  for (const p of allParticipants) {
    const list = participantsByChatId.get(p.chatId) ?? [];
    list.push(p);
    participantsByChatId.set(p.chatId, list);
  }

  const messagesByChatId = new Map<string, Message[]>();
  for (const { chatId, messages: msgs } of allMessages) {
    messagesByChatId.set(chatId, msgs);
  }

  return {
    filteredMemberships,
    filteredGroupChatsForAccess,
    groupIdToChatId,
    chatDetailsMap,
    groupMessagesMap,
    dmParticipantsList,
    dmChatsDetails,
    participantsByChatId,
    messagesByChatId,
  };
}

export type DmPeerUserSlice = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
  isAgent: boolean;
  managedBy: string | null;
};

export async function selectUserSliceForDmPeer(
  db: ChatsApiDb,
  peerUserId: string
): Promise<DmPeerUserSlice | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
      isAgent: users.isAgent,
      managedBy: users.managedBy,
    })
    .from(users)
    .where(eq(users.id, peerUserId))
    .limit(1);

  return row;
}

export type MessageReplyPreviewRow = {
  id: string;
  content: string;
  senderId: string;
  senderName: string | null;
};

/** Reply target in the same chat (for POST /api/chats/[id]/message). */
export async function selectMessageReplyPreviewForChat(
  db: ChatsApiDb,
  params: { messageId: string; chatId: string }
): Promise<MessageReplyPreviewRow | undefined> {
  const [row] = await db
    .select({
      id: messages.id,
      content: messages.content,
      senderId: messages.senderId,
      senderName: users.displayName,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .where(
      and(eq(messages.id, params.messageId), eq(messages.chatId, params.chatId))
    )
    .limit(1);

  return row;
}

export async function insertChatCreatedByUser(
  db: ChatsApiDb,
  params: {
    creatorUserId: string;
    name: string | null;
    isGroup: boolean;
    participantIds: string[];
    requiredNftContractAddress: string | null;
    requiredNftTokenId: number | null;
    requiredNftChainId: number | null;
  }
): Promise<Chat> {
  const now = new Date();
  const nftGated = !!params.requiredNftContractAddress;
  const [newChat] = await db
    .insert(chats)
    .values({
      id: await generateSnowflakeId(),
      name: params.name,
      isGroup: params.isGroup || false,
      createdAt: now,
      updatedAt: now,
      requiredNftContractAddress: params.requiredNftContractAddress,
      requiredNftTokenId: params.requiredNftTokenId ?? null,
      requiredNftChainId: params.requiredNftChainId ?? null,
      nftGated,
    })
    .returning();

  if (!newChat) {
    throw new Error('Failed to create chat');
  }

  await db.insert(chatParticipants).values({
    id: await generateSnowflakeId(),
    chatId: newChat.id,
    userId: params.creatorUserId,
  });

  for (const participantId of params.participantIds) {
    await db.insert(chatParticipants).values({
      id: await generateSnowflakeId(),
      chatId: newChat.id,
      userId: participantId,
    });
  }

  return newChat;
}
