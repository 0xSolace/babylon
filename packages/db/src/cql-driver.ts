/**
 * CQL Driver for Babylon Database
 *
 * Provides a Drizzle-compatible interface using CovenantSQL as the backend.
 * This is the PRIMARY database driver - NO PostgreSQL fallback.
 *
 * Uses @jeju/db Drizzle adapter for SQL-to-CQL translation.
 */

import { type CQLClient, getCQL, type QueryParam } from '@jeju/db';
import {
  sql as cqlSql,
  drizzle as createDrizzleCQL,
  type DrizzleCQL,
} from '@jeju/db/adapters';
import { logger } from './logger';

// ============================================================================
// Configuration
// ============================================================================

export interface CQLDriverConfig {
  blockProducerEndpoint: string;
  databaseId: string;
  privateKey?: `0x${string}`;
  timeout?: number;
  debug?: boolean;
}

function getConfig(): CQLDriverConfig {
  const endpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      '[CQL] CQL_BLOCK_PRODUCER_ENDPOINT is required. ' +
        'Babylon requires CovenantSQL - no PostgreSQL fallback.'
    );
  }

  return {
    blockProducerEndpoint: endpoint,
    databaseId: process.env.CQL_DATABASE_ID ?? 'babylon',
    privateKey: process.env.CQL_PRIVATE_KEY as `0x${string}` | undefined,
    timeout: parseInt(process.env.CQL_TIMEOUT ?? '30000', 10),
    debug: process.env.CQL_DEBUG === 'true',
  };
}

// ============================================================================
// Global State
// ============================================================================

const globalForCQL = globalThis as typeof globalThis & {
  cqlClient: CQLClient | undefined;
  drizzleCQL: DrizzleCQL | undefined;
  isInitialized: boolean;
};

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// ============================================================================
// Client Management
// ============================================================================

export async function initializeCQLDriver(): Promise<void> {
  if (isBuildTime) {
    logger.debug('[CQL] Skipping initialization during build');
    return;
  }

  if (globalForCQL.isInitialized) {
    return;
  }

  const config = getConfig();

  logger.info('[CQL] Initializing CovenantSQL driver', {
    endpoint: config.blockProducerEndpoint,
    databaseId: config.databaseId,
  });

  globalForCQL.cqlClient = getCQL({
    blockProducerEndpoint: config.blockProducerEndpoint,
    databaseId: config.databaseId,
    privateKey: config.privateKey,
    timeout: config.timeout,
    debug: config.debug,
  });

  // Verify connection
  const healthy = await globalForCQL.cqlClient.isHealthy();
  if (!healthy) {
    throw new Error(
      `[CQL] CovenantSQL at ${config.blockProducerEndpoint} is not healthy. ` +
        'Ensure Jeju services are running: cd /path/to/jeju && bun run dev'
    );
  }

  // Create Drizzle-compatible interface
  globalForCQL.drizzleCQL = createDrizzleCQL(
    globalForCQL.cqlClient,
    config.databaseId,
    {
      logger: config.debug,
    }
  );

  globalForCQL.isInitialized = true;
  logger.info('[CQL] CovenantSQL driver initialized successfully');
}

export function getCQLClient(): CQLClient {
  if (!globalForCQL.cqlClient) {
    throw new Error(
      '[CQL] CQL client not initialized. Call initializeCQLDriver() first.'
    );
  }
  return globalForCQL.cqlClient;
}

export function getDrizzleCQL(): DrizzleCQL {
  if (!globalForCQL.drizzleCQL) {
    throw new Error(
      '[CQL] Drizzle CQL not initialized. Call initializeCQLDriver() first.'
    );
  }
  return globalForCQL.drizzleCQL;
}

export function isCQLInitialized(): boolean {
  return globalForCQL.isInitialized ?? false;
}

export async function closeCQLConnection(): Promise<void> {
  if (globalForCQL.cqlClient) {
    // CQL client doesn't have a close method, but we reset state
    globalForCQL.cqlClient = undefined;
    globalForCQL.drizzleCQL = undefined;
    globalForCQL.isInitialized = false;
    logger.info('[CQL] Connection closed');
  }
}

// ============================================================================
// SQL Helpers (re-export for compatibility)
// ============================================================================

export { cqlSql as sql };
export type { DrizzleCQL };

// ============================================================================
// Raw Query Interface (for complex queries)
// ============================================================================

export async function rawQuery<T>(
  sqlString: string,
  params: QueryParam[] = []
): Promise<T[]> {
  const client = getCQLClient();
  const config = getConfig();
  const result = await client.query<T>(sqlString, params, config.databaseId);
  return result.rows;
}

export async function rawExec(
  sqlString: string,
  params: QueryParam[] = []
): Promise<{ rowsAffected: number }> {
  const client = getCQLClient();
  const config = getConfig();
  const result = await client.exec(sqlString, params, config.databaseId);
  return { rowsAffected: result.rowsAffected };
}
