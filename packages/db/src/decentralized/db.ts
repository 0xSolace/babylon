/**
 * Decentralized Database Layer
 *
 * ALL database operations route through CQL (CovenantSQL) via Jeju DWS.
 * NO FALLBACKS - CQL is required for operation.
 *
 * Configuration is resolved in this order:
 * 1. Environment variable override (CQL_BLOCK_PRODUCER_ENDPOINT)
 * 2. Network-based config from @jejunetwork/config (based on JEJU_NETWORK)
 *
 * This replaces the PostgreSQL Drizzle client as the primary data layer.
 */

import { logger } from '@babylon/shared';
// Type imports don't trigger runtime code execution
import type { CQLClient, ExecResult, QueryParam } from '@jeju/db';
import {
  createDrizzleTransaction,
  type DrizzleTransaction,
} from './drizzle-compat';

// Check if we're running in Bun
const isBun = typeof process !== 'undefined' && 'Bun' in globalThis;

// Lazy imports to avoid bun:sqlite issues during webpack build
let _getCQL: typeof import('@jeju/db').getCQL | null = null;
let _getCQLUrl: typeof import('@jejunetwork/config').getCQLUrl | null = null;

async function loadJejuConfig(): Promise<{
  getCQLUrl: typeof import('@jejunetwork/config').getCQLUrl;
}> {
  if (!_getCQLUrl) {
    const config = await import(
      /* webpackIgnore: true */ '@jejunetwork/config'
    );
    _getCQLUrl = config.getCQLUrl;
  }
  return { getCQLUrl: _getCQLUrl };
}

async function getCQL(
  config: Parameters<typeof import('@jeju/db').getCQL>[0]
): Promise<CQLClient> {
  if (!isBun) {
    throw new Error(
      '[DB] @jeju/db requires Bun runtime. Cannot run in Node.js. ' +
        'Build with Bun or use dynamic route exports to skip static page generation.'
    );
  }
  if (!_getCQL) {
    // Use webpackIgnore comment to prevent webpack from bundling this module
    const { getCQL: fn } = await import(/* webpackIgnore: true */ '@jeju/db');
    _getCQL = fn;
  }
  return _getCQL(config);
}

// ============================================================================
// Types
// ============================================================================

export interface WhereCondition {
  [key: string]: unknown;
}

export interface OrderBy {
  column: string;
  direction: 'asc' | 'desc';
}

export interface SelectOptions {
  where?: WhereCondition;
  orderBy?: OrderBy | OrderBy[];
  limit?: number;
  offset?: number;
  columns?: string[];
}

export interface InsertOptions {
  returning?: string[];
}

export interface UpdateOptions {
  where: WhereCondition;
  returning?: string[];
}

export interface DeleteOptions {
  where: WhereCondition;
}

/**
 * Transaction context for raw SQL operations
 */
export interface TransactionContext {
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null>;
  exec(sql: string, params?: QueryParam[]): Promise<ExecResult>;
}

/**
 * Extended transaction context with Drizzle-like chainable methods
 */
export type DrizzleTransactionContext = DrizzleTransaction;

// ============================================================================
// Decentralized Database Client
// ============================================================================

class DecentralizedDB {
  private client: CQLClient | null = null;
  private initialized = false;
  private databaseId: string;
  private _endpoint: string | null = null;

  constructor() {
    this.databaseId = process.env.CQL_DATABASE_ID || 'babylon';
  }

  /** Get the configured CQL endpoint */
  getEndpoint(): string | null {
    return this._endpoint;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Resolve CQL endpoint from env var or Jeju network config
    let endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;

    if (!endpoint) {
      // Try to get endpoint from @jejunetwork/config based on JEJU_NETWORK
      const network = process.env.JEJU_NETWORK;
      if (network) {
        const { getCQLUrl } = await loadJejuConfig();
        endpoint = getCQLUrl(network as 'localnet' | 'testnet' | 'mainnet');
        logger.info(
          `[DB] Using CQL endpoint from JEJU_NETWORK=${network}: ${endpoint}`,
          {},
          'DB'
        );
      }
    }

    if (!endpoint) {
      throw new Error(
        '[DB] CQL endpoint not configured. Either:\n' +
          '  1. Set CQL_BLOCK_PRODUCER_ENDPOINT environment variable, or\n' +
          '  2. Set JEJU_NETWORK=localnet|testnet|mainnet to use Jeju DWS config\n' +
          '\nStart Jeju for local development: cd /path/to/jeju && jeju dev'
      );
    }

    this._endpoint = endpoint;

    this.client = await getCQL({
      blockProducerEndpoint: endpoint,
      databaseId: this.databaseId,
      privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
      timeout: parseInt(process.env.CQL_TIMEOUT ?? '30000', 10),
      debug: process.env.CQL_DEBUG === 'true',
    });

    const healthy = await this.client.isHealthy();
    if (!healthy) {
      throw new Error(
        `[DB] CQL at ${endpoint} is not healthy. ` +
          'Start Jeju services: cd /path/to/jeju && jeju dev'
      );
    }

    logger.info(
      '[DB] Connected to CovenantSQL',
      { endpoint, databaseId: this.databaseId },
      'DB'
    );
    this.initialized = true;
  }

