/**
 * Perpetual Market Price History API
 *
 * @route GET /api/markets/perps/[ticker]/history - Get price history
 * @access Public
 *
 * @description
 * Returns price history for a perpetual market including price, change,
 * and OHLCV data. Useful for charting and analytics.
 *
 * @openapi
 * /api/markets/perps/{ticker}/history:
 *   get:
 *     tags:
 *       - Markets
 *     summary: Get perpetual market price history
 *     description: Returns price history with OHLCV data for charting
 *     parameters:
 *       - in: path
 *         name: ticker
 *         required: true
 *         schema:
 *           type: string
 *         description: Market ticker symbol (e.g., AAPL, TSLA)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 200
 *         description: Number of history points to return
 *     responses:
 *       200:
 *         description: Price history retrieved successfully
 *       404:
 *         description: Market not found
 *
 * @example
 * ```typescript
 * const response = await fetch(`/api/markets/perps/${ticker}/history?limit=100`);
 * const { history } = await response.json();
 * ```
 */

import { successResponse, withErrorHandling } from '@babylon/api';
import { db } from '@babylon/db';
import {
  HistoryQuerySchema,
  TickerParamPermissiveSchema,
} from '@babylon/shared';
import type { NextRequest } from 'next/server';

interface StockPriceRow {
  id: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  timestamp: Date;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  volume: number | null;
}

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ ticker: string }> }
  ) => {
    const { ticker } = TickerParamPermissiveSchema.parse(await context.params);
    const { searchParams } = new URL(request.url);
    const { limit } = HistoryQuerySchema.parse({
      limit: searchParams.get('limit'),
    });

    // Look up the organizationId from the perp market snapshot
    const marketSnapshot = await db.perpMarketSnapshot.findFirst({
      where: { ticker: { equals: ticker } },
    });

    if (!marketSnapshot) {
      return successResponse({
        ticker,
        history: [],
        message: 'Market not found',
      });
    }

    // Get price history from stockPrices table
    const history = await db.stockPrice.findMany({
      where: { organizationId: { equals: marketSnapshot.organizationId } },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const formatHistory = (rows: StockPriceRow[]) =>
      rows.reverse().map((point) => ({
        id: point.id,
        price: point.price,
        change: point.change,
        changePercent: point.changePercent,
        timestamp:
          point.timestamp instanceof Date
            ? point.timestamp.toISOString()
            : point.timestamp,
        openPrice: point.openPrice,
        highPrice: point.highPrice,
        lowPrice: point.lowPrice,
        volume: point.volume,
      }));

    // If we don't have enough recent data, also check older data
    if (history.length < 10) {
      const allHistory = await db.stockPrice.findMany({
        where: { organizationId: { equals: marketSnapshot.organizationId } },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return successResponse({
        ticker,
        organizationId: marketSnapshot.organizationId,
        history: formatHistory(allHistory as StockPriceRow[]),
      });
    }

    return successResponse({
      ticker,
      organizationId: marketSnapshot.organizationId,
      history: formatHistory(history as StockPriceRow[]),
    });
  }
);
