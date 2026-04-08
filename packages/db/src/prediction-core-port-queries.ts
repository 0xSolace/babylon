/**
 * Drizzle for `@babylon/core` `PredictionDbAdapter`.
 *
 * **Why here:** Keeps `drizzle-orm` usage in `packages/db` while core keeps port + mapping.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type {
  Market,
  NewMarket,
  NewPosition,
  NewPredictionPriceHistory,
  Position,
  Question,
} from './model-types';
import { markets } from './tables/markets';
import { positions } from './tables/positions';
import { predictionPriceHistories } from './tables/prediction-price-histories';
import { questions } from './tables/questions';

type CorePredictionDbExecutor = DrizzleClient | Transaction;

export async function corePredictionSelectMarketById(
  client: CorePredictionDbExecutor,
  id: string
): Promise<Market | undefined> {
  const [row] = await client
    .select()
    .from(markets)
    .where(eq(markets.id, id))
    .limit(1);
  return row;
}

export async function corePredictionSelectMarketsByIds(
  client: CorePredictionDbExecutor,
  ids: string[]
): Promise<Market[]> {
  if (ids.length === 0) return [];
  return client.select().from(markets).where(inArray(markets.id, ids));
}

export async function corePredictionSelectActiveMarkets(
  client: CorePredictionDbExecutor
): Promise<Market[]> {
  return client.select().from(markets).where(eq(markets.resolved, false));
}

export async function corePredictionSelectActiveUserPositions(
  client: CorePredictionDbExecutor,
  userId: string
): Promise<Position[]> {
  return client
    .select()
    .from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.status, 'active')));
}

export async function corePredictionSelectQuestionById(
  client: CorePredictionDbExecutor,
  id: string
): Promise<Question | undefined> {
  const [row] = await client
    .select()
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);
  return row;
}

export async function corePredictionSelectQuestionByQuestionNumber(
  client: CorePredictionDbExecutor,
  questionNumber: number
): Promise<Question | undefined> {
  const [row] = await client
    .select()
    .from(questions)
    .where(eq(questions.questionNumber, questionNumber))
    .limit(1);
  return row;
}

export async function corePredictionInsertMarketOnConflictDoNothing(
  client: CorePredictionDbExecutor,
  data: NewMarket
): Promise<Market | undefined> {
  const [inserted] = await client
    .insert(markets)
    .values(data)
    .onConflictDoNothing()
    .returning();
  return inserted;
}

export async function corePredictionUpdateMarketReturning(
  client: CorePredictionDbExecutor,
  marketId: string,
  patch: {
    yesShares?: string;
    noShares?: string;
    liquidity?: string;
    resolved?: boolean;
    resolution?: boolean | null;
    onChainMarketId?: string | null;
    onChainResolved?: boolean;
    resolutionProofUrl?: string | null;
    resolutionDescription?: string | null;
    updatedAt: Date;
  }
): Promise<Market | undefined> {
  const [updated] = await client
    .update(markets)
    .set(patch)
    .where(eq(markets.id, marketId))
    .returning();
  return updated;
}

export async function corePredictionSelectPositionByUserMarketSide(
  client: CorePredictionDbExecutor,
  userId: string,
  marketId: string,
  sideBool: boolean
): Promise<Position | undefined> {
  const [p] = await client
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.marketId, marketId),
        eq(positions.side, sideBool)
      )
    )
    .orderBy(
      desc(
        sql<number>`case when ${positions.status} = 'active' then 1 else 0 end`
      ),
      desc(positions.updatedAt),
      desc(positions.createdAt)
    )
    .limit(1);
  return p;
}

export async function corePredictionUpsertPositionReturning(
  client: CorePredictionDbExecutor,
  row: NewPosition,
  now: Date
): Promise<Position> {
  const [result] = await client
    .insert(positions)
    .values(row)
    .onConflictDoUpdate({
      target: positions.id,
      set: {
        shares: row.shares,
        avgPrice: row.avgPrice,
        amount: row.amount,
        pnl: row.pnl,
        outcome: row.outcome,
        resolvedAt: row.resolvedAt,
        status: row.status,
        updatedAt: now,
      },
    })
    .returning();
  if (!result) {
    throw new Error(
      `corePredictionUpsertPositionReturning: empty returning for user ${row.userId} market ${row.marketId}`
    );
  }
  return result;
}

export async function corePredictionDeletePosition(
  client: CorePredictionDbExecutor,
  positionId: string
): Promise<void> {
  await client.delete(positions).where(eq(positions.id, positionId));
}

export async function corePredictionSelectPositionsForMarket(
  client: CorePredictionDbExecutor,
  marketId: string
): Promise<Position[]> {
  return client
    .select()
    .from(positions)
    .where(eq(positions.marketId, marketId));
}

export async function corePredictionInsertPriceHistory(
  client: CorePredictionDbExecutor,
  row: NewPredictionPriceHistory
): Promise<void> {
  await client.insert(predictionPriceHistories).values(row);
}
