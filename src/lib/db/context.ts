/**
 * Database Context
 *
 * @deprecated Row Level Security (RLS) is not supported in CQL mode.
 * In decentralized mode, all database access uses the CQL client directly
 * without PostgreSQL session variables.
 *
 * For CQL mode:
 * - Use `import { db } from '@babylon/db'` directly
 * - Application-level authorization should be handled in service layers
 * - Context is managed through request middleware, not database sessions
 *
 * Legacy: Provides database access with Row Level Security (RLS) context
 * for PostgreSQL. These functions set the PostgreSQL session variable
 * `app.current_user_id` which RLS policies use to filter queries automatically.
 */

import { db as cqlDb, initializeDB } from '@babylon/db';
import type { AuthenticatedUser } from '@/lib/api/auth-middleware';
import { logger } from '@/lib/logger';

// Check if we're in CQL mode
const isCQLMode = Boolean(process.env.CQL_BLOCK_PRODUCER_ENDPOINT);

/**
 * Execute a database operation as a user
 *
 * In CQL mode, this is a pass-through - authorization is handled at application level.
 * The authUser parameter is validated but RLS is not applied.
 *
 * @param authUser - The authenticated user (from authenticate())
 * @param operation - The database operation to execute
 *
 * @throws {Error} If authUser is null or undefined
 */
export async function asUser<T>(
  authUser: AuthenticatedUser | null | undefined,
  operation: (db: typeof cqlDb) => Promise<T>
): Promise<T> {
  if (!authUser) {
    throw new Error(
      'asUser() requires an authenticated user. ' +
        'Use asPublic() for unauthenticated access or asSystem() for admin operations.'
    );
  }

  if (isCQLMode) {
    // In CQL mode, ensure DB is initialized and execute directly
    await initializeDB();
    return await operation(cqlDb);
  }

  // Legacy PostgreSQL mode - should not be reached
  logger.warn('PostgreSQL RLS mode is deprecated', {
    operation: 'asUser',
    userId: authUser.userId,
  });
  await initializeDB();
  return await operation(cqlDb);
}

/**
 * Execute a database operation as public (unauthenticated user)
 *
 * In CQL mode, this is a pass-through - public access is handled at application level.
 *
 * @param operation - The database operation to execute without user context
 */
export async function asPublic<T>(
  operation: (db: typeof cqlDb) => Promise<T>
): Promise<T> {
  if (isCQLMode) {
    await initializeDB();
    return await operation(cqlDb);
  }

  // Legacy PostgreSQL mode
  logger.warn('PostgreSQL RLS mode is deprecated', { operation: 'asPublic' });
  await initializeDB();
  return await operation(cqlDb);
}

/**
 * Execute a database operation as system (full access)
 *
 * In CQL mode, this is a pass-through - all operations have full access.
 * Authorization should be handled at the application/service layer.
 *
 * @param operation - The database operation to execute
 * @param operationName - Optional name for logging/auditing purposes
 */
export async function asSystem<T>(
  operation: (db: typeof cqlDb) => Promise<T>,
  operationName?: string
): Promise<T> {
  const startTime = Date.now();

  // Log system operation for security audit
  logger.warn(
    'System operation initiated',
    {
      operation: operationName || 'unknown',
      mode: isCQLMode ? 'cql' : 'postgres',
      timestamp: new Date().toISOString(),
    },
    'Security'
  );

  await initializeDB();
  const result = await operation(cqlDb);

  const duration = Date.now() - startTime;
  logger.info(
    'System operation completed',
    {
      operation: operationName || 'unknown',
      duration: `${duration}ms`,
    },
    'Security'
  );

  return result;
}
