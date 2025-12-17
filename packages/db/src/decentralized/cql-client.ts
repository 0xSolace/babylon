/**
 * CovenantSQL re-exports for Babylon
 */

export type {
  ACLPermission,
  ACLRule,
  BlockProducerInfo,
  CQLConfig,
  CQLConnection,
  CQLConnectionPool,
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
} from '@jeju/db';
export {
  CovenantSQLClient,
  CQLClient,
  getCQL,
  resetCQL,
} from '@jeju/db';

export type SQLValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | Uint8Array;

export interface CQLQueryResult<T> {
  rows: T[];
  rowCount: number;
  duration: number;
}

export interface CQLInsertResult {
  lastInsertId: string;
  rowsAffected: number;
}

export interface CQLHealthStatus {
  healthy: boolean;
  blockHeight: number;
  nodeCount: number;
  latencyMs: number;
}

/**
 * Check if CQL service is available without throwing
 */
export async function isCQLAvailable(): Promise<boolean> {
  const endpoint =
    process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4300';
  try {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Initialize CQL client with health check
 */
export async function initializeCQL() {
  const { getCQL } = await import('@jeju/db');

  const client = getCQL({
    blockProducerEndpoint:
      process.env.CQL_BLOCK_PRODUCER_ENDPOINT ?? 'http://localhost:4300',
    databaseId: process.env.CQL_DATABASE_ID ?? 'babylon-dev',
    privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
    timeout: parseInt(process.env.CQL_TIMEOUT ?? '30000', 10),
    debug: process.env.CQL_DEBUG === 'true',
  });

  const healthy = await client.isHealthy();
  if (!healthy) {
    throw new Error('[CQL] CovenantSQL is not healthy');
  }

  return client;
}

/**
 * Try to initialize CQL, return null if unavailable
 */
export async function tryInitializeCQL() {
  const available = await isCQLAvailable();
  if (!available) {
    return null;
  }
  return initializeCQL();
}

// Babylon naming aliases
export { getCQL as getCQLClient, resetCQL as resetCQLClient } from '@jeju/db';
