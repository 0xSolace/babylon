import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import * as jose from 'jose'

/**
 * WebSocket connection state
 */
interface WSConnection {
  id: string
  userId: string | null
  isAuthenticated: boolean
  subscriptions: Set<string>
  lastPing: number
  ws: unknown // Store reference for broadcasting
}

/**
 * Active WebSocket connections by connection ID
 */
const connections = new Map<string, WSConnection>()

/**
 * Channel subscribers - maps channel name to set of connection IDs
 */
const channels = new Map<string, Set<string>>()

/**
 * User connections - maps userId to set of connection IDs (for multi-device)
 */
const userConnections = new Map<string, Set<string>>()

/**
 * Valid channel prefixes
 */
const VALID_CHANNELS = [
  'chat:', // chat:chatId - messages for a specific chat
  'market:', // market:marketId - price updates for a market
  'feed:', // feed:userId - feed updates for a user
  'notifications:', // notifications:userId - notifications for a user
  'agent:', // agent:agentId - agent activity updates
  'global', // global - system-wide announcements
]

/**
 * Validate channel name
 */
function isValidChannel(channel: string): boolean {
  return VALID_CHANNELS.some(
    (prefix) => channel === prefix || channel.startsWith(prefix),
  )
}

/**
 * Get connection ID from WebSocket data
 */
function getConnectionId(ws: {
  data?: { connectionId?: string }
}): string | undefined {
  return ws.data?.connectionId
}

/**
 * Verify JWT token
 */
async function verifyToken(
  token: string,
): Promise<{ userId: string; isAdmin: boolean } | null> {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured', {}, 'WebSocket Auth')
    return null
  }

  const secret = new TextEncoder().encode(jwtSecret)

  const { payload } = await jose.jwtVerify(token, secret)

  if (payload.sub) {
    return {
      userId: payload.sub,
      isAdmin: payload.isAdmin === true,
    }
  }

  return null
}

/**
 * Broadcast message to all subscribers of a channel
 */
export function broadcastToChannel(channel: string, message: object): void {
  const subscribers = channels.get(channel)
  if (!subscribers) return

  const messageStr = JSON.stringify(message)

  for (const connectionId of subscribers) {
    const conn = connections.get(connectionId)
    if (conn?.ws) {
      const ws = conn.ws as { send: (msg: string) => void }
      ws.send(messageStr)
    }
  }
}

/**
 * Send message to a specific user (all their connections)
 */
export function sendToUser(userId: string, message: object): void {
  const userConns = userConnections.get(userId)
  if (!userConns) return

  const messageStr = JSON.stringify(message)

  for (const connectionId of userConns) {
    const conn = connections.get(connectionId)
    if (conn?.ws) {
      const ws = conn.ws as { send: (msg: string) => void }
      ws.send(messageStr)
    }
  }
}

/**
 * WebSocket realtime handlers
 *
 * Provides real-time updates for:
 * - Chat messages (chat:chatId)
 * - Market price updates (market:marketId)
 * - Agent activity (agent:agentId)
 * - Notifications (notifications:userId)
 * - Feed updates (feed:userId)
 */
