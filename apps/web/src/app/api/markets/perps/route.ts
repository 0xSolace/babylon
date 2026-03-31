import {
  addPublicReadHeaders,
  CACHE_KEYS,
  DEFAULT_TTLS,
  getCacheOrFetch,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { isOnchainPerpReadUnavailableError } from '@babylon/engine';
import { CHAIN, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createPerpMarketService } from './_adapters';
import {
  getOnchainPerpService,
  isOnchainPerpModeEnabled,
  logOnchainPerpRoute,
} from './_onchain';
import { mergeOrganizationMetadataForPerpMarkets } from './_org-metadata';

function isLocalOnchainDevFallbackEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && CHAIN.id === 31337;
}

const PerpsListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().positive().max(100),
  })
  .partial();

/**
 * GET /api/markets/perps
 * Returns perpetual markets snapshot (single source from PerpMarketService).
 *
 * WHY cache-aside: The full snapshot hits the DB on every request; short-TTL
 * Redis cache (8 s) eliminates redundant reads under burst traffic while
 * write-time invalidation (on open/close/price-impact) keeps it fresh.
 *
 * WHY opt-in pagination: The screener loads all markets and sorts client-side,
 * so the default (no page/limit) returns the full cached list. External
 * consumers can pass ?page=N&limit=M to get bounded pages (bypasses cache
 * to avoid key explosion with low hit rates).
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo } = await publicRateLimit(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const parsed = PerpsListQuerySchema.safeParse(
    Object.fromEntries(searchParams)
  );
  const usePagination = searchParams.has('limit') || searchParams.has('page');
  if (!parsed.success && usePagination) {
    const res = successResponse(
      {
        error: 'Invalid query parameters',
        details: parsed.error.flatten(),
      },
      400
    );
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  }

  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  const service = createPerpMarketService();

  let markets: Awaited<ReturnType<typeof service.getMarketsSnapshot>>;
  let total: number | undefined;
  const fetchDbMarkets = async () => {
    if (usePagination) {
      total = await service.countMarkets();
      const offset = (page - 1) * limit;
      return await service.getMarketsSnapshot({ limit, offset });
    }

    return await getCacheOrFetch(
      'snapshot',
      () => service.getMarketsSnapshot(),
      {
        namespace: CACHE_KEYS.MARKETS_API_PERPS,
        ttl: DEFAULT_TTLS.MARKETS_API_PERPS,
      }
    );
  };

  if (isOnchainPerpModeEnabled()) {
    logOnchainPerpRoute('GET /api/markets/perps');
    const onchainService = getOnchainPerpService();

    if (!(await onchainService.isDiamondDeployed())) {
      if (!isLocalOnchainDevFallbackEnabled()) {
        throw new Error(
          `On-chain perp diamond is not deployed at ${onchainService.diamondAddress}`
        );
      }

      logger.warn(
        'On-chain perp diamond not deployed yet; falling back to database snapshots',
        { chainId: CHAIN.id, diamondAddress: onchainService.diamondAddress },
        'GET /api/markets/perps'
      );
      markets = await fetchDbMarkets();
    } else {
      try {
        markets = (await onchainService.getMarketSnapshots()) as Awaited<
          ReturnType<typeof service.getMarketsSnapshot>
        >;
        markets = await mergeOrganizationMetadataForPerpMarkets(markets);
      } catch (error) {
        if (
          !isLocalOnchainDevFallbackEnabled() ||
          !isOnchainPerpReadUnavailableError(error)
        ) {
          throw error;
        }

        logger.warn(
          'On-chain perp view is not ready yet; falling back to database snapshots',
          {
            chainId: CHAIN.id,
            diamondAddress: onchainService.diamondAddress,
            error: error instanceof Error ? error.message : String(error),
          },
          'GET /api/markets/perps'
        );
        markets = await fetchDbMarkets();
      }
    }
  } else {
    markets = await fetchDbMarkets();
  }

  logger.info(
    'Perpetual markets fetched successfully',
    { count: markets.length, paginated: usePagination },
    'GET /api/markets/perps'
  );

  const res = successResponse({
    success: true,
    markets,
    count: markets.length,
    ...(usePagination ? { page, limit, total } : {}),
  });
  if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
  return res;
});
