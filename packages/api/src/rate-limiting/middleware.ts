/**
 * Rate Limiting Middleware for API Routes
 *
 * Provides helpers to apply rate limiting and duplicate detection to API routes.
 * Framework-agnostic - works with Elysia, standard Request/Response, or any framework.
 */

import { logger } from '@babylon/shared'
import {
  checkDuplicate,
  type DUPLICATE_DETECTION_CONFIGS,
} from '../utils/duplicate-detector'
import { checkRateLimit, type RATE_LIMIT_CONFIGS } from './user-rate-limiter'

/**
 * Rate limit error result
 */
export interface RateLimitErrorResult {
  success: false
  error: 'Rate limit exceeded'
  message: string
  retryAfter?: number
}

/**
 * Duplicate content error result
 */
export interface DuplicateContentErrorResult {
  success: false
  error: 'Duplicate content'
  message: string
  lastPostedAt?: string
}

/**
 * Create rate limit error response body
 */
export function createRateLimitError(
  retryAfter?: number,
): RateLimitErrorResult {
  return {
    success: false,
    error: 'Rate limit exceeded',
    message: `Too many requests. Please try again ${retryAfter ? `in ${retryAfter} seconds` : 'later'}.`,
    retryAfter,
  }
}

/**
 * Create duplicate content error response body
 */
export function createDuplicateContentError(
  lastPostedAt?: Date,
): DuplicateContentErrorResult {
  return {
    success: false,
    error: 'Duplicate content',
    message:
      'You have already posted this content recently. Please wait before posting it again.',
    lastPostedAt: lastPostedAt?.toISOString(),
  }
}

/**
 * Error response for rate limit exceeded
 */
export function rateLimitError(retryAfter?: number): Response {
  const body = createRateLimitError(retryAfter)
  const headers: Record<string, string> = {
    'X-RateLimit-Exceeded': 'true',
  }

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return Response.json(body, { status: 429, headers })
}

/**
 * Error response for duplicate content
 */
export function duplicateContentError(lastPostedAt?: Date): Response {
  return Response.json(createDuplicateContentError(lastPostedAt), {
    status: 409,
  })
}

/**
 * Apply rate limiting to an API route handler
 *
 * Usage:
 * ```ts
 * // With standard Request/Response
 * const rateLimitResult = await applyRateLimit(user.userId, RATE_LIMIT_CONFIGS.CREATE_POST);
 * if (!rateLimitResult.allowed) {
 *   return rateLimitError(rateLimitResult.retryAfter);
 * }
 *
 * // With Elysia
 * const rateLimitResult = await applyRateLimit(user.userId, RATE_LIMIT_CONFIGS.CREATE_POST);
 * if (!rateLimitResult.allowed) {
 *   ctx.set.status = 429;
 *   return createRateLimitError(rateLimitResult.retryAfter);
 * }
 * ```
 */
export function applyRateLimit(
  userId: string,
  config: (typeof RATE_LIMIT_CONFIGS)[keyof typeof RATE_LIMIT_CONFIGS],
) {
  return checkRateLimit(userId, config)
}

/**
 * Apply duplicate detection to content
 *
 * Usage:
 * ```ts
 * const duplicateResult = await applyDuplicateDetection(
 *   user.userId,
 *   content,
 *   DUPLICATE_DETECTION_CONFIGS.POST
 * );
 * if (duplicateResult.isDuplicate) {
 *   return duplicateContentError(duplicateResult.lastPostedAt);
 * }
 * ```
 */
export function applyDuplicateDetection(
  userId: string,
  content: string,
  config: (typeof DUPLICATE_DETECTION_CONFIGS)[keyof typeof DUPLICATE_DETECTION_CONFIGS],
) {
  return checkDuplicate(userId, content, config)
}

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  passed: boolean
  errorResponse?: Response
  retryAfter?: number
  remaining?: number
}

/**
 * Combined rate limiting and duplicate detection
 * Returns a Response if either check fails, or null if both pass
 *
 * Usage:
 * ```ts
 * const errorResponse = await checkRateLimitAndDuplicates(
 *   user.userId,
 *   content,
 *   RATE_LIMIT_CONFIGS.CREATE_POST,
 *   DUPLICATE_DETECTION_CONFIGS.POST
 * );
 * if (errorResponse) return errorResponse;
 * ```
 */
