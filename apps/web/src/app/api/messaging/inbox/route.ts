/**
 * Messaging Inbox API
 *
 * @route GET /api/messaging/inbox
 * @access Authenticated
 *
 * @description
 * Fetches pending encrypted messages for the authenticated user
 * from the decentralized relay network.
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

// Relay node URL from environment
const RELAY_URL = process.env.MESSAGING_RELAY_URL ?? 'http://localhost:3200';

interface RelayMessage {
  id: string;
  from: string;
  to: string;
  encryptedContent: string;
  timestamp: number;
  cid: string;
  receivedAt: number;
}

/**
 * GET /api/messaging/inbox
 * Fetch pending encrypted messages
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Get user's wallet address
  const userData = await db.user.findUnique({
    where: { id: user.userId },
    select: { walletAddress: true },
  });

  if (!userData?.walletAddress) {
    throw new BusinessLogicError(
      'Wallet address not found',
      'WALLET_NOT_FOUND'
    );
  }

  // Fetch from relay node
  const relayResponse = await fetch(
    `${RELAY_URL}/messages/${userData.walletAddress}`
  );

  if (!relayResponse.ok) {
    logger.error(
      'Failed to fetch from relay',
      { status: relayResponse.status },
      'GET /api/messaging/inbox'
    );
    throw new BusinessLogicError(
      'Failed to fetch messages from relay',
      'RELAY_ERROR'
    );
  }

  const result = (await relayResponse.json()) as {
    address: string;
    messages: RelayMessage[];
    count: number;
  };

  // Enrich messages with sender info from database
  const enrichedMessages = await Promise.all(
    result.messages.map(async (msg) => {
      const sender = await db.user.findFirst({
        where: { walletAddress: { equals: msg.from, mode: 'insensitive' } },
        select: {
          id: true,
          displayName: true,
          username: true,
          profileImageUrl: true,
        },
      });

      return {
        ...msg,
        sender: sender ?? {
          id: msg.from,
          displayName: msg.from.slice(0, 8) + '...',
          username: null,
          profileImageUrl: null,
        },
      };
    })
  );

  logger.debug(
    'Fetched inbox messages',
    { userId: user.userId, count: result.count },
    'GET /api/messaging/inbox'
  );

  return successResponse({
    messages: enrichedMessages,
    count: result.count,
  });
});
