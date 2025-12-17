/**
 * Send Encrypted Message API
 *
 * @route POST /api/messaging/send
 * @access Authenticated
 *
 * @description
 * Receives encrypted messages from users and forwards them to the
 * decentralized relay network. Messages are end-to-end encrypted,
 * so the server cannot read the content.
 */

import {
  authenticate,
  BusinessLogicError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const SendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient address required'),
  encryptedContent: z.string().min(1, 'Encrypted content required'),
  timestamp: z.number().optional(),
});

// Relay node URL from environment
const RELAY_URL = process.env.MESSAGING_RELAY_URL ?? 'http://localhost:3200';

/**
 * POST /api/messaging/send
 * Send an encrypted message to another user
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  const body = await request.json();
  const { to, encryptedContent, timestamp } = SendMessageSchema.parse(body);

  // Check if sender has registered keys
  const senderKey = await db.userMessagingKey.findUnique({
    where: { userId: user.userId },
  });

  if (!senderKey || !senderKey.isActive) {
    throw new BusinessLogicError(
      'You must register encryption keys before sending messages',
      'KEYS_NOT_REGISTERED'
    );
  }

  // Get sender's wallet address
  const senderUser = await db.user.findUnique({
    where: { id: user.userId },
    select: { walletAddress: true },
  });

  if (!senderUser?.walletAddress) {
    throw new BusinessLogicError(
      'Sender wallet address not found',
      'WALLET_NOT_FOUND'
    );
  }

  // Create message envelope
  const messageId = crypto.randomUUID();
  const envelope = {
    id: messageId,
    from: senderUser.walletAddress,
    to,
    encryptedContent,
    timestamp: timestamp ?? Date.now(),
  };

  // Forward to relay node
  const relayResponse = await fetch(`${RELAY_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });

  if (!relayResponse.ok) {
    const error = await relayResponse.text();
    logger.error(
      'Failed to send to relay',
      { error, messageId },
      'POST /api/messaging/send'
    );
    throw new BusinessLogicError(
      'Failed to deliver message to relay network',
      'RELAY_ERROR'
    );
  }

  const result = (await relayResponse.json()) as {
    success: boolean;
    messageId: string;
    cid: string;
    delivered: boolean;
  };

  logger.info(
    'Message sent to relay',
    { messageId, to, delivered: result.delivered },
    'POST /api/messaging/send'
  );

  return successResponse({
    success: true,
    messageId: result.messageId,
    cid: result.cid,
    delivered: result.delivered,
    timestamp: envelope.timestamp,
  });
});
