/**
 * Database Helper Functions
 *
 * Connection management and retry utilities for CQL (CovenantSQL).
 */

import { retryWithCondition } from '@jejunetwork/shared'
import { initializeDB, resetDB } from './cql-repository'
import type { DatabaseErrorType, SQLValue } from './types'

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
 * Connect to database (initialize CQL connection).
 */
export async function $connect(): Promise<void> {
  await initializeDB()
}

/**
 * Disconnect from database (reset CQL connection).
 */
export async function $disconnect(): Promise<void> {
  resetDB()
}

/**
 * @deprecated Use db.$queryRaw template literal directly.
 * Kept for backwards compatibility.
 */
export async function $queryRaw<T = Record<string, SQLValue>>(
  ..._args: unknown[]
): Promise<T[]> {
  throw new Error(
    '[DB] $queryRaw helper is deprecated. Use db.$queryRaw`SELECT ...` directly.',
  )
}

/**
 * @deprecated Use db.$executeRaw template literal directly.
 * Kept for backwards compatibility.
 */
export async function $executeRaw(..._args: unknown[]): Promise<number> {
  throw new Error(
    '[DB] $executeRaw helper is deprecated. Use db.$executeRaw`INSERT ...` directly.',
  )
}
