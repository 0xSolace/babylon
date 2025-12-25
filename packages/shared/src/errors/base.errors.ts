/**
 * Base error classes for the Babylon application
 *
 * @description Provides structured error handling with proper context and metadata.
 * All application errors extend JejuError from @jejunetwork/shared for consistent
 * error handling, logging, and API responses.
 */

import {
  AuthenticationError as JejuAuthenticationError,
  AuthorizationError as JejuAuthorizationError,
  BadRequestError as JejuBadRequestError,
  BusinessLogicError as JejuBusinessLogicError,
  ConflictError as JejuConflictError,
  DatabaseError as JejuDatabaseError,
  JejuError,
  ExternalServiceError as JejuExternalServiceError,
  InternalServerError as JejuInternalServerError,
  NotFoundError as JejuNotFoundError,
  RateLimitError as JejuRateLimitError,
  ServiceUnavailableError as JejuServiceUnavailableError,
  ValidationError as JejuValidationError,
} from '@jejunetwork/shared'

// ForbiddenError - Jeju uses AuthorizationError for this purpose
class JejuForbiddenError extends JejuAuthorizationError {}

/**
 * Base error class for all Babylon errors
 *
 * @description Extends JejuError with Babylon-specific functionality.
 */
export abstract class BabylonError extends JejuError {
  public readonly originalStatusCode: number

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>,
  ) {
    super(message, code, statusCode, isOperational, context)
    this.originalStatusCode = statusCode
  }
}

// Export Jeju error classes for Babylon use
export {
  JejuAuthenticationError as AuthenticationError,
  JejuAuthorizationError as AuthorizationError,
  JejuBadRequestError as BadRequestError,
  JejuBusinessLogicError as BusinessLogicError,
  JejuConflictError as ConflictError,
  JejuDatabaseError as DatabaseError,
  JejuExternalServiceError as ExternalServiceError,
  JejuForbiddenError as ForbiddenError,
  JejuInternalServerError as InternalServerError,
  JejuNotFoundError as NotFoundError,
  JejuRateLimitError as RateLimitError,
  JejuServiceUnavailableError as ServiceUnavailableError,
  JejuValidationError as ValidationError,
}

// Type guards for error checking are exported from ./types/errors.ts
