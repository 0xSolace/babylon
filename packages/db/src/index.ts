/**
 * Babylon Database Layer
 *
 * Provides the database abstraction layer for Babylon.
 *
 * MIGRATION STATUS:
 * - Primary: CQL (CovenantSQL) for new code
 * - Legacy: Drizzle ORM (PostgreSQL) for transactions and existing code
 *
 * The Drizzle-based transaction handling is maintained for compatibility
 * with existing services (fee-service, wallet-service, etc.) that rely on
 * raw Drizzle transaction methods.
 */

import type { DrizzleClient } from './client';
import * as schema from './schema';

// ============================================================================
// CQL Client (Decentralized Database)
// ============================================================================

export {
  type CQLClient,
  createCQLClient,
  getCQLClient,
  type QueryParam,
  resetCQLClient,
} from './cql-client';

export {
  CQLTableRepository,
  type DecentralizedDB,
  getDB,
  initializeDB,
  resetDB,
} from './cql-repository';

// Re-export transaction context types
export { type DrizzleTransactionContext } from './decentralized/db';

// Import CQL db for runtime
import { type CQLClient, db as cqlDatabase } from './cql-client';
export { cqlDatabase as cqlDb };

// ============================================================================
// Re-exports
// ============================================================================

export * from './schema';
export { schema };

export type { DrizzleClient, JsonValue, SQLValue } from './client';
export { TableRepository } from './client';

export type {
  ActorRef,
  ActorStateRow,
  AgentGoalWithActions,
  BalanceTransactionWithUser,
  ChatWithParticipants,
  ChatWithParticipantsAndMessages,
  ChatWithRelations,
  ExternalAgentConnectionWithRegistry,
  MessageWithSender,
  ModerationEscrowWithRelations,
  NewActorStateRow,
  PoolWithActorState,
  PostWithRelations,
  TradingFeeWithUser,
  UserWithAgentRelations,
  UserWithMetrics,
} from './model-types';
export type { DatabaseErrorType } from './types';
export * from './types';
export { isUniqueConstraintError, toDatabaseErrorType } from './types';

// ============================================================================
// Types
// ============================================================================

export type DbClient = CQLClient;
export type Database = CQLClient;

// Transaction uses DrizzleTransactionContext for compatibility with Drizzle-style methods
import { type DrizzleTransactionContext as DrizzleTxCtx } from './decentralized/db';
export type Transaction = DrizzleTxCtx;

/** Main database instance (CQL; decentralized). */
export const db: DbClient = cqlDatabase;

// ============================================================================
// Legacy Drizzle/Postgres helpers (disabled)
// ============================================================================

/** @deprecated PostgreSQL/Drizzle is disabled in decentralized mode. */
export function getRawDrizzle(): never {
  throw new Error('[DB] getRawDrizzle() is disabled in decentralized mode');
}

// ============================================================================
// SQL Query Helpers
// ============================================================================

export type { InferInsertModel, InferSelectModel, SQL } from 'drizzle-orm';
export {
  and,
  asc,
  avg,
  between,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  min,
  ne,
  not,
  notExists,
  notInArray,
  or,
  sql,
  sum,
} from 'drizzle-orm';
export type { SelectedFields } from 'drizzle-orm/pg-core';

// ============================================================================
// Transaction Support
// ============================================================================

/** Execute within a database transaction */
export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  await initializeDB();
  return getDB().transaction(fn);
}

/** User identifier - can be a string ID or an object with userId property */
export type UserIdOrUser = string | { userId: string };

/**
 * Execute as a specific user (with RLS)
 */
export async function asUser<T>(
  userIdOrUser: UserIdOrUser,
  operation: (database: DbClient) => Promise<T>
): Promise<T> {
  const userId =
    typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser.userId;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const oauth3DidRegex = /^did:oauth3:[a-z0-9]+$/i;
  const snowflakeRegex = /^\d{15,20}$/;

  if (
    !uuidRegex.test(userId) &&
    !oauth3DidRegex.test(userId) &&
    !snowflakeRegex.test(userId)
  ) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  // CovenantSQL doesn't currently support Postgres RLS/session variables.
  // We keep the helper for call-site compatibility.
  void userId;
  return operation(db);
}

