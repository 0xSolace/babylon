/**
 * Elysia App Factory
 *
 * Creates the base Elysia application with common plugins
 */

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { errorPlugin } from './plugins/error';
import { loggingPlugin } from './plugins/logging';

/**
 * Swagger documentation configuration
 */
const swaggerConfig = {
  path: '/docs',
  documentation: {
    info: {
      title: 'Babylon API',
      version: '1.0.0',
      description: 'API documentation for Babylon social conspiracy game',
      contact: {
        name: 'API Support',
        url: 'https://github.com/elizaos/babylon',
      },
    },
    components: {
      securitySchemes: {
        PrivyAuth: {
          type: 'http' as const,
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Privy authentication token (via cookie or Authorization header)',
        },
        BearerAuth: {
          type: 'http' as const,
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer authentication token (alias for PrivyAuth)',
        },
        CronSecret: {
          type: 'http' as const,
          scheme: 'bearer',
          description:
            'Cron secret for scheduled jobs (CRON_SECRET environment variable)',
        },
      },
    },
    tags: [
      { name: 'System', description: 'System health and statistics' },
      { name: 'Users', description: 'User profiles and authentication' },
      { name: 'Posts', description: 'Social feed and post management' },
      { name: 'Agents', description: 'Autonomous agent management' },
      { name: 'Chats', description: 'Group chats and direct messages' },
      { name: 'Trading', description: 'Trading feed and markets' },
      { name: 'Notifications', description: 'User notification system' },
      { name: 'A2A Protocol', description: 'Agent-to-Agent communication protocol' },
      { name: 'Admin', description: 'Administrative endpoints' },
      { name: 'Cron', description: 'Scheduled background jobs' },
    ],
  },
};

/**
 * Create a new Elysia app with common plugins
 *
 * @param prefix - URL prefix for all routes (default: '/api')
 * @returns Configured Elysia instance
 *
 * @example
 * ```typescript
 * import { createApp } from '@babylon/api/elysia';
 *
 * const app = createApp('/api')
 *   .get('/health', () => ({ status: 'ok' }))
 *   .listen(3000);
 * ```
 */
export function createApp(prefix = '/api') {
  return new Elysia({ prefix, aot: false })
    .use(swagger(swaggerConfig))
    .use(errorPlugin)
    .use(loggingPlugin);
}

/**
 * Create a minimal Elysia app without Swagger (for sub-routers)
 */
export function createRouter(prefix = '') {
  return new Elysia({ prefix });
}
