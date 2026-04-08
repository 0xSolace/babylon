/**
 * Drizzle for `TradeExecutionService` (NPC perp/prediction execution).
 *
 * **Why here:** pool/perp/org reads, `NPCTrade` analytics inserts, and
 * back-compat `PoolPosition` transactions live in `@babylon/db` with
 * **`asSystem`** / **`withTransaction`**; LLM decisions, `PerpMarketService`,
 * and rate limits stay in engine.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { asSystem, withTransaction } from './db';
import { actorState } from './tables/actor-state';
import { npcTrades } from './tables/npc-trades';
import { organizationState } from './tables/organization-state';
import { perpPositions } from './tables/perp-positions';
import { poolPositions } from './tables/pool-positions';

export type TradeExecutionNpcTradeInsert = typeof npcTrades.$inferInsert;
export type TradeExecutionPoolPositionInsert =
  typeof poolPositions.$inferInsert;

export async function fetchOrganizationCurrentPriceForNpcTrade(
  organizationId: string
): Promise<number | null> {
  return asSystem(async (c) => {
    const [state] = await c
      .select({ currentPrice: organizationState.currentPrice })
      .from(organizationState)
      .where(eq(organizationState.id, organizationId))
      .limit(1);
    return state?.currentPrice ?? null;
  }, 'trade-exec-org-price');
}

export async function insertNpcTradeRowTradeExecution(
  row: TradeExecutionNpcTradeInsert
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(npcTrades).values(row);
  }, 'trade-exec-npc-trade-insert');
}

export type UpsertPoolPositionAfterPredictionBuyInput = {
  positionRow: TradeExecutionPoolPositionInsert;
  onConflict: {
    currentPrice: number;
    size: number;
    shares: number;
    updatedAt: Date;
  };
  npcTradeRow: TradeExecutionNpcTradeInsert;
};

export async function runTransactionUpsertPoolPositionAfterPredictionBuy(
  input: UpsertPoolPositionAfterPredictionBuyInput
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx
      .insert(poolPositions)
      .values(input.positionRow)
      .onConflictDoUpdate({
        target: poolPositions.id,
        set: {
          currentPrice: input.onConflict.currentPrice,
          size: input.onConflict.size,
          shares: input.onConflict.shares,
          updatedAt: input.onConflict.updatedAt,
        },
      });
    await tx.insert(npcTrades).values(input.npcTradeRow);
  });
}

export async function selectOpenNpcPredictionPoolPosition(
  poolId: string,
  marketId: string,
  side: 'YES' | 'NO'
): Promise<typeof poolPositions.$inferSelect | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(poolPositions)
      .where(
        and(
          eq(poolPositions.poolId, poolId),
          eq(poolPositions.marketId, marketId),
          eq(poolPositions.side, side),
          eq(poolPositions.marketType, 'prediction'),
          isNull(poolPositions.closedAt)
        )
      )
      .limit(1);
    return row;
  }, 'trade-exec-open-pred-pool-pos');
}

export type ClosePredictionPoolPositionCasInput = {
  positionId: string;
  now: Date;
  currentPrice: number;
  realizedPnL: number;
  npcTradeRow: TradeExecutionNpcTradeInsert;
};

export async function runTransactionClosePredictionPoolPositionCas(
  input: ClosePredictionPoolPositionCasInput
): Promise<void> {
  await withTransaction(async (tx) => {
    const updateResult = await tx
      .update(poolPositions)
      .set({
        closedAt: input.now,
        currentPrice: input.currentPrice,
        shares: 0,
        unrealizedPnL: 0,
        realizedPnL: input.realizedPnL,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(poolPositions.id, input.positionId),
          isNull(poolPositions.closedAt)
        )
      )
      .returning({ id: poolPositions.id });

    if (updateResult.length === 0) {
      throw new Error(
        `Position already closed: race condition detected for position ${input.positionId}`
      );
    }

    await tx.insert(npcTrades).values(input.npcTradeRow);
  });
}

export async function selectPerpPositionByIdForNpcTrade(
  positionId: string
): Promise<typeof perpPositions.$inferSelect | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(perpPositions)
      .where(eq(perpPositions.id, positionId))
      .limit(1);
    return row;
  }, 'trade-exec-perp-pos-by-id');
}

export async function selectPoolPositionByIdForNpcTrade(
  positionId: string
): Promise<typeof poolPositions.$inferSelect | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(poolPositions)
      .where(eq(poolPositions.id, positionId))
      .limit(1);
    return row;
  }, 'trade-exec-pool-pos-by-id');
}

export type ClosePredictionPoolPositionLegacyInput = {
  positionId: string;
  now: Date;
  currentPrice: number;
  realizedPnL: number;
  npcTradeRow: TradeExecutionNpcTradeInsert;
};

export async function runTransactionClosePredictionPoolPositionLegacy(
  input: ClosePredictionPoolPositionLegacyInput
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx
      .update(poolPositions)
      .set({
        closedAt: input.now,
        currentPrice: input.currentPrice,
        unrealizedPnL: 0,
        realizedPnL: input.realizedPnL,
        updatedAt: input.now,
      })
      .where(eq(poolPositions.id, input.positionId));

    await tx.insert(npcTrades).values(input.npcTradeRow);
  });
}

export type CloseLegacyPoolPositionSettleInput = {
  positionId: string;
  now: Date;
  currentPrice: number;
  realizedPnL: number;
  actorId: string;
  netReturn: number;
  npcTradeRow: TradeExecutionNpcTradeInsert;
};

export async function runTransactionCloseLegacyPoolPositionSettle(
  input: CloseLegacyPoolPositionSettleInput
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx
      .update(poolPositions)
      .set({
        closedAt: input.now,
        currentPrice: input.currentPrice,
        unrealizedPnL: 0,
        realizedPnL: input.realizedPnL,
        updatedAt: input.now,
      })
      .where(eq(poolPositions.id, input.positionId));

    const [actor] = await tx
      .select()
      .from(actorState)
      .where(eq(actorState.id, input.actorId))
      .limit(1);

    if (actor) {
      const currentBalance = Number.parseFloat(actor.tradingBalance.toString());
      await tx
        .update(actorState)
        .set({
          tradingBalance: String(currentBalance + input.netReturn),
          updatedAt: new Date(),
        })
        .where(eq(actorState.id, input.actorId));
    }

    await tx.insert(npcTrades).values(input.npcTradeRow);
  });
}
