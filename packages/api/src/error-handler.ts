/**
 * Global error handler and middleware for API routes
 *
 * Architecture:
 * - All functions are framework-agnostic
 * - Works with Elysia, standard Request/Response, or any framework
 * - Core functions use standard web APIs
 */

import { DatabaseError } from '@babylon/db'
import type { JsonValue } from '@babylon/shared'
import { isAuthenticationError, isBabylonError, logger } from '@babylon/shared'
import { toNull } from '@jejunetwork/shared'
import type { ZodError } from 'zod'
import type { ElysiaContext } from './auth-middleware'
import { safeToJsonRecord, toJsonValueOrNull } from './utils/type-guards'

// =============================================================================
// Framework-agnostic types
// =============================================================================

/**
 * Options for error tracking and logging
 */
export interface ErrorHandlerOptions {
  /**
   * Function to track errors with analytics (e.g., PostHog)
   */
  trackError?: (
    userId: string | null,
    error: Error,
    context: Record<string, JsonValue>,
  ) => void | Promise<void>

  /**
   * Function to capture errors in error tracking (e.g., Sentry)
   */
  captureError?: (error: Error, context: Record<string, JsonValue>) => void
}

/**
 * Error processing result - framework-agnostic
 */
export interface ProcessedError {
  statusCode: number
  body: Record<string, JsonValue>
  headers?: Record<string, string>
  shouldLog: boolean
  logLevel: 'error' | 'warn' | 'debug'
}

/**
 * Request context for error processing - framework-agnostic
 */
export interface ErrorRequestContext {
  url: string
  method: string
  headers: Record<string, string>
  userId?: string | null
}

/**
 * Type guard to check if an error is a ZodError
 */
function isZodError(error: Error): error is ZodError {
  return error.constructor.name === 'ZodError' || 'issues' in error
}

/**
 * Type guard to check if an error is a DatabaseError
 */
function isDbError(error: Error): error is DatabaseError {
  return (
    error instanceof DatabaseError || error.constructor.name === 'DatabaseError'
  )
}

/**
 * Process an error and return structured error data (framework-agnostic)
 */
