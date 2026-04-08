/**
 * `@babylon/db/engine-storage` — process-wide DB + RLS + schema (same as `runtime.ts`).
 *
 * Bun's `mock.module` validates named imports against **this file's** export surface; `export *`
 * through `./runtime` / `./db` is not enough, so DB values are re-bound as `export const`.
 */
import * as Db from './db';
import * as tablesNs from './tables';

export { DatabaseService, getDbInstance } from './database-service';

export const asUser = Db.asUser;
export const asSystem = Db.asSystem;
export const asPublic = Db.asPublic;
export const checkDatabaseHealth = Db.checkDatabaseHealth;
export const closeDatabase = Db.closeDatabase;
export const db = Db.db;
export const dbRead = Db.dbRead;
export const dbWrite = Db.dbWrite;
export const executeRaw = Db.executeRaw;
export const exportJsonState = Db.exportJsonState;
export const getJsonState = Db.getJsonState;
export const getJsonStoragePath = Db.getJsonStoragePath;
export const getRawDrizzle = Db.getRawDrizzle;
export const getReadReplicaDbVersion = Db.getReadReplicaDbVersion;
export const getStorageMode = Db.getStorageMode;
export const initializeJsonMode = Db.initializeJsonMode;
export const initializeMemoryMode = Db.initializeMemoryMode;
export const isReadReplicaAvailable = Db.isReadReplicaAvailable;
export const isSimulationMode = Db.isSimulationMode;
export const loadJsonSnapshot = Db.loadJsonSnapshot;
export const resetToPostgresMode = Db.resetToPostgresMode;
export const saveJsonSnapshot = Db.saveJsonSnapshot;
export const withTransaction = Db.withTransaction;

export const tables = tablesNs;

export type Database = Db.Database;
export type StorageMode = Db.StorageMode;
export type Transaction = Db.Transaction;
export type UserIdOrUser = Db.UserIdOrUser;

export * from './tables';
