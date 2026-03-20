/**
 * Database runtime (connection management + mode-aware client)
 *
 * This module exists to avoid internal circular dependencies by ensuring
 * other modules can import `db`/`Database` without importing `src/index.ts`.
 */

import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  createDrizzleClient,
  type DrizzleClient,
  type SQLValue,
} from './client';
import { createJsonClient } from './json-client';
import {
  clearJsonStorage,
  exportJsonState,
  getJsonState,
  getJsonStoragePath,
  initJsonStorage,
  loadJsonSnapshot,
  saveJsonSnapshot,
} from './json-storage';
import { logger } from './logger';
import * as schema from './schema';

// ============================================================================
// Types
// ============================================================================

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

// ============================================================================
// Connection Management
// ============================================================================

// Global state for database connections (serverless-safe)
// Using a type assertion here is safe because we're extending globalThis
const globalForDb = globalThis as typeof globalThis & {
  postgresClient: ReturnType<typeof postgres> | undefined;
  drizzleDb: Database | undefined;
  db: DrizzleClient | undefined;
  // Read replica support for high-scale deployments
  readReplicaClient: ReturnType<typeof postgres> | undefined;
  readReplicaDrizzle: Database | undefined;
  readReplicaDb: DrizzleClient | undefined;
};

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// ============================================================================
// Shared Utilities
// ============================================================================

function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_ENV === 'test' ||
    (typeof process !== 'undefined' && process.argv?.join(' ').includes('test'))
  );
}

/** Hard cap so misconfiguration cannot exhaust Postgres max_connections */
const DATABASE_POOL_MAX_CAP = 500;

function parsePositiveIntEnv(key: string): number | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, DATABASE_POOL_MAX_CAP);
}

// ============================================================================
// Primary/Master Configuration
// ============================================================================

function getConnectionUrl(): string {
  return process.env.DATABASE_URL || 'postgresql://localhost:5432/babylon';
}

// ============================================================================
// Read Replica/Slave Configuration
// ============================================================================

// ============================================================================
// Postgres Client Configuration
// ============================================================================

