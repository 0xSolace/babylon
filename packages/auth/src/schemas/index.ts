/**
 * Zod Validation Schemas for Auth Package
 *
 * Security-critical validation for all auth data structures.
 */

import type { Address, Hex } from 'viem';
import { z } from 'zod';
import type { DID } from '../types/index';

// ============================================================================
// Primitive Schemas
// ============================================================================

/** Ethereum address validation (0x + 40 hex chars) */
export const AddressSchema = z.custom<Address>(
  (val): val is Address =>
    typeof val === 'string' && /^0x[a-fA-F0-9]{40}$/.test(val),
  { message: 'Invalid Ethereum address format' }
);

/** Hex string validation (0x + hex chars) */
export const HexSchema = z.custom<Hex>(
  (val): val is Hex => typeof val === 'string' && /^0x[a-fA-F0-9]*$/.test(val),
  { message: 'Invalid hex string format' }
);

/** DID format validation (did:jeju:network:publicKey) */
export const DIDSchema = z.custom<DID>(
  (val): val is DID =>
    typeof val === 'string' && /^did:jeju:[a-z]+:0x[a-fA-F0-9]+$/.test(val),
  { message: 'Invalid DID format - expected did:jeju:network:0x...' }
);

// ============================================================================
// Session Schemas
// ============================================================================

/** Session claims from wallet-signed tokens */
export const SessionClaimsSchema = z.object({
  did: DIDSchema,
  address: AddressSchema,
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  linkedTypes: z.array(z.string()),
  nonce: z.string().optional(),
});

export type SessionClaimsInput = z.infer<typeof SessionClaimsSchema>;

/** Complete session token structure */
export const SessionTokenDataSchema = z.object({
  claims: SessionClaimsSchema,
  signature: HexSchema,
});

export type SessionTokenDataInput = z.infer<typeof SessionTokenDataSchema>;

// ============================================================================
// PKCE Schemas
// ============================================================================

/** PKCE parameters for OAuth flows */
export const PKCEParamsSchema = z.object({
  codeVerifier: z.string().min(43).max(128),
  codeChallenge: z.string().min(1),
  state: z.string().min(16),
  nonce: z.string().min(1),
});

export type PKCEParamsInput = z.infer<typeof PKCEParamsSchema>;

// ============================================================================
// Key Backup Schemas
// ============================================================================

/** Key backup format for recovery */
export const KeyBackupSchema = z.object({
  version: z.number().int().positive(),
  userId: DIDSchema,
  encryptedKey: HexSchema,
  salt: HexSchema,
  iv: HexSchema,
  iterations: z.number().int().min(10000),
  createdAt: z.number().int().positive(),
});

export type KeyBackupInput = z.infer<typeof KeyBackupSchema>;

// ============================================================================
// OAuth Response Schemas
// ============================================================================

/** OAuth token response from providers */
export const OAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  token_type: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});

export type OAuthTokenResponseInput = z.infer<typeof OAuthTokenResponseSchema>;

/** Twitter user data response */
export const TwitterUserResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string(),
    username: z.string(),
    profile_image_url: z.string().url().optional(),
    verified: z.boolean().optional(),
  }),
});

export type TwitterUserResponseInput = z.infer<
  typeof TwitterUserResponseSchema
>;

/** Discord user data response */
export const DiscordUserResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string(),
  global_name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  avatar: z.string().nullable().optional(),
  verified: z.boolean().optional(),
});

export type DiscordUserResponseInput = z.infer<
  typeof DiscordUserResponseSchema
>;

// ============================================================================
// Client Session Schema
// ============================================================================

/** Client-side session data stored in sessionStorage */
export const SessionDataSchema = z.object({
  userId: DIDSchema,
  token: z.string().min(1),
  expiresAt: z.number().int().positive(),
  walletAddress: AddressSchema,
  linkedAccounts: z.array(
    z.object({
      type: z.enum(['email', 'wallet', 'farcaster', 'twitter', 'discord']),
      identifier: z.string(),
      verifiedAt: z.number(),
      metadata: z
        .object({
          fid: z.number().optional(),
          username: z.string().optional(),
          displayName: z.string().optional(),
          pfpUrl: z.string().optional(),
          twitterId: z.string().optional(),
          twitterUsername: z.string().optional(),
          discordId: z.string().optional(),
          discordUsername: z.string().optional(),
          chainId: z.number().optional(),
        })
        .optional(),
    })
  ),
});

export type SessionDataInput = z.infer<typeof SessionDataSchema>;
