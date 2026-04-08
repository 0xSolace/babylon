/**
 * Delete User API Key
 *
 * @route DELETE /api/users/api-keys/[keyId] - Revoke API key
 * @access Authenticated (own keys only)
 */

import {
  authenticate,
  invalidateCachedKey,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { revokeUserApiKeyForOwner } from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/users/api-keys/[keyId] - Revoke API key
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ keyId: string }> }
  ) => {
    const authUser = await authenticate(request);
    const { keyId } = await context.params;

    // Use asUser to enforce RLS - user can only revoke their own keys
    const deleted = await asUser(authUser.userId, async (dbClient) =>
      revokeUserApiKeyForOwner(dbClient, keyId, authUser.userId, new Date())
    );

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'API key not found or already revoked' },
        { status: 404 }
      );
    }

    // Immediately invalidate cached key to prevent continued use
    const revokedKey = deleted[0];
    if (revokedKey?.keyHash) {
      invalidateCachedKey(revokedKey.keyHash);
    }

    logger.info(
      'API key revoked',
      { userId: authUser.userId, keyId },
      'API Keys'
    );

    return successResponse({
      message: 'API key revoked successfully',
    });
  }
);
