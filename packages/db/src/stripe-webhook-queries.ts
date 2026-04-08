/**
 * SQL for POST /api/stripe/webhook (balance transaction lookups for disputes/refunds).
 */

import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';

type StripeWebhookDb = DrizzleClient | Transaction;

export type StripeWebhookPurchaseRow = {
  userId: string;
  amount: string;
  description: string | null;
};

export async function selectStripePurchaseBalanceRowByPaymentIntentId(
  db: StripeWebhookDb,
  paymentIntentId: string
): Promise<StripeWebhookPurchaseRow | undefined> {
  const [row] = await db
    .select({
      userId: balanceTransactions.userId,
      amount: balanceTransactions.amount,
      description: balanceTransactions.description,
    })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.relatedId, paymentIntentId),
        eq(balanceTransactions.type, 'stripe_purchase')
      )
    )
    .limit(1);
  return row;
}

export type StripeWebhookRefundRow = {
  amount: string;
  description: string | null;
};

export async function selectStripeRefundBalanceRowsForUserId(
  db: StripeWebhookDb,
  userId: string
): Promise<StripeWebhookRefundRow[]> {
  return db
    .select({
      amount: balanceTransactions.amount,
      description: balanceTransactions.description,
    })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.userId, userId),
        eq(balanceTransactions.type, 'stripe_refund')
      )
    );
}
