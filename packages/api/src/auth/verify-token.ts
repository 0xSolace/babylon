/**
 * Token Verification (Permissionless)
 *
 * Verifies wallet-signed session tokens. No shared secret needed.
 */

import { toNull } from '@jejunetwork/shared'
import { type SessionClaims, SessionManager } from './session-manager'

export interface VerifyResult {
  valid: boolean
  claims?: SessionClaims
  error?: string
}

export interface VerifyOptions {
  /** Whether to check token expiration (default: true) */
  checkExpiration?: boolean
}

const sessionManager = new SessionManager()

/**
 * Verify a session token and extract claims
 * Permissionless - uses wallet signature verification
 */
export async function verifyToken(
  token: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  // Check for empty token
  if (!token || token.trim() === '') {
    return {
      valid: false,
      error: 'Token is empty',
    }
  }

  // Check expiration without full verification
  if (options.checkExpiration !== false && sessionManager.isExpired(token)) {
    return {
      valid: false,
      error: 'Token has expired',
    }
  }

  // Verify signature - no secret needed
  const claims = await sessionManager.verifyToken(token)

  return {
    valid: true,
    claims,
  }
}

/** Convert SessionClaims to legacy format for compatibility */
export function toAuthClaims(claims: SessionClaims): {
  sub: string
  walletAddress: `0x${string}`
  linkedTypes: string[]
  iat: number
  exp: number
} {
  return {
    sub: claims.did,
    walletAddress: claims.address,
    linkedTypes: claims.linkedTypes,
    iat: claims.iat,
    exp: claims.exp,
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(header: string | null): string | null {
  if (!header) {
    return null
  }

  if (header.startsWith('Bearer ')) {
    return header.substring(7)
  }

  return null
}

/**
 * Extract token from cookie
 */
export function extractTokenFromCookie(
  cookies: Record<string, string> | undefined,
  cookieName = 'jeju-token',
): string | null {
  if (!cookies) {
    return null
  }

  return toNull(cookies[cookieName])
}

/**
 * Verify token from request headers or cookies
 */
export async function verifyFromRequest(
  headers: Headers,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  // Try Authorization header first
  const authHeader = headers.get('authorization')
  let token = extractTokenFromHeader(authHeader)

  // Fall back to cookie
  if (!token) {
    const cookieHeader = headers.get('cookie')
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...vals] = c.trim().split('=')
          return [key, vals.join('=')]
        }),
      )
      token = extractTokenFromCookie(cookies)
    }
  }

  if (!token) {
    return {
      valid: false,
      error: 'No token found in request',
    }
  }

  return verifyToken(token, options)
}