/**
 * Execute as system (bypass RLS)
 */
export async function asSystem<T>(
  operation: (database: DbClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const startTime = Date.now();
  const result = await operation(db);

  if (operationName && process.env.NODE_ENV === 'development') {
    console.log(
      `[DB] ${operationName} completed in ${Date.now() - startTime}ms`
    );
  }

  return result;
}

/**
 * Execute as public (unauthenticated)
 */
export async function asPublic<T>(
  operation: (database: DbClient) => Promise<T>
): Promise<T> {
  return operation(db);
}

// ============================================================================
// Storage Mode (JSON for simulation/testing)
// ============================================================================

import { createJsonClient } from './json-client';
import {
  clearJsonStorage,
  exportJsonState,
  getJsonState,
  initJsonStorage,
  loadJsonSnapshot,
  saveJsonSnapshot,
} from './json-storage';

export type StorageMode = 'cql' | 'json' | 'memory';

let currentStorageMode: StorageMode = 'cql';
let jsonClient: DrizzleClient | null = null;

export async function initializeJsonMode(
  basePath: string,
  options: { autoSave?: boolean } = {}
): Promise<void> {
  await initJsonStorage(basePath, options);
  currentStorageMode = 'json';
  jsonClient = createJsonClient();
}

export async function initializeMemoryMode(): Promise<void> {
  await initJsonStorage('/tmp/babylon-memory', { autoSave: false });
  currentStorageMode = 'memory';
  jsonClient = createJsonClient();
}

/**
 * @deprecated Use resetToCQLMode() instead. PostgreSQL is no longer supported.
 */
export function resetToPostgresMode(): void {
  resetToCQLMode();
}

export function resetToCQLMode(): void {
  currentStorageMode = 'cql';
  jsonClient = null;
  clearJsonStorage();
}

export function getStorageMode(): StorageMode {
  return currentStorageMode;
}

export function isSimulationMode(): boolean {
  return currentStorageMode === 'json' || currentStorageMode === 'memory';
}

export function getJsonClient(): DrizzleClient | null {
  return jsonClient;
}

export { exportJsonState, getJsonState, loadJsonSnapshot, saveJsonSnapshot };

// ============================================================================
// Decentralized Database Layer
// ============================================================================

export * from './decentralized';

// ============================================================================
// Validation Schemas (Drizzle-Zod)
// ============================================================================

export * from './validation';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  generateSnowflakeId,
  isValidSnowflakeId,
  parseSnowflakeId,
  SnowflakeGenerator,
} from '@babylon/shared';

export {
  DatabaseService,
  type FeedPost,
  getDbInstance,
} from './database-service';

export {
  $connect,
  $disconnect,
  $executeRaw,
  $queryRaw,
  isRetryableError,
  withRetry,
} from './helpers';
// Query monitoring (stub for performance route)
export { queryMonitor } from './query-monitor';
// User block utilities
export {
  getBlockedByUserIds,
  getBlockedUserIds,
  getMutedUserIds,
  hasBlocked,
} from './user-utils';

// ============================================================================
// Initialization
// ============================================================================

import { getDB, initializeDB, resetDB } from './cql-repository';

export async function initializeDatabase(): Promise<void> {
  // Initialize CQL (mandatory for decentralized operation)
  if (!process.env.CQL_BLOCK_PRODUCER_ENDPOINT) {
    throw new Error(
      '[DB] CQL_BLOCK_PRODUCER_ENDPOINT is required. ' +
        'Decentralized database is mandatory. Start Jeju: cd /path/to/jeju && bun run dev'
    );
  }
  await initializeDB();
}

export async function checkDatabaseHealth(): Promise<boolean> {
  // Check CQL (primary, mandatory)
  const cqlDb = getDB();
  const cqlHealthy = cqlDb.isHealthy();
  if (!cqlHealthy) {
    return false;
  }

  return true;
}

export async function closeDatabase(): Promise<void> {
  // Close CQL
  resetDB();
}
