/**
 * Auth Middleware
 *
 * Express/Elysia-compatible middleware for route protection.
 */

import type { Address } from 'viem';
import type { DID, JejuAuthClaims } from '../types/index';
import { type VerifyOptions, verifyFromRequest } from './verify-token';

export interface AuthMiddlewareConfig extends VerifyOptions {
  /** Whether authentication is required (vs optional) */
  required?: boolean;
  /** Callback when auth fails */
  onError?: (error: string) => Response;
  /** Callback when auth succeeds */
  onSuccess?: (claims: JejuAuthClaims) => void;
}

export interface AuthenticatedRequest {
  userId: DID;
  walletAddress?: Address;
  claims: JejuAuthClaims;
}

const DEFAULT_CONFIG: AuthMiddlewareConfig = {
  required: true,
  checkExpiration: true,
};

/**
 * Create auth middleware
 *
 * @example
 * ```typescript
 * // Next.js API route
 * import { createAuthMiddleware } from '@babylon/auth/server';
 *
 * const auth = createAuthMiddleware({ required: true });
 *
 * export async function GET(request: NextRequest) {
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
export function createAuthMiddleware(config: AuthMiddlewareConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (request: Request): Promise<AuthenticatedRequest | Response> => {
    const result = await verifyFromRequest(request.headers, cfg);

    if (!result.valid) {
      if (!cfg.required) {
        // Optional auth - return empty auth
        return {
          userId: '' as DID,
          claims: {
            sub: '' as DID,
            iss: '',
            aud: '',
            iat: 0,
            exp: 0,
            linkedTypes: [],
          },
        };
      }

      if (cfg.onError) {
        return cfg.onError(result.error ?? 'Authentication failed');
      }

      return new Response(
        JSON.stringify({ error: result.error ?? 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Map SessionClaims to JejuAuthClaims
    const sessionClaims = result.claims!;
    const claims: JejuAuthClaims = {
      sub: sessionClaims.did,
      iss: 'jeju-mpc',
      aud: 'babylon',
      iat: sessionClaims.iat,
      exp: sessionClaims.exp,
      walletAddress: sessionClaims.address,
      linkedTypes: sessionClaims.linkedTypes,
    };

    if (cfg.onSuccess) {
      cfg.onSuccess(claims);
    }

    return {
      userId: claims.sub,
      walletAddress: claims.walletAddress,
      claims,
    };
  };
}

/**
 * Helper to require authentication
 */
export function requireAuth(
  config: Omit<AuthMiddlewareConfig, 'required'> = {}
) {
  return createAuthMiddleware({ ...config, required: true });
}

/**
 * Helper for optional authentication
 */
export function optionalAuth(
  config: Omit<AuthMiddlewareConfig, 'required'> = {}
) {
  return createAuthMiddleware({ ...config, required: false });
}

/**
 * Check if result is an authenticated request
 */
export function isAuthenticated(
  result: AuthenticatedRequest | Response
): result is AuthenticatedRequest {
  return 'userId' in result && 'claims' in result;
}
