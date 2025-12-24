/**
 * Client-Side Session Manager
 *
 * Browser-compatible session token creation and management.
 * Uses wallet signatures for authentication - no shared secrets needed.
 */

import type { Address, Hex } from 'viem'
import { SessionDataSchema } from '../schemas/index'
import type { DID } from '../types/index'

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

const DEFAULT_EXPIRY = 24 * 60 * 60 // 24 hours

/**
 * Client-side Session Manager
 * Creates and manages wallet-signed session tokens
 */
export class SessionManager {
  /**
   * Create a session token from claims and wallet signature
   */
  createToken(claims: SessionClaims, signature: Hex): string {
    const token: SessionToken = { claims, signature }
    return btoa(JSON.stringify(token))
  }

  /**
   * Decode token without verification (for reading claims)
   */
  decodeToken(token: string): SessionClaims {
    const decoded = SessionDataSchema.parse(JSON.parse(atob(token)))
    return {
      did: decoded.userId,
      address: decoded.walletAddress,
      iat: Math.floor(Date.now() / 1000),
      exp: decoded.expiresAt / 1000,
      linkedTypes: decoded.linkedAccounts.map((a) => a.type),
    }
  }

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    const claims = this.decodeToken(token)
    return Date.now() / 1000 > claims.exp
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
