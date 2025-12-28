/**
 * Message Storage utilities
 */

import { getEQLite } from '@jejunetwork/db'

export interface EQLiteConfig {
  blockProducerEndpoint?: string
  databaseId?: string
  privateKey?: string
}

export interface QueryResult<T> {
  rows: T[]
}

export class MessageStorage {
  private client = getEQLite()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }

  async exec(sql: string, params?: (string | number | null)[]): Promise<void> {
    await this.client.exec(sql, params)
  }

  async query<T>(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<QueryResult<T>> {
    const result = await this.client.query<T>(sql, params)
    return result ?? { rows: [] }
  }
}

let storage: MessageStorage | null = null

export function createStorage(_config?: EQLiteConfig): MessageStorage {
  if (!storage) storage = new MessageStorage()
  return storage
}

export function getStorage(): MessageStorage {
  if (!storage) storage = new MessageStorage()
  return storage
}
