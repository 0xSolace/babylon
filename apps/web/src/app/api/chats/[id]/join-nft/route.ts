/**
 * Join NFT-Gated Chat API
 *
 * @route POST /api/chats/[id]/join-nft - Join an NFT-gated chat
 * @access Authenticated
 *
 * @description
 * Allows users to join an NFT-gated chat if they hold the required NFT.
 * Verifies NFT ownership before adding the user as a participant.
 */

import {
  authenticate,
  BusinessLogicError,
  NFTVerificationService,
  NotFoundError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  applyNftGatedChatUserSelfJoin,
  insertNftGatedChatSystemJoinMessage,
  isUniqueConstraintError,
  selectActiveChatParticipantForNftJoin,
  selectChatRowByIdForNftJoin,
  selectUserJoinAnnouncementSlice,
  selectUserWalletAddressRowForNftJoin,
  toDatabaseErrorType,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

/**
 * POST /api/chats/[id]/join-nft
 * Join an NFT-gated chat by verifying NFT ownership
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await authenticate(request);
    const { id: chatId } = await context.params;

    if (!chatId) {
      throw new BusinessLogicError('Chat ID is required', 'CHAT_ID_REQUIRED');
    }

    const chat = await asUser(user.userId, async (tx) =>
      selectChatRowByIdForNftJoin(tx, chatId)
    );

    if (!chat) {
      throw new NotFoundError('Chat', chatId);
    }

    if (!chat.nftGated || !chat.requiredNftContractAddress) {
      throw new BusinessLogicError(
        'This chat is not NFT-gated',
        'NOT_NFT_GATED'
      );
    }

    const existingParticipant = await asUser(user.userId, async (tx) =>
      selectActiveChatParticipantForNftJoin(tx, chatId, user.userId)
    );

    if (existingParticipant) {
      return successResponse({
        success: true,
        message: 'Already a member of this chat',
        alreadyMember: true,
      });
    }

    const userData = await asUser(user.userId, async (tx) =>
      selectUserWalletAddressRowForNftJoin(tx, user.userId)
    );

    if (!userData?.walletAddress) {
      throw new BusinessLogicError(
        'You need to connect a wallet to join NFT-gated chats',
        'WALLET_REQUIRED'
      );
    }

    // Invalidate cache and verify NFT ownership with fresh check
    await NFTVerificationService.invalidateOwnershipCache(
      userData.walletAddress,
      chat.requiredNftContractAddress,
      chat.requiredNftChainId ?? undefined
    );

    const verification = await NFTVerificationService.verifyChatAccess(
      userData.walletAddress,
      chat.requiredNftContractAddress,
      chat.requiredNftTokenId ?? null,
      chat.requiredNftChainId ?? undefined
    );

    if (!verification.canAccess) {
      throw new BusinessLogicError(
        verification.reason ??
          'You do not own the required NFT to join this chat',
        'NFT_REQUIRED'
      );
    }

    // Add user to chat using transaction for atomicity
    const now = new Date();

    try {
      await asUser(user.userId, async (tx) => {
        await applyNftGatedChatUserSelfJoin(tx, {
          chatId,
          userId: user.userId,
          groupId: chat.groupId,
          now,
        });
      });
    } catch (error) {
      // Handle race condition - if user was already added by concurrent request
      // Check for PostgreSQL unique constraint violation (code 23505)
      if (isUniqueConstraintError(toDatabaseErrorType(error))) {
        return successResponse({
          success: true,
          message: 'Already a member of this chat',
          alreadyMember: true,
        });
      }
      throw error;
    }

    const joiningUser = await asUser(user.userId, async (tx) =>
      selectUserJoinAnnouncementSlice(tx, user.userId)
    );
    const joinerName =
      joiningUser?.displayName || joiningUser?.username || 'Someone';

    const messageId = await generateSnowflakeId();
    await asUser(user.userId, async (tx) => {
      await insertNftGatedChatSystemJoinMessage(tx, {
        id: messageId,
        chatId,
        content: `${joinerName} joined the group`,
        createdAt: now,
      });
    });

    logger.info(
      'User joined NFT-gated chat',
      {
        userId: user.userId,
        chatId,
        contractAddress: chat.requiredNftContractAddress,
      },
      'POST /api/chats/[id]/join-nft'
    );

    return successResponse({
      success: true,
      message: 'Successfully joined the chat',
      chat: {
        id: chat.id,
        name: chat.name,
        nftGated: true,
        contractAddress: chat.requiredNftContractAddress,
        tokenId: chat.requiredNftTokenId,
        chainId: chat.requiredNftChainId,
      },
    });
  }
);
