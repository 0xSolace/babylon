/**
 * User Block API
 *
 * @route POST /api/users/[userId]/block - Block or unblock user
 * @route GET /api/users/[userId]/block - Check if user is blocked
 * @access Authenticated
 *
 * @description
 * Manages user blocking/unblocking. POST blocks or unblocks a user (also removes
 * follow relationships). GET checks if the current user has blocked the target user.
 *
 * @openapi
 * /api/users/{userId}/block:
 *   post:
 *     tags:
 *       - Users
 *     summary: Block or unblock user
 *     description: Blocks or unblocks a user and removes follow relationships
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user ID to block/unblock
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [block, unblock]
 *               reason:
 *                 type: string
 *                 description: Optional reason for blocking
 *     responses:
 *       200:
 *         description: Block/unblock action completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 block:
 *                   type: object
 *                   nullable: true
 *       400:
 *         description: Invalid action or already blocked/unblocked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Target user not found
 *   get:
 *     tags:
 *       - Users
 *     summary: Check if user is blocked
 *     description: Returns whether the current user has blocked the target user
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user ID to check
 *     responses:
 *       200:
 *         description: Block status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isBlocked:
 *                   type: boolean
 *                 block:
 *                   type: object
 *                   nullable: true
 *
 * @example
 * ```typescript
 * // Block user
 * await fetch(`/api/users/${userId}/block`, {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({ action: 'block', reason: 'Spam' })
 * });
 *
 * // Check block status
 * const { isBlocked } = await fetch(`/api/users/${userId}/block`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * }).then(r => r.json());
 * ```
 *
 * @see {@link /lib/moderation/filters} Moderation filters
 */

import {
  authenticate,
  BusinessLogicError,
  InternalServerError,
  NotFoundError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  deleteFollowsBetweenUsers,
  deleteUserBlockByBlockerAndBlockedReturning,
  insertUserBlockReturning,
  selectUserBlockIdByBlockerAndBlocked,
  selectUserBlockStatusSliceByBlockerAndBlocked,
  selectUserModerationTargetSliceById,
} from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { BlockUserSchema, generateSnowflakeId, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    // Authenticate the user
    const authUser = await authenticate(request);
    const { userId: targetUserId } = await context.params;

    // Parse request body
    const body = await request.json();
    const { action, reason } = BlockUserSchema.parse(body);

    logger.info(
      `User ${action} request`,
      {
        userId: authUser.userId,
        targetUserId,
        action,
      },
      'POST /api/users/[userId]/block'
    );

    // Cannot block yourself
    if (authUser.userId === targetUserId) {
      throw new BusinessLogicError(
        'Cannot block yourself',
        'CANNOT_BLOCK_SELF'
      );
    }

    return asUser(authUser, async (db) => {
      const targetUser = await selectUserModerationTargetSliceById(
        db,
        targetUserId
      );

      if (!targetUser) {
        throw new NotFoundError('User', targetUserId);
      }

      if (action === 'block') {
        const existingBlock = await selectUserBlockIdByBlockerAndBlocked(
          db,
          authUser.userId,
          targetUserId
        );

        if (existingBlock) {
          throw new BusinessLogicError(
            'User is already blocked',
            'ALREADY_BLOCKED'
          );
        }

        const blockId = await generateSnowflakeId();
        const block = await insertUserBlockReturning(db, {
          id: blockId,
          blockerId: authUser.userId,
          blockedId: targetUserId,
          reason: reason || null,
        });

        if (!block) {
          throw new InternalServerError('Failed to create block record');
        }

        await deleteFollowsBetweenUsers(db, authUser.userId, targetUserId);

        logger.info(
          'User blocked successfully',
          {
            userId: authUser.userId,
            targetUserId,
            blockId: block?.id,
          },
          'POST /api/users/[userId]/block'
        );

        return successResponse({
          success: true,
          message: 'User blocked successfully',
          block,
        });
      }

      const deleted = await deleteUserBlockByBlockerAndBlockedReturning(
        db,
        authUser.userId,
        targetUserId
      );

      if (deleted.length === 0) {
        throw new BusinessLogicError('User is not blocked', 'NOT_BLOCKED');
      }

      logger.info(
        'User unblocked successfully',
        {
          userId: authUser.userId,
          targetUserId,
        },
        'POST /api/users/[userId]/block'
      );

      return successResponse({
        success: true,
        message: 'User unblocked successfully',
      });
    });
  }
);

/**
 * GET /api/users/[userId]/block
 * Check if current user has blocked the target user
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const authUser = await authenticate(request);
    const { userId: targetUserId } = await context.params;

    return asUser(authUser, async (db) => {
      const block = await selectUserBlockStatusSliceByBlockerAndBlocked(
        db,
        authUser.userId,
        targetUserId
      );

      return successResponse({
        isBlocked: !!block,
        block: block ?? null,
      });
    });
  }
);
