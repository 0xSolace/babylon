/**
 * Drizzle selects for GET /api/admin/debug-dm (chats / participants / messages by chat ids).
 */

import { desc, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { messages } from './tables/messages';

type DebugDmDb = DrizzleClient | Transaction;

export async function selectChatsByIdsForAdminDebug(
  db: DebugDmDb,
  chatIds: string[]
) {
  if (chatIds.length === 0) {
    return [];
  }
  return db.select().from(chats).where(inArray(chats.id, chatIds));
}

export async function selectChatParticipantsByChatIdsForAdminDebug(
  db: DebugDmDb,
  chatIds: string[]
) {
  if (chatIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(chatParticipants)
    .where(inArray(chatParticipants.chatId, chatIds));
}

export async function selectMessagesByChatIdsForAdminDebug(
  db: DebugDmDb,
  chatIds: string[]
) {
  if (chatIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(messages)
    .where(inArray(messages.chatId, chatIds))
    .orderBy(desc(messages.createdAt));
}
