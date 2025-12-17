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

import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createDrizzleClient, type DrizzleClient } from './client';
import * as schema from './schema';

// ============================================================================
// CQL Client (Decentralized Database)
// ============================================================================

export {
  type CQLClient,
  createCQLClient,
  getCQLClient,
  resetCQLClient,
} from './cql-client';

export {
  CQLTableRepository,
  type DecentralizedDB,
  getDB,
  initializeDB,
  resetDB,
} from './cql-repository';

// Import CQL db for runtime
import { db as cqlDatabase } from './cql-client';
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

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

// ============================================================================
// Connection Management
// ============================================================================

const globalForDb = globalThis as typeof globalThis & {
  postgresClient: ReturnType<typeof postgres> | undefined;
  drizzleDb: Database | undefined;
  db: DrizzleClient | undefined;
};

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_ENV === 'test' ||
    (typeof process !== 'undefined' && process.argv?.join(' ').includes('test'))
  );
}

function getConnectionUrl(): string {
  // Support both PostgreSQL and CQL endpoints
  // DATABASE_URL for PostgreSQL (legacy, for transactions)
  // CQL_BLOCK_PRODUCER_ENDPOINT for CQL (new, for decentralized ops)
  return process.env.DATABASE_URL || 'postgresql://localhost:5432/babylon';
}

function createPostgresClient(): ReturnType<typeof postgres> {
  const url = getConnectionUrl();
  const isTest = isTestEnvironment();
  const isProd = process.env.NODE_ENV === 'production';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  const hasExplicitSSL =
    url.includes('sslmode=require') || url.includes('ssl=true');
  const isCloudProvider =
    url.includes('neon.tech') ||
    url.includes('supabase.co') ||
    url.includes('pooler.supabase') ||
    url.includes('db.bit.io') ||
    url.includes('.postgres.database.azure.com') ||
    url.includes('.rds.amazonaws.com');

  const sslMode: 'require' | false =
    hasExplicitSSL || (!isLocalhost && (isProd || isCloudProvider))
      ? 'require'
      : false;

  return postgres(url, {
    max: isProd ? 50 : isTest ? 5 : 10,
    idle_timeout: isProd ? 30 : 20,
    connect_timeout: 10,
    ssl: sslMode,
    transform: { undefined: null },
    onnotice: () => {},
  });
}

function getPostgresClient(): ReturnType<typeof postgres> | null {
  if (isBuildTime && !isTestEnvironment()) {
    return null;
  }

  if (!globalForDb.postgresClient) {
    const url = getConnectionUrl();
    if (!url || url === 'postgresql://localhost:5432/babylon') {
      if (isTestEnvironment()) {
        throw new Error('DATABASE_URL is required in test environment');
      }
      return null;
    }

    globalForDb.postgresClient = createPostgresClient();
  }

  return globalForDb.postgresClient;
}

function getDrizzleInstance(): Database | null {
  if (!globalForDb.drizzleDb) {
    const client = getPostgresClient();
    if (!client) return null;

    globalForDb.drizzleDb = drizzle(client, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });
  }

  return globalForDb.drizzleDb;
}

function getDbClient(): DrizzleClient | null {
  if (!globalForDb.db) {
    const drizzleInstance = getDrizzleInstance();
    if (!drizzleInstance) return null;

    globalForDb.db = createDrizzleClient(drizzleInstance);
  }

  return globalForDb.db;
}

// ============================================================================
// Database Export
// ============================================================================

function createModeAwareDbProxy(): DrizzleClient {
  const handler: ProxyHandler<DrizzleClient> = {
    get(_target, prop: string | symbol) {
      const client = getDbClient();
      if (!client) {
        if (isBuildTime) {
          return new Proxy(
            {},
            {
              get() {
                return () => Promise.resolve(null);
              },
            }
          );
        }
        throw new Error(
          'Database not initialized. Set DATABASE_URL environment variable.'
        );
      }
      return client[prop as keyof DrizzleClient];
    },
  };

  const proxyTarget: Partial<DrizzleClient> = {};
  return new Proxy(proxyTarget, handler) as DrizzleClient;
}

/** Main database instance */
export const db: DrizzleClient = createModeAwareDbProxy();

/** Get raw Drizzle instance for advanced operations (e.g., transactions) */
export function getRawDrizzle(): Database {
  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');
  return instance;
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
  const drizzleInstance = getDrizzleInstance();
  if (!drizzleInstance) throw new Error('Database not initialized');
  return drizzleInstance.transaction(fn);
}

/** User identifier - can be a string ID or an object with userId property */
export type UserIdOrUser = string | { userId: string };

/**
 * Execute as a specific user (with RLS)
 */
export async function asUser<T>(
  userIdOrUser: UserIdOrUser,
  operation: (database: DrizzleClient) => Promise<T>
): Promise<T> {
  const userId =
    typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser.userId;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const privyDidRegex = /^did:privy:[a-z0-9]+$/i;
  const oauth3DidRegex = /^did:oauth3:[a-z0-9]+$/i;
  const snowflakeRegex = /^\d{15,20}$/;

  if (
    !uuidRegex.test(userId) &&
    !privyDidRegex.test(userId) &&
    !oauth3DidRegex.test(userId) &&
    !snowflakeRegex.test(userId)
  ) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  const drizzleInstance = getDrizzleInstance();
  if (!drizzleInstance) throw new Error('Database not initialized');

  return drizzleInstance.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, true)`
    );
    const txClient = createDrizzleClient(tx as Database);
    return operation(txClient);
  });
}

/**
 * Execute as system (bypass RLS)
 */
export async function asSystem<T>(
  operation: (database: DrizzleClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const startTime = Date.now();
  const drizzleInstance = getDrizzleInstance();
  if (!drizzleInstance) throw new Error('Database not initialized');

  const result = await drizzleInstance.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', 'system', true)`
    );
    const txClient = createDrizzleClient(tx as Database);
    return operation(txClient);
  });

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
  operation: (database: DrizzleClient) => Promise<T>
): Promise<T> {
  const drizzleInstance = getDrizzleInstance();
  if (!drizzleInstance) throw new Error('Database not initialized');

  return drizzleInstance.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
    const txClient = createDrizzleClient(tx as Database);
    return operation(txClient);
  });
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

export type StorageMode = 'cql' | 'postgres' | 'json' | 'memory';

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

export * from './moderation/filters';

export {
  type QueryMetrics,
  queryMonitor,
  type SlowQueryStats,
} from './query-monitor';

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

  // Initialize Drizzle for legacy transaction support (optional)
  // Only needed if DATABASE_URL is configured for backwards compatibility
  if (process.env.DATABASE_URL) {
    getDrizzleInstance();
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  // Check CQL (primary, mandatory)
  const cqlDb = getDB();
  const cqlHealthy = cqlDb.isHealthy();
  if (!cqlHealthy) {
    return false;
  }

  // Check Drizzle if configured (optional, for legacy support)
  if (process.env.DATABASE_URL) {
    const drizzleInstance = getDrizzleInstance();
    if (!drizzleInstance) return false;
  }

  return true;
}

export async function closeDatabase(): Promise<void> {
  // Close CQL
  resetDB();
  // Close Drizzle
  if (globalForDb.postgresClient) {
    await globalForDb.postgresClient.end();
    globalForDb.postgresClient = undefined;
    globalForDb.drizzleDb = undefined;
    globalForDb.db = undefined;
  }
}
