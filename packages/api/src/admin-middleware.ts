/**
 * Admin Authentication Middleware
 *
 * @description Middleware for verifying admin privileges. Authenticates the user
 * and checks if they have admin access. In development mode, supports dev admin
 * token authentication for easier testing. In production, requires full OAuth3
 * authentication and database admin flag verification.
 *
 * Architecture:
 * - All functions are framework-agnostic
 * - Works with Elysia, standard Request/Response, or any framework
 * - Core functions use standard web APIs
 *
 * @security
 * - NEVER bypasses authentication based on localhost/host header
 * - Dev mode requires explicit dev admin token
 * - Production requires OAuth3 auth + database admin flag
 */

import { db, eq, users } from '@babylon/db'
import {
  type AuthenticatedUser,
  AuthorizationError,
  logger,
} from '@babylon/shared'
import { first } from '@jejunetwork/shared'
import type { ElysiaContext, RequestHeaders } from './auth-middleware'
import {
  authenticate,
  authenticateFromContext,
  authenticateFromToken,
} from './auth-middleware'
import { getDevAdminUser, isValidDevAdminToken } from './dev-credentials'

const isDevelopment = process.env.NODE_ENV !== 'production'

// =============================================================================
// Core logic (framework-agnostic)
// =============================================================================

/**
 * Admin user info from database
 */
export interface AdminUserInfo {
  isAdmin: boolean
  isBanned: boolean
  username: string | null
  displayName: string | null
}

/**
 * Check if a user ID has admin privileges (framework-agnostic)
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = result[0]
  if (!user) return false
  return user.isAdmin && !user.isBanned
}

/**
 * Get admin user info from database (framework-agnostic)
 */
export async function getAdminUserInfo(
  userId: string,
): Promise<AdminUserInfo | null> {
  const result = await db
    .select({
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return first(result) as AdminUserInfo | null
}

/**
 * Verify admin privileges for an authenticated user (framework-agnostic)
 * Throws AuthorizationError if user is not an admin
 */
export async function verifyAdminPrivileges(
  user: AuthenticatedUser,
): Promise<AdminUserInfo> {
  const dbUser = await getAdminUserInfo(user.userId)

  if (!dbUser) {
    logger.warn(
      'Admin check failed: User not found in database',
      { userId: user.userId },
      'verifyAdminPrivileges',
    )
    throw new AuthorizationError('User not found', 'admin', 'access')
  }

  if (dbUser.isBanned) {
    logger.warn(
      'Admin check failed: User is banned',
      { userId: user.userId },
      'verifyAdminPrivileges',
    )
    throw new AuthorizationError('User is banned', 'admin', 'access')
  }

  if (!dbUser.isAdmin) {
    logger.warn(
      'Admin check failed: User is not an admin',
      {
        userId: user.userId,
        username: dbUser.username,
      },
      'verifyAdminPrivileges',
    )
    throw new AuthorizationError('Admin access required', 'admin', 'access')
  }

  logger.info(
    'Admin access granted',
    {
      userId: user.userId,
      username: dbUser.username,
    },
    'verifyAdminPrivileges',
  )

  return dbUser
}

/**
 * Check for dev admin token in headers (framework-agnostic)
 * Returns dev admin user if valid token found in development mode, null otherwise
 */
export function checkDevAdminToken(
  headers: RequestHeaders,
): AuthenticatedUser | null {
  if (!isDevelopment) {
    return null
  }

  const devAdminToken = headers.get('x-dev-admin-token')
  if (devAdminToken && isValidDevAdminToken(devAdminToken)) {
    const devUser = getDevAdminUser()
    if (devUser) {
      logger.info(
        'Admin access granted via dev token',
        { userId: devUser.userId },
        'checkDevAdminToken',
      )
      return {
        userId: devUser.userId,
        dbUserId: devUser.dbUserId,
        walletAddress: devUser.walletAddress,
      }
    }
  }

  return null
}

/**
 * Check for dev admin token from Elysia context
 */
export function checkDevAdminTokenFromContext(
  ctx: ElysiaContext,
): AuthenticatedUser | null {
  if (!isDevelopment) {
    return null
  }

  const devAdminToken = ctx.headers['x-dev-admin-token']
  if (devAdminToken && isValidDevAdminToken(devAdminToken)) {
    const devUser = getDevAdminUser()
    if (devUser) {
      logger.info(
        'Admin access granted via dev token',
        { userId: devUser.userId },
        'checkDevAdminToken',
      )
      return {
        userId: devUser.userId,
        dbUserId: devUser.dbUserId,
        walletAddress: devUser.walletAddress,
      }
    }
  }

  return null
}

/**
 * Require admin from token (framework-agnostic core function)
 * First checks dev admin token, then authenticates and verifies admin privileges
 */
export async function requireAdminFromToken(
  token: string,
  headers: RequestHeaders,
): Promise<AuthenticatedUser> {
  // Check for dev admin token first
  const devAdmin = checkDevAdminToken(headers)
  if (devAdmin) {
    return devAdmin
  }

  // Authenticate and verify admin
  const user = await authenticateFromToken(token)
  await verifyAdminPrivileges(user)
  return user
}

// =============================================================================
// Standard Request/Response adapters
// =============================================================================

/**
 * Authenticate request and verify admin privileges
 *
 * In development mode:
 * - Accepts x-dev-admin-token header with valid dev token
 * - Falls back to standard OAuth3 auth + admin check
 *
 * In production:
 * - Requires valid OAuth3 authentication
 * - Requires isAdmin flag in database
 */
export async function requireAdmin(
  request: Request,
): Promise<AuthenticatedUser> {
  // Check for dev admin token first
  const devAdmin = checkDevAdminToken(request.headers)
  if (devAdmin) {
    return devAdmin
  }

  // Standard authentication flow
  const user = await authenticate(request)

  // Verify admin privileges
  await verifyAdminPrivileges(user)

  return user
}

/**
 * Authenticate request and verify admin privileges (Elysia context)
 */
export async function requireAdminFromContext(
  ctx: ElysiaContext,
): Promise<AuthenticatedUser> {
  // Check for dev admin token first
  const devAdmin = checkDevAdminTokenFromContext(ctx)
  if (devAdmin) {
    return devAdmin
  }

  // Standard authentication flow
  const user = await authenticateFromContext(ctx)

  // Verify admin privileges
  await verifyAdminPrivileges(user)

  return user
}

// =============================================================================
// Elysia-compatible exports (core functions)
// =============================================================================

export {
  isUserAdmin as isUserAdminCore,
  getAdminUserInfo as getAdminUserInfoCore,
  verifyAdminPrivileges as verifyAdminPrivilegesCore,
  checkDevAdminToken as checkDevAdminTokenCore,
  requireAdminFromToken as requireAdminFromTokenCore,
}
