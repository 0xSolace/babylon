/**
 * Central export point for all error-related utilities
 */

export {
  Agent0DuplicateFeedbackError,
  Agent0Error,
  Agent0FeedbackError,
  Agent0RateLimitError,
  Agent0RegistrationError,
  Agent0ReputationError,
  Agent0SearchError,
} from './agent0.errors';
// Base error classes
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
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from './base.errors';

// Re-import for runtime usage
import { BabylonError, ValidationError } from './base.errors';

// Domain-specific errors
export {
  AgentAuthenticationError,
  AgentError,
  BlockchainError,
  CoalitionError,
  DepositError,
  FeedError,
  GameError,
  InsufficientFundsError,
  LLMError,
  PaymentError,
  PoolError,
  PositionError,
  SmartContractError,
  TradingError,
  WalletError,
  WithdrawalError,
} from './domain.errors';

// Error handler and utilities
export {
  asyncHandler,
  errorHandler,
  errorResponse,
  successResponse,
  withErrorHandling,
} from './error-handler';

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

  // Pool errors
  POOL_INACTIVE: 'POOL_INACTIVE',
  POOL_FULL: 'POOL_FULL',
  POOL_LOCKED: 'POOL_LOCKED',

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

/**
 * Helper to create a standard error response object
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    violations?: Array<{ field: string; message: string }>;
    context?: Record<string, unknown>;
  };
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
          context: error.context,
        }),
    },
  };
}
