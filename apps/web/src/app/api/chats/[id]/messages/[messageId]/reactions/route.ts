/**
 * Chat Message Reactions API
 *
 * @route POST /api/chats/[id]/messages/[messageId]/reactions
 * @route DELETE /api/chats/[id]/messages/[messageId]/reactions?emoji=...
 */

import {
  AuthorizationError,
  authenticate,
  BusinessLogicError,
  broadcastChatMessageReaction,
  checkRateLimitAsync,
  NotFoundError,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { requireNftChatAccess } from '@babylon/api/services/nft-chat-gating-service';
import {
  deleteMessageReactionById,
  insertChatMessageReactionRow,
  selectChatParticipantRowForReactionAccess,
  selectChatRowByIdForReaction,
  selectMessageIdInChatForReaction,
  selectMessageReactionIdForUserEmoji,
  selectMessageReactionSummaryForViewer,
} from '@babylon/db';
import { asSystem, asUser } from '@babylon/db/engine-storage';
import {
  ALLOWED_REACTION_EMOJI_SET,
  ChatMessageReactionCreateSchema,
  generateSnowflakeId,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

async function requireChatAccess(
  user: Awaited<ReturnType<typeof authenticate>>,
  chatId: string
) {
  const chat = await asSystem(
    (db) => selectChatRowByIdForReaction(db, chatId),
    'get-chat-for-reaction'
  );
  if (!chat) throw new NotFoundError('Chat', chatId);

  const isMember = await asUser(user, async (db) =>
    selectChatParticipantRowForReactionAccess(db, chatId, user.userId)
  );
  if (!isMember) {
    throw new AuthorizationError(
      'You do not have access to this chat',
      'chat',
      'read'
    );
  }

  await requireNftChatAccess(user, chatId);
}

async function requireMessageInChat(chatId: string, messageId: string) {
  const msg = await asSystem(
    (db) => selectMessageIdInChatForReaction(db, messageId, chatId),
    'get-message-for-reaction'
  );
  if (!msg) throw new NotFoundError('Message', messageId);
}

async function getReactionSummary(messageId: string, currentUserId: string) {
  return asSystem(
    (db) => selectMessageReactionSummaryForViewer(db, messageId, currentUserId),
    'get-message-reaction-summary'
  );
}

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; messageId: string }> }
  ) => {
    const user = await authenticate(request);

    // Rate-limit reaction toggles (30 per minute per user)
    const rl = await checkRateLimitAsync(
      user.userId,
      RATE_LIMIT_CONFIGS.REACTION_TOGGLE
    );
    if (!rl.allowed) return rateLimitError(rl.retryAfter);

    const { id: chatId, messageId } = await context.params;

    const body = await request.json();
    const { emoji } = ChatMessageReactionCreateSchema.parse(body);

    if (!ALLOWED_REACTION_EMOJI_SET.has(emoji)) {
      throw new BusinessLogicError(
        'Unsupported reaction emoji',
        'UNSUPPORTED_REACTION_EMOJI'
      );
    }

    await requireChatAccess(user, chatId);
    await requireMessageInChat(chatId, messageId);

    const existing = await asSystem(
      (db) =>
        selectMessageReactionIdForUserEmoji(db, {
          messageId,
          userId: user.userId,
          emoji,
        }),
      'check-existing-message-reaction'
    );

    if (!existing) {
      await asUser(user, async (db) => {
        await insertChatMessageReactionRow(db, {
          id: await generateSnowflakeId(),
          chatId,
          messageId,
          userId: user.userId,
          emoji,
        });
      });

      await broadcastChatMessageReaction(chatId, {
        messageId,
        chatId,
        emoji,
        userId: user.userId,
        action: 'added',
      });
    }

    const reactions = await getReactionSummary(messageId, user.userId);
    return successResponse({ messageId, reactions });
  }
);

export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; messageId: string }> }
  ) => {
    const user = await authenticate(request);

    // Rate-limit reaction toggles (30 per minute per user)
    const rl = await checkRateLimitAsync(
      user.userId,
      RATE_LIMIT_CONFIGS.REACTION_TOGGLE
    );
    if (!rl.allowed) return rateLimitError(rl.retryAfter);

    const { id: chatId, messageId } = await context.params;

    const { searchParams } = new URL(request.url);
    const emoji = searchParams.get('emoji');
    if (!emoji) {
      throw new BusinessLogicError('emoji is required', 'EMOJI_REQUIRED');
    }
    if (!ALLOWED_REACTION_EMOJI_SET.has(emoji)) {
      throw new BusinessLogicError(
        'Unsupported reaction emoji',
        'UNSUPPORTED_REACTION_EMOJI'
      );
    }

    await requireChatAccess(user, chatId);
    await requireMessageInChat(chatId, messageId);

    const existing = await asSystem(
      (db) =>
        selectMessageReactionIdForUserEmoji(db, {
          messageId,
          userId: user.userId,
          emoji,
        }),
      'check-existing-message-reaction-delete'
    );

    if (existing) {
      await asUser(user, async (db) => {
        await deleteMessageReactionById(db, existing.id);
      });

      await broadcastChatMessageReaction(chatId, {
        messageId,
        chatId,
        emoji,
        userId: user.userId,
        action: 'removed',
      });
    }

    const reactions = await getReactionSummary(messageId, user.userId);
    return successResponse({ messageId, reactions });
  }
);
