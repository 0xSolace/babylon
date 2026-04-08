/**
 * SQL for `apps/web` trading fee outbox drain/enqueue.
 */

import { asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type NewTradingFeeOutboxRow,
  type TradingFeeOutboxRow,
  tradingFeeOutbox,
} from './tables/trading-fee-outbox';

type OutboxDb = DrizzleClient | Transaction;

export async function insertTradingFeeOutboxRow(
  db: OutboxDb,
  row: NewTradingFeeOutboxRow
): Promise<void> {
  await db.insert(tradingFeeOutbox).values(row);
}

export async function selectTradingFeeOutboxRowsOrderCreatedAscLimit(
  db: OutboxDb,
  limit: number
): Promise<TradingFeeOutboxRow[]> {
  return db
    .select()
    .from(tradingFeeOutbox)
    .orderBy(asc(tradingFeeOutbox.createdAt))
    .limit(limit);
}

export async function deleteTradingFeeOutboxById(
  db: OutboxDb,
  id: string
): Promise<void> {
  await db.delete(tradingFeeOutbox).where(eq(tradingFeeOutbox.id, id));
}
