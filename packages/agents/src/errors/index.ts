/**
 * Error Classes for @babylon/agents
 *
 * Agent0-specific error classes for the agents package.
 *
 * @packageDocumentation
 */

import type { JsonValue } from '@babylon/shared'
import {
  AuthorizationError,
  ExternalServiceError,
  RateLimitError,
} from '@babylon/shared'

// Export AuthorizationError for use in agents
export { AuthorizationError }

// =============================================================================
// Agent0-specific errors
// =============================================================================

/**
 * Base error class for all Agent0 operations
 */
export class Agent0Error extends ExternalServiceError {
  public readonly operation:
    | 'register'
    | 'feedback'
    | 'reputation'
    | 'search'
    | 'discovery'
  public readonly agent0Code?: string
  public declare readonly context?: Record<string, unknown>

  constructor(
    message: string,
    operation: 'register' | 'feedback' | 'reputation' | 'search' | 'discovery',
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number,
  ) {
    super('Agent0', message, originalStatusCode)
    this.operation = operation
    this.agent0Code = agent0Code
    this.context = {
      service: 'Agent0',
      originalStatusCode,
      operation,
      agent0Code,
      originalError: originalError?.message,
      originalStack:
        process.env.NODE_ENV === 'development'
          ? originalError?.stack
          : undefined,
    }
  }

  /**
   * Type guard for Agent0Error
   */
  static isInstance(error: unknown): error is Agent0Error {
    return error instanceof Agent0Error
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    const statusCode = (this as ExternalServiceError).originalStatusCode
    if (statusCode && statusCode >= 500) {
      return true
    }

    const retryableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NetworkError',
      'timeout',
      'network',
    ]

    return retryableMessages.some((msg) =>
      this.message.toLowerCase().includes(msg.toLowerCase()),
    )
  }
}

/**
 * Error for Agent0 registration failures
 */
export class Agent0RegistrationError extends Agent0Error {
  public readonly agentName?: string

  constructor(
    message: string,
    agentName?: string,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number,
  ) {
    super(message, 'register', agent0Code, originalError, originalStatusCode)
    this.agentName = agentName
  }

  static isInstance(error: unknown): error is Agent0RegistrationError {
    return error instanceof Agent0RegistrationError
  }
}

/**
 * Error for Agent0 feedback submission failures
 */
export class Agent0FeedbackError extends Agent0Error {
  public readonly feedbackId?: string

  constructor(
    message: string,
    feedbackId?: string,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number,
  ) {
    super(message, 'feedback', agent0Code, originalError, originalStatusCode)
    this.feedbackId = feedbackId
  }

  static isInstance(error: unknown): error is Agent0FeedbackError {
    return error instanceof Agent0FeedbackError
  }
}

/**
 * Error for Agent0 reputation query failures
 */
export class Agent0ReputationError extends Agent0Error {
  public readonly tokenId?: number

  constructor(
    message: string,
    tokenId?: number,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number,
  ) {
    super(message, 'reputation', agent0Code, originalError, originalStatusCode)
    this.tokenId = tokenId
  }

  static isInstance(error: unknown): error is Agent0ReputationError {
    return error instanceof Agent0ReputationError
  }
}

/**
 * Error for Agent0 search/discovery failures
 */
export class Agent0SearchError extends Agent0Error {
  public readonly filters?: Record<string, JsonValue>

  constructor(
    message: string,
    filters?: Record<string, JsonValue>,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number,
  ) {
    super(message, 'search', agent0Code, originalError, originalStatusCode)
    this.filters = filters
  }

  static isInstance(error: unknown): error is Agent0SearchError {
    return error instanceof Agent0SearchError
  }
}

/**
 * Error for duplicate feedback submission attempts
 */
export class Agent0DuplicateFeedbackError extends Agent0FeedbackError {
  constructor(feedbackId: string, targetAgentId: number) {
    super(
      `Duplicate feedback submission for feedback ${feedbackId} targeting agent ${targetAgentId}`,
      feedbackId,
      'DUPLICATE_FEEDBACK',
    )
  }

  static isInstance(error: unknown): error is Agent0DuplicateFeedbackError {
    return error instanceof Agent0DuplicateFeedbackError
  }
}

/**
 * Error for Agent0 rate limiting
 */
export class Agent0RateLimitError extends RateLimitError {
  constructor(retryAfterSeconds?: number) {
    super(10, 60000, retryAfterSeconds)
  }

  static isInstance(error: unknown): error is Agent0RateLimitError {
    return error instanceof Agent0RateLimitError
  }
}
