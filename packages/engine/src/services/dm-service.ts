/**
 * DM Service
 *
 * Helper functions for creating and managing direct message chats.
 * Used by agent trade notifications and other system DMs.
 */

import {
  fetchDmChatLookupBetweenUsers,
  insertDmChatCreationBundle,
  insertDmServiceMessage,
  withTransaction,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';

/**
 * Get or create a DM chat between two users.
 *
 * NOTE: This function should NOT be used for agent-owner communication.
 * Agents should communicate with their owners through the Agents (team chat).
 *
 * @param userA - First user ID
 * @param userB - Second user ID
 * @returns The chat ID
 * @throws Error if trying to create DM between agent and owner
 */
export async function getOrCreateDMChat(
  userA: string,
  userB: string
): Promise<string> {
  const { userAData, userBData, existingChat } =
    await fetchDmChatLookupBetweenUsers({
      userA,
      userB,
      traceLabel: 'dm-service-pre-create-lookup',
    });

  if (userAData?.isAgent && userAData?.managedBy === userB) {
    throw new Error(
      'Agent-owner DMs are not allowed - use Agents chat instead'
    );
  }
  if (userBData?.isAgent && userBData?.managedBy === userA) {
    throw new Error(
      'Agent-owner DMs are not allowed - use Agents chat instead'
    );
  }

  if (existingChat.length > 0 && existingChat[0]) {
    return existingChat[0].chatId;
  }

  const chatId = await generateSnowflakeId();
  const now = new Date();

  try {
    await withTransaction(async (tx) => {
      await insertDmChatCreationBundle(tx, {
        chatId,
        userA,
        userB,
        now,
      });
    });

    logger.info('Created new DM chat', { chatId, userA, userB }, 'DMService');

    return chatId;
  } catch (error) {
    const isUniqueViolation =
      error instanceof Error &&
      'code' in error &&
      (error as Error & { code?: string }).code === '23505';
    if (isUniqueViolation) {
      logger.warn(
        'Race condition detected, retrying chat lookup',
        { userA, userB },
        'DMService'
      );

      const retry = await fetchDmChatLookupBetweenUsers({
        userA,
        userB,
        traceLabel: 'dm-service-retry-lookup',
      });

      if (retry.existingChat.length > 0 && retry.existingChat[0]) {
        return retry.existingChat[0].chatId;
      }
    }
    throw error;
  }
}

/**
 * Send a message to a chat.
 *
 * @param chatId - The chat ID
 * @param senderId - The sender's user ID
 * @param content - The message content
 * @returns The message ID
 */
export async function sendMessageToChat(
  chatId: string,
  senderId: string,
  content: string
): Promise<string> {
  const messageId = await generateSnowflakeId();
  const now = new Date();

  await insertDmServiceMessage({
    messageId,
    chatId,
    senderId,
    content,
    createdAt: now,
  });

  logger.debug(
    'Sent message to chat',
    { messageId, chatId, senderId },
    'DMService'
  );

  return messageId;
}
