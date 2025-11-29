/**
 * Elysia Error Handling Plugin
 *
 * Global error handling for all API routes
 */

import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { BabylonError, isAuthenticationError } from '../../errors';
import { logger } from '@babylon/shared';

/**
 * Error handling plugin that catches and formats all errors
 */
export const errorPlugin = new Elysia({ name: 'error-handler' }).onError(
  ({ error, request, set }) => {
    const url = new URL(request.url);
    const errorContext = {
      url: url.pathname,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    // Handle authentication errors (401)
    if (
      isAuthenticationError(error) ||
      (error instanceof Error &&
        (error.message.includes('authentication') ||
          error.message.includes('token') ||
          error.message.includes('Unauthorized')))
    ) {
      set.status = 401;
      return {
        error: error instanceof Error ? error.message : 'Authentication required',
      };
    }

    // Handle Zod validation errors (400)
    if (error instanceof ZodError) {
      logger.warn('Validation error', {
        error: error.message,
        issues: error.issues,
        ...errorContext,
      });
      set.status = 400;
      return {
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    // Handle Babylon custom errors
    if (error instanceof BabylonError) {
      if (error.statusCode >= 400 && error.statusCode < 500) {
        logger.warn('Client error', {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
          ...errorContext,
        });
      } else {
        logger.error('Server error', {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
          ...errorContext,
        });
      }

      set.status = error.statusCode;

      const response: Record<string, unknown> = { error: error.message };
      if (error.context?.details) {
        response.details = error.context.details;
      }
      if (process.env.NODE_ENV === 'development') {
        response.code = error.code;
      }
      return response;
    }

    // Handle NotFoundError-like errors
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('Not found'))
    ) {
      set.status = 404;
      return { error: error.message };
    }

    // Handle generic errors (500)
    logger.error('Unhandled error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      ...errorContext,
    });

    set.status = 500;
    return {
      error:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }
);

