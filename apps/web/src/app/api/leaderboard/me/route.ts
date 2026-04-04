import {
  authenticate,
  ReputationService,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { LeaderboardQuerySchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const { searchParams } = new URL(request.url);
  const validationResult = LeaderboardQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!validationResult.success) {
    throw validationResult.error;
  }

  const { pageSize, type } = validationResult.data;
  const leaderboardType = type ?? 'wallet';

  const currentUser = await ReputationService.getUserPosition(
    authUser.userId,
    leaderboardType,
    pageSize
  );

  return successResponse({
    success: true,
    leaderboardType,
    currentUser,
  });
});
