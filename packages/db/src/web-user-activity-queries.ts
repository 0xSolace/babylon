/**
 * SQL for `GET /api/users/[userId]/activity` (RLS `db`).
 */

import { desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { pointsTransactions } from './tables/points-transactions';

type UserActivityDb = DrizzleClient | Transaction;

export type BalanceTransactionTradeActivityRow = {
  id: string;
  type: string;
  amount: string;
  relatedId: string | null;
  description: string | null;
  createdAt: Date;
};

export async function selectBalanceTransactionRowsForUserActivityOrderCreatedDescLimit(
  db: UserActivityDb,
  userId: string,
  limit: number
): Promise<BalanceTransactionTradeActivityRow[]> {
  return db
    .select({
      id: balanceTransactions.id,
      type: balanceTransactions.type,
      amount: balanceTransactions.amount,
      relatedId: balanceTransactions.relatedId,
      description: balanceTransactions.description,
      createdAt: balanceTransactions.createdAt,
    })
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
}

export type PointsTransactionActivityRow = {
  id: string;
  amount: number;
  pointsBefore: number;
  pointsAfter: number;
  reason: string;
  paymentProvider: string | null;
  createdAt: Date;
};

export async function selectPointsTransactionActivityRowsByUserIdOrderCreatedDescLimit(
  db: UserActivityDb,
  userId: string,
  limit: number
): Promise<PointsTransactionActivityRow[]> {
  return db
    .select({
      id: pointsTransactions.id,
      amount: pointsTransactions.amount,
      pointsBefore: pointsTransactions.pointsBefore,
      pointsAfter: pointsTransactions.pointsAfter,
      reason: pointsTransactions.reason,
      paymentProvider: pointsTransactions.paymentProvider,
      createdAt: pointsTransactions.createdAt,
    })
    .from(pointsTransactions)
    .where(eq(pointsTransactions.userId, userId))
    .orderBy(desc(pointsTransactions.createdAt))
    .limit(limit);
}
