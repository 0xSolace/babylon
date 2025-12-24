import type { JsonValue } from '@babylon/shared'
import { Elysia, t } from 'elysia'

/**
 * WebSocket connection state
 */
interface WSConnection {
  userId: string
  subscriptions: Set<string>
  lastPing: number
}

/**
 * Active WebSocket connections
 */
const connections = new Map<string, WSConnection>()

/**
 * Channel subscribers
 */
const channels = new Map<string, Set<string>>()

/**
 * Broadcast message to a channel
 */
export function broadcast(channel: string, message: JsonValue): void {
  const subscribers = channels.get(channel)
  if (!subscribers) return

  const payload = JSON.stringify({
    channel,
    data: message,
    timestamp: Date.now(),
  })

  for (const connectionId of subscribers) {
    const conn = connections.get(connectionId)
    if (conn) {
      // In Elysia, we'd need to store the actual WebSocket reference
      // This is a simplified version showing the pattern
      console.log(`Broadcasting to ${connectionId}:`, payload)
    }
  }
}

/**
 * WebSocket realtime handlers
 *
 * Provides real-time updates for:
 * - Chat messages
 * - Market price updates
 * - Agent activity
 * - Notifications
 * - Feed updates
 *
 * TODO: Implement full WebSocket handling with authentication
 */
export const realtimeWS = new Elysia({ prefix: '/ws' }).ws('/realtime', {
  body: t.Object({
    type: t.String(),
    payload: t.Optional(t.Unknown()),
  }),

  open(ws) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Store connection (need to verify auth token first)
    connections.set(connectionId, {
      userId: 'pending', // Will be set after auth
      subscriptions: new Set(),
      lastPing: Date.now(),
    })

    ws.send(
      JSON.stringify({
        type: 'connected',
        connectionId,
        message: 'WebSocket connected. Send auth message to authenticate.',
      }),
    )
  },

  message(ws, message) {
    const { type, payload } = message

    switch (type) {
      case 'auth': {
        // TODO: Verify JWT token and associate with connection
        // const token = payload?.token;
        // const verified = await jwt.verify(token);
        ws.send(
          JSON.stringify({
            type: 'auth_response',
            todo: 'Implement JWT verification',
            status: 'pending',
          }),
        )
        break
      }

      case 'subscribe': {
        // Subscribe to a channel
        const channel =
          payload && typeof payload === 'object' && 'channel' in payload
            ? String(payload.channel)
            : undefined
        ws.send(
          JSON.stringify({
            type: 'subscribed',
            channel,
            todo: 'Implement channel subscription',
          }),
        )
        break
      }

      case 'unsubscribe': {
        // Unsubscribe from a channel
        const channel =
          payload && typeof payload === 'object' && 'channel' in payload
            ? String(payload.channel)
            : undefined
        ws.send(
          JSON.stringify({
            type: 'unsubscribed',
            channel,
          }),
        )
        break
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
        break
      }

      default: {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${type}`,
          }),
        )
      }
    }
  },

  close(_ws) {
    // Clean up connection
    // TODO: Remove from connections map and channels
    console.log('WebSocket connection closed')
  },
})

/**
 * Channel types for subscription
 */
export const CHANNELS = {
  // User-specific channels
  USER_NOTIFICATIONS: (userId: string) => `user:${userId}:notifications`,
  USER_MESSAGES: (userId: string) => `user:${userId}:messages`,

  // Market channels
  MARKET_PRICES: (marketId: string) => `market:${marketId}:prices`,
  MARKET_TRADES: (marketId: string) => `market:${marketId}:trades`,

  // Chat channels
  CHAT_ROOM: (chatId: string) => `chat:${chatId}:messages`,

  // Global channels
  GLOBAL_FEED: 'global:feed',
  GLOBAL_MARKETS: 'global:markets',
  AGENT_ACTIVITY: 'global:agents',
} as const
