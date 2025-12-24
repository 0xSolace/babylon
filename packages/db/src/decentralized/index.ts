/**
 * Decentralized Database Module
 *
 * Provides integration with Jeju's CovenantSQL for decentralized data persistence.
 */

// DB utilities from @jejunetwork/db
export {
  buildOrderByClause,
  buildWhereClause,
  CovenantSQLClient,
  CQLClient,
  getCQL,
  type OrderByInput,
  resetCQL,
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
} from '../cql-client'
// Schema definitions
export {
  BABYLON_SCHEMAS,
  CQL_SCHEMA,
  createCQLTables,
  generateAllDDL,
  getSchemaByName,
} from './cql-schema'
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

// Types
export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  CQLColumn,
  CQLConfig,
  CQLConnection,
  CQLConnectionPool,
  CQLHealthStatus,
  CQLIndex,
  CQLTableSchema,
  CQLTransaction,
  CreateRentalRequest,
  DatabaseConfig,
  DatabaseInfo,
  DatabaseStatus,
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
