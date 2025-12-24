import { randomBytes } from 'node:crypto'
import { logger } from '@babylon/shared'
import { streamAdd } from '../redis'
import type { JsonValue } from '../types'

// import { enqueueOutbox } from './outbox'; // Uncomment when needed

/**
 * Supported realtime channels.
 */
export type RealtimeChannel =
  | 'feed'
  | 'markets'
  | 'breaking-news'
  | 'upcoming-events'
  | `chat:${string}`
  | `notifications:${string}`
  | string

export interface RealtimeEventEnvelope<T extends JsonValue = JsonValue> {
  channel: RealtimeChannel
  type: string
  version?: string
  data: T
  timestamp: number
}

/** @deprecated Use RealtimeSubscriptionClaims instead */
export interface RealtimeTokenPayload {
  userId: string
  channels: RealtimeChannel[]
  exp: number // epoch seconds
  iat: number // epoch seconds
}

/**
 * @deprecated Use PermissionlessRealtimeManager instead
 * This uses a shared secret - prefer wallet-signed tokens
 */
export function signRealtimeToken(_payload: RealtimeTokenPayload): string {
  throw new Error(
    'signRealtimeToken is deprecated. Use PermissionlessRealtimeManager instead.',
  )
}

/**
 * @deprecated Use verifySubscriptionToken instead
 * This uses a shared secret - prefer wallet-signed tokens
 */
export function verifyRealtimeToken(
  _token: string,
): RealtimeTokenPayload | null {
  throw new Error(
    'verifyRealtimeToken is deprecated. Use verifySubscriptionToken instead.',
  )
}

/**
 * Publish an event to a realtime channel.
 *
 * Contract:
 * - If DB logic fails upstream, surface the error (caller decides).
 * - If publish fails but upstream work succeeded, we log and rely on the
 *   outbox/worker to replay later.
 */
export async function publishEvent(
  event: RealtimeEventEnvelope,
  opts?: { maxlen?: number },
): Promise<void> {
  const streamKey = toStreamKey(event.channel)
  const res = await streamAdd(
    streamKey,
    { ...event, version: event.version ?? 'v1' } as Record<string, JsonValue>,
    {
      maxlen: opts?.maxlen ?? 10_000,
    },
  )
  if (!res) {
    throw new Error('streamAdd returned null (Redis not available)')
  }
  logger.info(
    'Realtime event published',
    { channel: event.channel, type: event.type, streamId: res },
    'Realtime',
  )
}

export const toStreamKey = (channel: RealtimeChannel) => `realtime:${channel}`

/**
 * @deprecated Use createSubscriptionMessage + wallet signature instead
 *
 * For permissionless realtime auth:
 * ```ts
 * import { createSubscriptionMessage, createSubscriptionToken } from '@babylon/api';
 *
 * const { message, claims } = createSubscriptionMessage(address, channels);
 * const signature = await wallet.signMessage(message);
 * const token = createSubscriptionToken(claims, signature);
 * ```
 */
export function issueRealtimeToken(_params: {
  userId: string
  channels: RealtimeChannel[]
  ttlSeconds?: number
}): string {
  throw new Error(
    'issueRealtimeToken is deprecated. Use createSubscriptionMessage + wallet signature instead.',
  )
}

export const generateConnectionId = () => randomBytes(12).toString('hex')
