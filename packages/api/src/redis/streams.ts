/**
 * Redis Streams Support (Decentralized)
 *
 * Provides Redis Streams operations using decentralized cache.
 * Note: Full Redis stream semantics are not supported in decentralized mode.
 * For real-time messaging, use Farcaster or the messaging service.
 */

import type { JsonValue } from '../types';
import { getRedisClient } from './client';

/**
 * Convert a payload object into Redis stream field/value pairs (stringified).
 */
const encodeStreamPayload = (payload: Record<string, JsonValue>) => {
  return {
    payload: JSON.stringify(payload),
  };
};

/**
 * Add an entry to a stream.
 *
 * Note: In decentralized mode, this is simplified - no MAXLEN support.
 */
export async function streamAdd(
  stream: string,
  payload: Record<string, JsonValue>,
  _opts?: { maxlen?: number }
): Promise<string | null> {
  const client = getRedisClient();
  const entry = encodeStreamPayload(payload);

  // Convert entry to field/value pairs
  const args: string[] = [];
  Object.entries(entry).forEach(([key, value]) => {
    args.push(key, String(value));
  });

  return await client.xadd(stream, '*', ...args);
}

export interface StreamMessage<T = Record<string, unknown>> {
  stream: string;
  id: string;
  payload: T;
}

/**
 * Extract payload from stream entry data
 */
const extractPayload = (
  data: Record<string, string>
): Record<string, unknown> => {
  if (data.payload) {
    return JSON.parse(data.payload) as Record<string, unknown>;
  }
  return data as Record<string, unknown>;
};

/**
 * Read entries from streams.
 *
 * Note: In decentralized mode, this is a simplified implementation.
 * Real-time streaming is not fully supported - use Farcaster or messaging service.
 */
export async function streamRead(
  streams: string[],
  _ids: string[],
  _opts?: { count?: number; block?: number }
): Promise<StreamMessage[]> {
  const client = getRedisClient();
  const results: StreamMessage[] = [];

  for (const stream of streams) {
    // Get all entries from the stream (simplified - no ID tracking)
    const streamData = await client.get(stream);

    if (streamData) {
      const entries = JSON.parse(streamData) as Array<{
        id: string;
        data: Record<string, string>;
      }>;

      for (const entry of entries) {
        const payload = extractPayload(entry.data);
        results.push({ stream, id: entry.id, payload });
      }
    }
  }

  return results;
}
