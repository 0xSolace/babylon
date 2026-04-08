/**
 * Direct-message chat lookup and inserts for `dm-service` (system DMs, trade notifications).
 *
 * **Why here:** Joins on `users` / `Chat` / `ChatParticipant` / `DMAcceptance` / `Message` stay under `asSystem` or explicit transactions.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { aliasedTable, and, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { dmAcceptances } from './tables/dm-acceptances';
import { messages } from './tables/messages';
import { users } from './tables/user';

type DbLike = DrizzleClient | Transaction;

export type DmUserAgentSlice = {
  isAgent: boolean;
  managedBy: string | null;
};

export async function fetchDmChatLookupBetweenUsers(params: {
  userA: string;
  userB: string;
  traceLabel: 'dm-service-pre-create-lookup' | 'dm-service-retry-lookup';
}): Promise<{
  userAData: DmUserAgentSlice | undefined;
  userBData: DmUserAgentSlice | undefined;
  existingChat: { chatId: string }[];
}> {
  const { userA, userB, traceLabel } = params;
  const otherParticipants = aliasedTable(chatParticipants, 'cp_other');

  return asSystem(async (c) => {
    const [userAInfo, userBInfo] = await Promise.all([
      c
        .select({ isAgent: users.isAgent, managedBy: users.managedBy })
        .from(users)
        .where(eq(users.id, userA))
        .limit(1),
      c
        .select({ isAgent: users.isAgent, managedBy: users.managedBy })
        .from(users)
        .where(eq(users.id, userB))
        .limit(1),
    ]);

    const existing = await c
      .select({ chatId: chatParticipants.chatId })
      .from(chatParticipants)
      .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
      .innerJoin(
        otherParticipants,
        eq(chatParticipants.chatId, otherParticipants.chatId)
      )
      .where(
        and(
          eq(chatParticipants.userId, userA),
          eq(chatParticipants.isActive, true),
          eq(chats.isGroup, false),
          eq(otherParticipants.userId, userB),
          eq(otherParticipants.isActive, true)
        )
      )
      .limit(1);

    return {
      userAData: userAInfo[0],
      userBData: userBInfo[0],
      existingChat: existing,
    };
  }, traceLabel);
}

export async function insertDmChatCreationBundle(
  tx: DbLike,
  params: {
    chatId: string;
    userA: string;
    userB: string;
    now: Date;
  }
): Promise<void> {
  const { chatId, userA, userB, now } = params;

  await tx.insert(chats).values({
    id: chatId,
    isGroup: false,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(chatParticipants).values([
    {
      id: await generateSnowflakeId(),
      chatId,
      userId: userA,
      joinedAt: now,
      isActive: true,
    },
    {
      id: await generateSnowflakeId(),
      chatId,
      userId: userB,
      joinedAt: now,
      isActive: true,
    },
  ]);

  await tx.insert(dmAcceptances).values({
    id: await generateSnowflakeId(),
    chatId,
    userId: userB,
    otherUserId: userA,
    status: 'accepted',
    createdAt: now,
    acceptedAt: now,
  });
}

export async function insertDmServiceMessage(params: {
  messageId: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}): Promise<void> {
  const { messageId, chatId, senderId, content, createdAt } = params;

  await asSystem(
    async (c) =>
      c.insert(messages).values({
        id: messageId,
        chatId,
        senderId,
        content,
        createdAt,
      }),
    'dm-service-send-message'
  );
}
