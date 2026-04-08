/**
 * Raw SQL reads for GET /api/admin/groups (group chats + participants + messages + users + groups).
 */

import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import type { Chat } from './tables/chats';
import { chats } from './tables/chats';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { users } from './tables/user';

type GroupsAdminDb = DrizzleClient | Transaction;

export type AdminGroupParticipantSlice = {
  chatId: string;
  userId: string;
  joinedAt: Date;
};

export type AdminGroupMessageSlice = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
};

export type AdminGroupUserSlice = {
  id: string;
  username: string | null;
  displayName: string | null;
  isActor: boolean;
  profileImageUrl: string | null;
};

export type AdminGroupRowSlice = {
  id: string;
  name: string;
  createdById: string;
  ownerId: string;
  type: string;
};

export async function fetchAdminGroupsListRawData(
  db: GroupsAdminDb,
  chatSortOrder: 'asc' | 'desc'
): Promise<{
  chatsList: Chat[];
  participantsList: AdminGroupParticipantSlice[];
  messagesList: AdminGroupMessageSlice[];
  allUsers: AdminGroupUserSlice[];
  allUserGroups: AdminGroupRowSlice[];
}> {
  const chatsList = await db
    .select()
    .from(chats)
    .where(eq(chats.isGroup, true))
    .orderBy(
      chatSortOrder === 'asc' ? asc(chats.createdAt) : desc(chats.createdAt)
    );

  const chatIds = chatsList.map((c) => c.id);

  const participantsList: AdminGroupParticipantSlice[] =
    chatIds.length > 0
      ? await db
          .select({
            chatId: chatParticipants.chatId,
            userId: chatParticipants.userId,
            joinedAt: chatParticipants.joinedAt,
          })
          .from(chatParticipants)
          .where(inArray(chatParticipants.chatId, chatIds))
      : [];

  const messagesList: AdminGroupMessageSlice[] =
    chatIds.length > 0
      ? await db
          .select({
            id: messages.id,
            chatId: messages.chatId,
            senderId: messages.senderId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.chatId, chatIds))
          .orderBy(desc(messages.createdAt))
      : [];

  const allParticipantIds = [...new Set(participantsList.map((p) => p.userId))];
  const allMessageSenderIds = [...new Set(messagesList.map((m) => m.senderId))];
  const allUserIds = [
    ...new Set([...allParticipantIds, ...allMessageSenderIds]),
  ];

  const allUsers: AdminGroupUserSlice[] =
    allUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            isActor: users.isActor,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

  const allUserGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdById: groups.createdById,
      ownerId: groups.ownerId,
      type: groups.type,
    })
    .from(groups);

  return {
    chatsList,
    participantsList,
    messagesList,
    allUsers,
    allUserGroups,
  };
}
