/**
 * Shared Type Exports
 */

export {
  type AgentCapabilities,
  AgentCapabilitiesSchema,
  type GameNetworkInfo,
  GameNetworkInfoSchema,
} from './agents'
export type { AuthenticatedUser } from './auth'
export {
  type ApiError,
  type ApiResponse,
  type ErrorLike,
  type JsonRpcError,
  type JsonRpcNotification,
  type JsonRpcParams,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcResult,
  type JsonValue,
  JsonValueSchema,
  type StringRecord,
} from './common'
export {
  // Error interfaces
  type AppError,
  // Error message utilities
  extractErrorMessage,
  // Authentication/Authorization type guards
  isAuthenticationError,
  isAuthorizationError,
  // Base error type guards
  isBabylonError,
  isBadRequestError,
  // Business logic type guards
  isBusinessLogicError,
  isConflictError,
  // Service error type guards
  isDatabaseError,
  isExternalServiceError,
  // Server error type guards
  isInternalServerError,
  isLLMError,
  isNetworkError,
  // Resource error type guards
  isNotFoundError,
  isOperationalError,
  // Rate limiting type guards
  isRateLimitError,
  isServiceUnavailableError,
  // Validation/Request error type guards
  isValidationError,
  type NetworkError,
} from './errors'
export { BanStatus, MarketOutcome, VotePosition } from './moderation'
export type {
  PaymentVerificationParams,
  PaymentVerificationResult,
} from './payments'