function getPostgresClientConfig(
  url: string,
  role: 'primary' | 'replica'
): postgres.Options<{}> {
  const isTest = isTestEnvironment();
  const isProd = process.env.NODE_ENV === 'production';

  // Determine if this is a local database connection
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  // Check if SSL is already specified in the URL (sslmode=require or ssl=true)
  const hasExplicitSSL =
    url.includes('sslmode=require') || url.includes('ssl=true');

  // Check for cloud database providers that require SSL (Neon, Supabase, etc.)
  const isCloudProvider =
    url.includes('neon.tech') ||
    url.includes('supabase.co') ||
    url.includes('pooler.supabase') ||
    url.includes('db.bit.io') ||
    url.includes('.postgres.database.azure.com') ||
    url.includes('.rds.amazonaws.com');

  // SSL is required for:
  // - URL explicitly specifies sslmode=require
  // - Production with non-localhost connections
  // - Any cloud database provider (even in development)
  const sslMode: 'require' | false =
    hasExplicitSSL || (!isLocalhost && (isProd || isCloudProvider))
      ? 'require'
      : false;

  // Node serves many concurrent requests in one process; without a bounded pool we'd get
  // one connection per in-flight query and exhaust Neon/Postgres limits. Pool caps connections
  // and queues work. Defaults stay small so (instances × pool max) stays within Neon caps.
  const isPooler =
    url.includes('pooler') ||
    url.includes('pgbouncer') ||
    url.includes('?pgbouncer=true') ||
    url.includes('?pgbouncer=1') ||
    url.includes('-pooler.') ||
    url.includes('pooler.supabase');

  const envKey =
    role === 'primary' ? 'DATABASE_POOL_MAX' : 'DATABASE_READ_REPLICA_POOL_MAX';
  const envMax = parsePositiveIntEnv(envKey);
  let poolMax: number;
  if (envMax !== undefined) {
    poolMax = envMax;
  } else if (isPooler) {
    // PgBouncer / Neon pooler: multiplexes to backends. Defaults stay small per process
    // so many concurrent app instances (serverless / workers) do not exhaust pooled (~10k) caps.
    poolMax =
      role === 'primary'
        ? isProd
          ? 10
          : isTest
            ? 2
            : 8
        : isProd
          ? 15
          : isTest
            ? 2
            : 12;
  } else {
    // Direct Postgres: each slot may hold a server connection. Stricter than pooler so
    // high fan-out stays under Neon direct (~4k) limits. Prefer pooled URL in production.
    poolMax =
      role === 'primary'
        ? isProd
          ? 8
          : isTest
            ? 5
            : 10
        : isProd
          ? 12
          : isTest
            ? 5
            : 15;
  }

  // Connection params
  const applicationName =
    role === 'replica' && process.env.DATABASE_READ_REPLICA_APPLICATION_NAME
      ? process.env.DATABASE_READ_REPLICA_APPLICATION_NAME
      : (process.env.DATABASE_APPLICATION_NAME ?? 'babylon');

  const applyGuardrails =
    !isTest &&
    (process.env.NODE_ENV === 'production' ||
      ['true', '1', 'yes'].includes(
        process.env.DATABASE_SESSION_GUARDRAILS?.toLowerCase() ?? ''
      ));

  const connectionParams: Partial<postgres.ConnectionParameters> = {
    application_name: applicationName,
  };

  if (applyGuardrails) {
    const statementMs =
      parsePositiveIntEnv('DATABASE_STATEMENT_TIMEOUT_MS') ?? 60_000;
    const lockMs = parsePositiveIntEnv('DATABASE_LOCK_TIMEOUT_MS') ?? 10_000;
    const idleInTxMs =
      parsePositiveIntEnv('DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS') ?? 60_000;
    if (statementMs > 0) connectionParams.statement_timeout = statementMs;
    if (lockMs > 0) connectionParams.lock_timeout = lockMs;
    if (idleInTxMs > 0)
      connectionParams.idle_in_transaction_session_timeout = idleInTxMs;
  }

  logger.debug(`[Drizzle] Creating ${role} postgres client`, {
    isProd,
    isLocalhost,
    isCloudProvider,
    hasExplicitSSL,
    sslMode,
    isPooler,
    poolMax,
    urlHost: url.split('@')[1]?.split('/')[0] || 'unknown',
  });

  return {
    max: poolMax,
    // Shorter idle timeout for serverless to release connections faster
    idle_timeout: isProd ? 20 : 15,
    connect_timeout: 10,
    ssl: sslMode,
    transform: { undefined: null },
    onnotice: () => {},
    connection: connectionParams,
  };
}

// ============================================================================
// Primary/Master Client Creation
// ============================================================================

function createPostgresClient(): ReturnType<typeof postgres> {
  const url = getConnectionUrl();
  return postgres(url, getPostgresClientConfig(url, 'primary'));
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
    logger.info('[Drizzle] Database connection created');
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

// ============================================================================
// Read Replica/Slave Client Creation
// ============================================================================

/**
 * Create a read replica postgres client
 * Uses separate connection pool for read-heavy operations
 */
function createReadReplicaClient(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_READ_REPLICA_URL || getConnectionUrl();
  return postgres(url, getPostgresClientConfig(url, 'replica'));
}

/**
 * Get read replica Drizzle instance
 * Falls back to primary if read replica not configured
 */
function getReadReplicaDrizzle(): Database | null {
  // If no dedicated read replica, use primary
  const replicaUrl = process.env.DATABASE_READ_REPLICA_URL;
  if (!replicaUrl || replicaUrl === getConnectionUrl()) {
    return getDrizzleInstance();
  }

  if (!globalForDb.readReplicaDrizzle) {
    if (!globalForDb.readReplicaClient) {
      const client = createReadReplicaClient();
      globalForDb.readReplicaClient = client;
    }

    if (!globalForDb.readReplicaClient) return getDrizzleInstance();

    globalForDb.readReplicaDrizzle = drizzle(globalForDb.readReplicaClient, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });

    logger.info('[Drizzle] Read replica connection created');
  }

  return globalForDb.readReplicaDrizzle;
}

