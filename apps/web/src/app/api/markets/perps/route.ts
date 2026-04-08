import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';
import { createPerpMarketService } from './_adapters';

/**
 * GET /api/markets/perps
 * Returns perpetual markets snapshot (single source from PerpMarketService)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo, user } = await publicRateLimit(request);
  if (error) return error;

  return runWithOptionalUserRls(user, async (db) => {
    const service = createPerpMarketService({ dbClient: db });
    const markets = await service.getMarketsSnapshot();

    logger.info(
      'Perpetual markets fetched successfully',
      { count: markets.length },
      'GET /api/markets/perps'
    );

    const res = successResponse({
      success: true,
      markets,
      count: markets.length,
    });
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  });
});
