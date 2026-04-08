/**
 * SQL for GET /api/markets/predictions/[id]/history (price history rows, newest first).
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type PredictionPriceHistory,
  predictionPriceHistories,
} from './tables/prediction-price-histories';

type PredictionHistoryDb = DrizzleClient | Transaction;

export async function selectPredictionPriceHistoryRowsForMarketDesc(
  db: PredictionHistoryDb,
  params: { marketId: string; since: Date | null; limit: number }
): Promise<PredictionPriceHistory[]> {
  const { marketId, since, limit } = params;
  return db
    .select()
    .from(predictionPriceHistories)
    .where(
      since
        ? and(
            eq(predictionPriceHistories.marketId, marketId),
            gte(predictionPriceHistories.createdAt, since)
          )
        : eq(predictionPriceHistories.marketId, marketId)
    )
    .orderBy(desc(predictionPriceHistories.createdAt))
    .limit(limit);
}