/**
 * Get read replica DrizzleClient (cached)
 * Falls back to primary if read replica not configured
 */
function getReadReplicaDbClient(): DrizzleClient | null {
  const replica = getReadReplicaDrizzle();
  if (!replica) {
    return getDbClient();
  }

  if (!globalForDb.readReplicaDb) {
    globalForDb.readReplicaDb = createDrizzleClient(replica);
  }

  return globalForDb.readReplicaDb;
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
// Retry Logic
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

const defaultRetryConfig: RetryConfig = isTestEnvironment()
  ? { maxRetries: 2, initialDelayMs: 50, maxDelayMs: 500, jitter: false }
  : { maxRetries: 5, initialDelayMs: 100, maxDelayMs: 5000, jitter: true };

async function withRetryInternal<T>(
  operation: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Retry on transient connection errors
      // Match specific error patterns to avoid retrying non-retryable errors
      const errorMsg = lastError.message.toLowerCase();
      const isRetryable =
        (errorMsg.includes('connection') &&
          (errorMsg.includes('closed') ||
            errorMsg.includes('terminated') ||
            errorMsg.includes('refused') ||
            errorMsg.includes('reset'))) ||
        (errorMsg.includes('timeout') &&
          (errorMsg.includes('connection') || errorMsg.includes('query'))) ||
        errorMsg.includes('deadlock') ||
        errorMsg.includes('econnrefused') ||
        errorMsg.includes('econnreset') ||
        errorMsg.includes('etimedout');

      if (!isRetryable || attempt === config.maxRetries) {
        throw lastError;
      }

      logger.warn(`[Drizzle] Retry ${attempt + 1}/${config.maxRetries}`, {
        error: lastError.message,
      });

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, config.maxDelayMs);
      if (config.jitter) delay += Math.random() * delay * 0.1;
    }
  }

  throw lastError;
}

// ============================================================================
// Storage Mode Management
// ============================================================================

export type StorageMode = 'postgres' | 'json' | 'memory';

// Global storage mode
let currentStorageMode: StorageMode = 'postgres';
let jsonClient: DrizzleClient | null = null;

/**
 * Initialize JSON storage mode.
 * All database operations will use JSON file storage instead of PostgreSQL.
 *
 * @param basePath - Directory to store JSON files
 * @param options - Configuration options
 */
export async function initializeJsonMode(
  basePath: string,
  options: { autoSave?: boolean } = {}
): Promise<void> {
  await initJsonStorage(basePath, options);
  currentStorageMode = 'json';
  jsonClient = createJsonClient();
  logger.info('[DB] Initialized JSON storage mode', { basePath });
}

/**
 * Initialize memory storage mode (JSON without persistence).
 * Useful for testing.
 */
export async function initializeMemoryMode(): Promise<void> {
  await initJsonStorage('/tmp/babylon-memory', { autoSave: false });
  currentStorageMode = 'memory';
  jsonClient = createJsonClient();
  logger.info('[DB] Initialized memory storage mode');
}

/**
 * Reset to PostgreSQL mode.
 */
export function resetToPostgresMode(): void {
  currentStorageMode = 'postgres';
  jsonClient = null;
  clearJsonStorage();
  logger.info('[DB] Reset to PostgreSQL mode');
}

/** Get current storage mode */
export function getStorageMode(): StorageMode {
  return currentStorageMode;
}

/** Check if using JSON/memory mode */
export function isSimulationMode(): boolean {
  return currentStorageMode === 'json' || currentStorageMode === 'memory';
}

// Re-export JSON storage utilities
export {
  exportJsonState,
  getJsonState,
  getJsonStoragePath,
  loadJsonSnapshot,
  saveJsonSnapshot,
};

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Read-only methods that can safely use read replica
 */
