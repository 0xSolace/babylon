/**
 * Virtual balance deduct/refund + ledger rows for agent on-chain registration flows.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { users } from './tables/user';

type RegDb = DrizzleClient | Transaction;

export async function tryDeductVirtualBalanceForAgentRegistration(
  db: RegDb,
  params: {
    ownerUserId: string;
    agentUserId: string;
    cost: number;
    balanceTransactionId: string;
    withdrawalDescription: string;
  }
): Promise<
  | { ok: true; balanceBefore: number; balanceAfter: number }
  | { ok: false; currentBalance: number }
> {
  const [deducted] = await db
    .update(users)
    .set({
      virtualBalance: sql`(${users.virtualBalance})::numeric - ${params.cost}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, params.ownerUserId),
        sql`(${users.virtualBalance})::numeric >= ${params.cost}`
      )
    )
    .returning({ virtualBalance: users.virtualBalance });

  if (!deducted) {
    const [owner] = await db
      .select({ virtualBalance: users.virtualBalance })
      .from(users)
      .where(eq(users.id, params.ownerUserId))
      .limit(1);

    return {
      ok: false,
      currentBalance: Number(owner?.virtualBalance ?? '0'),
    };
  }

  const balanceAfter = Number(deducted.virtualBalance);
  const balanceBefore = balanceAfter + params.cost;

  await db.insert(balanceTransactions).values({
    id: params.balanceTransactionId,
    userId: params.ownerUserId,
    type: 'withdrawal',
    amount: String(params.cost),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    relatedId: params.agentUserId,
    description: params.withdrawalDescription,
    createdAt: new Date(),
  });

  return { ok: true, balanceBefore, balanceAfter };
}

export async function refundVirtualBalanceForAgentRegistration(
  db: RegDb,
  params: {
    ownerUserId: string;
    agentUserId: string;
    cost: number;
    balanceTransactionId: string;
    depositDescription: string;
  }
): Promise<void> {
  const [refunded] = await db
    .update(users)
    .set({
      virtualBalance: sql`(${users.virtualBalance})::numeric + ${params.cost}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.ownerUserId))
    .returning({ virtualBalance: users.virtualBalance });

  const balanceAfter = Number(refunded?.virtualBalance ?? '0');
  const balanceBefore = balanceAfter - params.cost;

  await db.insert(balanceTransactions).values({
    id: params.balanceTransactionId,
    userId: params.ownerUserId,
    type: 'deposit',
    amount: String(params.cost),
    balanceBefore: String(balanceBefore),
    balanceAfter: String(balanceAfter),
    relatedId: params.agentUserId,
    description: params.depositDescription,
    createdAt: new Date(),
  });
}
