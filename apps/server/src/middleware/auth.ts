import { type JWTPayloadSpec, jwt } from '@elysiajs/jwt'
import { Elysia, t } from 'elysia'
import { isHexString } from '../utils'

/**
 * JWT payload type for Babylon auth tokens
 */
interface BabylonJWTClaims {
  sub?: string
  oauth3Id?: string
  dbUserId?: string
  walletAddress?: string
  isAdmin?: boolean
}

/**
 * JWT configuration with schema for proper typing
 */
const createJwtMiddleware = () =>
  jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    exp: '7d',
    schema: t.Object({
      sub: t.Optional(t.String()),
      oauth3Id: t.Optional(t.String()),
      dbUserId: t.Optional(t.String()),
      walletAddress: t.Optional(t.String()),
      isAdmin: t.Optional(t.Boolean()),
    }),
  })

export const jwtMiddleware = createJwtMiddleware()

/**
 * Authenticated user type for the server
 */
export interface ServerAuthUser {
  userId: string
  oauth3Id?: string
  dbUserId?: string
  walletAddress?: `0x${string}`
  isAdmin: boolean
}

/**
 * Export the auth state type for use in routes
 */
// biome-ignore lint/correctness/noUnusedVariables: Public API type for route handlers
type AuthState = {
  user: ServerAuthUser | null
  isAuthenticated: boolean
}

/**
 * Auth context derived by authMiddleware - includes index signature for Elysia compatibility
 */
export type DerivedAuthContext = {
  user: ServerAuthUser | null
  isAuthenticated: boolean
  [key: string]: unknown
}

/**
 * Auth context type for route handlers
 */
export interface AuthContext {
  user: ServerAuthUser | null
  isAuthenticated: boolean
}

/**
 * Helper to get auth context from handler params.
 * Accepts any object (Elysia context) that may have user and isAuthenticated properties.
 */
export function getAuthContext(ctx: Record<string, unknown>): AuthContext {
  const user = ctx.user as ServerAuthUser | null | undefined
  const isAuthenticated = ctx.isAuthenticated as boolean | undefined
  return {
    user: user ?? null,
    isAuthenticated: isAuthenticated ?? false,
  }
}

/**
 * Auth middleware that validates JWT tokens and provides user context
 * Routes using this middleware should use getAuthContext() to access user/isAuthenticated
 */
const createAuthMiddleware = () =>
  new Elysia({ name: 'auth-middleware' })
    .use(jwtMiddleware)
    .derive(async ({ jwt, headers }): Promise<DerivedAuthContext> => {
      const authorization = headers.authorization

      if (!authorization || !authorization.startsWith('Bearer ')) {
        return { user: null, isAuthenticated: false }
      }

      const token = authorization.slice(7)
      const verifyResult = await jwt.verify(token)

      // jwt.verify returns false if verification fails, or the payload if successful
      if (verifyResult === false) {
        return { user: null, isAuthenticated: false }
      }

      // Type the payload - verifyResult is the decoded JWT claims
      const payload = verifyResult as BabylonJWTClaims & JWTPayloadSpec

      const walletAddr = payload.walletAddress
      const user: ServerAuthUser = {
        userId: typeof payload.sub === 'string' ? payload.sub : '',
        oauth3Id:
          typeof payload.oauth3Id === 'string' ? payload.oauth3Id : undefined,
        dbUserId:
          typeof payload.dbUserId === 'string' ? payload.dbUserId : undefined,
        walletAddress:
          typeof walletAddr === 'string' && isHexString(walletAddr)
            ? walletAddr
            : undefined,
        isAdmin: payload.isAdmin === true,
      }

      return { user, isAuthenticated: true }
    })

export const authMiddleware = createAuthMiddleware()

/**
 * Guard that requires authentication - throws 401 if not authenticated
 */
const createRequireAuth = () =>
  new Elysia({ name: 'require-auth' })
    .use(authMiddleware)
    .onBeforeHandle((ctx) => {
      const { user, isAuthenticated } = getAuthContext(ctx)
      if (!isAuthenticated || !user) {
        ctx.set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }
    })

export const requireAuth = createRequireAuth()

/**
 * Guard that requires admin privileges
 */
const createRequireAdmin = () =>
  new Elysia({ name: 'require-admin' })
    .use(requireAuth)
    .onBeforeHandle((ctx) => {
      const { user } = getAuthContext(ctx)
      if (!user || !user.isAdmin) {
        ctx.set.status = 403
        return { error: 'Forbidden', message: 'Admin access required' }
      }
    })

export const requireAdmin = createRequireAdmin()
