export const dynamic = 'force-dynamic';

/**
 * Get Public Key by Address
 *
 * @route GET /api/messaging/keys/:address
 * @access Public
 */

import {
  NotFoundError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { db } from '@babylon/db';
import type { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ address: string }>;
}

/**
 * GET /api/messaging/keys/:address
 * Get public encryption key for a user address
 */
export const GET = withErrorHandling(
  async (_request: NextRequest, { params }: RouteParams) => {
    const { address } = await params;

    // First try to find user by wallet address
    const user = await db.user.findFirst({
      where: {
        OR: [
          { walletAddress: { equals: address, mode: 'insensitive' } },
          { id: address },
        ],
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError('User', address);
    }

    const key = await db.userMessagingKey.findUnique({
      where: { userId: user.id },
    });

    if (!key || !key.isActive) {
      throw new NotFoundError('MessagingKey', address);
    }

    return successResponse({
      address,
      userId: user.id,
      publicKey: key.publicKey,
      signedPreKey: key.signedPreKey,
    });
  }
);
