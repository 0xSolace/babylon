/**
 * SQL for GET /api/markets/perps/[ticker]/history (snapshot org + stock price rows).
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { stockPrices } from './tables/stock-prices';

type PerpHistoryDb = DrizzleClient | Transaction;

export async function selectPerpMarketOrganizationIdByTicker(
  db: PerpHistoryDb,
  ticker: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ organizationId: perpMarketSnapshots.organizationId })
    .from(perpMarketSnapshots)
    .where(eq(perpMarketSnapshots.ticker, ticker))
    .limit(1);
  return row?.organizationId;
}

export type PerpStockPriceHistoryRow = {
  id: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  volume: number | null;
};

export async function selectStockPriceHistoryRowsForOrganizationDesc(
  db: PerpHistoryDb,
  params: {
    organizationId: string;
    since: Date | null;
    limit: number;
  }
): Promise<PerpStockPriceHistoryRow[]> {
  const { organizationId, since, limit } = params;
  return db
    .select({
      id: stockPrices.id,
      price: stockPrices.price,
      change: stockPrices.change,
      changePercent: stockPrices.changePercent,
      timestamp: stockPrices.timestamp,
      openPrice: stockPrices.openPrice,
      highPrice: stockPrices.highPrice,
      lowPrice: stockPrices.lowPrice,
      volume: stockPrices.volume,
    })
    .from(stockPrices)
    .where(
      since
        ? and(
            eq(stockPrices.organizationId, organizationId),
            gte(stockPrices.timestamp, since)
          )
        : eq(stockPrices.organizationId, organizationId)
    )
    .orderBy(desc(stockPrices.timestamp))
    .limit(limit);
}
