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

export const generateConnectionId = () => randomBytes(12).toString('hex')

/**
 * Broadcast data to a realtime channel
 */
export async function broadcastToChannel(
  channel: RealtimeChannel,
  data: JsonValue,
): Promise<void> {
  await publishEvent({
    channel,
    type:
      typeof data === 'object' && data !== null && 'type' in data
        ? String((data as Record<string, unknown>).type)
        : 'message',
    data,
    timestamp: Date.now(),
  })
}

/**
 * Send follow notification to a user
 */
export async function notifyFollow(
  userId: string,
  followerId: string,
): Promise<void> {
  await publishEvent({
    channel: `notifications:${userId}`,
    type: 'follow',
    data: { userId, followerId },
    timestamp: Date.now(),
  })
}

/**
 * Send group chat invite notification to a user
 */
export async function notifyGroupChatInvite(
  userId: string,
  inviterId: string,
  chatId: string,
  chatName: string,
): Promise<void> {
  await publishEvent({
    channel: `notifications:${userId}`,
    type: 'group_chat_invite',
    data: { userId, inviterId, chatId, chatName },
    timestamp: Date.now(),
  })
}