  private requireClient(): CQLClient {
    if (!this.client || !this.initialized) {
      throw new Error(
        '[DB] Database not initialized. Call initialize() first.'
      );
    }
    return this.client;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async query<T>(sql: string, params: QueryParam[] = []): Promise<T[]> {
    const client = this.requireClient();
    const result = await client.query<T>(sql, params);
    return result.rows;
  }

  async queryOne<T>(sql: string, params: QueryParam[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async exec(sql: string, params: QueryParam[] = []): Promise<ExecResult> {
    const client = this.requireClient();
    return client.exec(sql, params);
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async select<T>(table: string, options: SelectOptions = {}): Promise<T[]> {
    const { where, orderBy, limit, offset, columns } = options;

    const columnList = columns?.length
      ? columns.map((c) => `"${c}"`).join(', ')
      : '*';
    let sql = `SELECT ${columnList} FROM "${table}"`;
    const params: QueryParam[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value], i) => {
        params.push(value as QueryParam);
        return `"${key}" = $${i + 1}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
      const orderClauses = orders.map(
        (o) => `"${o.column}" ${o.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    if (limit !== undefined) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset !== undefined) {
      sql += ` OFFSET ${offset}`;
    }

    return this.query<T>(sql, params);
  }

  async selectOne<T>(
    table: string,
    options: SelectOptions = {}
  ): Promise<T | null> {
    const rows = await this.select<T>(table, { ...options, limit: 1 });
    return rows[0] ?? null;
  }

  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    options: InsertOptions = {}
  ): Promise<T | null> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    let sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`;

    if (options.returning?.length) {
      sql += ` RETURNING ${options.returning.map((c) => `"${c}"`).join(', ')}`;
      return this.queryOne<T>(sql, values as QueryParam[]);
    }

    await this.exec(sql, values as QueryParam[]);
    return null;
  }

  async insertMany<T>(
    table: string,
    records: Record<string, unknown>[],
    options: InsertOptions = {}
  ): Promise<T[]> {
    if (records.length === 0) return [];

    const firstRecord = records[0];
    if (!firstRecord) return [];

    const columns = Object.keys(firstRecord);
    const allValues: QueryParam[] = [];
    const valueSets: string[] = [];

    records.forEach((record, rowIndex) => {
      const placeholders = columns.map((col, colIndex) => {
        allValues.push(record[col] as QueryParam);
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      valueSets.push(`(${placeholders.join(', ')})`);
    });

    let sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`;

    if (options.returning?.length) {
      sql += ` RETURNING ${options.returning.map((c) => `"${c}"`).join(', ')}`;
      return this.query<T>(sql, allValues);
    }

    await this.exec(sql, allValues);
    return [];
  }

  async update<T>(
    table: string,
    data: Record<string, unknown>,
    options: UpdateOptions
  ): Promise<T | null> {
    const setClauses: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = $${paramIndex++}`);
      params.push(value as QueryParam);
    }

    const whereClauses = Object.entries(options.where).map(([key, value]) => {
      params.push(value as QueryParam);
      return `"${key}" = $${paramIndex++}`;
    });

    let sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    if (options.returning?.length) {
      sql += ` RETURNING ${options.returning.map((c) => `"${c}"`).join(', ')}`;
      return this.queryOne<T>(sql, params);
    }

    await this.exec(sql, params);
    return null;
  }

  async delete(table: string, options: DeleteOptions): Promise<number> {
    const params: QueryParam[] = [];
    const whereClauses = Object.entries(options.where).map(
      ([key, value], i) => {
        params.push(value as QueryParam);
        return `"${key}" = $${i + 1}`;
      }
    );

    const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')}`;
    const result = await this.exec(sql, params);
    return result.rowsAffected;
  }

  async count(table: string, where?: WhereCondition): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${table}"`;
    const params: QueryParam[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value], i) => {
        params.push(value as QueryParam);
        return `"${key}" = $${i + 1}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.queryOne<{ count: number }>(sql, params);
    if (result === null) {
      throw new Error(`[DB] COUNT query on "${table}" returned no rows`);
    }
    return result.count;
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Execute operations within a transaction.
   * The callback receives a DrizzleTransactionContext that supports both:
   * - Raw SQL: tx.query(), tx.queryOne(), tx.exec()
   * - Drizzle-style: tx.update(table).set({}).where(), tx.insert(table).values()
   */
  async transaction<T>(
    fn: (ctx: DrizzleTransactionContext) => Promise<T>
  ): Promise<T> {
    const client = this.requireClient();
    const conn = await client.connect();
    const tx = await conn.beginTransaction();

    try {
      const rawCtx: TransactionContext = {
        query: async <R>(sql: string, params?: QueryParam[]): Promise<R[]> => {
          const result = await tx.query<R>(sql, params);
          return result.rows;
        },
        queryOne: async <R>(
          sql: string,
          params?: QueryParam[]
        ): Promise<R | null> => {
          const result = await tx.query<R>(sql, params);
          return result.rows[0] ?? null;
        },
        exec: (sql: string, params?: QueryParam[]) => tx.exec(sql, params),
      };

      // Wrap with Drizzle-compatible transaction
      const drizzleTx = createDrizzleTransaction(rawCtx);
      const result = await fn(drizzleTx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      client.getPool(conn.databaseId).release(conn);
    }
  }

  // ============================================================================
  // Health & Status
  // ============================================================================

  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;
    return this.client.isHealthy();
  }

  async getBlockHeight(): Promise<number> {
    const client = this.requireClient();
    const info = await client.getBlockProducerInfo();
    return info.blockHeight;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let dbInstance: DecentralizedDB | null = null;

export function getDB(): DecentralizedDB {
  if (!dbInstance) {
    dbInstance = new DecentralizedDB();
  }
  return dbInstance;
}

export async function initializeDB(): Promise<DecentralizedDB> {
  const db = getDB();
  await db.initialize();
  return db;
}

export function resetDB(): void {
  dbInstance = null;
}

export { DecentralizedDB };
