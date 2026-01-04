/**
 * SQLit Repository for Babylon
 *
 * Provides typed table access pattern for SQLit database.
 * Re-exports from decentralized/db.ts
 */

export {
  DB,
  getDB,
  initializeDB,
  resetDB,
} from './decentralized/db'

export type {
  DeleteOptions,
  InsertOptions,
  OrderBy,
  SelectOptions,
  TransactionContext,
  UpdateOptions,
  WhereCondition,
} from './decentralized/db'

// SQLitTableRepository - a typed wrapper for table operations
import type { QueryParam, ExecResult } from '@jejunetwork/db'
import { getDB, type DB } from './decentralized/db'
import { toQueryParam } from './type-guards'

export class SQLitTableRepository<T extends Record<string, unknown>> {
  private db: DB
  private tableName: string

  constructor(tableName: string) {
    this.db = getDB()
    this.tableName = tableName
  }

  async findMany(options?: {
    where?: Partial<T>
    orderBy?: { column: keyof T; direction: 'asc' | 'desc' } | Array<{ column: keyof T; direction: 'asc' | 'desc' }>
    limit?: number
    offset?: number
  }): Promise<T[]> {
    return this.db.select<T>(this.tableName, {
      where: options?.where as Record<string, unknown>,
      orderBy: options?.orderBy as { column: string; direction: 'asc' | 'desc' } | Array<{ column: string; direction: 'asc' | 'desc' }>,
      limit: options?.limit,
      offset: options?.offset,
    })
  }

  async findFirst(options?: {
    where?: Partial<T>
    orderBy?: { column: keyof T; direction: 'asc' | 'desc' }
  }): Promise<T | null> {
    return this.db.selectOne<T>(this.tableName, {
      where: options?.where as Record<string, unknown>,
      orderBy: options?.orderBy as { column: string; direction: 'asc' | 'desc' },
    })
  }

  async findUnique(options: { where: Partial<T> }): Promise<T | null> {
    return this.db.selectOne<T>(this.tableName, {
      where: options.where as Record<string, unknown>,
    })
  }

  async create(data: Partial<T>): Promise<T | null> {
    return this.db.insert<T>(this.tableName, data as Record<string, unknown>, {
      returning: ['*'],
    })
  }

  async createMany(data: Array<Partial<T>>): Promise<number> {
    let count = 0
    for (const item of data) {
      await this.db.insert(this.tableName, item as Record<string, unknown>)
      count++
    }
    return count
  }

  async update(options: { where: Partial<T>; data: Partial<T> }): Promise<T | null> {
    return this.db.update<T>(this.tableName, options.data as Record<string, unknown>, {
      where: options.where as Record<string, unknown>,
      returning: ['*'],
    })
  }

  async updateMany(options: { where: Partial<T>; data: Partial<T> }): Promise<number> {
    const result = await this.db.update(this.tableName, options.data as Record<string, unknown>, {
      where: options.where as Record<string, unknown>,
    })
    return result ? 1 : 0
  }

  async delete(options: { where: Partial<T> }): Promise<number> {
    return this.db.delete(this.tableName, {
      where: options.where as Record<string, unknown>,
    })
  }

  async count(where?: Partial<T>): Promise<number> {
    return this.db.count(this.tableName, where as Record<string, unknown>)
  }
}
