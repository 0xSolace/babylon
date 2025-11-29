/**
 * Chat Elysia Type Schemas
 *
 * Schemas for chat-related API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

/**
 * Chat participant
 */
export const ChatParticipantSchema = t.Object({
  id: SnowflakeId,
  userId: SnowflakeId,
  username: t.Nullable(t.String()),
  displayName: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  isActor: t.Boolean(),
  joinedAt: ISODateString,
});

/**
 * Chat message
 */
export const ChatMessageSchema = t.Object({
  id: SnowflakeId,
  chatId: SnowflakeId,
  senderId: SnowflakeId,
  senderUsername: t.Nullable(t.String()),
  senderDisplayName: t.Nullable(t.String()),
  senderProfileImageUrl: t.Nullable(URLString),
  senderIsActor: t.Boolean(),
  content: t.String(),
  createdAt: ISODateString,
  updatedAt: t.Optional(ISODateString),
  isEdited: t.Boolean(),
  replyToId: t.Nullable(SnowflakeId),
});

/**
 * Chat summary
 */
export const ChatSummarySchema = t.Object({
  id: SnowflakeId,
  name: t.Nullable(t.String()),
  isGroup: t.Boolean(),
  createdAt: ISODateString,
  updatedAt: ISODateString,
  lastMessageAt: t.Nullable(ISODateString),
  lastMessageContent: t.Nullable(t.String()),
  lastMessageSenderId: t.Nullable(SnowflakeId),
  unreadCount: t.Number(),
  participants: t.Array(ChatParticipantSchema),
  participantCount: t.Number(),
});

/**
 * List chats response
 */
export const ListChatsResponseSchema = t.Object({
  groupChats: t.Array(ChatSummarySchema),
  directChats: t.Array(ChatSummarySchema),
  total: t.Number(),
});

/**
 * Create chat request
 */
export const CreateChatRequestSchema = t.Object({
  name: t.Optional(t.String({ maxLength: 100 })),
  isGroup: t.Optional(t.Boolean({ default: false })),
  participantIds: t.Array(SnowflakeId),
});

/**
 * Create DM request
 */
export const CreateDMRequestSchema = t.Object({
  userId: SnowflakeId,
});

/**
 * Send message request
 */
export const SendMessageRequestSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: 5000 }),
  replyToId: t.Optional(SnowflakeId),
});

/**
 * Chat messages query
 */
export const ChatMessagesQuerySchema = t.Object({
  limit: t.Optional(t.Number({ default: 50, maximum: 100 })),
  before: t.Optional(t.String()),
  after: t.Optional(t.String()),
});

/**
 * Chat messages response
 */
export const ChatMessagesResponseSchema = t.Object({
  success: t.Boolean(),
  messages: t.Array(ChatMessageSchema),
  hasMore: t.Boolean(),
  cursor: t.Optional(t.Nullable(t.String())),
});

/**
 * Unread count response
 */
export const UnreadCountResponseSchema = t.Object({
  unreadCount: t.Number(),
  unreadChats: t.Array(
    t.Object({
      chatId: SnowflakeId,
      count: t.Number(),
    })
  ),
});

