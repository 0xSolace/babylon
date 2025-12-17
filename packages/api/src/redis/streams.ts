/**
 * Redis Streams Support (Decentralized)
 *
 * Provides Redis Streams operations using decentralized cache.
 * Note: Full Redis stream semantics are not supported in decentralized mode.
 * For real-time messaging, use Farcaster or the messaging service.
 */

import { logger } from '@babylon/shared';
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
  try {
    const client = getRedisClient();
    const entry = encodeStreamPayload(payload);

    // Convert entry to field/value pairs
    const args: string[] = [];
    Object.entries(entry).forEach(([key, value]) => {
      args.push(key, String(value));
    });

    return await client.xadd(stream, '*', ...args);
  } catch (error) {
    logger.warn(
      '[Streams] streamAdd failed, stream operations limited in decentralized mode',
      { stream, error }
    );
    return null;
  }
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
): Record<string, unknown> | null => {
  if (data.payload) {
    try {
      return JSON.parse(data.payload) as Record<string, unknown>;
    } catch {
      return { payload: data.payload };
    }
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
  try {
    const client = getRedisClient();
    const results: StreamMessage[] = [];

    for (const stream of streams) {
      // Get all entries from the stream (simplified - no ID tracking)
      const streamData = await client.get(stream);

      if (streamData) {
        try {
          const entries = JSON.parse(streamData) as Array<{
            id: string;
            data: Record<string, string>;
          }>;
          for (const entry of entries) {
            const payload = extractPayload(entry.data);
            if (payload) {
              results.push({ stream, id: entry.id, payload });
            }
          }
        } catch {
          // Not a valid stream structure
        }
      }
    }

    return results;
  } catch (error) {
    logger.warn(
      '[Streams] streamRead failed, stream operations limited in decentralized mode',
      { error }
    );
    return [];
  }
}
