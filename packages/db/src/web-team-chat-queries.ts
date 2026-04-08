/**
 * SQL for `apps/web` agents team-chat routes (reply preview, destructive reset).
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { users } from './tables/user';

type TeamChatDb = DrizzleClient | Transaction;

export async function selectTeamChatReplyMessageWithSenderDisplayName(
  db: TeamChatDb,
  params: { messageId: string; chatId: string }
): Promise<
  | {
      id: string;
      content: string;
      senderId: string;
      senderName: string | null;
    }
  | undefined
> {
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

/**
 * Deletes all chats in the group (messages, participants, chats), then group
 * members and the group row. Matches legacy `DELETE /api/agents/team-chat`.
 */
export async function deleteTeamChatGroupCascadeInTx(
  tx: TeamChatDb,
  groupId: string
): Promise<void> {
  const allChatsInGroup = await tx
    .select({ id: chats.id })
    .from(chats)
    .where(eq(chats.groupId, groupId));
  const chatIds = allChatsInGroup.map((c) => c.id);

  if (chatIds.length > 0) {
    await tx.delete(messages).where(inArray(messages.chatId, chatIds));
    await tx
      .delete(chatParticipants)
      .where(inArray(chatParticipants.chatId, chatIds));
    await tx.delete(chats).where(inArray(chats.id, chatIds));
  }

  await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await tx.delete(groups).where(eq(groups.id, groupId));
}
