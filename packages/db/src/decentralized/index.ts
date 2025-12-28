/**
 * Decentralized Database Module
 *
 * Provides integration with Jeju's CovenantSQL for decentralized data persistence.
 */

// DB utilities from @jejunetwork/db
export {
  buildOrderByClause,
  buildWhereClause,
  EQLiteClient,
  getEQLite,
  type OrderByInput,
  resetEQLite,
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
} from '../eqlite-client'
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
  createEQLiteTables,
  EQLITE_SCHEMA,
  generateAllDDL,
  getSchemaByName,
} from './eqlite-schema'

// Types
export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  CreateRentalRequest,
  DatabaseConfig,
  DatabaseInfo,
  DatabaseStatus,
  EQLiteColumn,
  EQLiteConfig,
  EQLiteConnection,
  EQLiteConnectionPool,
  EQLiteHealthStatus,
  EQLiteIndex,
  EQLiteTableSchema,
  EQLiteTransaction,
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
