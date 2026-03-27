/**
 * NFT Group Service
 *
 * @module api/services/nft-group-service
 *
 * @description
 * Shared utilities for managing NFT-gated group chats, including user removal
 * and membership management.
 */

import {
  applyRevokeNftGatedChatMembership,
  fetchChatNameById,
} from '@babylon/db';
import { db } from '@babylon/db/runtime';
import { logger } from '@babylon/shared';

import { notifyNftAccessRevoked } from './notification-service';

/**
 * Remove a user from an NFT-gated chat and optionally mark their group membership as inactive.
 * Uses a transaction to ensure atomicity of the operation.
 * Also sends a notification to the user about their removal.
 *
 * @param chatId - The ID of the chat to remove the user from
 * @param groupId - The ID of the linked group (null if no group)
 * @param userId - The ID of the user to remove
 * @param reason - The reason for removal (e.g., "No longer owns required NFT")
 */
export async function removeUserFromNftChat(
  chatId: string,
  groupId: string | null,
  userId: string,
  reason: string
): Promise<void> {
  // Get chat name for notification before removal
  let chatName = 'NFT-gated chat';
  try {
    const name = await fetchChatNameById(chatId);
    if (name) chatName = name;
  } catch {
    // Continue with default name if lookup fails
  }

  await db.transaction(async (tx) => {
    await applyRevokeNftGatedChatMembership(tx, {
      userId,
      chatId,
      groupId,
      reason,
    });
  });

  // Send notification to user about their removal (non-blocking)
  try {
    await notifyNftAccessRevoked(userId, chatId, chatName, reason);
  } catch (error) {
    // Log but don't fail the removal if notification fails
    logger.warn(
      'Failed to send NFT access revoked notification',
      {
        userId,
        chatId,
        error: error instanceof Error ? error.message : String(error),
      },
      'NFTGroupService'
    );
  }
}
