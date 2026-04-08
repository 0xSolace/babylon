/**
 * Admin Markets Oversight API
 *
 * @route GET /api/admin/markets - Get market overview and stats
 * @access Admin
 *
 * @description
 * Returns market statistics and list of active/recent markets
 * for admin oversight and management.
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { PredictionPricing } from '@babylon/core/markets/prediction/pricing';
import {
  type AdminMarketsOverviewStatusFilter,
  fetchAdminMarketsOverviewBundle,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') || 'all';
  const status: AdminMarketsOverviewStatusFilter =
    rawStatus === 'active' ||
    rawStatus === 'expired' ||
    rawStatus === 'resolved'
      ? rawStatus
      : 'all';
  // Clamp limit to prevent heavy queries (min 1, max 200, default 50)
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.min(
    Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1),
    200
  );

  logger.info(
    'Admin markets overview requested',
    { status, limit },
    'GET /api/admin/markets'
  );

  const now = new Date();
  const nowIso = toISO(now);

  const { marketStats, positionStats, marketsList } = await asSystem(
    (tx) =>
      fetchAdminMarketsOverviewBundle(tx, {
        status,
        limit,
        now,
        nowIso,
      }),
    'admin-markets-overview'
  );

  // Calculate yes price for each market using the canonical CPMM pricing formula
  // from PredictionPricing.getCurrentPrice: yesPrice = noShares / (yesShares + noShares)
  const marketsWithPrices = marketsList.map((market) => {
    const yesShares = parseFloat(String(market.yesShares));
    const noShares = parseFloat(String(market.noShares));
    const yesPrice = PredictionPricing.getCurrentPrice(
      yesShares,
      noShares,
      'yes'
    );
    const noPrice = PredictionPricing.getCurrentPrice(
      yesShares,
      noShares,
      'no'
    );

    return {
      ...market,
      yesPrice: Math.round(yesPrice * 100),
      noPrice: Math.round(noPrice * 100),
      status: market.resolved
        ? 'resolved'
        : new Date(market.endDate) <= now
          ? 'expired'
          : 'active',
    };
  });

  return successResponse({
    stats: {
      total: marketStats?.total ?? 0,
      active: marketStats?.active ?? 0,
      expired: marketStats?.expired ?? 0,
      resolved: marketStats?.resolved ?? 0,
      totalLiquidity: marketStats?.totalLiquidity ?? 0,
      totalPositions: positionStats?.totalPositions ?? 0,
      activePositions: positionStats?.activePositions ?? 0,
      totalPositionValue: positionStats?.totalValue ?? 0,
    },
    markets: marketsWithPrices,
  });
});
