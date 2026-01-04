/**
 * Decentralized Database Layer
 *
 * Thin wrapper around @jejunetwork/db that provides Babylon-specific
 * configuration and a unified interface.
 *
 * Configuration is resolved in this order:
 * 1. Environment variable override (SQLIT_BLOCK_PRODUCER_ENDPOINT)
 * 2. Network-based config from @jejunetwork/config (based on JEJU_NETWORK)
 */

import { getNetworkName, getSQLitEndpoint } from '@babylon/shared/config'
import { getSQLitUrl } from '@jejunetwork/config'
import {
  type ExecResult,
  getSQLit,
  type QueryParam,
  type SQLitClient,
} from '@jejunetwork/db'
import { first } from '@jejunetwork/shared'
import { createQueryTransaction, type QueryTransaction } from '../sqlit-client'
import { toQueryParam } from '../type-guards'

/** Jeju network type */
type JejuNetwork = 'localnet' | 'testnet' | 'mainnet'

/** Type guard for valid Jeju network values */
function isJejuNetwork(value: string): value is JejuNetwork {
  return value === 'localnet' || value === 'testnet' || value === 'mainnet'
}

/** Type guard for hex string private key format */
function isHexPrivateKey(value: string | undefined): value is `0x${string}` {
  return typeof value === 'string' && value.startsWith('0x')
}

// ============================================================================
// Types
// ============================================================================

export interface WhereCondition {
  [key: string]: unknown
}

export interface OrderBy {
  column: string
  direction: 'asc' | 'desc'
}

export interface SelectOptions {
  where?: WhereCondition
  orderBy?: OrderBy | OrderBy[]
  limit?: number
  offset?: number
  columns?: string[]
}

export interface InsertOptions {
  returning?: string[]
}

export interface UpdateOptions {
  where: WhereCondition
  returning?: string[]
}

export interface DeleteOptions {
  where: WhereCondition
}

export interface TransactionContext {
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]>
  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null>
  exec(sql: string, params?: QueryParam[]): Promise<ExecResult>
}

export type { QueryTransaction }

// ============================================================================
// Database Client
// ============================================================================

class DB {
  private client: SQLitClient | null = null
  private initialized = false
  private databaseId: string
  private _endpoint: string | null = null

  constructor() {
    this.databaseId = process.env.SQLIT_DATABASE_ID || 'babylon'
  }

  getEndpoint(): string | null {
    return this._endpoint
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Env override takes precedence, then config
    let endpoint =
      (typeof process !== 'undefined'
        ? process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT
        : undefined) || getSQLitEndpoint()

    // Fallback: try network-based config if endpoint still not set
    if (!endpoint) {
      const network =
        (typeof process !== 'undefined'
          ? process.env.JEJU_NETWORK
          : undefined) || getNetworkName()
      if (network && isJejuNetwork(network)) {
        try {
          endpoint = getSQLitUrl(network)
        } catch {
          // Config not available, use default
        }
      }
    }

    // Default to localnet endpoint if nothing else is configured
    if (!endpoint) {
      endpoint = 'http://localhost:4661'
    }

    this._endpoint = endpoint

    const privateKey = process.env.SQLIT_PRIVATE_KEY
    this.client = getSQLit({
      blockProducerEndpoint: endpoint,
      databaseId: this.databaseId,
      privateKey: isHexPrivateKey(privateKey) ? privateKey : undefined,
      timeout: parseInt(process.env.SQLIT_TIMEOUT ?? '30000', 10),
      debug: process.env.SQLIT_DEBUG === 'true',
    })

    const healthy = await this.client.isHealthy()
    if (!healthy) {
      throw new Error(`[DB] SQLit at ${endpoint} is not healthy.`)
    }

    this.initialized = true
  }

  private requireClient(): SQLitClient {
    if (!this.client || !this.initialized) {
      throw new Error('[DB] Database not initialized. Call initialize() first.')
    }
    return this.client
  }

  // Query Methods
  async query<T>(sql: string, params: QueryParam[] = []): Promise<T[]> {
    const result = await this.requireClient().query<T>(sql, params)
    return result.rows
  }

