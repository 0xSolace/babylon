/**
 * SQLit Client for Babylon
 *
 * Provides query builder interface for SQLit database operations.
 * Re-exports from decentralized/db.ts and @jejunetwork/db
 */

import { getNetworkName, getSQLitEndpoint } from '@babylon/shared/config'
import { getSQLitUrl } from '@jejunetwork/config'
import type { ExecResult, QueryParam } from '@jejunetwork/db'
import { getSQLit, type SQLitClient } from '@jejunetwork/db'
import {
  createQueryTransaction as createDrizzleQueryTransaction,
  type DeleteBuilder,
  type InsertBuilder,
  type UpdateBuilder,
} from './decentralized/drizzle-compat'

// Type guard for valid Jeju network values
type JejuNetwork = 'localnet' | 'testnet' | 'mainnet'
function isJejuNetwork(value: string): value is JejuNetwork {
  return value === 'localnet' || value === 'testnet' || value === 'mainnet'
}

function isHexPrivateKey(value: string | undefined): value is `0x${string}` {
  return typeof value === 'string' && value.startsWith('0x')
}

// Database singleton
let client: SQLitClient | null = null
const SQLIT_DATABASE_ID = process.env.SQLIT_DATABASE_ID || 'babylon'

export function getSQLitClient(): SQLitClient {
  if (!client) {
    throw new Error(
      '[sqlit-client] Database not initialized. Call createSQLitClient() first.',
    )
  }
  return client
}

export function resetSQLitClient(): void {
  client = null
}

export async function createSQLitClient(): Promise<SQLitClient> {
  if (client) return client

  // Resolve endpoint
  let endpoint = process.env.SQLIT_BLOCK_PRODUCER_ENDPOINT || getSQLitEndpoint()

  if (!endpoint) {
    const network = process.env.JEJU_NETWORK || getNetworkName()
    if (network && isJejuNetwork(network)) {
      try {
        endpoint = getSQLitUrl(network)
      } catch {
        // Config not available
      }
    }
  }

  if (!endpoint) {
    endpoint = 'http://localhost:4661'
  }

  const privateKey = process.env.SQLIT_PRIVATE_KEY
  client = getSQLit({
    blockProducerEndpoint: endpoint,
    databaseId: SQLIT_DATABASE_ID,
    privateKey: isHexPrivateKey(privateKey) ? privateKey : undefined,
    timeout: parseInt(process.env.SQLIT_TIMEOUT ?? '30000', 10),
    debug: process.env.SQLIT_DEBUG === 'true',
  })

  return client
}

export type { SQLitClient }

// ============================================================================
// Query Builders
// ============================================================================

export interface TransactionContext {
  query<T>(sql: string, params?: QueryParam[]): Promise<T[]>
  queryOne<T>(sql: string, params?: QueryParam[]): Promise<T | null>
  exec(sql: string, params?: QueryParam[]): Promise<ExecResult>
}

export interface QueryTransaction extends TransactionContext {
  $queryRaw<T>(
    strings: TemplateStringsArray,
    ...values: QueryParam[]
  ): Promise<T[]>
  $execRaw(
    strings: TemplateStringsArray,
    ...values: QueryParam[]
  ): Promise<ExecResult>
  transaction<T>(fn: (tx: QueryTransaction) => Promise<T>): Promise<T>
}

