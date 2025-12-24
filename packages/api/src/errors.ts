/**
 * API Error Classes
 *
 * Re-exports error classes from @babylon/shared for consistency.
 * Defines API-specific errors like ApiError, UnauthorizedError, ForbiddenError.
 */

import type { JsonValue } from '@babylon/shared'
import { BabylonError, ValidationError } from '@babylon/shared'
import { safeToJsonRecord } from './utils/type-guards'

// =============================================================================
// Re-export error classes from @babylon/shared for convenience
// =============================================================================
export {
  AuthenticationError,
  AuthorizationError,
  BabylonError,
  isAuthenticationError,
} from '@babylon/shared'

// =============================================================================
// API-specific error classes
// =============================================================================

/**
 * Simple API Error class for basic error responses
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Unauthorized Error (401) - for API authentication failures
 */
export class UnauthorizedError extends BabylonError {
  constructor(
    message = 'Unauthorized',
    code?: string,
    context?: Record<string, JsonValue>,
  ) {
    super(message, code || 'UNAUTHORIZED', 401, true, context)
  }
}

/**
 * Forbidden Error (403) - for API authorization failures
 */
export class ForbiddenError extends BabylonError {
  constructor(
    message = 'Forbidden',
    code?: string,
    context?: Record<string, JsonValue>,
  ) {
    super(message, code || 'FORBIDDEN', 403, true, context)
  }
}

// =============================================================================
// Error codes and response helpers
// =============================================================================

/**
 * Error code constants
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AUTH_NO_TOKEN: 'AUTH_NO_TOKEN',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FOREIGN_KEY_CONSTRAINT: 'FOREIGN_KEY_CONSTRAINT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  RATE_LIMIT: 'RATE_LIMIT',
  TRADING_MARKET_CLOSED: 'TRADING_MARKET_CLOSED',
  TRADING_INVALID_PRICE: 'TRADING_INVALID_PRICE',
  TRADING_POSITION_LIMIT: 'TRADING_POSITION_LIMIT',
  TRADING_RISK_LIMIT: 'TRADING_RISK_LIMIT',
  AGENT_ERROR: 'AGENT_ERROR',
  AGENT_AUTH_NOT_REGISTERED: 'AGENT_AUTH_NOT_REGISTERED',
  AGENT_AUTH_INVALID_SIGNATURE: 'AGENT_AUTH_INVALID_SIGNATURE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  SMART_CONTRACT_ERROR: 'SMART_CONTRACT_ERROR',
  LLM_ERROR: 'LLM_ERROR',
} as const

/**
 * Standard error response object
 */
export interface ErrorResponse {
  error: {
    message: string
    code: string
    violations?: Array<{ field: string; message: string }>
    context?: Record<string, JsonValue>
  }
}

/**
 * Create a standardized error response object
 */
export function createErrorResponse(error: BabylonError): ErrorResponse {
  return {
    error: {
      message: error.message,
      code: error.code,
      ...(error instanceof ValidationError &&
        error.violations && {
          violations: error.violations,
        }),
      ...(process.env.NODE_ENV === 'development' &&
        error.context && {
          context: safeToJsonRecord(error.context),
        }),
    },
  }
}
