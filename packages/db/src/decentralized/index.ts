/**
 * Decentralized Database Module
 *
 * Provides integration with Jeju's CovenantSQL for decentralized data persistence.
 */

// DB utilities from @jejunetwork/db
export {
  buildOrderByClause,
  buildWhereClause,
  SQLitClient,
  getSQLit,
  type OrderByInput,
  resetSQLit,
  toQueryParam,
  type WhereClauseResult,
  type WhereInput,
} from '@jejunetwork/db'
// Query builder layer
export {
  createQueryTransaction,
  DeleteBuilder,
  InsertBuilder,
  QueryTransaction,
  SelectBuilder,
  UpdateBuilder,
} from '../sqlit-client'
// Decentralized Database (primary data layer)
export {
  DB,
  type DeleteOptions,
  getDB,
  type InsertOptions,
  initializeDB,
  type OrderBy,
  resetDB,
  type SelectOptions,
  type TransactionContext,
  type UpdateOptions,
  type WhereCondition,
} from './db'
// Typed table references (from drizzle-compat)
export {
  type InferTableRow,
  TABLE_ROW_TYPE,
  type TypedTableRef,
} from './drizzle-compat'
// Schema definitions
export {
  BABYLON_SCHEMAS,
  createSQLitTables,
  SQLIT_SCHEMA,
  generateAllDDL,
  getSchemaByName,
} from './sqlit-schema'

// Types
export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  CreateRentalRequest,
  DatabaseConfig,
  DatabaseInfo,
  DatabaseStatus,
  SQLitColumn,
  SQLitConfig,
  SQLitConnection,
  SQLitConnectionPool,
  SQLitHealthStatus,
  SQLitIndex,
  SQLitTableSchema,
  SQLitTransaction,
  ExecResult,
  GrantRequest,
  Migration,
  MigrationResult,
  QueryParam,
  QueryResult,
  RentalInfo,
  RentalPlan,
  RevokeRequest,
  SQLPrimitive,
} from './types'
