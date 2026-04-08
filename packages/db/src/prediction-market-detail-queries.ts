/**
 * SQL for GET /api/markets/predictions/[id] (aggregates not covered by core service).
 */

import { and, count, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { npcTrades } from './tables/npc-trades';

type PredictionMarketDetailDb = DrizzleClient | Transaction;

export async function selectPredictionMarketTradeCountsByMarketId(
  db: PredictionMarketDetailDb,
  marketId: string
): Promise<{ balanceTrades: number; npcTrades: number }> {
  const [balanceTradeCountRows, npcTradeCountRows] = await Promise.all([
    db
      .select({ count: count() })
      .from(balanceTransactions)
      .where(
        and(
          eq(balanceTransactions.relatedId, marketId),
          inArray(balanceTransactions.type, ['pred_buy', 'pred_sell'])
        )
      ),
    db
      .select({ count: count() })
      .from(npcTrades)
      .where(
        and(
          eq(npcTrades.marketType, 'prediction'),
          eq(npcTrades.marketId, marketId)
        )
      ),
  ]);

  return {
    balanceTrades: Number(balanceTradeCountRows[0]?.count ?? 0),
    npcTrades: Number(npcTradeCountRows[0]?.count ?? 0),
  };
}
