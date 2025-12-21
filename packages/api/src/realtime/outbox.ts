import { db, type JsonValue } from '@babylon/db';
import { logger } from '@babylon/shared';
import { randomUUID } from 'crypto';
import { streamAdd } from '../redis';
import type { RealtimeChannel, RealtimeEventEnvelope } from './index';
import { toStreamKey } from './index';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 100;

/**
 * Persist an event in the realtime outbox for retry.
 */
export async function enqueueOutbox(
  event: RealtimeEventEnvelope
): Promise<void> {
  // RealtimeEventEnvelope is compatible with JsonValue - it's a plain object with JsonValue fields
  const payload: JsonValue = {
    channel: event.channel,
    type: event.type,
    version: event.version ?? 'v1',
    data: event.data,
    timestamp: event.timestamp,
  };
  await db.realtimeOutbox.create({
    data: {
      id: randomUUID(),
      channel: event.channel,
      type: event.type,
      version: event.version ?? 'v1',
      payload,
      updatedAt: new Date(),
    },
  });
}

/**
 * Drain a batch of pending/failed events and publish to Streams.
 */
export async function drainOutboxBatch(limit: number = BATCH_SIZE): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  // Query pending or (failed with attempts < MAX_ATTEMPTS)
  const rows = await db.realtimeOutbox.findMany({
    where: {
      OR: [
        { status: 'pending' },
        {
          AND: [{ status: 'failed' }, { attempts: { lt: MAX_ATTEMPTS } }],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    // Validate and parse payload from database
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

    // Convert envelope to Record<string, JsonValue> for streamAdd
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

    // Update the row status to 'sent' and increment attempts
    await db.realtimeOutbox.update({
      where: { id: row.id },
      data: {
        status: 'sent',
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    sent++;
  }

  return { processed: rows.length, sent, failed };
}
