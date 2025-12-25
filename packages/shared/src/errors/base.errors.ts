/**
 * Base error classes for the Babylon application
 *
 * Re-exports from @jejunetwork/shared with Babylon-specific alias.
 */

// Re-export from Jeju with Babylon alias
export {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  BusinessLogicError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError,
  JejuError as BabylonError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from '@jejunetwork/shared'