export function processError(
  error: Error | unknown,
  context: ErrorRequestContext,
  options?: ErrorHandlerOptions,
): ProcessedError {
  // Handle unknown errors
  if (!(error instanceof Error)) {
    logger.error('Unknown error type', {
      error: String(error),
      ...context,
      timestamp: new Date().toISOString(),
    })

    return {
      statusCode: 500,
      body: {
        error: {
          message: 'An unexpected error occurred',
          code: 'UNKNOWN_ERROR',
        },
      },
      shouldLog: true,
      logLevel: 'error',
    }
  }

  const authHeader = context.headers.authorization
  const isTestToken = authHeader?.includes('test-token')

  // Handle authentication errors early
  if (isAuthenticationError(error)) {
    if (!isTestToken) {
      logger.warn('Authentication failed', {
        error: error.message,
        ...context,
        timestamp: new Date().toISOString(),
      })
    }

    return {
      statusCode: 401,
      body: { error: error.message || 'Authentication required' },
      shouldLog: false,
      logLevel: 'warn',
    }
  }

  // Handle validation errors early
  if (isZodError(error)) {
    if (!isTestToken) {
      logger.warn('Validation error', {
        error: error.message,
        issues: error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.map(String),
        })),
        name: error.name,
        ...context,
        timestamp: new Date().toISOString(),
      })
    }

    return {
      statusCode: 400,
      body: {
        error: 'Validation failed',
        details: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      },
      shouldLog: false,
      logLevel: 'warn',
    }
  }

  // Handle client errors (4xx)
  if (
    isBabylonError(error) &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    logger.warn('Client error', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      ...context,
      timestamp: new Date().toISOString(),
    })

    const errorData: Record<string, JsonValue> = { error: error.message }
    const clientErrorDetails = toJsonValueOrNull(error.context?.details)
    if (clientErrorDetails !== null) {
      errorData.details = clientErrorDetails
    }
    if (process.env.NODE_ENV === 'development') {
      errorData.code = error.code
      if (error.stack) {
        errorData.stack = error.stack
      }
    }

    return {
      statusCode: error.statusCode,
      body: errorData,
      headers:
        error.code === 'RATE_LIMIT' && error.context?.retryAfter
          ? { 'Retry-After': String(error.context.retryAfter) }
          : undefined,
      shouldLog: false,
      logLevel: 'warn',
    }
  }

  // Log unexpected errors at ERROR level
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
    timestamp: new Date().toISOString(),
  })

  // Track error with analytics
  const userId = toNull(context.userId)
  const isClientError =
    isBabylonError(error) && error.statusCode >= 400 && error.statusCode < 500

  if (
    options?.trackError &&
    !isAuthenticationError(error) &&
    !isZodError(error) &&
    !isClientError
  ) {
    void options.trackError(userId, error, {
      endpoint: new URL(context.url).pathname,
      method: context.method,
    })
  }

  // Capture error in error tracking
  const shouldCaptureInErrorTracking =
    options?.captureError &&
    !isZodError(error) &&
    !(isBabylonError(error) && error.isOperational && error.statusCode < 500) &&
    !isAuthenticationError(error) &&
    error.name !== 'ValidationError'

  if (shouldCaptureInErrorTracking && options.captureError) {
    const captureContext: Record<string, JsonValue> = {
      request: {
        url: context.url,
        method: context.method,
        headers: context.headers,
      },
    }
    if (userId) {
      captureContext.user = { id: userId }
    }
    if (isBabylonError(error) && error.context) {
      captureContext.error = {
        context: safeToJsonRecord(error.context),
        code: error.code,
      }
    }
    options.captureError(error, captureContext)
  }

  // Handle Babylon errors (our custom errors)
  if (isBabylonError(error)) {
    const errorData: Record<string, JsonValue> = { error: error.message }
    const babylonErrorDetails = toJsonValueOrNull(error.context?.details)
    if (babylonErrorDetails !== null) {
      errorData.details = babylonErrorDetails
    }
    if (process.env.NODE_ENV === 'development') {
      errorData.code = error.code
      if (error.stack) {
        errorData.stack = error.stack
      }
    }

    return {
      statusCode: error.statusCode,
      body: errorData,
      headers:
        error.code === 'RATE_LIMIT' && error.context?.retryAfter
          ? { 'Retry-After': String(error.context.retryAfter) }
          : undefined,
      shouldLog: false,
      logLevel: 'error',
    }
  }

  // Handle database errors
  if (isDbError(error)) {
    return processDatabaseError(error)
  }

  // Handle native JavaScript errors
  if (error.name === 'SyntaxError') {
    return {
      statusCode: 400,
      body: { error: 'Invalid JSON in request body' },
      shouldLog: false,
      logLevel: 'warn',
    }
  }

  if (error.name === 'TypeError') {
    return {
      statusCode: 500,
      body: {
        error:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
      },
      shouldLog: true,
      logLevel: 'error',
    }
  }

  // Default Error handling
  const errorData: Record<string, JsonValue> = {
    error:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorData.stack = error.stack
  }

  return {
    statusCode: 500,
    body: errorData,
    shouldLog: true,
    logLevel: 'error',
  }
}

/**
 * Handle database-specific errors
 */
