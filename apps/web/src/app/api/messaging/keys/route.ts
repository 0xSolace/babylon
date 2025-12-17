/**
 * Decentralized Messaging Keys API
 *
 * @route POST /api/messaging/keys - Register encryption keys
 * @route GET /api/messaging/keys/:address - Get public key for address
 * @access Authenticated
 *
 * @description
 * Manages user encryption key registration for decentralized messaging.
 * Keys are stored both in the database (for fast lookup) and on-chain
 * via the KeyRegistry contract.
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

const RegisterKeysSchema = z.object({
  publicKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid public key format'),
  signedPreKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid pre-key format')
    .optional(),
  signature: z.string().optional(), // For on-chain registration verification
});

/**
 * POST /api/messaging/keys
 * Register encryption keys for decentralized messaging
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  const body = await request.json();
  const { publicKey, signedPreKey } = RegisterKeysSchema.parse(body);

  // Store key in database for fast lookup
  const existingKey = await db.userMessagingKey.findUnique({
    where: { userId: user.userId },
  });

  if (existingKey) {
    // Update existing key
    await db.userMessagingKey.update({
      where: { userId: user.userId },
      data: {
        publicKey,
        signedPreKey: signedPreKey ?? publicKey,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new key
    await db.userMessagingKey.create({
      data: {
        userId: user.userId,
        publicKey,
        signedPreKey: signedPreKey ?? publicKey,
        isActive: true,
      },
    });
  }

  logger.info(
    'Messaging keys registered',
    { userId: user.userId },
    'POST /api/messaging/keys'
  );

  return successResponse({
    success: true,
    publicKey,
    message: 'Encryption keys registered successfully',
  });
});

/**
 * GET /api/messaging/keys
 * Get current user's messaging keys
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  const key = await db.userMessagingKey.findUnique({
    where: { userId: user.userId },
  });

  if (!key) {
    throw new BusinessLogicError(
      'No messaging keys registered',
      'KEYS_NOT_REGISTERED'
    );
  }

  return successResponse({
    publicKey: key.publicKey,
    signedPreKey: key.signedPreKey,
    isActive: key.isActive,
    registeredAt: key.createdAt,
    updatedAt: key.updatedAt,
  });
});
