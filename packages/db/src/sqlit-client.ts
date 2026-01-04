/**
 * SQLit Client for Babylon
 * 
 * Provides query builder interface for SQLit database operations.
 * Re-exports from decentralized/db.ts and @jejunetwork/db
 */

import type { ExecResult, QueryParam } from '@jejunetwork/db'
import { getSQLit, type SQLitClient } from '@jejunetwork/db'
import { getSQLitEndpoint, getNetworkName } from '@babylon/shared/config'
import { getSQLitUrl } from '@jejunetwork/config'

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
    throw new Error('[sqlit-client] Database not initialized. Call createSQLitClient() first.')
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
  $queryRaw<T>(strings: TemplateStringsArray, ...values: QueryParam[]): Promise<T[]>
  $execRaw(strings: TemplateStringsArray, ...values: QueryParam[]): Promise<ExecResult>
  transaction<T>(fn: (tx: QueryTransaction) => Promise<T>): Promise<T>
}

export function createQueryTransaction(ctx: TransactionContext): QueryTransaction {
  return {
    ...ctx,
    
    async $queryRaw<T>(strings: TemplateStringsArray, ...values: QueryParam[]): Promise<T[]> {
      const sql = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '')
      return ctx.query<T>(sql, values)
    },
    
    async $execRaw(strings: TemplateStringsArray, ...values: QueryParam[]): Promise<ExecResult> {
      const sql = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '')
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
      throw new Error('[sqlit-client] Database not initialized. Call createSQLitClient() first.')
    }
    return this._client
  }

  async initialize(): Promise<void> {
    this._client = await createSQLitClient()
    const healthy = await this._client.isHealthy()
    if (!healthy) {
      throw new Error('[sqlit-client] SQLit is not healthy')
    }
  }

  async query<T>(sql: string, params: QueryParam[] = []): Promise<{ rows: T[] }> {
    return this.client.query<T>(sql, params, this._databaseId)
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
      queryOne: async <R>(sql: string, params?: QueryParam[]): Promise<R | null> => {
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
}

export const db = new DBProxy()
