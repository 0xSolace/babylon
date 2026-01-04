/**
 * Error Type Guards
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

export interface AppError {
  message: string
  code?: string
  details?: Record<string, string | number | boolean>
}

export interface NetworkError extends Error {
  status?: number
  statusText?: string
  url?: string
}

interface JejuErrorLike {
  code: string
  statusCode: number
  isOperational: boolean
}

function hasJejuErrorShape(error: unknown): error is Error & JejuErrorLike {
  return (
    error instanceof Error &&
    'code' in error &&
    'statusCode' in error &&
    'isOperational' in error
  )
}

export function isBabylonError(error: unknown): error is BabylonError {
  return error instanceof BabylonError || hasJejuErrorShape(error)
}

export function isOperationalError(error: unknown): boolean {
  return hasJejuErrorShape(error) && error.isOperational
}

export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError
}

export function isAuthorizationError(
  error: unknown,
): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isBadRequestError(error: unknown): error is BadRequestError {
  return error instanceof BadRequestError
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError
}

export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error && ('status' in error || 'url' in error)
}

export function isExternalServiceError(
  error: unknown,
): error is ExternalServiceError {
  return error instanceof ExternalServiceError
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}

export function isBusinessLogicError(
  error: unknown,
): error is BusinessLogicError {
  return error instanceof BusinessLogicError
}

export function isInternalServerError(
  error: unknown,
): error is InternalServerError {
  return error instanceof InternalServerError
}

export function isServiceUnavailableError(
  error: unknown,
): error is ServiceUnavailableError {
  return error instanceof ServiceUnavailableError
}

export function extractErrorMessage(
  error: Error | AppError | string | JsonValue | { message?: string },
): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return 'An unknown error occurred'
}
