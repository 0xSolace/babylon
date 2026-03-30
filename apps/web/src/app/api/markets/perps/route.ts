import {
  addPublicReadHeaders,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { createPerpMarketService } from './_adapters';
import {
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  logOnchainPerpRoute,
} from './_onchain';

/**
 * GET /api/markets/perps
 * Returns perpetual markets snapshot (single source from PerpMarketService)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const markets = isOnchainPerpModeEnabled()
    ? await (async () => {
        logOnchainPerpRoute('GET /api/markets/perps');
        return await getOnchainPerpService().getMarketSnapshots();
      })()
    : await createPerpMarketService().getMarketsSnapshot();

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
