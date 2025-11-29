/**
 * Elysia Logging Plugin
 *
 * Request/response logging with performance tracking
 */

import { Elysia } from 'elysia';
import { logger } from '@babylon/shared';

/**
 * Logging plugin that tracks request duration and logs request/response info
 */
export const loggingPlugin = new Elysia({ name: 'logging' })
  .derive({ as: 'global' }, () => ({
    requestStartTime: Date.now(),
  }))
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    logger.debug(
      'Incoming request',
      {
        method: request.method,
        path: url.pathname,
        query: url.search,
      },
      'elysia'
    );
  })
  .onAfterResponse(({ request, set, requestStartTime }) => {
    const duration = Date.now() - requestStartTime;
    const url = new URL(request.url);

    // Only log non-health check routes at info level
    const logLevel = url.pathname === '/api/health' ? 'debug' : 'info';

    logger[logLevel](
      'Request completed',
      {
        method: request.method,
        path: url.pathname,
        status: set.status ?? 200,
        duration: `${duration}ms`,
      },
      'elysia'
    );
  })
  .onError(({ request, error, set }) => {
    const url = new URL(request.url);

    logger.error(
      'Request error',
      {
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        status: set.status ?? 500,
      },
      'elysia'
    );
  });

