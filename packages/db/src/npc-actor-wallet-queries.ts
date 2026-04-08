/**
 * Atomic `ActorState.tradingBalance` updates for `createNpcWalletAdapter`.
 *
 * **Why here:** SQL increment/decrement with balance guard lives in `@babylon/db`;
 * `WalletPort` wiring and error messages stay in engine.
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';
import { actorState } from './tables/actor-state';

type DbLike = DrizzleClient | Transaction;

export async function npcActorStateAtomicDebit(
  db: DbLike,
  actorId: string,
  amount: number
): Promise<{ id: string }[]> {
  return db
    .update(actorState)
    .set({
      tradingBalance: sql`${actorState.tradingBalance} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(actorState.id, actorId),
        gte(sql<number>`${actorState.tradingBalance}::numeric`, amount)
      )
    )
    .returning({ id: actorState.id });
}

export async function npcActorStateAtomicCredit(
  db: DbLike,
  actorId: string,
  amount: number
): Promise<{ id: string }[]> {
  return db
    .update(actorState)
    .set({
      tradingBalance: sql`${actorState.tradingBalance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(actorState.id, actorId))
    .returning({ id: actorState.id });
}

export async function selectNpcActorTradingBalance(
  db: DbLike,
  actorId: string
): Promise<{ tradingBalance: string | null } | undefined> {
  const [row] = await db
    .select({ tradingBalance: actorState.tradingBalance })
    .from(actorState)
    .where(eq(actorState.id, actorId))
    .limit(1);
  return row;
}

export async function selectActorStateRowById(
  db: DbLike,
  actorId: string
): Promise<typeof actorState.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(actorState)
    .where(eq(actorState.id, actorId))
    .limit(1);
  return row;
}

export async function npcActorStateAtomicDebitAsSystem(
  actorId: string,
  amount: number
): Promise<{ id: string }[]> {
  return asSystem(
    async (c) => npcActorStateAtomicDebit(c, actorId, amount),
    'npc-actor-wallet-debit'
  );
}

export async function npcActorStateAtomicCreditAsSystem(
  actorId: string,
  amount: number
): Promise<{ id: string }[]> {
  return asSystem(
    async (c) => npcActorStateAtomicCredit(c, actorId, amount),
    'npc-actor-wallet-credit'
  );
}

export async function selectNpcActorTradingBalanceAsSystem(
  actorId: string
): Promise<{ tradingBalance: string | null } | undefined> {
  return asSystem(
    async (c) => selectNpcActorTradingBalance(c, actorId),
    'npc-actor-wallet-balance'
  );
}