export function createQueryTransaction(
  ctx: TransactionContext,
): QueryTransaction {
  return {
    ...ctx,

    async $queryRaw<T>(
      strings: TemplateStringsArray,
      ...values: QueryParam[]
    ): Promise<T[]> {
      const sql = strings.reduce(
        (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
        '',
      )
      return ctx.query<T>(sql, values)
    },

    async $execRaw(
      strings: TemplateStringsArray,
      ...values: QueryParam[]
    ): Promise<ExecResult> {
      const sql = strings.reduce(
        (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
        '',
      )
      return ctx.exec(sql, values)
    },

    async transaction<T>(fn: (tx: QueryTransaction) => Promise<T>): Promise<T> {
      // Nested transactions not supported, just run the function
      return fn(this)
    },
  }
}

// Create db singleton with lazy initialization
class DBProxy {
  private _client: SQLitClient | null = null
  private _databaseId = SQLIT_DATABASE_ID

  private get client(): SQLitClient {
    if (!this._client) {
      throw new Error(
        '[sqlit-client] Database not initialized. Call createSQLitClient() first.',
      )
    }
    return this._client
  }

  async initialize(): Promise<void> {
    this._client = await createSQLitClient()

    // Retry health check with exponential backoff (SQLit may still be starting)
    const maxRetries = 5
    const baseDelayMs = 500

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const healthy = await this._client.isHealthy()
      if (healthy) {
        return
      }

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * 2 ** (attempt - 1)
        console.log(
          `[sqlit-client] SQLit not healthy, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`,
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw new Error('[sqlit-client] SQLit is not healthy after retries')
  }

  async query<T>(sql: string, params: QueryParam[] = []): Promise<T[]> {
    const result = await this.client.query<T>(sql, params, this._databaseId)
    return result.rows
  }

  async exec(sql: string, params: QueryParam[] = []): Promise<ExecResult> {
    return this.client.exec(sql, params, this._databaseId)
  }

  async transaction<T>(fn: (tx: QueryTransaction) => Promise<T>): Promise<T> {
    const conn = await this.client.connect(this._databaseId)
    const tx = await conn.beginTransaction()

    const ctx: TransactionContext = {
      query: async <R>(sql: string, params?: QueryParam[]): Promise<R[]> => {
        const result = await tx.query<R>(sql, params)
        return result.rows
      },
      queryOne: async <R>(
        sql: string,
        params?: QueryParam[],
      ): Promise<R | null> => {
        const result = await tx.query<R>(sql, params)
        return result.rows[0] ?? null
      },
      exec: (sql: string, params?: QueryParam[]) => tx.exec(sql, params),
    }

    const queryTx = createQueryTransaction(ctx)

    try {
      const result = await fn(queryTx)
      await tx.commit()
      return result
    } catch (error) {
      await tx.rollback()
      throw error
    } finally {
      this.client.getPool(this._databaseId).release(conn)
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this._client) return false
    return this._client.isHealthy()
  }

  // Drizzle-compatible query builders
  private getExecutor() {
    return {
      query: <T>(sql: string, params?: QueryParam[]) =>
        this.query<T>(sql, params ?? []),
      queryOne: async <T>(
        sql: string,
        params?: QueryParam[],
      ): Promise<T | null> => {
        const rows = await this.query<T>(sql, params ?? [])
        return rows[0] ?? null
      },
      exec: (sql: string, params?: QueryParam[]) =>
        this.exec(sql, params ?? []),
    }
  }

  select<TFields extends Record<string, unknown> | undefined = undefined>(
    fields?: TFields,
  ) {
    const tx = createDrizzleQueryTransaction(this.getExecutor())
    return tx.select(fields)
  }

  insert(table: object | string): InsertBuilder<Record<string, unknown>> {
    const tx = createDrizzleQueryTransaction(this.getExecutor())
    return tx.insert(table)
  }

  update(table: object | string): UpdateBuilder<Record<string, unknown>> {
    const tx = createDrizzleQueryTransaction(this.getExecutor())
    return tx.update(table)
  }

  delete(table: object | string): DeleteBuilder<Record<string, unknown>> {
    const tx = createDrizzleQueryTransaction(this.getExecutor())
    return tx.delete(table)
  }

  // Prisma-like repository for tables
  private createTableRepository(tableName: string) {
    return {
      findMany: async <T>(opts?: {
        where?: Record<string, unknown>
        select?: Record<string, boolean>
        take?: number
        orderBy?: Record<string, 'asc' | 'desc'>
      }): Promise<T[]> => {
        let sql = `SELECT * FROM "${tableName}"`
        const params: QueryParam[] = []

        if (opts?.where) {
          const conditions: string[] = []
          let paramIdx = 1
          for (const [key, value] of Object.entries(opts.where)) {
            conditions.push(`"${key}" = $${paramIdx++}`)
            params.push(value as QueryParam)
          }
          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`
          }
        }

        if (opts?.orderBy) {
          const orders: string[] = []
          for (const [key, dir] of Object.entries(opts.orderBy)) {
            orders.push(`"${key}" ${dir.toUpperCase()}`)
          }
          if (orders.length > 0) {
            sql += ` ORDER BY ${orders.join(', ')}`
          }
        }

        if (opts?.take) {
          sql += ` LIMIT ${opts.take}`
        }

        return this.query<T>(sql, params)
      },
      findUnique: async <T>(opts: {
        where: Record<string, unknown>
      }): Promise<T | null> => {
        const conditions: string[] = []
        const params: QueryParam[] = []
        let paramIdx = 1
        for (const [key, value] of Object.entries(opts.where)) {
          conditions.push(`"${key}" = $${paramIdx++}`)
          params.push(value as QueryParam)
        }
        const sql = `SELECT * FROM "${tableName}" WHERE ${conditions.join(' AND ')} LIMIT 1`
        const rows = await this.query<T>(sql, params)
        return rows[0] ?? null
      },
      findFirst: async <T>(opts?: {
        where?: Record<string, unknown>
      }): Promise<T | null> => {
        let sql = `SELECT * FROM "${tableName}"`
        const params: QueryParam[] = []

        if (opts?.where) {
          const conditions: string[] = []
          let paramIdx = 1
          for (const [key, value] of Object.entries(opts.where)) {
            conditions.push(`"${key}" = $${paramIdx++}`)
            params.push(value as QueryParam)
          }
          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`
          }
        }
        sql += ' LIMIT 1'

        const rows = await this.query<T>(sql, params)
        return rows[0] ?? null
      },
      create: async <T>(opts: {
        data: Record<string, unknown>
      }): Promise<T> => {
        const columns = Object.keys(opts.data)
        const params: QueryParam[] = Object.values(opts.data) as QueryParam[]
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
        const sql = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`
        const rows = await this.query<T>(sql, params)
        return rows[0]
      },
      update: async <T>(opts: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }): Promise<T> => {
        const setColumns = Object.keys(opts.data)
        const params: QueryParam[] = []
        let paramIdx = 1

        const setParts = setColumns.map((col) => {
          params.push(opts.data[col] as QueryParam)
          return `"${col}" = $${paramIdx++}`
        })

        const whereParts: string[] = []
        for (const [key, value] of Object.entries(opts.where)) {
          params.push(value as QueryParam)
          whereParts.push(`"${key}" = $${paramIdx++}`)
        }

        const sql = `UPDATE "${tableName}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')} RETURNING *`
        const rows = await this.query<T>(sql, params)
        return rows[0]
      },
      upsert: async <T>(opts: {
        where: Record<string, unknown>
        create: Record<string, unknown>
        update: Record<string, unknown>
      }): Promise<T> => {
        // Try to find existing
        const existing = await this.createTableRepository(
          tableName,
        ).findUnique<T>({ where: opts.where })
        if (existing) {
          return this.createTableRepository(tableName).update<T>({
            where: opts.where,
            data: opts.update,
          })
        }
        return this.createTableRepository(tableName).create<T>({
          data: opts.create,
        })
      },
      count: async (opts?: {
        where?: Record<string, unknown>
      }): Promise<number> => {
        let sql = `SELECT COUNT(*) as count FROM "${tableName}"`
        const params: QueryParam[] = []

        if (opts?.where) {
          const conditions: string[] = []
          let paramIdx = 1
          for (const [key, value] of Object.entries(opts.where)) {
            conditions.push(`"${key}" = $${paramIdx++}`)
            params.push(value as QueryParam)
          }
          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`
          }
        }

        const rows = await this.query<{ count: number }>(sql, params)
        return rows[0]?.count ?? 0
      },
      deleteMany: async (opts?: {
        where?: Record<string, unknown>
      }): Promise<{ count: number }> => {
        let sql = `DELETE FROM "${tableName}"`
        const params: QueryParam[] = []

        if (opts?.where) {
          const conditions: string[] = []
          let paramIdx = 1
          for (const [key, value] of Object.entries(opts.where)) {
            conditions.push(`"${key}" = $${paramIdx++}`)
            params.push(value as QueryParam)
          }
          if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`
          }
        }

        const result = await this.exec(sql, params)
        return { count: result.rowsAffected }
      },
      createMany: async <_T>(opts: {
        data: Record<string, unknown>[]
      }): Promise<{ count: number }> => {
        if (opts.data.length === 0) return { count: 0 }

        const columns = Object.keys(opts.data[0])
        let totalInserted = 0

        // Batch insert rows
        for (const row of opts.data) {
          const params: QueryParam[] = columns.map(
            (col) => row[col] as QueryParam,
          )
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
          const sql = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
          const result = await this.exec(sql, params)
          totalInserted += result.rowsAffected
        }

        return { count: totalInserted }
      },
    }
  }

  // Table repositories (Prisma-like interface)
  get tag() {
    return this.createTableRepository('Tag')
  }
  get user() {
    return this.createTableRepository('User')
  }
  get post() {
    return this.createTableRepository('Post')
  }
  get question() {
    return this.createTableRepository('Question')
  }
  get market() {
    return this.createTableRepository('Market')
  }
  get game() {
    return this.createTableRepository('Game')
  }
  get actorState() {
    return this.createTableRepository('ActorState')
  }
  get organizationState() {
    return this.createTableRepository('OrganizationState')
  }
  get pool() {
    return this.createTableRepository('Pool')
  }
  get position() {
    return this.createTableRepository('Position')
  }
  get stockPrice() {
    return this.createTableRepository('StockPrice')
  }
  get worldEvent() {
    return this.createTableRepository('WorldEvent')
  }
  get worldFact() {
    return this.createTableRepository('WorldFact')
  }
  get trendingTag() {
    return this.createTableRepository('TrendingTag')
  }
  get postTag() {
    return this.createTableRepository('PostTag')
  }
  get notification() {
    return this.createTableRepository('Notification')
  }
  get message() {
    return this.createTableRepository('Message')
  }
  get chat() {
    return this.createTableRepository('Chat')
  }
  get trajectory() {
    return this.createTableRepository('Trajectory')
  }
  get trainingBatch() {
    return this.createTableRepository('TrainingBatch')
  }
  get trainedModel() {
    return this.createTableRepository('TrainedModel')
  }
  get agentRegistry() {
    return this.createTableRepository('AgentRegistry')
  }
  get llmCallLog() {
    return this.createTableRepository('LlmCallLog')
  }
  get rewardJudgment() {
    return this.createTableRepository('RewardJudgment')
  }
  get benchmarkResult() {
    return this.createTableRepository('BenchmarkResult')
  }
}

// Export the DBProxy type for proper typing
export type DBProxyType = DBProxy

export const db = new DBProxy()
