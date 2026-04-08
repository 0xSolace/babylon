/**
 * SQL for GET /api/chats/[id] (chat + paginated messages + reaction aggregates).
 */

import { and, count, desc, eq, inArray, lt } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type ChatParticipant,
  chatParticipants,
} from './tables/chat-participants';
import { type Chat, chats } from './tables/chats';
import { messageReactions } from './tables/message-reactions';
import type { Message } from './tables/messages';
import { messages } from './tables/messages';
import { users } from './tables/user';

type ChatDetailDb = DrizzleClient | Transaction;

export async function selectChatRowById(
  db: ChatDetailDb,
  chatId: string
): Promise<Chat | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

/** Any participant row (no isActive filter), for read access checks. */
export async function selectChatParticipantRowForChatReadAccess(
  db: ChatDetailDb,
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

export async function selectChatParticipantsByChatId(
  db: ChatDetailDb,
  chatId: string
): Promise<ChatParticipant[]> {
  return db
    .select()
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, chatId));
}

export async function selectMessagesPageForChatDetail(
  db: ChatDetailDb,
  params: {
    chatId: string;
    /** Message id used as cursor; when missing, first page. */
    cursorMessageId: string | null;
    /** Request limit + 1 for hasMore detection. */
    pageSize: number;
  }
): Promise<Message[]> {
  const { chatId, cursorMessageId, pageSize } = params;

  if (cursorMessageId) {
    const [cursorMessage] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, cursorMessageId))
      .limit(1);

    if (cursorMessage) {
      return db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, chatId),
            lt(messages.createdAt, cursorMessage.createdAt)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(pageSize);
    }
  }

  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(pageSize);
}

export type ChatParticipantUserDisplaySlice = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  isAgent: boolean;
  managedBy: string | null;
};

export async function selectUserDisplaySlicesByIds(
  db: ChatDetailDb,
  userIds: string[]
): Promise<ChatParticipantUserDisplaySlice[]> {
  if (userIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      profileImageUrl: users.profileImageUrl,
      isAgent: users.isAgent,
      managedBy: users.managedBy,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export type MessageReactionCountRow = {
  messageId: string;
  emoji: string;
  count: number;
};

export async function selectMessageReactionCountsGrouped(
  db: ChatDetailDb,
  messageIds: string[]
): Promise<MessageReactionCountRow[]> {
  if (messageIds.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      count: count(),
    })
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds))
    .groupBy(messageReactions.messageId, messageReactions.emoji);

  return rows.map((r) => ({
    messageId: r.messageId,
    emoji: r.emoji,
    count: Number(r.count ?? 0),
  }));
}

export type UserReactionOnMessageRow = {
  messageId: string;
  emoji: string;
};

export async function selectUserReactionsOnMessages(
  db: ChatDetailDb,
  messageIds: string[],
  userId: string
): Promise<UserReactionOnMessageRow[]> {
  if (messageIds.length === 0) {
    return [];
  }
  return db
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
    })
    .from(messageReactions)
    .where(
      and(
        inArray(messageReactions.messageId, messageIds),
        eq(messageReactions.userId, userId)
      )
    );
}

export type ReplyTargetMessageRow = {
  id: string;
  content: string;
  senderId: string;
};

export async function selectReplyTargetMessagesInChat(
  db: ChatDetailDb,
  params: { messageIds: string[]; chatId: string }
): Promise<ReplyTargetMessageRow[]> {
  if (params.messageIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: messages.id,
      content: messages.content,
      senderId: messages.senderId,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.id, params.messageIds),
        eq(messages.chatId, params.chatId)
      )
    );
}
