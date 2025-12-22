/**
 * Error Classes for @babylon/agents
 *
 * Re-exports base error classes from @babylon/shared and provides
 * Agent0-specific error classes for the agents package.
 *
 * @packageDocumentation
 */

import type { JsonValue } from '@babylon/shared';

// Re-export all base error classes from shared
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
} from '@babylon/shared';

// Import for extending
import { ExternalServiceError, RateLimitError } from '@babylon/shared';

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
    | 'discovery';
  public readonly agent0Code?: string;

  constructor(
    message: string,
    operation: 'register' | 'feedback' | 'reputation' | 'search' | 'discovery',
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number
  ) {
    // Pass enhanced context to parent
    super('Agent0', message, originalStatusCode);
    this.operation = operation;
    this.agent0Code = agent0Code;

    // Context is set in parent, but we can access it via toJSON()
    Object.assign(this, {
      context: {
        ...this.context,
        operation,
        agent0Code,
        originalError: originalError?.message,
        originalStack:
          process.env.NODE_ENV === 'development'
            ? originalError?.stack
            : undefined,
      },
    });
  }

  /**
   * Type guard for Agent0Error
   */
  static isInstance(error: unknown): error is Agent0Error {
    return error instanceof Agent0Error;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    // Network errors and 5xx errors are retryable
    if (this.originalStatusCode && this.originalStatusCode >= 500) {
      return true;
    }

    // Specific retryable error codes
    const retryableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NetworkError',
      'timeout',
      'network',
    ];

    return retryableMessages.some((msg) =>
      this.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
}

/**
 * Error for Agent0 registration failures
 */
export class Agent0RegistrationError extends Agent0Error {
  public readonly agentName?: string;

  constructor(
    message: string,
    agentName?: string,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number
  ) {
    super(message, 'register', agent0Code, originalError, originalStatusCode);
    this.agentName = agentName;

    Object.assign(this, {
      context: {
        ...this.context,
        agentName,
      },
    });
  }

  static isInstance(error: unknown): error is Agent0RegistrationError {
    return error instanceof Agent0RegistrationError;
  }
}

/**
 * Error for Agent0 feedback submission failures
 */
export class Agent0FeedbackError extends Agent0Error {
  public readonly feedbackId?: string;

  constructor(
    message: string,
    feedbackId?: string,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number
  ) {
    super(message, 'feedback', agent0Code, originalError, originalStatusCode);
    this.feedbackId = feedbackId;

    Object.assign(this, {
      context: {
        ...this.context,
        feedbackId,
      },
    });
  }

  static isInstance(error: unknown): error is Agent0FeedbackError {
    return error instanceof Agent0FeedbackError;
  }
}

/**
 * Error for Agent0 reputation query failures
 */
export class Agent0ReputationError extends Agent0Error {
  public readonly tokenId?: number;

  constructor(
    message: string,
    tokenId?: number,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number
  ) {
    super(message, 'reputation', agent0Code, originalError, originalStatusCode);
    this.tokenId = tokenId;

    Object.assign(this, {
      context: {
        ...this.context,
        tokenId,
      },
    });
  }

  static isInstance(error: unknown): error is Agent0ReputationError {
    return error instanceof Agent0ReputationError;
  }
}

/**
 * Error for Agent0 search/discovery failures
 */
export class Agent0SearchError extends Agent0Error {
  public readonly filters?: Record<string, JsonValue>;

  constructor(
    message: string,
    filters?: Record<string, JsonValue>,
    agent0Code?: string,
    originalError?: Error,
    originalStatusCode?: number
  ) {
    super(message, 'search', agent0Code, originalError, originalStatusCode);
    this.filters = filters;

    Object.assign(this, {
      context: {
        ...this.context,
        filters,
      },
    });
  }

  static isInstance(error: unknown): error is Agent0SearchError {
    return error instanceof Agent0SearchError;
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
      'DUPLICATE_FEEDBACK'
    );

    Object.assign(this, {
      context: {
        ...this.context,
        targetAgentId,
      },
    });
  }

  static isInstance(error: unknown): error is Agent0DuplicateFeedbackError {
    return error instanceof Agent0DuplicateFeedbackError;
  }
}

/**
 * Error for Agent0 rate limiting
 */
export class Agent0RateLimitError extends RateLimitError {
  constructor(retryAfterSeconds?: number) {
    super(10, 60000, retryAfterSeconds); // 10 requests per minute default
  }

  static isInstance(error: unknown): error is Agent0RateLimitError {
    return error instanceof Agent0RateLimitError;
  }
}