function processDatabaseError(
  error: DatabaseError & { code?: string },
): ProcessedError {
  const errorCode = 'code' in error ? error.code : undefined

  switch (errorCode) {
    case '23505': // PostgreSQL unique_violation
      return {
        statusCode: 409,
        body: { error: 'A record with this value already exists' },
        shouldLog: false,
        logLevel: 'warn',
      }

    case '23503': // PostgreSQL foreign_key_violation
      return {
        statusCode: 400,
        body: { error: 'Foreign key constraint failed' },
        shouldLog: false,
        logLevel: 'warn',
      }

    case '23502': // PostgreSQL not_null_violation
      return {
        statusCode: 400,
        body: { error: 'Required field is missing' },
        shouldLog: false,
        logLevel: 'warn',
      }

    case '23514': // PostgreSQL check_violation
      return {
        statusCode: 400,
        body: { error: 'Check constraint violation' },
        shouldLog: false,
        logLevel: 'warn',
      }

    default: {
      const dbErrorData: Record<string, JsonValue> = {
        error: 'Database operation failed',
      }
      if (process.env.NODE_ENV === 'development') {
        if (errorCode) {
          dbErrorData.code = errorCode
        }
        dbErrorData.message = error.message
      }
      return {
        statusCode: 500,
        body: dbErrorData,
        shouldLog: true,
        logLevel: 'error',
      }
    }
  }
}

/**
 * Main error handler that processes all errors and returns appropriate responses
 */
export function errorHandler(
  error: Error | unknown,
  request: Request,
  options?: ErrorHandlerOptions,
): Response {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const context: ErrorRequestContext = {
    url: request.url,
    method: request.method,
    headers,
    userId: request.headers.get('x-user-id'),
  }

  const processed = processError(error, context, options)

  return Response.json(processed.body, {
    status: processed.statusCode,
    headers: processed.headers,
  })
}

/**
 * Error handler for Elysia context
 */
export function errorHandlerFromContext(
  error: Error | unknown,
  ctx: ElysiaContext,
  options?: ErrorHandlerOptions,
): Response {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(ctx.headers)) {
    if (value) {
      headers[key] = value
    }
  }

  const context: ErrorRequestContext = {
    url: ctx.request.url,
    method: ctx.request.method,
    headers,
    userId: ctx.headers['x-user-id'],
  }

  const processed = processError(error, context, options)

  ctx.set.status = processed.statusCode
  if (processed.headers) {
    ctx.set.headers = processed.headers
  }

  return Response.json(processed.body, {
    status: processed.statusCode,
    headers: processed.headers,
  })
}

/**
 * Route handler context type
 */
export interface RouteContext {
  params?:
    | Record<string, string | string[]>
    | Promise<Record<string, string | string[]>>
}

/**
 * Higher-order function wrapper for API routes with error handling
 */
export function withErrorHandling<TContext extends RouteContext = RouteContext>(
  handler: (req: Request, context?: TContext) => Promise<Response> | Response,
  options?: ErrorHandlerOptions,
): (req: Request, context?: TContext) => Promise<Response> {
  return async (req: Request, context?: TContext): Promise<Response> => {
    try {
      const response = await handler(req, context)
      return response
    } catch (error) {
      return errorHandler(error, req, options)
    }
  }
}

/**
 * Async wrapper for route handlers with error boundaries
 */
export function asyncHandler<TContext extends RouteContext = RouteContext>(
  setup?: () => Promise<void>,
  handler?: (req: Request, context?: TContext) => Promise<Response>,
  teardown?: () => Promise<void>,
): (req: Request, context?: TContext) => Promise<Response> {
  return async (req: Request, context?: TContext) => {
    try {
      if (setup) {
        await setup()
      }

      if (!handler) {
        throw new Error('Handler function is required')
      }

      const result = await handler(req, context)
      if (teardown) {
        await teardown()
      }
      return result
    } catch (error) {
      return errorHandler(error, req)
    }
  }
}

/**
 * Type-safe error response helper
 */
export function errorResponse(
  message: string,
  code: string,
  statusCode: number,
  details?: Record<string, JsonValue>,
): Response {
  return Response.json(
    {
      error: {
        message,
        code,
        ...details,
      },
    },
    { status: statusCode },
  )
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  statusCode = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(data, { status: statusCode, headers })
}
