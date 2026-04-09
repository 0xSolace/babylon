import {
  authenticate,
  PointsService,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { LeaderboardQuerySchema } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { sanitizeForJson } from '@/lib/json/sanitize';

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

  const currentUser = await PointsService.getUserPosition(
    authUser.userId,
    leaderboardType,
    pageSize
  );

  return successResponse(
    sanitizeForJson({
      success: true,
      leaderboardType,
      currentUser,
    })
  );
});
