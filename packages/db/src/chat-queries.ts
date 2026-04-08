/**
 * Lightweight chat row reads shared across API, agents, and notifications.
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { db, type Transaction } from './db';
import { chats } from './tables/chats';

type ChatQueryDb = DrizzleClient | Transaction;

export type ChatGroupSliceRow = {
  groupId: string | null;
  isGroup: boolean;
};

export async function selectChatGroupSliceByChatId(
  dbClient: ChatQueryDb,
  chatId: string
): Promise<ChatGroupSliceRow | undefined> {
  const [row] = await dbClient
    .select({ groupId: chats.groupId, isGroup: chats.isGroup })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

export async function fetchChatNameById(
  chatId: string
): Promise<string | null> {
  const [row] = await db
    .select({ name: chats.name })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  return row?.name ?? null;
}