const READ_METHODS = new Set([
  'select',
  'selectDistinct',
  'selectDistinctOn',
  'query',
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  '$queryRaw',
]);

/**
 * Read-only methods on table repositories (e.g. db.user.findMany)
 */
const TABLE_READ_METHODS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
]);

/**
 * Write methods that must use primary database
 */
const WRITE_METHODS = new Set([
  'insert',
  'update',
  'delete',
  'execute',
  'transaction',
  '$transaction',
  '$executeRaw',
  'create',
  'createMany',
  'updateMany',
  'deleteMany',
  'upsert',
]);

/**
 * Create a lazy proxy that switches between PostgreSQL and JSON mode,
 * and automatically routes reads to replica when available.
 */
function createModeAwareDbProxy(): DrizzleClient {
  const handler: ProxyHandler<DrizzleClient> = {
    get(_target, prop: string | symbol) {
      // In JSON/memory mode, use the JSON client
      if (currentStorageMode !== 'postgres' && jsonClient) {
        return jsonClient[prop as keyof DrizzleClient];
      }

      const propStr = String(prop);
      const isReadMethod = READ_METHODS.has(propStr);
      const isWriteMethod = WRITE_METHODS.has(propStr);

      // For read operations, try to use replica
      if (isReadMethod) {
        const replicaClient = getReadReplicaDbClient();
        if (replicaClient) {
          return replicaClient[prop as keyof DrizzleClient];
        }
      }

      // For writes or when no replica, use primary
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
          'Database not initialized. Check DATABASE_URL or use initializeJsonMode().'
        );
      }

      const value = client[prop as keyof DrizzleClient];

      // For table repositories (user, post, etc.), wrap with read/write detection
      if (
        !isReadMethod &&
        !isWriteMethod &&
        value &&
        typeof value === 'object' &&
        'findMany' in value
      ) {
        return new Proxy(value as object, {
          get(target, method: string | symbol) {
            const methodStr = String(method);

            // Route table read methods to replica if available
            if (TABLE_READ_METHODS.has(methodStr)) {
              const replicaClient = getReadReplicaDbClient();
              if (replicaClient) {
                const tableRepo = replicaClient[prop as keyof DrizzleClient];
                if (tableRepo && typeof tableRepo === 'object') {
                  const replicaMethod = (
                    tableRepo as Record<PropertyKey, unknown>
                  )[method];
                  // Bind to replica table repo so `this` context is correct
                  if (typeof replicaMethod === 'function') {
                    return replicaMethod.bind(tableRepo);
                  }
                  return replicaMethod;
                }
              }
            }

            // Writes or no replica - use primary
            return (target as Record<PropertyKey, unknown>)[method];
          },
        }) as unknown as typeof value;
      }

      return value;
    },
  };

  const proxyTarget: Partial<DrizzleClient> = {};
  return new Proxy(proxyTarget, handler) as DrizzleClient;
}

/**
 * Create a proxy that always routes to primary (writes)
 */
function createPrimaryDbProxy(): DrizzleClient {
  const handler: ProxyHandler<DrizzleClient> = {
    get(_target, prop: string | symbol) {
      // In JSON/memory mode, use the JSON client
      if (currentStorageMode !== 'postgres' && jsonClient) {
        return jsonClient[prop as keyof DrizzleClient];
      }

      // Always use primary
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
          'Database not initialized. Check DATABASE_URL or use initializeJsonMode().'
        );
      }
      return client[prop as keyof DrizzleClient];
    },
  };

  const proxyTarget: Partial<DrizzleClient> = {};
  return new Proxy(proxyTarget, handler) as DrizzleClient;
}

/**
 * Create a proxy that always routes to read replica (reads)
 */
