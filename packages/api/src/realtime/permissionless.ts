/**
 * Permissionless Realtime Tokens
 *
 * Uses wallet signatures instead of shared secrets for realtime subscription auth.
 * No REALTIME_SIGNING_SECRET needed - fully permissionless.
 *
 * Flow:
 * 1. Server creates subscription message with channels + expiry
 * 2. User signs message with their wallet
 * 3. Anyone can verify the subscription - no shared secret needed
 */

import { type Address, type Hex, verifyMessage } from 'viem';
import type { RealtimeChannel } from './index';

export interface RealtimeSubscriptionClaims {
  /** User's wallet address */
  address: Address;
  /** Channels the user can subscribe to */
  channels: RealtimeChannel[];
  /** Issued at (unix seconds) */
  iat: number;
  /** Expires at (unix seconds) */
  exp: number;
  /** Optional nonce for replay protection */
  nonce?: string;
}

export interface RealtimeSubscriptionToken {
  claims: RealtimeSubscriptionClaims;
  signature: Hex;
}

const DEFAULT_TTL = 15 * 60; // 15 minutes

/**
 * Create subscription message for wallet to sign
 */
export function createSubscriptionMessage(
  address: Address,
  channels: RealtimeChannel[],
  ttlSeconds = DEFAULT_TTL
): { message: string; claims: RealtimeSubscriptionClaims } {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();

  const claims: RealtimeSubscriptionClaims = {
    address,
    channels,
    iat: now,
    exp: now + ttlSeconds,
    nonce,
  };

  const message = `Subscribe to Babylon Realtime:

Address: ${address}
Channels: ${channels.join(', ')}
Issued: ${now}
Expires: ${now + ttlSeconds}
Nonce: ${nonce}`;

  return { message, claims };
}

/**
 * Create subscription token from claims and signature
 */
export function createSubscriptionToken(
  claims: RealtimeSubscriptionClaims,
  signature: Hex
): string {
  const token: RealtimeSubscriptionToken = { claims, signature };
  return btoa(JSON.stringify(token));
}

/**
 * Verify subscription token - no secret needed
 */
export async function verifySubscriptionToken(
  token: string
): Promise<RealtimeSubscriptionClaims> {
  const decoded = JSON.parse(atob(token)) as RealtimeSubscriptionToken;
  const { claims, signature } = decoded;

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now > claims.exp) {
    throw new Error('Subscription token expired');
  }

  // Reconstruct message and verify signature
  const message = `Subscribe to Babylon Realtime:

Address: ${claims.address}
Channels: ${claims.channels.join(', ')}
Issued: ${claims.iat}
Expires: ${claims.exp}
Nonce: ${claims.nonce ?? ''}`;

  const isValid = await verifyMessage({
    address: claims.address,
    message,
    signature,
  });

  if (!isValid) {
    throw new Error('Invalid subscription signature');
  }

  return claims;
}

/**
 * Check if token is expired (without full verification)
 */
export function isSubscriptionExpired(token: string): boolean {
  try {
    const decoded = JSON.parse(atob(token)) as RealtimeSubscriptionToken;
    return Date.now() / 1000 > decoded.claims.exp;
  } catch {
    return true;
  }
}

/**
 * Decode token without verification (for reading claims)
 */
export function decodeSubscriptionToken(
  token: string
): RealtimeSubscriptionClaims | null {
  try {
    const decoded = JSON.parse(atob(token)) as RealtimeSubscriptionToken;
    return decoded.claims;
  } catch {
    return null;
  }
}

/**
 * Check if user has access to a specific channel
 */
export function hasChannelAccess(
  claims: RealtimeSubscriptionClaims,
  channel: RealtimeChannel
): boolean {
  // Exact match
  if (claims.channels.includes(channel)) return true;

  // Wildcard patterns
  for (const sub of claims.channels) {
    // notifications:* matches notifications:userId
    if (sub.endsWith(':*')) {
      const prefix = sub.slice(0, -1);
      if (channel.startsWith(prefix)) return true;
    }
    // * matches everything
    if (sub === '*') return true;
  }

  return false;
}

/**
 * Permissionless Realtime Manager
 * Drop-in replacement for secret-based realtime auth
 */
export class PermissionlessRealtimeManager {
  private defaultTTL: number;

  constructor(config: { ttlSeconds?: number } = {}) {
    this.defaultTTL = config.ttlSeconds ?? DEFAULT_TTL;
  }

  /**
   * Create subscription message for wallet to sign
   */
  createMessage(
    address: Address,
    channels: RealtimeChannel[]
  ): { message: string; claims: RealtimeSubscriptionClaims } {
    return createSubscriptionMessage(address, channels, this.defaultTTL);
  }

  /**
   * Create token from signed claims
   */
  createToken(claims: RealtimeSubscriptionClaims, signature: Hex): string {
    return createSubscriptionToken(claims, signature);
  }

  /**
   * Verify token (permissionless - no secret needed)
   */
  async verifyToken(token: string): Promise<RealtimeSubscriptionClaims> {
    return verifySubscriptionToken(token);
  }

  /**
   * Check if token is expired
   */
  isExpired(token: string): boolean {
    return isSubscriptionExpired(token);
  }

  /**
   * Decode token without verification
   */
  decode(token: string): RealtimeSubscriptionClaims | null {
    return decodeSubscriptionToken(token);
  }

  /**
   * Check channel access
   */
  hasAccess(
    claims: RealtimeSubscriptionClaims,
    channel: RealtimeChannel
  ): boolean {
    return hasChannelAccess(claims, channel);
  }
}
