// POST /api/users/me/game-guide - Mark game guide as completed

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { updateUserGameGuideCompletedAtByPrivyId } from '@babylon/db';
import { asUser } from '@babylon/db/engine-storage';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const now = new Date();

  const result = await asUser(authUser, async (db) =>
    updateUserGameGuideCompletedAtByPrivyId(db, authUser.privyId!, now)
  );

  if (result.length === 0) {
    logger.warn(
      'Game guide: no user found',
      { privyId: authUser.privyId },
      'game-guide'
    );
  }

  return successResponse({
    success: true,
    gameGuideCompletedAt: toISO(now),
  });
});