function createReplicaDbProxy(): DrizzleClient {
  const handler: ProxyHandler<DrizzleClient> = {
    get(_target, prop: string | symbol) {
      // In JSON/memory mode, use the JSON client
      if (currentStorageMode !== 'postgres' && jsonClient) {
        return jsonClient[prop as keyof DrizzleClient];
      }

      // Try to use read replica
      const replicaClient = getReadReplicaDbClient();
      if (replicaClient) {
        return replicaClient[prop as keyof DrizzleClient];
      }

      // Fallback to primary if no replica
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
          'Database not initialized. Check DATABASE_URL or use initializeJsonMode().'
        );
      }
      return client[prop as keyof DrizzleClient];
    },
  };

  const proxyTarget: Partial<DrizzleClient> = {};
  return new Proxy(proxyTarget, handler) as DrizzleClient;
}

/**
 * Main database client with automatic read/write routing.
 *
 * Automatically routes:
 * - Reads (select, findMany, findUnique, count, etc.) → read replica (if configured)
 * - Writes (insert, update, delete, create, etc.) → primary database
 *
 * Falls back to primary if no replica is configured.
 *
 * @example
 * ```typescript
 * // Automatically routes to replica
 * const posts = await db.post.findMany({ take: 100 });
 *
 * // Automatically routes to primary
 * await db.post.create({ data: { ... } });
 * ```
 */
export const db: DrizzleClient = createModeAwareDbProxy();

/**
 * Explicit read-only client that always routes to read replica.
 * Falls back to primary if no replica is configured.
 *
 * Use when you want to be explicit about using the replica:
 * - Feed queries
 * - Search results
 * - Analytics queries
 * - Public data that can tolerate slight replication lag
 *
 * @example
 * ```typescript
 * const posts = await dbRead.post.findMany({ take: 100 });
 * const user = await dbRead.user.findUnique({ where: { id: userId } });
 * ```
 */
export const dbRead: DrizzleClient = createReplicaDbProxy();

/**
 * Explicit write-only client that always routes to primary database.
 *
 * Use when you want to be explicit about using the primary:
 * - Write operations
 * - Operations requiring strong consistency
 * - Transactions
 *
 * @example
 * ```typescript
 * await dbWrite.post.create({ data: { ... } });
 * await dbWrite.user.update({ where: { id }, data: { ... } });
 * ```
 */
export const dbWrite: DrizzleClient = createPrimaryDbProxy();

/** Raw Drizzle instance for advanced queries (PostgreSQL only) */
export function getRawDrizzle(): Database {
  if (currentStorageMode !== 'postgres') {
    throw new Error('getRawDrizzle() is only available in PostgreSQL mode');
  }
  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');
  return instance;
}

/** Execute within a transaction */
export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');
  return withRetryInternal(() => instance.transaction(fn));
}

// ============================================================================
// RLS Context Support
// ============================================================================

/** User identifier - can be a string ID or an object with userId property */
export type UserIdOrUser = string | { userId: string };

/**
 * Execute as a specific user (with RLS)
 * @param userIdOrUser - A string userId or an object with userId property (e.g., AuthenticatedUser)
 * @param operation - The database operation to execute
 */
export async function asUser<T>(
  userIdOrUser: UserIdOrUser,
  operation: (database: DrizzleClient) => Promise<T>
): Promise<T> {
  // Extract userId from string or object
  const userId =
    typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser.userId;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const privyDidRegex = /^did:privy:[a-z0-9]+$/i;
  const snowflakeRegex = /^\d{15,20}$/;

  if (
    !uuidRegex.test(userId) &&
    !privyDidRegex.test(userId) &&
    !snowflakeRegex.test(userId)
  ) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');

  return withRetryInternal(() =>
    instance.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`
      );
      // Create a client wrapper for the transaction
      // Transaction type from Drizzle is compatible with Database
      const txClient = createDrizzleClient(tx);
      return operation(txClient);
    })
  );
}

/**
 * Execute as system (bypass RLS)
 */
export async function asSystem<T>(
  operation: (database: DrizzleClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const startTime = Date.now();
  if (operationName) {
    logger.debug('[Drizzle] System operation', { operation: operationName });
  }

  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');

  const result = await withRetryInternal(() =>
    instance.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', 'system', true)`
      );
      // Type assertion is safe: the transaction `tx` from Drizzle implements
      // the same query/execute interface used by createDrizzleClient. The
      // operation callback only uses compatible Database methods (select,
      // insert, update, delete, execute) that both types support.
      const txClient = createDrizzleClient(tx as Database);
      return operation(txClient);
    })
  );

  if (operationName) {
    logger.debug('[Drizzle] System operation completed', {
      operation: operationName,
      duration: `${Date.now() - startTime}ms`,
    });
  }

  return result;
}

