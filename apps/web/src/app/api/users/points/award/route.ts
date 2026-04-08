/**
 * Points Award API
 *
 * @route POST /api/users/points/award - Award points to user
 * @access Internal/System
 *
 * @description
 * Awards points to users for achievements and milestones. Creates balance
 * transaction records for transparency. Used internally by points service.
 *
 * @openapi
 * /api/users/points/award:
 *   post:
 *     tags:
 *       - Users
 *     summary: Award points to user
 *     description: Awards points to a user and creates transaction record (internal use)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - points
 *               - reason
 *             properties:
 *               userId:
 *                 type: string
 *               points:
 *                 type: number
 *               reason:
 *                 type: string
 *                 enum: [profile_completion, farcaster_link, twitter_link, wallet_connect, referral_bonus, report_reward, moderation_reward]
 *               description:
 *                 type: string
 *                 description: Custom description for transaction
 *     responses:
 *       200:
 *         description: Points awarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: object
 *                 newBalance:
 *                   type: number
 *       400:
 *         description: Invalid input or user not found
 *
 * @example
 * ```typescript
 * await fetch('/api/users/points/award', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     userId: 'user-id',
 *     points: 100,
 *     reason: 'profile_completion'
 *   })
 * });
 * ```
 *
 * @see {@link /lib/services/points-service} Points service
 */

import {
  authenticate,
  BusinessLogicError,
  requireAdmin,
  requireUserByIdentifier,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  Decimal,
  insertPointsAwardDepositReturningAdminSlices,
  selectBalanceTransactionHistorySlicesByUserIdOrderCreatedDesc,
} from '@babylon/db';
import { asSystem, asUser } from '@babylon/db/engine-storage';
import {
  AwardPointsSchema,
  generateSnowflakeId,
  logger,
  UserIdParamSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  // Parse and validate request body
  const body = await request.json();
  const {
    userId,
    points: amount,
    reason,
    description,
  } = AwardPointsSchema.parse(body);

  // Verify user exists and get current balance
  const user = await requireUserByIdentifier(userId);

  // Calculate balance changes
  const balanceBefore = new Decimal(user.virtualBalance?.toString() || '0');
  const amountDecimal = new Decimal(amount);
  const balanceAfter = Decimal.add(balanceBefore, amountDecimal);

  const transactionId = await generateSnowflakeId();
  const { transaction, updatedUser } = await asSystem(
    async (db) =>
      insertPointsAwardDepositReturningAdminSlices(db, {
        transactionId,
        userId: user.id,
        amount,
        amountStr: amountDecimal.toString(),
        balanceBeforeStr: balanceBefore.toString(),
        balanceAfterStr: balanceAfter.toString(),
        description: description || reason,
      }),
    'points-award-admin'
  );

  logger.info(
    `Successfully awarded ${amount} points`,
    { userId: user.id, amount, reason },
    'POST /api/users/points/award'
  );

  if (!transaction) {
    throw new BusinessLogicError(
      'Failed to create transaction',
      'TRANSACTION_FAILED'
    );
  }
  if (!updatedUser) {
    throw new BusinessLogicError('Failed to update user', 'UPDATE_FAILED');
  }

  return successResponse({
    message: `Successfully awarded ${amount} points`,
    transaction: {
      id: transaction.id,
      amount: transaction.amount?.toString() || '0',
      reason: transaction.description,
      timestamp: transaction.createdAt,
      balanceBefore: transaction.balanceBefore?.toString() || '0',
      balanceAfter: transaction.balanceAfter?.toString() || '0',
    },
    user: {
      id: updatedUser.id,
      virtualBalance: updatedUser.virtualBalance?.toString() || '0',
      totalDeposited: updatedUser.totalDeposited?.toString() || '0',
    },
  });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('userId');

  if (!userIdParam) {
    throw new BusinessLogicError('User ID is required', 'USER_ID_REQUIRED');
  }

  // Validate userId format
  const { userId } = UserIdParamSchema.parse({ userId: userIdParam });
  const targetUser = await requireUserByIdentifier(userId);
  const canonicalUserId = targetUser.id;

  if (authUser.userId !== canonicalUserId) {
    throw new BusinessLogicError(
      'You can only view your own points history',
      'UNAUTHORIZED_ACCESS'
    );
  }

  const transactions = await asUser(authUser, async (db) =>
    selectBalanceTransactionHistorySlicesByUserIdOrderCreatedDesc(
      db,
      canonicalUserId
    )
  );

  logger.info(
    'Points award history fetched',
    { userId: canonicalUserId, transactionCount: transactions.length },
    'GET /api/users/points/award'
  );

  return successResponse({
    transactions: transactions.map((tx) => ({
      id: tx.id,
      amount: String(tx.amount),
      reason: tx.description,
      timestamp: tx.createdAt,
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
    })),
  });
});
