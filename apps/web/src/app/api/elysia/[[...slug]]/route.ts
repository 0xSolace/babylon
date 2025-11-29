/**
 * Elysia API Route Handler
 *
 * This catch-all route handles all Elysia API requests under /api/elysia/*
 * Uses the shared infrastructure from @babylon/api/elysia
 */
import { createApp, authPlugin, optionalAuthPlugin } from '@babylon/api/elysia';

// Create app with /api/elysia prefix
const app = createApp('/api/elysia')
  // Root endpoint
  .get(
    '/',
    () => ({
      message: 'Babylon Elysia API',
      version: '1.0.0',
    }),
    {
      detail: {
        tags: ['System'],
        summary: 'Root endpoint',
        description: 'Returns API information',
      },
    }
  )
  // Health check
  .get(
    '/health',
    () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns the API health status and current timestamp',
      },
    }
  )
  // Example authenticated endpoint
  .use(authPlugin)
  .get(
    '/me',
    async ({ authenticate }) => {
      const user = await authenticate();
      return {
        userId: user.userId,
        privyId: user.privyId,
        isAgent: user.isAgent,
      };
    },
    {
      detail: {
        tags: ['Users'],
        summary: 'Get current user',
        description: 'Returns the authenticated user info',
        security: [{ PrivyAuth: [] }],
      },
    }
  )
  // Example optional auth endpoint
  .use(optionalAuthPlugin)
  .get(
    '/session',
    async ({ user }) => ({
      authenticated: user !== null,
      userId: user?.userId ?? null,
    }),
    {
      detail: {
        tags: ['Users'],
        summary: 'Check session',
        description: 'Returns session status (works for both authenticated and anonymous users)',
      },
    }
  );

// Export type for Eden Treaty
export type App = typeof app;

// Export HTTP method handlers for Next.js 16
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const DELETE = app.handle;
export const PATCH = app.handle;
