/**
 * User Account Deletion API
 *
 * @route POST /api/users/delete-account - Delete user account
 * @access Authenticated
 *
 * @description
 * Permanently deletes user account and associated data (GDPR right to erasure).
 * Performs cascading deletion of user data while preserving anonymized data for
 * analytics. Includes blockchain data notice for on-chain registered users.
 *
 * @openapi
 * /api/users/delete-account:
 *   post:
 *     tags:
 *       - Users
 *     summary: Delete user account
 *     description: Permanently deletes user account and data (GDPR compliance)
 *     security:
 *       - PrivyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmation
 *             properties:
 *               confirmation:
 *                 type: string
 *                 enum: [DELETE MY ACCOUNT]
 *                 description: Confirmation text required for deletion
 *               reason:
 *                 type: string
 *                 description: Optional reason for deletion
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deleted_data:
 *                   type: object
 *                 blockchain_notice:
 *                   type: object
 *                   nullable: true
 *                 important_notes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid confirmation text
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *
 * @example
 * ```typescript
 * await fetch('/api/users/delete-account', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     confirmation: 'DELETE MY ACCOUNT',
 *     reason: 'Privacy concerns'
 *   })
 * });
 * ```
 *
 * @see GDPR Article 17 - Right to erasure
 */

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { deleteUserAccountById } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const DeleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
  reason: z.string().optional(),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  const body = await request.json();
  const { reason } = DeleteAccountSchema.parse(body);

  logger.info(
    'User requested account deletion',
    { userId, reason: reason || 'No reason provided' },
    'POST /api/users/delete-account'
  );

  const deleteOutcome = await asSystem(
    async (db) => deleteUserAccountById(db, userId),
    'delete-account'
  );

  if (deleteOutcome.ok) {
    logger.info(
      'User account deleted successfully',
      { userId, username: deleteOutcome.user.username },
      'POST /api/users/delete-account'
    );
  }

  if (!deleteOutcome.ok) {
    return successResponse({ error: 'User not found' }, 404);
  }

  const user = deleteOutcome.user;

  const blockchainNotice = user.onChainRegistered
    ? {
        blockchain_data_notice:
          'Your on-chain data (wallet address, NFT token ID, transaction history) is permanently recorded on the blockchain and cannot be deleted. It will remain publicly visible.',
        wallet_address: user.walletAddress,
        nft_token_id: user.nftTokenId,
      }
    : null;

  return successResponse({
    success: true,
    message: 'Your account has been permanently deleted.',
    deleted_data: {
      user_id: userId,
      username: user.username,
      deletion_time: new Date().toISOString(),
    },
    ...(blockchainNotice ? { blockchain_notice: blockchainNotice } : {}),
    important_notes: [
      'Your account and personal data have been deleted from our servers.',
      'Some anonymized data may be retained for analytics and AI training.',
      'Blockchain data (if any) remains permanently on the blockchain and cannot be deleted.',
      'If you registered via email, you may need to contact our authentication provider (Privy) to delete your auth account separately.',
    ],
  });
});
