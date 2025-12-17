/**
 * Permissionless Session Manager
 *
 * Uses wallet signatures for session tokens instead of a shared secret.
 * No JEJU_JWT_SECRET needed - fully permissionless.
 *
 * Flow:
 * 1. User signs a session message with their wallet
 * 2. Session token = base64(message + signature)
 * 3. Verification recovers address from signature, no shared secret needed
 */

import { type Address, type Hex, verifyMessage } from 'viem';
import type { DID } from '../types/index';

export interface SessionClaims {
  /** DID of the user */
  did: DID;
  /** Wallet address */
  address: Address;
  /** Issued at (unix seconds) */
  iat: number;
  /** Expires at (unix seconds) */
  exp: number;
  /** Linked auth types */
  linkedTypes: string[];
  /** Optional nonce for replay protection */
  nonce?: string;
}

export interface SessionToken {
  /** The claims being signed */
  claims: SessionClaims;
  /** Wallet signature of the claims */
  signature: Hex;
}

const DEFAULT_EXPIRY = 24 * 60 * 60; // 24 hours

/**
 * Permissionless Session Manager
 * No shared secret - uses wallet signatures for verification
 */
export class SessionManager {
  private expiresIn: number;

  constructor(config: { expiresIn?: number } = {}) {
    this.expiresIn = config.expiresIn ?? DEFAULT_EXPIRY;
  }

  /**
   * Create the message that needs to be signed by the wallet
   */
  createSessionMessage(claims: Omit<SessionClaims, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const fullClaims: SessionClaims = {
      ...claims,
      iat: now,
      exp: now + this.expiresIn,
    };

    return `Sign to create session:\n\nDID: ${fullClaims.did}\nAddress: ${fullClaims.address}\nIssued: ${fullClaims.iat}\nExpires: ${fullClaims.exp}\nNonce: ${fullClaims.nonce ?? 'none'}`;
  }

  /**
   * Create a session token from claims and wallet signature
   * Claims must include iat/exp from createSessionMessage
   */
  createToken(claims: SessionClaims, signature: Hex): string {
    const token: SessionToken = { claims, signature };
    return btoa(JSON.stringify(token));
  }

  /**
   * Verify a session token - recovers address from signature
   * No shared secret needed - fully permissionless
   */
  async verifyToken(token: string): Promise<SessionClaims> {
    const decoded = JSON.parse(atob(token)) as SessionToken;
    const { claims, signature } = decoded;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > claims.exp) {
      throw new Error('Session expired');
    }

    // Verify signature matches the address in claims
    const message = this.reconstructMessage(claims);
    const isValid = await verifyMessage({
      address: claims.address,
      message,
      signature,
    });

    if (!isValid) {
      throw new Error('Invalid session signature');
    }

    // Verify DID contains the address
    if (
      !claims.did.toLowerCase().includes(claims.address.toLowerCase().slice(2))
    ) {
      throw new Error('DID does not match address');
    }

    return claims;
  }

  /**
   * Decode token without verification (for reading claims)
   */
  decodeToken(token: string): SessionClaims | null {
    try {
      const decoded = JSON.parse(atob(token)) as SessionToken;
      return decoded.claims;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    const claims = this.decodeToken(token);
    if (!claims) return true;
    return Date.now() / 1000 > claims.exp;
  }

  /**
   * Reconstruct the message that was signed
   */
  private reconstructMessage(claims: SessionClaims): string {
    return `Sign to create session:\n\nDID: ${claims.did}\nAddress: ${claims.address}\nIssued: ${claims.iat}\nExpires: ${claims.exp}\nNonce: ${claims.nonce ?? 'none'}`;
  }
}

/**
 * Create session message for wallet to sign
 */
export function createSessionMessage(
  did: DID,
  address: Address,
  expiresIn = DEFAULT_EXPIRY
): { message: string; claims: SessionClaims } {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();

  const claims: SessionClaims = {
    did,
    address,
    iat: now,
    exp: now + expiresIn,
    linkedTypes: [],
    nonce,
  };

  const message = `Sign to create session:\n\nDID: ${did}\nAddress: ${address}\nIssued: ${now}\nExpires: ${now + expiresIn}\nNonce: ${nonce}`;

  return { message, claims };
}
