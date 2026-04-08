/**
 * Raw loads for `MarketMetricsService` (prediction + perp slices).
 *
 * **Why here:** Market/position/price history SQL under `asSystem`.
 * Volatility math, sorting, and prompt formatting stay in engine.
 */

import { logger } from '@babylon/shared';
import { desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { positions } from './tables/positions';
import { predictionPriceHistories } from './tables/prediction-price-histories';
import { stockPrices } from './tables/stock-prices';

export type MarketMetricsActiveMarketRow = {
  id: string;
  question: string;
  yesShares: string;
  noShares: string;
  liquidity: string;
  resolved: boolean;
};

export type MarketMetricsPositionCountRow = {
  marketId: string;
  count: number;
};

export type MarketMetricsPriceHistoryRow = {
  marketId: string;
  yesPrice: number;
  createdAt: Date;
};

export async function loadMarketMetricsPredictionSlice(params: {
  lookbackDate: Date;
}): Promise<{
  activeMarkets: MarketMetricsActiveMarketRow[];
  positionCounts: MarketMetricsPositionCountRow[];
  priceHistories: MarketMetricsPriceHistoryRow[];
}> {
  const { lookbackDate } = params;

  return asSystem(async (c) => {
    const activeMarkets = await c
      .select({
        id: markets.id,
        question: markets.question,
        yesShares: markets.yesShares,
        noShares: markets.noShares,
        liquidity: markets.liquidity,
        resolved: markets.resolved,
      })
      .from(markets)
      .where(eq(markets.resolved, false))
      .limit(50);

    const positionCountsRaw = await c
      .select({
        marketId: positions.marketId,
        count: sql<number>`count(*)::int`,
      })
      .from(positions)
      .where(eq(positions.status, 'active'))
      .groupBy(positions.marketId);

    const priceHistoriesRaw = await c
      .select({
        marketId: predictionPriceHistories.marketId,
        yesPrice: predictionPriceHistories.yesPrice,
        createdAt: predictionPriceHistories.createdAt,
      })
      .from(predictionPriceHistories)
      .where(gte(predictionPriceHistories.createdAt, lookbackDate))
      .orderBy(desc(predictionPriceHistories.createdAt))
      .limit(1000);

    return {
      activeMarkets,
      positionCounts: positionCountsRaw.map((p) => ({
        marketId: p.marketId,
        count: Number(p.count),
      })),
      priceHistories: priceHistoriesRaw.map((h) => ({
        marketId: h.marketId,
        yesPrice: h.yesPrice,
        createdAt: h.createdAt,
      })),
    };
  }, 'market-metrics-prediction');
}

export type MarketMetricsStockPriceRow = {
  orgId: string;
  price: number;
  timestamp: Date;
};

export type MarketMetricsPerpSnapshotRow = {
  organizationId: string;
  price24hAgo: number | null;
  price24hAgoUpdatedAt: Date | null;
};

export async function loadMarketMetricsPerpSlice(params: {
  lookbackDate: Date;
}): Promise<{
  recentPrices: MarketMetricsStockPriceRow[];
  snapshotRows: MarketMetricsPerpSnapshotRow[];
}> {
  const { lookbackDate } = params;

  return asSystem(async (c) => {
    const rp = await c
      .select({
        orgId: stockPrices.organizationId,
        price: stockPrices.price,
        timestamp: stockPrices.timestamp,
      })
      .from(stockPrices)
      .where(gte(stockPrices.timestamp, lookbackDate))
      .orderBy(desc(stockPrices.timestamp))
      .limit(500);

    const orgIds = [...new Set(rp.map((p) => p.orgId))];
    let snapshots: MarketMetricsPerpSnapshotRow[] = [];

    if (orgIds.length > 0) {
      try {
        const rows = await c
          .select({
            organizationId: perpMarketSnapshots.organizationId,
            price24hAgo: perpMarketSnapshots.price24hAgo,
            price24hAgoUpdatedAt: perpMarketSnapshots.price24hAgoUpdatedAt,
          })
          .from(perpMarketSnapshots)
          .where(inArray(perpMarketSnapshots.organizationId, orgIds));

        snapshots = rows.map((r) => ({
          organizationId: r.organizationId,
          price24hAgo: r.price24hAgo,
          price24hAgoUpdatedAt: r.price24hAgoUpdatedAt,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode =
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: string }).code
            : undefined;

        const isMissingTableError =
          errorCode === '42P01' ||
          errorMessage.toLowerCase().includes('does not exist');

        if (isMissingTableError) {
          logger.debug(
            'PerpMarketSnapshot table not available, using stockPrices only',
            { error: errorMessage },
            'MarketMetrics'
          );
        } else {
          logger.error(
            'Failed to query PerpMarketSnapshot',
            { error: errorMessage, errorCode },
            'MarketMetrics'
          );
          throw error;
        }
      }
    }

    return {
      recentPrices: rp.map((p) => ({
        orgId: p.orgId,
        price: p.price,
        timestamp: p.timestamp,
      })),
      snapshotRows: snapshots,
    };
  }, 'market-metrics-perp-load');
}
