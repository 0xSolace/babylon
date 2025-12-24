import { Elysia } from 'elysia'
import { authMiddleware, getAuthContext } from '../middleware'

/**
 * SSE/Realtime routes
 * TODO: Migrate from apps/web/app/api/realtime/*
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
        return {
          todo: 'Migrate realtime token generation',
          source: 'apps/web/app/api/realtime/token/route.ts',
          userId: user.userId,
        }
      },
      {
        detail: {
          tags: ['Realtime'],
          summary: 'Get realtime connection token',
        },
      },
    )

    // SSE event stream
    .get(
      '/events',
      async function* (ctx) {
        const { user, isAuthenticated } = getAuthContext(ctx)
        const { set } = ctx
        if (!isAuthenticated || !user) {
          set.status = 401
          return
        }

        set.headers['Content-Type'] = 'text/event-stream'
        set.headers['Cache-Control'] = 'no-cache'
        set.headers.Connection = 'keep-alive'

        // Send initial connection event
        yield `data: ${JSON.stringify({ type: 'connected', userId: user.userId })}\n\n`

        // Keep-alive loop (placeholder - real implementation would subscribe to event sources)
        let iterations = 0
        while (iterations < 100) {
          await new Promise((resolve) => setTimeout(resolve, 30000))
          yield `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`
          iterations++
        }
      },
      {
        detail: {
          tags: ['Realtime'],
          summary: 'SSE event stream',
          description:
            'Server-Sent Events stream for realtime updates. Consider using WebSocket for better performance.',
        },
      },
    )

export const sseRoutes = createSseRoutes()
