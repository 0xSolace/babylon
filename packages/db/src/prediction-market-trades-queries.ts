/**
 * SQL for GET /api/markets/predictions/[id]/trades (market row + union trade feed + user slices).
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { markets } from './tables/markets';
import { users } from './tables/user';

type PredictionTradesDb = DrizzleClient | Transaction;

export type PredictionMarketIdQuestionRow = {
  id: string;
  question: string;
};

export async function selectPredictionMarketIdQuestionById(
  db: PredictionTradesDb,
  marketId: string
): Promise<PredictionMarketIdQuestionRow | undefined> {
  const [row] = await db
    .select({
      id: markets.id,
      question: markets.question,
    })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);
  return row;
}

/** Raw row shape from the BalanceTransaction ∪ NPCTrade union query. */
export type PredictionMarketTradeUnionRow = {
  id: string;
  type: string;
  userId: string;
  transactionType: string | null;
  amount: number | string;
  marketId: string | null;
  marketType: string | null;
  ticker: string | null;
  action: string | null;
  side: string | null;
  price: number | string | null;
  sentiment: number | string | null;
  reason: string | null;
  timestampMs: number | string | bigint;
};

export async function executePredictionMarketTradesUnionPage(
  db: PredictionTradesDb,
  params: { marketId: string; limit: number; offset: number }
): Promise<PredictionMarketTradeUnionRow[]> {
  const { marketId, limit, offset } = params;
  const result = await db.execute(sql`
      select
        bt."id" as "id",
        'balance' as "type",
        bt."userId" as "userId",
        bt."type" as "transactionType",
        bt."amount"::float8 as "amount",
        bt."relatedId" as "marketId",
        null::text as "marketType",
        null::text as "ticker",
        null::text as "action",
        null::text as "side",
        null::float8 as "price",
        null::float8 as "sentiment",
        null::text as "reason",
        (extract(epoch from bt."createdAt") * 1000)::bigint as "timestampMs"
      from "BalanceTransaction" bt
      where bt."relatedId" = ${marketId}
        and bt."type" in ('pred_buy', 'pred_sell')

      union all

      select
        nt."id" as "id",
        'npc' as "type",
        nt."npcActorId" as "userId",
        null::text as "transactionType",
        nt."amount"::float8 as "amount",
        nt."marketId" as "marketId",
        nt."marketType" as "marketType",
        nt."ticker" as "ticker",
        nt."action" as "action",
        nt."side" as "side",
        nt."price"::float8 as "price",
        nt."sentiment"::float8 as "sentiment",
        nt."reason" as "reason",
        (extract(epoch from nt."executedAt") * 1000)::bigint as "timestampMs"
      from "NPCTrade" nt
      where nt."marketType" = 'prediction'
        and nt."marketId" = ${marketId}

      order by "timestampMs" desc
      limit ${limit}
      offset ${offset}
    `);

  return result as unknown as PredictionMarketTradeUnionRow[];
}

export type PredictionTradeUserDisplaySliceRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
};

export async function selectPredictionTradeUserDisplaySlicesByIds(
  db: PredictionTradesDb,
  userIds: string[]
): Promise<PredictionTradeUserDisplaySliceRow[]> {
  if (userIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}
