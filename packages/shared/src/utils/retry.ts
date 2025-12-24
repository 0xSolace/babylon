/**
 * Retry Utility for Async Operations
 *
 * Provides retry logic for async operations with exponential backoff.
 * Automatically retries on network errors, 5xx server errors, and rate limit (429) responses.
 */

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds before first retry (default: 100) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds between retries (default: 2000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Optional callback for logging retry attempts */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
}

/**
 * Type guard to check if error has a status property
 */
function hasStatus(error: unknown): error is { status: number } {
  if (error === null || typeof error !== 'object') return false
  // After 'in' check, TypeScript knows error has 'status' property
  return 'status' in error && typeof error.status === 'number'
}

/**
 * Check if error is retryable (network errors, 5xx, rate limits)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true // Network errors
  }

  if (hasStatus(error)) {
    // Retry on 5xx errors and 429 (rate limit)
    return error.status >= 500 || error.status === 429
  }

  return false
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Convert unknown error to Error instance
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === 'string') {
    return new Error(error)
  }
  return new Error(String(error))
}

/**
 * Retry an async operation if it fails with a retryable error
 */
export async function retryIfRetryable<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = toError(error)

      if (!isRetryableError(error) || attempt === opts.maxAttempts - 1) {
        throw error
      }

      const delay = Math.min(
        opts.initialDelayMs * opts.backoffMultiplier ** attempt,
        opts.maxDelayMs,
      )

      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay)
      }

      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Retry with custom condition
 */
export async function retryWithCondition<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = toError(error)

      if (!shouldRetry(lastError) || attempt === opts.maxAttempts - 1) {
        throw error
      }

      const delay = Math.min(
        opts.initialDelayMs * opts.backoffMultiplier ** attempt,
        opts.maxDelayMs,
      )

      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay)
      }

      await sleep(delay)
    }
  }

  throw lastError
}
