/**
 * Durable queue for perp (and future) trading fees when inline processing fails after retries.
 *
 * Rows are removed in the same Postgres transaction as `FeeService.processTradingFee`
 * so a crash after charging cannot leave a stale row that would double-charge on retry.
 */

import type { TradingFeeOutboxPort } from '@babylon/core/markets/shared';
import {
  deleteTradingFeeOutboxById,
  insertTradingFeeOutboxRow,
  selectTradingFeeOutboxRowsOrderCreatedAscLimit,
} from '@babylon/db';
import {
  asSystem,
  dbWrite,
  type Transaction,
  withTransaction,
} from '@babylon/db/engine-storage';
import { FeeService, type FeeType, isValidFeeType } from '@babylon/engine';
import { generateSnowflakeId, logger } from '@babylon/shared';

const DRAIN_BATCH_SIZE = 50;

export async function enqueueFailedTradingFee(params: {
  userId: string;
  amount: number;
  type: string;
  relatedId: string;
  positionId: string;
  lastError?: string;
}): Promise<void> {
  const id = await generateSnowflakeId();
  await asSystem(
    (tx) =>
      insertTradingFeeOutboxRow(tx, {
        id,
        userId: params.userId,
        tradeType: params.type,
        tradeAmount: String(params.amount),
        tradeId: params.positionId,
        marketId: params.relatedId,
        lastError: params.lastError ?? null,
      }),
    'trading-fee-outbox-enqueue'
  );
}

export function createTradingFeeOutboxAdapter(): TradingFeeOutboxPort {
  return {
    enqueue: (p) => enqueueFailedTradingFee(p),
  };
}

export async function drainTradingFeeOutboxBatch(): Promise<{
  examined: number;
  processed: number;
  failed: number;
}> {
  const rows = await selectTradingFeeOutboxRowsOrderCreatedAscLimit(
    dbWrite,
    DRAIN_BATCH_SIZE
  );

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    if (!isValidFeeType(row.tradeType)) {
      failed += 1;
      logger.error(
        'Invalid tradeType in outbox — skipping row',
        {
          outboxId: row.id,
          userId: row.userId,
          tradeType: row.tradeType,
        },
        'TradingFeeOutbox'
      );
      continue;
    }

    try {
      await withTransaction(async (tx: Transaction) => {
        await FeeService.processTradingFee(
          row.userId,
          row.tradeType as FeeType,
          Number(row.tradeAmount),
          row.tradeId ?? undefined,
          row.marketId ?? undefined,
          tx
        );
        await deleteTradingFeeOutboxById(tx, row.id);
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        'Trading fee outbox row failed (will retry on next drain)',
        {
          outboxId: row.id,
          userId: row.userId,
          tradeType: row.tradeType,
          error: error instanceof Error ? error.message : String(error),
        },
        'TradingFeeOutbox'
      );
    }
  }

  return { examined: rows.length, processed, failed };
}
