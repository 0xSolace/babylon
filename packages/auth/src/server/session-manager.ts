/**
 * Server-Side Session Manager
 *
 * Permissionless session tokens using wallet signatures.
 * No shared secrets - anyone can verify tokens using public key cryptography.
 */

import {
  hasProperty,
  hasStringProperty,
  isHexAddress,
  isObject,
} from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { verifyMessage } from 'viem'
import { isHex } from '../types/guards'
import type { DID } from '../types/index'

// ============================================================================
// Type Guards
// ============================================================================

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!isObject(value)) return false
  const record = value as Record<string, unknown>
  if (!hasStringProperty(value, 'did')) return false
  if (!hasStringProperty(value, 'address') || !isHexAddress(value.address))
    return false
  if (typeof record.iat !== 'number') return false
  if (typeof record.exp !== 'number') return false
  if (!hasProperty(value, 'linkedTypes') || !Array.isArray(value.linkedTypes))
    return false
  return true
}

function isSessionToken(value: unknown): value is SessionToken {
  if (!isObject(value)) return false
  if (!hasProperty(value, 'claims') || !isSessionClaims(value.claims))
    return false
  if (!hasStringProperty(value, 'signature') || !isHex(value.signature))
    return false
  return true
}

export interface SessionClaims {
  /** DID of the user */
  did: DID
  /** Wallet address */
  address: Address
  /** Issued at (unix seconds) */
  iat: number
  /** Expires at (unix seconds) */
  exp: number
  /** Linked auth types */
  linkedTypes: string[]
  /** Optional nonce for replay protection */
  nonce?: string
}

export interface SessionToken {
  /** The claims being signed */
  claims: SessionClaims
  /** Wallet signature of the claims */
  signature: Hex
}

export interface SessionManagerConfig {
  /** Session expiry in seconds (default: 86400 = 24 hours) */
  expiresIn?: number
}

const DEFAULT_EXPIRY = 24 * 60 * 60 // 24 hours

/**
 * Server-side Session Manager
 *
 * Creates and verifies wallet-signed session tokens.
 * Permissionless: no shared secrets needed for verification.
 */
export class SessionManager {
  private readonly expiresIn: number

  constructor(config: SessionManagerConfig = {}) {
    this.expiresIn = config.expiresIn ?? DEFAULT_EXPIRY
  }

  /**
   * Create a session token from claims and wallet signature
   */
  createToken(claims: SessionClaims, signature: Hex): string {
    const token: SessionToken = { claims, signature }
    return btoa(JSON.stringify(token))
  }

  /**
   * Verify a session token and return the claims
   * Throws if invalid or expired
   */
  async verifyToken(token: string): Promise<SessionClaims> {
    const decoded = this.decodeTokenRaw(token)

    // Check expiration
    if (Date.now() / 1000 > decoded.claims.exp) {
      throw new Error('Session expired')
    }

    // Reconstruct the message that was signed
    const message = this.reconstructMessage(decoded.claims)

    // Verify the signature
    const isValid = await verifyMessage({
      address: decoded.claims.address,
      message,
      signature: decoded.signature,
    })

    if (!isValid) {
      throw new Error('Invalid signature')
    }

    return decoded.claims
  }

  /**
   * Decode token without verification (for reading claims)
   */
  decodeToken(token: string): SessionClaims | null {
    const decoded = this.decodeTokenRaw(token)
    return decoded.claims
  }

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    const decoded = this.decodeTokenRaw(token)
    return Date.now() / 1000 > decoded.claims.exp
  }

  /**
   * Decode the raw token structure
   */
  private decodeTokenRaw(token: string): SessionToken {
    const json = atob(token)
    const parsed: unknown = JSON.parse(json)

    if (!isSessionToken(parsed)) {
      throw new Error('Invalid token structure')
    }

    return parsed
  }

  /**
   * Reconstruct the message that was signed
   */
  private reconstructMessage(claims: SessionClaims): string {
    return `Sign to create session:\n\nDID: ${claims.did}\nAddress: ${claims.address}\nIssued: ${claims.iat}\nExpires: ${claims.exp}\nNonce: ${claims.nonce ?? ''}`
  }

  /**
   * Get the configured expiry time
   */
  getExpiresIn(): number {
    return this.expiresIn
  }
}

/**
 * Create session message for wallet to sign
 */
export function createSessionMessage(
  did: DID,
  address: Address,
  expiresIn = DEFAULT_EXPIRY,
): { message: string; claims: SessionClaims } {
  const now = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomUUID()

  const claims: SessionClaims = {
    did,
    address,
    iat: now,
    exp: now + expiresIn,
    linkedTypes: [],
    nonce,
  }

  const message = `Sign to create session:\n\nDID: ${did}\nAddress: ${address}\nIssued: ${now}\nExpires: ${now + expiresIn}\nNonce: ${nonce}`

  return { message, claims }
}
