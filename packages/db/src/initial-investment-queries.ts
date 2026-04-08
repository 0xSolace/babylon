/**
 * Pool / PoolPosition / NPCTrade writes for `InitialInvestmentService.executeInvestment`.
 *
 * **Why here:** seed-time inserts use **`asSystem`**; LLM batching and
 * **`npcActorStateAtomicDebit`** (runtime `db`) stay in engine.
 */

import { eq } from 'drizzle-orm';
import { asSystem } from './db';
import { npcTrades } from './tables/npc-trades';
import { poolPositions } from './tables/pool-positions';
import { pools } from './tables/pools';

export type NewPoolRow = typeof pools.$inferInsert;
export type NewPoolPositionRow = typeof poolPositions.$inferInsert;
export type NewNpcTradeRow = typeof npcTrades.$inferInsert;

export async function poolExistsById(poolId: string): Promise<boolean> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: pools.id })
      .from(pools)
      .where(eq(pools.id, poolId))
      .limit(1);
    return row !== undefined;
  }, 'initial-inv-pool-exists');
}

export async function insertNpcPoolRowOnConflictDoNothing(
  row: NewPoolRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(pools).values(row).onConflictDoNothing({ target: pools.id });
  }, 'initial-inv-pool-insert');
}

export async function insertPoolPositionRowForInitialInvestment(
  row: NewPoolPositionRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(poolPositions).values(row);
  }, 'initial-inv-pool-position-insert');
}

export async function insertNpcTradeRowForInitialInvestment(
  row: NewNpcTradeRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(npcTrades).values(row);
  }, 'initial-inv-npc-trade-insert');
}
