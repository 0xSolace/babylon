/**
 * Drizzle for `@babylon/api` realtime outbox persistence.
 */

import { and, eq, lt, or, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { realtimeOutboxes } from './tables/realtime-outboxes';
import type { JsonValue } from './types';

type OutboxDb = DrizzleClient | Transaction;

const MAX_ATTEMPTS = 5;

export type RealtimeOutboxEnqueueInput = {
  id: string;
  channel: string;
  type: string;
  version: string;
  payload: JsonValue;
  updatedAt: Date;
};

export async function insertRealtimeOutboxRow(
  client: OutboxDb,
  input: RealtimeOutboxEnqueueInput
): Promise<void> {
  await client.insert(realtimeOutboxes).values(input);
}

export async function selectRealtimeOutboxDrainBatch(
  client: OutboxDb,
  limit: number
): Promise<(typeof realtimeOutboxes.$inferSelect)[]> {
  return client
    .select()
    .from(realtimeOutboxes)
    .where(
      or(
        eq(realtimeOutboxes.status, 'pending'),
        and(
          eq(realtimeOutboxes.status, 'failed'),
          lt(realtimeOutboxes.attempts, MAX_ATTEMPTS)
        )
      )
    )
    .orderBy(realtimeOutboxes.createdAt)
    .limit(limit);
}

export async function updateRealtimeOutboxMarkSent(
  client: OutboxDb,
  rowId: string
): Promise<void> {
  await client
    .update(realtimeOutboxes)
    .set({
      status: 'sent',
      attempts: sql`${realtimeOutboxes.attempts} + 1`,
      lastError: null,
    })
    .where(eq(realtimeOutboxes.id, rowId));
}
