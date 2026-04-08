/**
 * Points Transfer API
 *
 * @route POST /api/points/transfer - Transfer points
 * @access Authenticated
 *
 * @description
 * Enables peer-to-peer point transfers between users. Similar to Farcaster's
 * "pay" feature. Includes optional message and notifications.
 *
 * @openapi
 * /api/points/transfer:
 *   post:
 *     tags:
 *       - Points
 *     summary: Transfer points
 *     description: Transfers points from authenticated user to another user
 *     security:
 *       - PrivyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - amount
 *             properties:
 *               recipientId:
 *                 type: string
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Points amount (positive integer)
 *               message:
 *                 type: string
 *                 maxLength: 200
 *                 description: Optional transfer message
 *     responses:
 *       200:
 *         description: Transfer completed successfully
 *       400:
 *         description: Invalid input or insufficient balance
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recipient not found
 *
 * @example
 * ```typescript
 * await fetch('/api/points/transfer', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     recipientId: 'user-id',
 *     amount: 100,
 *     message: 'Thanks!'
 *   })
 * });
 * ```
 */

import {
  authenticate,
  BusinessLogicError,
  cachedDb,
  createNotification,
  NotFoundError,
  withErrorHandling,
} from '@babylon/api';

import { asSystem } from '@babylon/db/engine-storage';
import { generateSnowflakeId, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const TransferPointsSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  message: z.string().max(200).optional(),
});

/**
 * POST /api/points/transfer
 * Transfer points from authenticated user to another user
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate the sender
  const authUser = await authenticate(request);
  const senderId = authUser.dbUserId!;

  // Parse and validate request body
  const body = await request.json();
  const validation = TransferPointsSchema.safeParse(body);

  if (!validation.success) {
    const firstError = validation.error.issues?.[0];
    return NextResponse.json(
      { error: firstError?.message || 'Invalid request data' },
      { status: 400 }
    );
  }

  const { recipientId, amount, message } = validation.data;

  // Prevent self-transfers
  if (senderId === recipientId) {
    return NextResponse.json(
      { error: 'Cannot send points to yourself' },
      { status: 400 }
    );
  }

  // Check if trying to send to Agent0 network agent or app (not local User records)
  if (recipientId.startsWith('agent0-') || recipientId.startsWith('app-')) {
    return NextResponse.json(
      {
        error:
          'Cannot send points to external agents or apps. Points can only be sent to Babylon users and agents.',
      },
      { status: 400 }
    );
  }

  const { sender, recipient, result } = await asSystem(async (db) => {
    const [senderRow, recipientRow] = await Promise.all([
      db.user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          reputationPoints: true,
          displayName: true,
          username: true,
        },
      }),
      db.user.findUnique({
        where: { id: recipientId },
        select: {
          id: true,
          reputationPoints: true,
          displayName: true,
          username: true,
        },
      }),
    ]);

    if (!senderRow) {
      throw new NotFoundError('Sender');
    }
    if (!recipientRow) {
      throw new NotFoundError('Recipient');
    }

    if (senderRow.reputationPoints < amount) {
      throw new BusinessLogicError(
        `Insufficient points. You have ${senderRow.reputationPoints} points, but tried to send ${amount} points.`,
        'INSUFFICIENT_POINTS',
        {
          details: {
            available: senderRow.reputationPoints,
            requested: amount,
          },
        }
      );
    }

    const senderPointsBefore = senderRow.reputationPoints;
    const recipientPointsBefore = recipientRow.reputationPoints;
    const senderCurrentPoints = Number(senderRow.reputationPoints);
    const recipientCurrentPoints = Number(recipientRow.reputationPoints);

    const updatedSender = await db.user.update({
      where: { id: senderId },
      data: {
        reputationPoints: senderCurrentPoints - amount,
      },
    });

    const updatedRecipient = await db.user.update({
      where: { id: recipientId },
      data: {
        reputationPoints: recipientCurrentPoints + amount,
      },
    });

    await db.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: senderId,
        amount: -amount,
        pointsBefore: senderPointsBefore,
        pointsAfter: updatedSender.reputationPoints,
        reason: 'transfer_sent',
        metadata: JSON.stringify({
          recipientId,
          recipientName: recipientRow.displayName || recipientRow.username,
          message,
        }),
      },
    });

    await db.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: recipientId,
        amount: amount,
        pointsBefore: recipientPointsBefore,
        pointsAfter: updatedRecipient.reputationPoints,
        reason: 'transfer_received',
        metadata: JSON.stringify({
          senderId,
          senderName: senderRow.displayName || senderRow.username,
          message,
        }),
      },
    });

    return {
      sender: senderRow,
      recipient: recipientRow,
      result: {
        sender: updatedSender,
        recipient: updatedRecipient,
      },
    };
  }, 'points-transfer');

  // Invalidate cache for both users to update UI immediately
  await Promise.all([
    cachedDb.invalidateUserCache(senderId),
    cachedDb.invalidateUserCache(recipientId),
  ]).catch((error) => {
    logger.warn('Failed to invalidate user cache after points transfer', {
      error,
      senderId,
      recipientId,
    });
  });

  logger.info(
    `Points transfer: ${sender.username || senderId} sent ${amount} points to ${recipient.username || recipientId}`,
    {
      senderId,
      recipientId,
      amount,
      message,
      senderNewBalance: result.sender.reputationPoints,
      recipientNewBalance: result.recipient.reputationPoints,
    },
    'PointsTransfer'
  );

  // Send notification to recipient
  const senderName = sender.displayName || sender.username || 'Someone';
  const notificationMessage = message
    ? `${senderName} sent you ${amount} points: "${message}"`
    : `${senderName} sent you ${amount} points`;

  await createNotification({
    userId: recipientId,
    type: 'points_received',
    actorId: senderId,
    title: `You received ${amount} points`,
    message: notificationMessage,
  }).catch((err) => {
    // Log error but don't fail the transfer
    logger.error(
      'Failed to create notification for points transfer',
      { error: err, recipientId, senderId },
      'PointsTransfer'
    );
  });

  return NextResponse.json({
    success: true,
    transfer: {
      amount,
      sender: {
        id: sender.id,
        name: sender.displayName || sender.username,
        newBalance: result.sender.reputationPoints,
      },
      recipient: {
        id: recipient.id,
        name: recipient.displayName || recipient.username,
        newBalance: result.recipient.reputationPoints,
      },
      message,
    },
  });
});
