/**
 * Redis Streams Support (Decentralized)
 *
 * Provides Redis Streams operations using decentralized cache.
 * Note: Full Redis stream semantics are not supported in decentralized mode.
 * For real-time messaging, use Farcaster or the messaging service.
 */

import { isJsonRecord } from '@babylon/shared'
import type { JsonValue } from '../types'
import { getRedisClient } from './client'

/**
 * Convert a payload object into Redis stream field/value pairs (stringified).
 */
const encodeStreamPayload = (payload: Record<string, JsonValue>) => {
  return {
    payload: JSON.stringify(payload),
  }
}

/**
 * Add an entry to a stream.
 *
 * Note: In decentralized mode, this is simplified - no MAXLEN support.
 */
export async function streamAdd(
  stream: string,
  payload: Record<string, JsonValue>,
  _opts?: { maxlen?: number },
): Promise<string | null> {
  const client = getRedisClient()
  const entry = encodeStreamPayload(payload)

  // Convert entry to field/value pairs
  const args: string[] = []
  Object.entries(entry).forEach(([key, value]) => {
    args.push(key, String(value))
  })

  return await client.xadd(stream, '*', ...args)
}

export interface StreamMessage<T = Record<string, unknown>> {
  stream: string
  id: string
  payload: T
}

/**
 * Extract payload from stream entry data
 */
const extractPayload = (
  data: Record<string, string>,
): Record<string, unknown> => {
  if (data.payload) {
    const parsed: unknown = JSON.parse(data.payload)
    if (isJsonRecord(parsed)) {
      return parsed
    }
    return {}
  }
  // data is already Record<string, string>, which is a valid Record<string, unknown>
  return data
}

/**
 * Read entries from streams.
 *
 * Note: In decentralized mode, this is a simplified implementation.
 * Real-time streaming is not fully supported - use Farcaster or messaging service.
 */
export async function streamRead(
  streams: string[],
  _ids: string[],
  _opts?: { count?: number; block?: number },
): Promise<StreamMessage[]> {
  const client = getRedisClient()
  const results: StreamMessage[] = []

  for (const stream of streams) {
    // Get all entries from the stream (simplified - no ID tracking)
    const streamData = await client.get(stream)

    if (streamData) {
      const parsed: unknown = JSON.parse(streamData)
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (
            typeof entry === 'object' &&
            entry !== null &&
            'id' in entry &&
            typeof entry.id === 'string' &&
            'data' in entry &&
            typeof entry.data === 'object' &&
            entry.data !== null
          ) {
            const payload = extractPayload(entry.data as Record<string, string>)
            results.push({ stream, id: entry.id, payload })
          }
        }
      }
    }
  }

  return results
}