/**
 * Execute as public (unauthenticated)
 */
export async function asPublic<T>(
  operation: (database: DrizzleClient) => Promise<T>
): Promise<T> {
  const instance = getDrizzleInstance();
  if (!instance) throw new Error('Database not initialized');

  return withRetryInternal(() =>
    instance.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
      // Transaction type is compatible with Database for our use case
      const txClient = createDrizzleClient(tx as Database);
      return operation(txClient);
    })
  );
}

// ============================================================================
// Utilities
// ============================================================================

/** Health check */
export async function checkDatabaseHealth(): Promise<boolean> {
  const instance = getDrizzleInstance();
  if (!instance) return false;
  await instance.execute(sql`SELECT 1`);
  return true;
}

// ============================================================================
// Read Replica Support
// ============================================================================

/**
 * Execute read-only query on read replica
 *
 * @deprecated Use `dbRead` or `db` (which auto-routes reads) instead.
 * This function is redundant with the automatic routing in the main `db` client.
 *
 * @example
 * ```typescript
 * // Instead of: await onReadReplica(async (db) => db.select()...)
 * // Just use: await db.select()... (automatically routes to replica)
 * // Or explicitly: await dbRead.select()...
 * ```
 */
export async function onReadReplica<T>(
  operation: (database: Database) => Promise<T>
): Promise<T> {
  const replica = getReadReplicaDrizzle();
  if (!replica) {
    throw new Error('Database not initialized');
  }

  return withRetryInternal(() => operation(replica));
}

/**
 * Execute read-only query on read replica using DrizzleClient (ORM-style API)
 *
 * @deprecated Use `dbRead` or `db` (which auto-routes reads) instead.
 * This function is redundant with the automatic routing in the main `db` client.
 *
 * @example
 * ```typescript
 * // Instead of: await onReadReplicaClient(async (db) => db.user.findMany(...))
 * // Just use: await db.user.findMany(...) (automatically routes to replica)
 * // Or explicitly: await dbRead.user.findMany(...)
 * ```
 */
export async function onReadReplicaClient<T>(
  operation: (database: DrizzleClient) => Promise<T>
): Promise<T> {
  const replicaClient = getReadReplicaDbClient();
  if (!replicaClient) {
    throw new Error('Database not initialized');
  }

  return withRetryInternal(() => operation(replicaClient));
}

/**
 * Check if a read replica is configured and available
 */
export function isReadReplicaAvailable(): boolean {
  const replicaUrl = process.env.DATABASE_READ_REPLICA_URL;
  return !!replicaUrl && replicaUrl !== getConnectionUrl();
}

/** Graceful shutdown */
export async function closeDatabase(): Promise<void> {
  // Close read replica first
  if (globalForDb.readReplicaClient) {
    await globalForDb.readReplicaClient.end();
    globalForDb.readReplicaClient = undefined;
    globalForDb.readReplicaDrizzle = undefined;
    globalForDb.readReplicaDb = undefined;
    logger.info('[Drizzle] Read replica connection closed');
  }

  // Close primary connection
  if (globalForDb.postgresClient) {
    await globalForDb.postgresClient.end();
    globalForDb.postgresClient = undefined;
    globalForDb.drizzleDb = undefined;
    globalForDb.db = undefined;
    logger.info('[Drizzle] Database connections closed');
  }
}


