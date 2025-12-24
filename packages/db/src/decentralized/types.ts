/**
 * Decentralized Database Types for Babylon
 */

export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  ColumnMeta,
  CQLConfig,
  CQLConnection,
  CQLConnectionPool,
  CQLDataType,
  CQLEvent,
  CQLTransaction,
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
  WhereInput,
} from '@jejunetwork/db'

// Babylon-specific types for adapter layer
export type SQLPrimitive = string | number | boolean | null | Date | bigint
export type SQLValue =
  | SQLPrimitive
  | Uint8Array
  | SQLPrimitive[]
  | Record<string, SQLPrimitive>

export interface CQLHealthStatus {
  healthy: boolean
  blockHeight: number
  nodeCount: number
  latencyMs: number
}

export interface CQLColumn {
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

export interface CQLIndex {
  name: string
  columns: string[]
  unique?: boolean
}

export interface CQLTableSchema {
  name: string
  columns: CQLColumn[]
  primaryKey: string[]
  uniqueConstraints?: Array<{ name: string; columns: string[] }>
  indexes?: CQLIndex[]
}