  async queryOne<T>(sql: string, params: QueryParam[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return first(rows)
  }

  async exec(sql: string, params: QueryParam[] = []): Promise<ExecResult> {
    return this.requireClient().exec(sql, params)
  }

  // CRUD Operations
  async select<T>(table: string, options: SelectOptions = {}): Promise<T[]> {
    const { where, orderBy, limit, offset, columns } = options

    const columnList = columns?.length
      ? columns.map((c) => `"${c}"`).join(', ')
      : '*'
    let sql = `SELECT ${columnList} FROM "${table}"`
    const params: QueryParam[] = []

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value], i) => {
        params.push(toQueryParam(value))
        return `"${key}" = $${i + 1}`
      })
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
      const orderClauses = orders.map(
        (o) => `"${o.column}" ${o.direction.toUpperCase()}`,
      )
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    if (limit !== undefined) sql += ` LIMIT ${limit}`
    if (offset !== undefined) sql += ` OFFSET ${offset}`

    return this.query<T>(sql, params)
  }

  async selectOne<T>(
    table: string,
    options: SelectOptions = {},
  ): Promise<T | null> {
    const rows = await this.select<T>(table, { ...options, limit: 1 })
    return first(rows)
  }

  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    options: InsertOptions = {},
  ): Promise<T | null> {
    const columns = Object.keys(data)
    const values = Object.values(data).map((v) => toQueryParam(v))
    const placeholders = columns.map((_, i) => `$${i + 1}`)

    let sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`

    if (options.returning?.length) {
      sql += ` RETURNING ${options.returning.map((c) => `"${c}"`).join(', ')}`
      return this.queryOne<T>(sql, values)
    }

    await this.exec(sql, values)
    return null
  }

  async update<T>(
    table: string,
    data: Record<string, unknown>,
    options: UpdateOptions,
  ): Promise<T | null> {
    const setClauses: string[] = []
    const params: QueryParam[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = $${paramIndex++}`)
      params.push(toQueryParam(value))
    }

    const whereClauses = Object.entries(options.where).map(([key, value]) => {
      params.push(toQueryParam(value))
      return `"${key}" = $${paramIndex++}`
    })

    let sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`

    if (options.returning?.length) {
      sql += ` RETURNING ${options.returning.map((c) => `"${c}"`).join(', ')}`
      return this.queryOne<T>(sql, params)
    }

    await this.exec(sql, params)
    return null
  }

  async delete(table: string, options: DeleteOptions): Promise<number> {
    const params: QueryParam[] = []
    const whereClauses = Object.entries(options.where).map(
      ([key, value], i) => {
        params.push(toQueryParam(value))
        return `"${key}" = $${i + 1}`
      },
    )

    const sql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')}`
    const result = await this.exec(sql, params)
    return result.rowsAffected
  }

  async count(table: string, where?: WhereCondition): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${table}"`
    const params: QueryParam[] = []

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value], i) => {
        params.push(toQueryParam(value))
        return `"${key}" = $${i + 1}`
      })
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    const result = await this.queryOne<{ count: number }>(sql, params)
    if (result === null) {
      throw new Error(`[DB] COUNT query on "${table}" returned no rows`)
    }
    return result.count
  }

  // Transaction Support
  async transaction<T>(fn: (ctx: QueryTransaction) => Promise<T>): Promise<T> {
    const client = this.requireClient()
    const conn = await client.connect()
    const tx = await conn.beginTransaction()

    const rawCtx: TransactionContext = {
      query: async <R>(sql: string, params?: QueryParam[]): Promise<R[]> => {
        const result = await tx.query<R>(sql, params)
        return result.rows
      },
      queryOne: async <R>(
        sql: string,
        params?: QueryParam[],
      ): Promise<R | null> => {
        const result = await tx.query<R>(sql, params)
        return first(result.rows)
      },
      exec: (sql: string, params?: QueryParam[]) => tx.exec(sql, params),
    }

    const queryTx = createQueryTransaction(rawCtx)

    try {
      const result = await fn(queryTx)
      await tx.commit()
      return result
    } catch (error) {
      await tx.rollback()
      throw error
    } finally {
      client.getPool(conn.databaseId).release(conn)
    }
  }

  // Health & Status
  async isHealthy(): Promise<boolean> {
    if (!this.client) return false
    return this.client.isHealthy()
  }

  async getBlockHeight(): Promise<number> {
    const info = await this.requireClient().getBlockProducerInfo()
    return info.blockHeight
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let dbInstance: DB | null = null

export function getDB(): DB {
  if (!dbInstance) {
    dbInstance = new DB()
  }
  return dbInstance
}

export async function initializeDB(): Promise<DB> {
  const db = getDB()
  await db.initialize()
  return db
}

export function resetDB(): void {
  dbInstance = null
}

export { DB }
