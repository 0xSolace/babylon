/**
 * Wallet Auth Middleware
 *
 * Elysia-compatible middleware for wallet-signed session tokens.
 * Permissionless - no shared secrets needed.
 */

import type { Address } from 'viem'
import { type VerifyOptions, verifyFromRequest } from './verify-token'

/** DID type for wallet-based identity */
export type WalletDID = `did:jeju:${string}`

export interface WalletAuthClaims {
  sub: WalletDID
  iss: string
  aud: string
  iat: number
  exp: number
  walletAddress?: Address
  linkedTypes: string[]
}

export interface WalletAuthMiddlewareConfig extends VerifyOptions {
  /** Whether authentication is required (vs optional) */
  required?: boolean
  /** Callback when auth fails */
  onError?: (error: string) => Response
  /** Callback when auth succeeds */
  onSuccess?: (claims: WalletAuthClaims) => void
}

export interface WalletAuthenticatedRequest {
  userId: WalletDID
  walletAddress?: Address
  claims: WalletAuthClaims
}

const DEFAULT_CONFIG: WalletAuthMiddlewareConfig = {
  required: true,
  checkExpiration: true,
}

/**
 * Create wallet auth middleware
 *
 * @example
 * ```typescript
 * import { createWalletAuthMiddleware } from '@babylon/api';
 *
 * const auth = createWalletAuthMiddleware({ required: true });
 *
 * export async function GET(request: Request) {
 *   const authResult = await auth(request);
 *   if (authResult instanceof Response) {
 *     return authResult; // Auth failed
 *   }
 *
 *   const { userId, walletAddress } = authResult;
 *   // ... handle authenticated request
 * }
 * ```
 */
export function createWalletAuthMiddleware(
  config: WalletAuthMiddlewareConfig = {},
) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  return async (
    request: Request,
  ): Promise<WalletAuthenticatedRequest | Response> => {
    const result = await verifyFromRequest(request.headers, cfg)

    if (!result.valid) {
      if (!cfg.required) {
        // Optional auth - return empty auth
        return {
          userId: '' as WalletDID,
          claims: {
            sub: '' as WalletDID,
            iss: '',
            aud: '',
            iat: 0,
            exp: 0,
            linkedTypes: [],
          },
        }
      }

      if (cfg.onError) {
        return cfg.onError(result.error ?? 'Authentication failed')
      }

      return new Response(
        JSON.stringify({ error: result.error ?? 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Map SessionClaims to WalletAuthClaims
    const sessionClaims = result.claims
    if (!sessionClaims) {
      throw new Error('Session claims not found')
    }
    const claims: WalletAuthClaims = {
      sub: sessionClaims.did as WalletDID,
      iss: 'jeju-mpc',
      aud: 'babylon',
      iat: sessionClaims.iat,
      exp: sessionClaims.exp,
      walletAddress: sessionClaims.address,
      linkedTypes: sessionClaims.linkedTypes,
    }

    if (cfg.onSuccess) {
      cfg.onSuccess(claims)
    }

    return {
      userId: claims.sub,
      walletAddress: claims.walletAddress,
      claims,
    }
  }
}

/**
 * Helper to require wallet authentication
 */
export function requireWalletAuth(
  config: Omit<WalletAuthMiddlewareConfig, 'required'> = {},
) {
  return createWalletAuthMiddleware({ ...config, required: true })
}

/**
 * Helper for optional wallet authentication
 */
export function optionalWalletAuth(
  config: Omit<WalletAuthMiddlewareConfig, 'required'> = {},
) {
  return createWalletAuthMiddleware({ ...config, required: false })
}

/**
 * Check if result is an authenticated request
 */
export function isWalletAuthenticated(
  result: WalletAuthenticatedRequest | Response,
): result is WalletAuthenticatedRequest {
  return 'userId' in result && 'claims' in result
}
