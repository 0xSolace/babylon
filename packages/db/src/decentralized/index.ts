/**
 * Decentralized Database Module
 *
 * Provides integration with Jeju's CovenantSQL for decentralized data persistence.
 * Uses the real @jeju/db package.
 */

// Re-export CQL client from Jeju
export {
  CovenantSQLClient,
  CQLClient,
  getCQL,
  resetCQL,
} from '@jeju/db';
export type {
  CQLAdapter,
  CQLTransactionAdapter,
  SelectOptions as CQLAdapterSelectOptions,
} from './cql-adapter';
// Adapter layer for Drizzle-like API
export {
  getCQLAdapter,
  initializeCQLAdapter,
  resetCQLAdapter,
} from './cql-adapter';
// Babylon convenience wrappers
export {
  getCQLClient,
  initializeCQL,
  isCQLAvailable,
  resetCQLClient,
  tryInitializeCQL,
} from './cql-client';
// Schema definitions
export {
  BABYLON_SCHEMAS,
  CQL_SCHEMA,
  createCQLTables,
  generateAllDDL,
  getSchemaByName,
} from './cql-schema';
// Decentralized Database (primary data layer)
export {
  DecentralizedDB,
  type DeleteOptions,
  type DrizzleTransactionContext,
  getDB,
  type InsertOptions,
  initializeDB,
  type OrderBy,
  resetDB,
  type SelectOptions,
  type TransactionContext,
  type UpdateOptions,
  type WhereCondition,
} from './db';
// Drizzle compatibility layer
export {
  createDrizzleTransaction,
  DrizzleTransaction,
  type TransactionExecutor,
} from './drizzle-compat';

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
  CQLInsertResult,
  CQLQueryResult,
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
  SQLValue,
} from './types';
