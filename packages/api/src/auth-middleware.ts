/**
 * API Authentication Middleware
 *
 * ALL authentication routes through OAuth3 (Jeju's decentralized auth).
 * NO FALLBACKS - OAuth3 is required.
 *
 * Supports:
 * - OAuth3 user authentication (via tokens/cookies)
 * - Agent session tokens
 * - Wallet-based authentication
 *
 * Architecture:
 * - All functions are framework-agnostic
 * - Works with Elysia, standard Request/Response, or any framework
 * - Core functions use standard web APIs (Request, Response, Headers)
 */

import { getOAuth3Client, type OAuth3Client } from '@babylon/auth'
import { db } from '@babylon/db'
import type { AuthenticatedUser } from '@babylon/shared'
import { AuthenticationError } from '@babylon/shared'
import { verifyAgentSession } from './agent-auth'
import { hasDbUserId } from './utils/type-guards'

// =============================================================================
// Framework-agnostic types
// =============================================================================

/**
 * Token extraction result - framework-agnostic
 */
export interface TokenInfo {
  token: string
  source: 'cookie' | 'bearer'
}

/**
 * Request headers interface - framework-agnostic
 * Works with Elysia headers, standard Headers, or any compatible interface
 */
export interface RequestHeaders {
  get(name: string): string | null
}

/**
 * Cookie reader interface - framework-agnostic
 */
export interface CookieReader {
  get(name: string): { value: string } | undefined
}

/**
 * Elysia context interface for type-safe middleware
 */
export interface ElysiaContext {
  request: Request
  headers: Record<string, string | undefined>
  cookie: Record<string, { value: string } | undefined>
  set: {
    status?: number
    headers?: Record<string, string>
  }
}

// =============================================================================
// Core logic (framework-agnostic)
// =============================================================================

// Lazy initialization of OAuth3 client
let oauth3Client: OAuth3Client | null = null

export function getAuthClient(): OAuth3Client {
  if (!oauth3Client) {
    oauth3Client = getOAuth3Client()
  }
  return oauth3Client
}

/**
 * Extract authentication token from headers and cookies
 * Framework-agnostic - works with any headers/cookies interface
 */
export function extractToken(
  headers: RequestHeaders,
  cookies?: CookieReader,
): TokenInfo | null {
  // Check for OAuth3 token in cookie first (if cookies provided)
  if (cookies) {
    const oauth3Token = cookies.get('oauth3-token')?.value
    if (oauth3Token) {
      return { token: oauth3Token, source: 'cookie' }
    }
  }

  // Check Authorization Bearer header
  const authHeader = headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return { token: authHeader.substring(7), source: 'bearer' }
  }

  return null
}

/**
 * Extract token from Elysia context
 */
export function extractTokenFromContext(ctx: ElysiaContext): TokenInfo | null {
  // Check for OAuth3 token in cookie first
  const cookieToken = ctx.cookie['oauth3-token']?.value
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' }
  }

  // Check Authorization Bearer header
  const authHeader = ctx.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return { token: authHeader.substring(7), source: 'bearer' }
  }

  return null
}

/**
 * Validate a token and return authenticated user (core logic)
 * Framework-agnostic - pure function that takes a token string
 */
export async function validateToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  // Try agent session authentication first (faster)
  const agentSession = await verifyAgentSession(token)
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      oauth3Id: agentSession.agentId,
      isAgent: true,
    }
  }

  // Try OAuth3 authentication
  const auth = getAuthClient()
  const session = await auth.validateSession(token).catch(() => null)

  if (!session) {
    return null
  }

  // Get user from database using OAuth3 identity
  const identityId = session.identityId

  let dbUser = await db.user.findFirst({
    where: { oauth3Id: identityId },
  })

  // If not found by oauth3Id, try by wallet address from session
  if (!dbUser && session.smartAccount) {
    dbUser = await db.user.findFirst({
      where: { walletAddress: session.smartAccount },
    })

    // Link OAuth3 identity to existing user
    if (dbUser) {
      await db.user.update({
        where: { id: String(dbUser.id) },
        data: { oauth3Id: identityId },
      })
    }
  }

  return {
    userId: dbUser ? String(dbUser.id) : identityId,
    dbUserId: dbUser ? String(dbUser.id) : undefined,
    oauth3Id: identityId,
    walletAddress: dbUser?.walletAddress
      ? String(dbUser.walletAddress)
      : session.smartAccount,
    email: undefined,
    isAgent: false,
  }
}

/**
 * Authenticate from token with detailed error handling (core logic)
 * Framework-agnostic - throws AuthenticationError on failure
 */
