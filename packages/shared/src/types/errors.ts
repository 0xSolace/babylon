/**
 * Error Type Definitions and Type Guards
 *
 * Centralized error types and type guards for error handling.
 * Error classes are exported from ./errors/index.ts
 */

import {
  AuthenticationError,
  AuthorizationError,
  BabylonError,
  BadRequestError,
  BusinessLogicError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError,
  LLMError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from '../errors'
import type { JsonValue } from './common'

// =============================================================================
// Error Interfaces
// =============================================================================

/**
 * Base error interface for all application errors
 */
export interface AppError {
  message: string
  code?: string
  details?: Record<string, string | number | boolean>
}

/**
 * Network/HTTP error interface
 * Note: There's no NetworkError class, only this interface
 */
export interface NetworkError extends Error {
  status?: number
  statusText?: string
  url?: string
}

// =============================================================================
// Base Error Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a Babylon error
 */
export function isBabylonError(error: unknown): error is BabylonError {
  return error instanceof BabylonError
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (isBabylonError(error)) {
    return error.isOperational
  }
  return false
}

// =============================================================================
// Authentication/Authorization Error Type Guards
// =============================================================================

/**
 * Type guard to check if error is AuthenticationError class
 */
export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError
}

/**
 * Type guard to check if an error is an authorization error
 */
export function isAuthorizationError(
  error: unknown,
): error is AuthorizationError {
  return error instanceof AuthorizationError
}

// =============================================================================
// Resource Error Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a not found error
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

/**
 * Type guard to check if an error is a conflict error
 */
export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError
}

// =============================================================================
// Validation/Request Error Type Guards
// =============================================================================

/**
 * Type guard to check if error is ValidationError class
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Type guard to check if an error is a bad request error
 */
export function isBadRequestError(error: unknown): error is BadRequestError {
  return error instanceof BadRequestError
}

// =============================================================================
// Service Error Type Guards
// =============================================================================

/**
 * Type guard to check if error is DatabaseError class
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError
}

/**
 * Type guard to check if error is LLMError class
 */
export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError
}

/**
 * Type guard to check if error is NetworkError interface
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error && ('status' in error || 'url' in error)
}

/**
 * Type guard to check if an error is an external service error
 */
export function isExternalServiceError(
  error: unknown,
): error is ExternalServiceError {
  return error instanceof ExternalServiceError
}

// =============================================================================
// Rate Limiting Error Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}

// =============================================================================
// Business Logic Error Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a business logic error
 */
export function isBusinessLogicError(
  error: unknown,
): error is BusinessLogicError {
  return error instanceof BusinessLogicError
}

// =============================================================================
// Server Error Type Guards
// =============================================================================

/**
 * Type guard to check if an error is an internal server error
 */
export function isInternalServerError(
  error: unknown,
): error is InternalServerError {
  return error instanceof InternalServerError
}

/**
 * Type guard to check if an error is a service unavailable error
 */
export function isServiceUnavailableError(
  error: unknown,
): error is ServiceUnavailableError {
  return error instanceof ServiceUnavailableError
}

// =============================================================================
// Error Message Utilities
// =============================================================================

/**
 * Extract error message from any error-like object
 */
export function extractErrorMessage(
  error: Error | AppError | string | JsonValue | { message?: string },
): string {
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'An unknown error occurred'
}
