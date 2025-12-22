/**
 * Database Query Helpers
 *
 * Helper functions for common database operations.
 * Updated to work with CQL (CovenantSQL) as the primary database.
 *
 * These helpers are database-agnostic and work with both CQL and the legacy Drizzle client.
 * The Database type from index.ts is now CQLClient.
 */

import { retryWithCondition } from '@babylon/shared';
import type { sql } from 'drizzle-orm';
import type { SQLValue } from './client';
import type { Database } from './index';
import type { DatabaseErrorType } from './types';

/**
 * Re-export SQLValue type for convenience.
 */
export type { SQLValue };

/**
 * Execute a raw SQL query and return typed results.
 *
 * @param db - Database instance
 * @param query - SQL query constructed using Drizzle's sql template tag
 * @returns Array of result rows with the specified type
 */
export async function $queryRaw<
  T extends Record<string, SQLValue> = Record<string, SQLValue>,
>(db: Database, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return Array.from(result) as T[];
}

/**
 * Execute a raw SQL statement (INSERT, UPDATE, DELETE).
 *
 * @param db - Database instance
 * @param query - SQL query constructed using Drizzle's sql template tag
 * @returns Always returns 1 to indicate success
 */
export async function $executeRaw(
  db: Database,
  query: ReturnType<typeof sql>
): Promise<number> {
  await db.execute(query);
  return 1;
}

/**
 * Determine if a database error is retryable.
 * Retryable errors include connection issues, timeouts, and deadlocks.
 * This is database-specific and different from the HTTP-focused isRetryableError in @babylon/shared.
 *
 * @param error - Error to check
 * @returns True if the error is retryable, false otherwise
 */
export function isRetryableError(error: DatabaseErrorType): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('deadlock') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    );
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const errorMessage = String(error.message || '').toLowerCase();
    return (
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset')
    );
  }
  return false;
}

/**
 * Retry an async operation with exponential backoff on retryable database errors.
 * Uses the shared retry infrastructure with database-specific error checking.
 *
 * @param operation - Async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delayMs - Initial delay in milliseconds (default: 100)
 * @returns Result of the operation
 * @throws Error if operation fails after all retries
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  return retryWithCondition(
    operation,
    (error: unknown) => {
      const dbError: DatabaseErrorType =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null && 'message' in error
            ? (error as DatabaseErrorType)
            : new Error(String(error));
      return isRetryableError(dbError);
    },
    {
      maxAttempts: maxRetries + 1, // +1 because retryWithCondition counts attempts, not retries
      initialDelayMs: delayMs,
      backoffMultiplier: 2,
    }
  );
}

/**
 * Connect to database.
 * For CQL, this initializes the connection to the block producer.
 */
export async function $connect(): Promise<void> {
  const { initializeDB } = await import('./cql-repository');
  await initializeDB();
}

/**
 * Disconnect from database and clean up connection resources.
 * For CQL, this resets the database connection.
 */
export async function $disconnect(): Promise<void> {
  const { resetDB } = await import('./cql-repository');
  resetDB();
}