export async function authenticateFromToken(
  token: string,
): Promise<AuthenticatedUser> {
  // Try agent session authentication first (faster)
  const agentSession = await verifyAgentSession(token)
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      oauth3Id: agentSession.agentId,
      isAgent: true,
    }
  }

  // Try OAuth3 authentication
  const auth = getAuthClient()

  let session: Awaited<ReturnType<typeof auth.validateSession>> | undefined
  try {
    session = await auth.validateSession(token)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('expired')) {
      throw new AuthenticationError(
        'Authentication token has expired. Please refresh your session.',
        'EXPIRED_TOKEN',
      )
    }
    if (message.includes('invalid')) {
      throw new AuthenticationError(message, 'INVALID_TOKEN')
    }
    throw new AuthenticationError(message, 'INVALID_CREDENTIALS')
  }

  if (!session) {
    throw new AuthenticationError('Invalid session token', 'INVALID_TOKEN')
  }

  // Get user from database using OAuth3 identity
  const identityId = session.identityId

  let dbUser = await db.user.findFirst({
    where: { oauth3Id: identityId },
  })

  // If not found by oauth3Id, try by wallet address from session
  if (!dbUser && session.smartAccount) {
    dbUser = await db.user.findFirst({
      where: { walletAddress: session.smartAccount },
    })

    // Link OAuth3 identity to existing user
    if (dbUser) {
      await db.user.update({
        where: { id: String(dbUser.id) },
        data: { oauth3Id: identityId },
      })
    }
  }

  return {
    userId: dbUser ? String(dbUser.id) : identityId,
    dbUserId: dbUser ? String(dbUser.id) : undefined,
    oauth3Id: identityId,
    walletAddress: dbUser?.walletAddress
      ? String(dbUser.walletAddress)
      : session.smartAccount,
    email: undefined,
    isAgent: false,
  }
}

// =============================================================================
// Standard Request/Response adapters
// =============================================================================

/**
 * Authenticate from standard Request object
 *
 * Authentication is performed via OAuth3 (decentralized auth).
 * Tokens can be provided via:
 * 1. oauth3-token cookie (preferred - auto-refreshed)
 * 2. Authorization Bearer header (for agents/external clients)
 */
export async function authenticate(
  request: Request,
): Promise<AuthenticatedUser> {
  const tokenInfo = extractToken(
    request.headers,
    createCookieReader(request.headers.get('cookie')),
  )

  if (!tokenInfo) {
    throw new AuthenticationError(
      'Missing or invalid authorization header or cookie',
      'NO_TOKEN',
    )
  }

  return authenticateFromToken(tokenInfo.token)
}

/**
 * Authenticate from Elysia context
 */
export async function authenticateFromContext(
  ctx: ElysiaContext,
): Promise<AuthenticatedUser> {
  const tokenInfo = extractTokenFromContext(ctx)

  if (!tokenInfo) {
    throw new AuthenticationError(
      'Missing or invalid authorization header or cookie',
      'NO_TOKEN',
    )
  }

  return authenticateFromToken(tokenInfo.token)
}

// =============================================================================
// Core logic helpers
// =============================================================================

/**
 * Create a cookie reader from a cookie header string
 */
function createCookieReader(cookieHeader: string | null): CookieReader {
  const cookies = new Map<string, string>()
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [key, value] = part.trim().split('=')
      if (key && value) {
        cookies.set(key, value)
      }
    }
  }
  return {
    get(name: string) {
      const value = cookies.get(name)
      return value ? { value } : undefined
    },
  }
}

/**
 * Require that an authenticated user has a database record (core logic)
 */
export function requireDbUser(
  authUser: AuthenticatedUser,
): AuthenticatedUser & { dbUserId: string } {
  if (!hasDbUserId(authUser)) {
    throw new AuthenticationError(
      'User profile not found. Please complete onboarding first.',
      'INVALID_CREDENTIALS',
    )
  }
  return authUser
}

// =============================================================================
// Standard adapters
// =============================================================================

/**
 * Authenticate and require that the user has a database record
 */
export async function authenticateWithDbUser(
  request: Request,
): Promise<AuthenticatedUser & { dbUserId: string }> {
  const authUser = await authenticate(request)
  return requireDbUser(authUser)
}

/**
 * Authenticate and require that the user has a database record (Elysia context)
 */
export async function authenticateWithDbUserFromContext(
  ctx: ElysiaContext,
): Promise<AuthenticatedUser & { dbUserId: string }> {
  const authUser = await authenticateFromContext(ctx)
  return requireDbUser(authUser)
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const tokenInfo = extractToken(
    request.headers,
    createCookieReader(request.headers.get('cookie')),
  )
  if (!tokenInfo) {
    return null
  }
  return validateToken(tokenInfo.token)
}

/**
 * Optional authentication from Elysia context
 */
export async function optionalAuthFromContext(
  ctx: ElysiaContext,
): Promise<AuthenticatedUser | null> {
  const tokenInfo = extractTokenFromContext(ctx)
  if (!tokenInfo) {
    return null
  }
  return validateToken(tokenInfo.token)
}

/**
 * Optional authentication from headers - framework-agnostic
 * Works with Elysia headers, standard Headers, or any compatible interface
 */
export async function optionalAuthFromHeaders(
  headers: RequestHeaders,
): Promise<AuthenticatedUser | null> {
  const tokenInfo = extractToken(headers)
  if (!tokenInfo) {
    return null
  }
  return validateToken(tokenInfo.token)
}

/**
 * Standard auth error response helper
 */
export function authErrorResponse(message = 'Unauthorized'): Response {
  return Response.json({ error: message }, { status: 401 })
}

/**
 * Authenticate user from request (convenience wrapper)
 */
export async function authenticateUser(req: Request) {
  const authUser = await authenticate(req)
  return {
    id: authUser.userId,
    ...authUser,
  }
}

// =============================================================================
// Elysia-compatible exports (core functions)
// =============================================================================

export {
  extractToken as extractTokenCore,
  validateToken as validateTokenCore,
  authenticateFromToken as authenticateFromTokenCore,
  requireDbUser as requireDbUserCore,
  optionalAuthFromHeaders as optionalAuthCore,
}
