import { Elysia } from 'elysia'
import {
  banCheckMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
} from './middleware'
import {
  a2aRoutes,
  actorsRoutes,
  adminRoutes,
  agentsRoutes,
  airdropRoutes,
  authRoutes,
  chatsRoutes,
  cronRoutes,
  feedbackRoutes,
  groupsRoutes,
  healthRoutes,
  icoRoutes,
  leaderboardRoutes,
  marketsRoutes,
  mcpRoutes,
  messagingRoutes,
  moderationRoutes,
  notificationsRoutes,
  postsRoutes,
  sseRoutes,
  usersRoutes,
} from './routes'
import { realtimeWS } from './ws/realtime'

/**
 * Babylon API Server
 *
 * Elysia-based backend server for Babylon services.
 * Migrated from Next.js API routes for better performance and type safety.
 */
const createApp = () =>
  new Elysia()
    // Global error handling
    .onError(({ code, error, set }) => {
      console.error(`[Error] ${code}:`, error)

      if (code === 'VALIDATION') {
        set.status = 400
        return {
          error: 'Validation Error',
          message: 'message' in error ? error.message : 'Validation failed',
        }
      }

      if (code === 'NOT_FOUND') {
        set.status = 404
        return {
          error: 'Not Found',
          message: 'The requested resource was not found',
        }
      }

      set.status = 500
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      return {
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'development'
            ? errorMessage
            : 'An unexpected error occurred',
      }
    })

    // Request logging
    .onBeforeHandle(({ request }) => {
      const url = new URL(request.url)
      console.log(
        `[${new Date().toISOString()}] ${request.method} ${url.pathname}`,
      )
    })

    // CORS
    .use(corsMiddleware)

    // Rate limiting (applied globally)
    .use(rateLimitMiddleware)

    // Ban check (applied globally for authenticated routes)
    .use(banCheckMiddleware)

    // Root endpoint
    .get('/', () => ({
      name: 'Babylon API Server',
      version: '1.0.0',
      docs: '/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    }))

    // API documentation stub
    .get('/docs', () => ({
      message: 'API Documentation',
      description:
        'Swagger UI will be enabled once zod compatibility is resolved',
      routes: [
        'GET /health - Health check',
        'GET /api/users/me - Current user profile',
        'GET /api/markets/* - Market endpoints',
        'GET /api/agents/* - Agent endpoints',
        'GET /api/chats/* - Chat endpoints',
        'GET /api/posts - Feed/posts endpoints',
        'GET /api/admin/* - Admin endpoints',
        'POST /api/cron/* - Cron triggers',
        'GET /api/realtime/* - SSE/realtime',
        '* /api/a2a/* - A2A protocol',
        '* /api/mcp/* - MCP protocol',
        'GET /api/ico/status - ICO status',
        'POST /api/admin/ico/* - ICO admin endpoints',
        'WS /ws/realtime - WebSocket realtime',
      ],
    }))

    // Mount all routes
    .use(healthRoutes)
    .use(authRoutes)
    .use(usersRoutes)
    .use(leaderboardRoutes)
    .use(actorsRoutes)
    .use(marketsRoutes)
    .use(agentsRoutes)
    .use(chatsRoutes)
    .use(postsRoutes)
    .use(adminRoutes)
    .use(cronRoutes)
    .use(sseRoutes)
    .use(a2aRoutes)
    .use(mcpRoutes)
    .use(icoRoutes)
    .use(airdropRoutes)
    .use(feedbackRoutes)
    .use(groupsRoutes)
    .use(messagingRoutes)
    .use(moderationRoutes)
    .use(notificationsRoutes)

    // WebSocket handlers
    .use(realtimeWS)

export const app = createApp()
export type App = typeof app
