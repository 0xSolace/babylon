/**
 * SQL for /api/chats/[id]/messages/[messageId]/reactions (read + toggle).
 */

import { and, count, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { type Chat, chats } from './tables/chats';
import { messageReactions } from './tables/message-reactions';
import { messages } from './tables/messages';

type ReactionDb = DrizzleClient | Transaction;

export async function selectChatRowByIdForReaction(
  db: ReactionDb,
  chatId: string
): Promise<Chat | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

/** Any participant row (route does not filter on isActive). */
export async function selectChatParticipantRowForReactionAccess(
  db: ReactionDb,
  chatId: string,
  userId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: chatParticipants.id })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    )
    .limit(1);
  return row;
}

export async function selectMessageIdInChatForReaction(
  db: ReactionDb,
  messageId: string,
  chatId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
    .limit(1);
  return row;
}

export type MessageReactionSummaryEntry = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export async function selectMessageReactionSummaryForViewer(
  db: ReactionDb,
  messageId: string,
  currentUserId: string
): Promise<MessageReactionSummaryEntry[]> {
  const [countsByEmoji, myEmojis] = await Promise.all([
    db
      .select({
        emoji: messageReactions.emoji,
        count: count(),
      })
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .groupBy(messageReactions.emoji),
    db
      .select({ emoji: messageReactions.emoji })
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, currentUserId)
        )
      ),
  ]);

  const myEmojiSet = new Set(myEmojis.map((r) => r.emoji));
  return countsByEmoji
    .map((r) => ({
      emoji: r.emoji,
      count: Number(r.count ?? 0),
      reactedByMe: myEmojiSet.has(r.emoji),
    }))
    .filter((r) => r.count > 0);
}

export async function selectMessageReactionIdForUserEmoji(
  db: ReactionDb,
  params: { messageId: string; userId: string; emoji: string }
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: messageReactions.id })
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, params.messageId),
        eq(messageReactions.userId, params.userId),
        eq(messageReactions.emoji, params.emoji)
      )
    )
    .limit(1);
  return row;
}

export async function insertChatMessageReactionRow(
  db: ReactionDb,
  row: {
    id: string;
    chatId: string;
    messageId: string;
    userId: string;
    emoji: string;
  }
): Promise<void> {
  await db.insert(messageReactions).values(row);
}

export async function deleteMessageReactionById(
  db: ReactionDb,
  reactionId: string
): Promise<void> {
  await db.delete(messageReactions).where(eq(messageReactions.id, reactionId));
}
