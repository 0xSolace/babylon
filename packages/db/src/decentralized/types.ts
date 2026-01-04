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
  SQLitConfig,
  SQLitConnection,
  SQLitConnectionPool,
  SQLitDataType,
  SQLitEvent,
  SQLitTransaction,
  WhereInput,
} from '@jejunetwork/db'

// Babylon-specific types for adapter layer
export type SQLPrimitive = string | number | boolean | null | Date | bigint
export type SQLValue =
  | SQLPrimitive
  | Uint8Array
  | SQLPrimitive[]
  | Record<string, SQLPrimitive>

export interface SQLitHealthStatus {
  healthy: boolean
  blockHeight: number
  nodeCount: number
  latencyMs: number
}

export interface SQLitColumn {
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

export interface SQLitIndex {
  name: string
  columns: string[]
  unique?: boolean
}

export interface SQLitTableSchema {
  name: string
  columns: SQLitColumn[]
  primaryKey: string[]
  uniqueConstraints?: Array<{ name: string; columns: string[] }>
  indexes?: SQLitIndex[]
}
