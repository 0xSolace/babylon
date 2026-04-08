import {
  insertRealtimeOutboxRow,
  type JsonValue,
  selectRealtimeOutboxDrainBatch,
  updateRealtimeOutboxMarkSent,
} from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import { randomUUID } from 'crypto';
import { streamAdd } from '../redis';
import type { RealtimeChannel, RealtimeEventEnvelope } from './index';
import { toStreamKey } from './index';

const BATCH_SIZE = 100;

/**
 * Persist an event in the realtime outbox for retry.
 */
export async function enqueueOutbox(
  event: RealtimeEventEnvelope
): Promise<void> {
  const payload: JsonValue = {
    channel: event.channel,
    type: event.type,
    version: event.version ?? 'v1',
    data: event.data,
    timestamp: event.timestamp,
  };
  await asSystem(
    async (c) =>
      insertRealtimeOutboxRow(c, {
        id: randomUUID(),
        channel: event.channel,
        type: event.type,
        version: event.version ?? 'v1',
        payload,
        updatedAt: new Date(),
      }),
    'realtime-outbox-enqueue'
  );
}

/**
 * Drain a batch of pending/failed events and publish to Streams.
 */
export async function drainOutboxBatch(limit: number = BATCH_SIZE): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const rows = await asSystem(
    async (c) => selectRealtimeOutboxDrainBatch(c, limit),
    'realtime-outbox-drain-select'
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = row.payload;
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('channel' in payload) ||
      !('type' in payload) ||
      !('data' in payload) ||
      !('timestamp' in payload)
    ) {
      logger.error(
        'Invalid payload structure in outbox',
        { rowId: row.id },
        'RealtimeOutbox'
      );
      failed++;
      continue;
    }

    const envelope: RealtimeEventEnvelope = {
      channel: payload.channel as RealtimeChannel,
      type: payload.type as string,
      version: 'version' in payload ? (payload.version as string) : undefined,
      data: payload.data as JsonValue,
      timestamp:
        typeof payload.timestamp === 'number'
          ? payload.timestamp
          : Number(payload.timestamp),
    };

    const envelopeRecord: Record<string, JsonValue> = {
      channel: envelope.channel,
      type: envelope.type,
      version: envelope.version ?? 'v1',
      data: envelope.data,
      timestamp: envelope.timestamp,
    };
    await streamAdd(toStreamKey(envelope.channel), envelopeRecord, {
      maxlen: 10_000,
    });
    await asSystem(
      async (c) => updateRealtimeOutboxMarkSent(c, row.id),
      'realtime-outbox-drain-mark-sent'
    );
    sent++;
  }

  return { processed: rows.length, sent, failed };
}