export function checkRateLimitAndDuplicates(
  userId: string,
  content: string | null,
  rateLimitConfig: (typeof RATE_LIMIT_CONFIGS)[keyof typeof RATE_LIMIT_CONFIGS],
  duplicateConfig?: (typeof DUPLICATE_DETECTION_CONFIGS)[keyof typeof DUPLICATE_DETECTION_CONFIGS],
): Response | null {
  // Skip rate limiting in test environment if DISABLE_RATE_LIMITING is set
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.DISABLE_RATE_LIMITING === 'true'
  ) {
    return null
  }

  // Check rate limit first
  const rateLimitResult = checkRateLimit(userId, rateLimitConfig)
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit check failed', {
      userId,
      actionType: rateLimitConfig.actionType,
      retryAfter: rateLimitResult.retryAfter,
    })
    return rateLimitError(rateLimitResult.retryAfter)
  }

  // Check for duplicates if content is provided and config is given
  if (content && duplicateConfig) {
    const duplicateResult = checkDuplicate(userId, content, duplicateConfig)
    if (duplicateResult.isDuplicate) {
      logger.warn('Duplicate content detected', {
        userId,
        actionType: duplicateConfig.actionType,
        lastPostedAt: duplicateResult.lastPostedAt?.toISOString(),
      })
      return duplicateContentError(duplicateResult.lastPostedAt)
    }
  }

  // All checks passed
  logger.debug('Rate limit and duplicate checks passed', {
    userId,
    actionType: rateLimitConfig.actionType,
    remaining: rateLimitResult.remaining,
  })

  return null
}

/**
 * Check rate limits for Elysia (returns result object instead of Response)
 */
export function checkRateLimitsForElysia(
  userId: string,
  content: string | null,
  rateLimitConfig: (typeof RATE_LIMIT_CONFIGS)[keyof typeof RATE_LIMIT_CONFIGS],
  duplicateConfig?: (typeof DUPLICATE_DETECTION_CONFIGS)[keyof typeof DUPLICATE_DETECTION_CONFIGS],
): {
  passed: boolean
  status?: number
  body?: RateLimitErrorResult | DuplicateContentErrorResult
  headers?: Record<string, string>
  remaining?: number
} {
  // Skip rate limiting in test environment if DISABLE_RATE_LIMITING is set
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.DISABLE_RATE_LIMITING === 'true'
  ) {
    return { passed: true }
  }

  // Check rate limit first
  const rateLimitResult = checkRateLimit(userId, rateLimitConfig)
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit check failed', {
      userId,
      actionType: rateLimitConfig.actionType,
      retryAfter: rateLimitResult.retryAfter,
    })

    const headers: Record<string, string> = { 'X-RateLimit-Exceeded': 'true' }
    if (rateLimitResult.retryAfter) {
      headers['Retry-After'] = rateLimitResult.retryAfter.toString()
    }

    return {
      passed: false,
      status: 429,
      body: createRateLimitError(rateLimitResult.retryAfter),
      headers,
    }
  }

  // Check for duplicates if content is provided and config is given
  if (content && duplicateConfig) {
    const duplicateResult = checkDuplicate(userId, content, duplicateConfig)
    if (duplicateResult.isDuplicate) {
      logger.warn('Duplicate content detected', {
        userId,
        actionType: duplicateConfig.actionType,
        lastPostedAt: duplicateResult.lastPostedAt?.toISOString(),
      })
      return {
        passed: false,
        status: 409,
        body: createDuplicateContentError(duplicateResult.lastPostedAt),
      }
    }
  }

  // All checks passed
  logger.debug('Rate limit and duplicate checks passed', {
    userId,
    actionType: rateLimitConfig.actionType,
    remaining: rateLimitResult.remaining,
  })

  return { passed: true, remaining: rateLimitResult.remaining }
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: Response,
  remaining: number,
  resetAt: Date,
): Response {
  const newHeaders = new Headers(response.headers)
  newHeaders.set('X-RateLimit-Remaining', remaining.toString())
  newHeaders.set('X-RateLimit-Reset', resetAt.toISOString())

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
