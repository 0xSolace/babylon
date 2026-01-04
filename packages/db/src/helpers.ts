/**
 * Database Helper Functions
 *
 * Connection management and retry utilities for SQLit.
 */

import { retryWithCondition } from '@jejunetwork/shared'
import { initializeDB, resetDB } from './sqlit-repository'
import type { DatabaseErrorType } from './types'

/**
 * Determine if a database error is retryable.
 */
export function isRetryableError(error: DatabaseErrorType): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('deadlock') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    )
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const errorMessage = String(error.message || '').toLowerCase()
    return (
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset')
    )
  }
  return false
}

/**
 * Retry an async operation with exponential backoff on retryable database errors.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100,
): Promise<T> {
  return retryWithCondition(
    operation,
    (error: unknown) => {
      const dbError: DatabaseErrorType =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null && 'message' in error
            ? (error as DatabaseErrorType)
            : new Error(String(error))
      return isRetryableError(dbError)
    },
    {
      maxAttempts: maxRetries + 1,
      initialDelayMs: delayMs,
      backoffMultiplier: 2,
    },
  )
}

/**
 * Connect to database (initialize SQLit connection).
 */
export async function $connect(): Promise<void> {
  await initializeDB()
}

/**
 * Disconnect from database (reset SQLit connection).
 */
export async function $disconnect(): Promise<void> {
  resetDB()
}
