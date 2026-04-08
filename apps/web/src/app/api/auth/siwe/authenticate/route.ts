/**
 * SIWE Authentication Endpoint
 *
 * @route POST /api/auth/siwe/authenticate
 * @access Public
 *
 * @description
 * Authenticates an agent using SIWE (Sign-In With Ethereum).
 * - If wallet exists: Issues a new API key (login)
 * - If wallet doesn't exist: Creates new user with isAgent=true (register)
 *
 * @openapi
 * /api/auth/siwe/authenticate:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate/Register agent via SIWE
 *     description: |
 *       Verify SIWE signature and either login (existing wallet) or register (new wallet).
 *       For new registrations, username is required.
 *       For existing users, a new API key is issued.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - signature
 *               - username
 *             properties:
 *               message:
 *                 type: string
 *                 description: EIP-4361 SIWE message
 *               signature:
 *                 type: string
 *                 description: Signature from wallet
 *               username:
 *                 type: string
 *                 description: Desired username (3-30 chars) - used for registration, ignored for login
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isNewUser:
 *                   type: boolean
 *                   description: True if this was a new registration
 *                 userId:
 *                   type: string
 *                 username:
 *                   type: string
 *                 walletAddress:
 *                   type: string
 *                 apiKey:
 *                   type: string
 *                   description: API key (only shown once!)
 *       400:
 *         description: Invalid nonce, signature, domain, or username
 *       409:
 *         description: Username already taken
 */

import {
  generateApiKey,
  hashApiKey,
  successResponse,
  verifySiweMessage,
  withErrorHandling,
} from '@babylon/api';
import {
  generateSnowflakeId,
  insertSiweAgentUserReturningSlice,
  insertUserApiKeyRow,
  selectUserIdByUsernameCaseInsensitive,
  selectUserSiweAuthSliceByWalletAddress,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger, UsernameSchema } from '@babylon/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const AuthSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: z.string().min(1, 'Signature is required'),
  username: UsernameSchema, // Always required - used for registration, ignored for login
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  // Validate request body
  const parseResult = AuthSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      {
        error: 'validation_error',
        message: firstError?.message || 'Invalid request',
      },
      { status: 400 }
    );
  }

  const { message, signature, username } = parseResult.data;

  // Verify SIWE signature
  const verifyResult = await verifySiweMessage(message, signature);
  if (!verifyResult.success) {
    return NextResponse.json(
      {
        error: verifyResult.error,
        message: getErrorMessage(verifyResult.error),
      },
      { status: 400 }
    );
  }

  const walletAddress = verifyResult.address.toLowerCase();

  const siweResult = await asSystem(async (tx) => {
    const existingUser = await selectUserSiweAuthSliceByWalletAddress(
      tx,
      walletAddress
    );

    if (existingUser) {
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);
      const keyId = await generateSnowflakeId();

      await insertUserApiKeyRow(tx, {
        id: keyId,
        userId: existingUser.id,
        keyHash,
        name: `SIWE Login ${new Date().toISOString().split('T')[0]}`,
        createdAt: new Date(),
      });

      return { type: 'login' as const, existingUser, apiKey };
    }

    const existingUsername = await selectUserIdByUsernameCaseInsensitive(
      tx,
      username
    );

    if (existingUsername) {
      return { type: 'username_taken' as const };
    }

    const userId = await generateSnowflakeId();
    const now = new Date();

    const user = await insertSiweAgentUserReturningSlice(tx, {
      id: userId,
      username,
      displayName: username,
      walletAddress,
      createdAt: now,
      updatedAt: now,
    });

    if (!user) {
      throw new Error('Failed to create user');
    }

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyId = await generateSnowflakeId();

    await insertUserApiKeyRow(tx, {
      id: keyId,
      userId,
      keyHash,
      name: 'SIWE Registration',
      createdAt: now,
    });

    return { type: 'register' as const, user, apiKey };
  }, 'auth-siwe-authenticate');

  if (siweResult.type === 'login') {
    const { existingUser, apiKey } = siweResult;
    logger.info(
      'SIWE agent login',
      {
        userId: existingUser.id,
        username: existingUser.username,
        walletAddress: existingUser.walletAddress,
      },
      'SIWE'
    );

    return successResponse({
      success: true,
      isNewUser: false,
      userId: existingUser.id,
      username: existingUser.username,
      walletAddress: existingUser.walletAddress,
      apiKey,
    });
  }

  if (siweResult.type === 'username_taken') {
    return NextResponse.json(
      {
        error: 'username_taken',
        message: `Username '${username}' is already taken`,
      },
      { status: 409 }
    );
  }

  const { user, apiKey } = siweResult;

  logger.info(
    'SIWE agent registration',
    {
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
    },
    'SIWE'
  );

  return successResponse({
    success: true,
    isNewUser: true,
    userId: user.id,
    username: user.username,
    walletAddress: user.walletAddress,
    apiKey,
  });
});

function getErrorMessage(
  error:
    | 'invalid_nonce'
    | 'invalid_domain'
    | 'invalid_signature'
    | 'expired_message'
): string {
  switch (error) {
    case 'invalid_nonce':
      return 'Nonce is invalid, expired, or already used. Please request a new nonce.';
    case 'invalid_domain':
      return 'Domain in SIWE message does not match expected domain.';
    case 'invalid_signature':
      return 'Signature verification failed.';
    case 'expired_message':
      return 'SIWE message has expired.';
  }
}
