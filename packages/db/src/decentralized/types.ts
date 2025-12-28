/**
 * Decentralized Database Types for Babylon
 */

export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  ColumnMeta,
  CreateRentalRequest,
  DatabaseConfig,
  DatabaseInfo,
  DatabaseStatus,
  EQLiteConfig,
  EQLiteConnection,
  EQLiteConnectionPool,
  EQLiteDataType,
  EQLiteEvent,
  EQLiteTransaction,
  ExecResult,
  GrantRequest,
  Migration,
  MigrationResult,
  MinerInfo,
  OrderByInput,
  QueryParam,
  QueryResult,
  RentalInfo,
  RentalPlan,
  RevokeRequest,
  WhereInput,
} from '@jejunetwork/db'

// Babylon-specific types for adapter layer
export type SQLPrimitive = string | number | boolean | null | Date | bigint
export type SQLValue =
  | SQLPrimitive
  | Uint8Array
  | SQLPrimitive[]
  | Record<string, SQLPrimitive>

export interface EQLiteHealthStatus {
  healthy: boolean
  blockHeight: number
  nodeCount: number
  latencyMs: number
}

export interface EQLiteColumn {
  name: string
  type:
    | 'TEXT'
    | 'INTEGER'
    | 'BIGINT'
    | 'BOOLEAN'
    | 'TIMESTAMP'
    | 'DECIMAL'
    | 'DOUBLE'
    | 'JSON'
  nullable: boolean
  primaryKey?: boolean
  default?: string | number | boolean
  unique?: boolean
  precision?: number
  scale?: number
}

export interface EQLiteIndex {
  name: string
  columns: string[]
  unique?: boolean
}

export interface EQLiteTableSchema {
  name: string
  columns: EQLiteColumn[]
  primaryKey: string[]
  uniqueConstraints?: Array<{ name: string; columns: string[] }>
  indexes?: EQLiteIndex[]
}
