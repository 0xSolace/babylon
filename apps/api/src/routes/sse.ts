import { logger } from '@babylon/shared'
import { Elysia, t } from 'elysia'
import * as jose from 'jose'
import { authMiddleware, getAuthContext } from '../middleware'

const TOKEN_EXPIRATION_SECONDS = 300

interface SSEConnection {
  userId: string
  subscriptions: Set<string>
  eventQueue: Array<{ event: string; data: unknown }>
}

const sseConnections = new Map<string, SSEConnection>()

function getJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET not configured')
  return new TextEncoder().encode(jwtSecret)
}

async function generateRealtimeToken(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_SECONDS * 1000)
  const token = await new jose.SignJWT({ type: 'realtime', userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret())
  return { token, expiresAt }
}

async function verifyRealtimeToken(
  token: string,
): Promise<{ userId: string } | null> {
  const { payload } = await jose.jwtVerify(token, getJwtSecret())
  return payload.type === 'realtime' && payload.sub
    ? { userId: payload.sub }
    : null
}

export function pushSSEEvent(
  userId: string,
  event: string,
  data: unknown,
): void {
  for (const conn of sseConnections.values()) {
    if (conn.userId === userId) conn.eventQueue.push({ event, data })
  }
}

export function pushSSEChannelEvent(
  channel: string,
  event: string,
  data: unknown,
): void {
  for (const conn of sseConnections.values()) {
    if (conn.subscriptions.has(channel)) conn.eventQueue.push({ event, data })
  }
}

/**
 * SSE/Realtime routes
 * Provides Server-Sent Events for realtime updates
 */
const createSseRoutes = () =>
  new Elysia({ prefix: '/api/realtime' })
    .use(authMiddleware)

    // Get realtime connection token
    .get(
      '/token',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        const { token, expiresAt } = await generateRealtimeToken(user.userId)

        logger.info(
          'Realtime token generated',
          { userId: user.userId, expiresAt: expiresAt.toISOString() },
          'GET /api/realtime/token',
        )

        return {
          success: true,
          token,
          expiresAt: expiresAt.toISOString(),
          expiresIn: TOKEN_EXPIRATION_SECONDS,
          // Also provide WebSocket URL for clients that prefer WS
          wsUrl: '/ws/realtime',
        }
      },
      {
        detail: {
          tags: ['Realtime'],
          summary: 'Get realtime connection token',
          description:
            'Generates a short-lived token for SSE or WebSocket connections',
        },
      },
    )

    // SSE event stream
    .get(
      '/events',
      async function* (ctx) {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { query, set } = ctx

        // Auth: cookie-based or token-based
        let userId = isAuthenticated && user ? user.userId : undefined
        if (!userId && query.token) {
          const verified = await verifyRealtimeToken(query.token)
          if (verified) userId = verified.userId
        }

        if (!userId) {
          set.status = 401
          yield `event: error\ndata: ${JSON.stringify({ error: 'Unauthorized' })}\n\n`
          return
        }

        // SSE headers
        Object.assign(set.headers, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        })

        const connectionId = `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const connection: SSEConnection = {
          userId,
          subscriptions: new Set([`notifications:${userId}`]),
          eventQueue: [],
        }
        sseConnections.set(connectionId, connection)

        logger.info('SSE connection opened', { connectionId, userId }, 'SSE')

        yield `event: connected\ndata: ${JSON.stringify({
          connectionId,
          userId,
          subscriptions: [...connection.subscriptions],
        })}\n\n`

        // Event loop with simple heartbeat counter
        const MAX_DURATION_MS = 3600000
        const HEARTBEAT_MS = 30000
        const POLL_MS = 100
        const startTime = Date.now()
        let lastHeartbeat = startTime

        while (Date.now() - startTime < MAX_DURATION_MS) {
          // Drain event queue
          while (connection.eventQueue.length > 0) {
            const ev = connection.eventQueue.shift()
            if (ev)
              yield `event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`
          }

          await new Promise((r) => setTimeout(r, POLL_MS))

          // Heartbeat
          const now = Date.now()
          if (now - lastHeartbeat >= HEARTBEAT_MS) {
            yield `event: heartbeat\ndata: ${JSON.stringify({ timestamp: now })}\n\n`
            lastHeartbeat = now
          }
        }

        sseConnections.delete(connectionId)
        logger.info('SSE connection closed', { connectionId, userId }, 'SSE')
      },
      {
        query: t.Object({ token: t.Optional(t.String()) }),
        detail: {
          tags: ['Realtime'],
          summary: 'SSE event stream',
          description:
            'Server-Sent Events stream. Auth via cookie or token query param.',
        },
      },
    )

    // Subscribe to channel
    .post(
      '/subscribe',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        if (!isAuthenticated || !user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        const body = ctx.body as { channel: string; connectionId: string }
        const conn = sseConnections.get(body.connectionId)
        if (!conn || conn.userId !== user.userId) {
          ctx.set.status = 404
          return { error: 'Connection not found' }
        }

        conn.subscriptions.add(body.channel)
        logger.info(
          'SSE subscribed',
          { connectionId: body.connectionId, channel: body.channel },
          'SSE',
        )
        return {
          success: true,
          channel: body.channel,
          subscriptions: [...conn.subscriptions],
        }
      },
      {
        body: t.Object({ channel: t.String(), connectionId: t.String() }),
        detail: { tags: ['Realtime'], summary: 'Subscribe to channel' },
      },
    )

    // Unsubscribe from channel
    .post(
      '/unsubscribe',
      async (ctx) => {
        const { user, isAuthenticated } = getAuthContext(ctx)
        if (!isAuthenticated || !user) {
          ctx.set.status = 401
          return { error: 'Unauthorized' }
        }

        const body = ctx.body as { channel: string; connectionId: string }
        const conn = sseConnections.get(body.connectionId)
        if (!conn || conn.userId !== user.userId) {
          ctx.set.status = 404
          return { error: 'Connection not found' }
        }

        conn.subscriptions.delete(body.channel)
        logger.info(
          'SSE unsubscribed',
          { connectionId: body.connectionId, channel: body.channel },
          'SSE',
        )
        return {
          success: true,
          channel: body.channel,
          subscriptions: [...conn.subscriptions],
        }
      },
      {
        body: t.Object({ channel: t.String(), connectionId: t.String() }),
        detail: { tags: ['Realtime'], summary: 'Unsubscribe from channel' },
      },
    )

export const sseRoutes = createSseRoutes()
