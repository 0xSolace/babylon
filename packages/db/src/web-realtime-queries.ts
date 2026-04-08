/**
 * SQL for `apps/web` POST /api/realtime/token (channel authorization).
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { users } from './tables/user';

type RealtimeDb = DrizzleClient | Transaction;

export async function selectActiveChatParticipantChatIdsForUser(
  db: RealtimeDb,
  params: { userId: string; chatIds: string[] }
): Promise<string[]> {
  if (params.chatIds.length === 0) return [];
  const rows = await db
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.userId, params.userId),
        eq(chatParticipants.isActive, true),
        inArray(chatParticipants.chatId, params.chatIds)
      )
    );
  return rows.map((r) => r.chatId);
}

export async function selectManagedAgentIdsForOwnerInList(
  db: RealtimeDb,
  params: { ownerUserId: string; agentUserIds: string[] }
): Promise<string[]> {
  if (params.agentUserIds.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, params.agentUserIds),
        eq(users.managedBy, params.ownerUserId),
        eq(users.isAgent, true)
      )
    );
  return rows.map((r) => r.id);
}
