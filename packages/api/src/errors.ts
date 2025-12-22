/**
 * API Error Classes
 *
 * Re-exports error classes from @babylon/shared for consistency.
 * Defines API-specific errors like ApiError, UnauthorizedError, ForbiddenError.
 */

import type { JsonValue } from './types';

// =============================================================================
// Re-export error classes from @babylon/shared
// =============================================================================

// Re-export type guards from shared
export {
  AuthenticationError,
  AuthorizationError,
  BabylonError,
  BadRequestError,
  BusinessLogicError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError,
  isAuthenticationError,
  isDatabaseError,
  isLLMError,
  isNetworkError,
  isValidationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from '@babylon/shared';

// Import BabylonError for extending in local error classes
import { BabylonError } from '@babylon/shared';

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
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Unauthorized Error (401) - for API authentication failures
 *
 * Use this for simple 401 responses. For detailed auth failures,
 * use AuthenticationError from @babylon/shared.
 */
export class UnauthorizedError extends BabylonError {
  constructor(
    message = 'Unauthorized',
    code?: string,
    context?: Record<string, JsonValue>
  ) {
    super(message, code || 'UNAUTHORIZED', 401, true, context);
  }
}

/**
 * Forbidden Error (403) - for API authorization failures
 *
 * Use this for simple 403 responses. For detailed permission failures,
 * use AuthorizationError from @babylon/shared.
 */
export class ForbiddenError extends BabylonError {
  constructor(
    message = 'Forbidden',
    code?: string,
    context?: Record<string, JsonValue>
  ) {
    super(message, code || 'FORBIDDEN', 403, true, context);
  }
}

// =============================================================================
// Type guards for API-specific errors
// =============================================================================

/**
 * Type guard to check if an error is an authorization error (API version)
 */
export function isAuthorizationError(
  error: unknown
): error is InstanceType<typeof import('@babylon/shared').AuthorizationError> {
  return (
    error instanceof BabylonError &&
    error.code === 'FORBIDDEN' &&
    error.statusCode === 403
  );
}

/**
 * Type guard to check if an error is a Babylon error
 */
export function isBabylonError(error: unknown): error is BabylonError {
  return error instanceof BabylonError;
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (isBabylonError(error)) {
    return error.isOperational;
  }
  return false;
}

// =============================================================================
// Error codes and response helpers
// =============================================================================

/**
 * Error code constants for consistency across the application
 */
export const ErrorCodes = {
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Auth errors
  AUTH_NO_TOKEN: 'AUTH_NO_TOKEN',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN: 'AUTH_EXPIRED_TOKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FOREIGN_KEY_CONSTRAINT: 'FOREIGN_KEY_CONSTRAINT',

  // Business logic errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  RATE_LIMIT: 'RATE_LIMIT',

  // Trading errors
  TRADING_MARKET_CLOSED: 'TRADING_MARKET_CLOSED',
  TRADING_INVALID_PRICE: 'TRADING_INVALID_PRICE',
  TRADING_POSITION_LIMIT: 'TRADING_POSITION_LIMIT',
  TRADING_RISK_LIMIT: 'TRADING_RISK_LIMIT',

  // Agent errors
  AGENT_ERROR: 'AGENT_ERROR',
  AGENT_AUTH_NOT_REGISTERED: 'AGENT_AUTH_NOT_REGISTERED',
  AGENT_AUTH_INVALID_SIGNATURE: 'AGENT_AUTH_INVALID_SIGNATURE',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  SMART_CONTRACT_ERROR: 'SMART_CONTRACT_ERROR',
  LLM_ERROR: 'LLM_ERROR',
} as const;

/**
 * Standard error response object
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    violations?: Array<{ field: string; message: string }>;
    context?: Record<string, JsonValue>;
  };
}

/**
 * Create a standardized error response object
 */
export function createErrorResponse(error: BabylonError): ErrorResponse {
  // Import ValidationError at runtime to avoid circular dependency issues
  const { ValidationError } = require('@babylon/shared') as {
    ValidationError: typeof import('@babylon/shared').ValidationError;
  };

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
          context: error.context as Record<string, JsonValue>,
        }),
    },
  };
}