export const realtimeWS = new Elysia({ prefix: '/ws' }).ws('/realtime', {
  body: t.Object({
    type: t.String(),
    payload: t.Optional(t.Unknown()),
  }),

  open(ws) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Store connection
    const connection: WSConnection = {
      id: connectionId,
      userId: null,
      isAuthenticated: false,
      subscriptions: new Set(),
      lastPing: Date.now(),
      ws,
    }
    connections.set(connectionId, connection)

    // Store connectionId in ws data for later reference
    const wsData = ws as unknown as { data: { connectionId: string } }
    wsData.data = { connectionId }

    ws.send(
      JSON.stringify({
        type: 'connected',
        connectionId,
        message: 'WebSocket connected. Send auth message to authenticate.',
      }),
    )

    logger.info('WebSocket connection opened', { connectionId }, 'WebSocket')
  },

  async message(ws, message) {
    const connectionId = getConnectionId(
      ws as { data?: { connectionId?: string } },
    )
    const connection = connectionId ? connections.get(connectionId) : undefined
    const msg = message as { type: string; payload?: unknown }
    const { type, payload } = msg

    switch (type) {
      case 'auth': {
        if (!connection) {
          ws.send(
            JSON.stringify({ type: 'error', message: 'Connection not found' }),
          )
          return
        }

        const token =
          payload && typeof payload === 'object' && 'token' in payload
            ? String(payload.token)
            : undefined

        if (!token) {
          ws.send(
            JSON.stringify({
              type: 'auth_response',
              success: false,
              error: 'Token required',
            }),
          )
          return
        }

        const verified = await verifyToken(token)

        if (verified) {
          connection.userId = verified.userId
          connection.isAuthenticated = true

          // Add to user connections map
          let userConns = userConnections.get(verified.userId)
          if (!userConns) {
            userConns = new Set()
            userConnections.set(verified.userId, userConns)
          }
          userConns.add(connection.id)

          // Auto-subscribe to user's notifications
          const notifChannel = `notifications:${verified.userId}`
          connection.subscriptions.add(notifChannel)
          let channelSubs = channels.get(notifChannel)
          if (!channelSubs) {
            channelSubs = new Set()
            channels.set(notifChannel, channelSubs)
          }
          channelSubs.add(connection.id)

          ws.send(
            JSON.stringify({
              type: 'auth_response',
              success: true,
              userId: verified.userId,
              isAdmin: verified.isAdmin,
            }),
          )

          logger.info(
            'WebSocket authenticated',
            { connectionId, userId: verified.userId },
            'WebSocket',
          )
        } else {
          ws.send(
            JSON.stringify({
              type: 'auth_response',
              success: false,
              error: 'Invalid or expired token',
            }),
          )
        }
        break
      }

      case 'subscribe': {
        if (!connection?.isAuthenticated) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Authentication required',
            }),
          )
          return
        }

        const channel =
          payload && typeof payload === 'object' && 'channel' in payload
            ? String(payload.channel)
            : undefined

        if (!channel) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Channel name required',
            }),
          )
          return
        }

        if (!isValidChannel(channel)) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: `Invalid channel: ${channel}. Valid prefixes: ${VALID_CHANNELS.join(', ')}`,
            }),
          )
          return
        }

        // Add to subscriptions
        connection.subscriptions.add(channel)

        // Add to channel subscribers
        let channelSubs = channels.get(channel)
        if (!channelSubs) {
          channelSubs = new Set()
          channels.set(channel, channelSubs)
        }
        channelSubs.add(connection.id)

        ws.send(
          JSON.stringify({
            type: 'subscribed',
            channel,
            subscriptionCount: channelSubs.size,
          }),
        )

        logger.info(
          'WebSocket subscribed to channel',
          { connectionId, channel, userId: connection.userId },
          'WebSocket',
        )
        break
      }

      case 'unsubscribe': {
        if (!connection) {
          ws.send(
            JSON.stringify({ type: 'error', message: 'Connection not found' }),
          )
          return
        }

        const channel =
          payload && typeof payload === 'object' && 'channel' in payload
            ? String(payload.channel)
            : undefined

        if (!channel) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Channel name required',
            }),
          )
          return
        }

        // Remove from subscriptions
        connection.subscriptions.delete(channel)

        // Remove from channel subscribers
        const channelSubs = channels.get(channel)
        if (channelSubs) {
          channelSubs.delete(connection.id)
          if (channelSubs.size === 0) {
            channels.delete(channel)
          }
        }

        ws.send(
          JSON.stringify({
            type: 'unsubscribed',
            channel,
          }),
        )

        logger.info(
          'WebSocket unsubscribed from channel',
          { connectionId, channel, userId: connection.userId },
          'WebSocket',
        )
        break
      }

      case 'ping': {
        if (connection) {
          connection.lastPing = Date.now()
        }
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

  close(ws) {
    const connectionId = getConnectionId(
      ws as { data?: { connectionId?: string } },
    )
    if (!connectionId) return

    const connection = connections.get(connectionId)
    if (!connection) return

    // Remove from all subscribed channels
    for (const channel of connection.subscriptions) {
      const channelSubs = channels.get(channel)
      if (channelSubs) {
        channelSubs.delete(connectionId)
        if (channelSubs.size === 0) {
          channels.delete(channel)
        }
      }
    }

    // Remove from user connections
    if (connection.userId) {
      const userConns = userConnections.get(connection.userId)
      if (userConns) {
        userConns.delete(connectionId)
        if (userConns.size === 0) {
          userConnections.delete(connection.userId)
        }
      }
    }

    // Remove connection
    connections.delete(connectionId)

    logger.info(
      'WebSocket connection closed',
      { connectionId, userId: connection.userId },
      'WebSocket',
    )
  },
})

/**
 * Get WebSocket stats for monitoring
 */
export function getWebSocketStats(): {
  totalConnections: number
  authenticatedConnections: number
  totalChannels: number
  channelStats: Array<{ channel: string; subscribers: number }>
} {
  let authenticatedCount = 0
  for (const conn of connections.values()) {
    if (conn.isAuthenticated) authenticatedCount++
  }

  const channelStats = Array.from(channels.entries()).map(
    ([channel, subscribers]) => ({
      channel,
      subscribers: subscribers.size,
    }),
  )

  return {
    totalConnections: connections.size,
    authenticatedConnections: authenticatedCount,
    totalChannels: channels.size,
    channelStats,
  }
}
