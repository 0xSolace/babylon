/**
 * Auth Type Guards and Utility Types
 *
 * Auth-specific type guards.
 */

import {
  isValidAddress,
  isValidHex,
  isAddress as sharedIsAddress,
  isHex as sharedIsHex,
  toHexString,
} from '@babylon/shared'
import { hasStringProperty, isObject } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'
import type {
  BackupRecoveryProof,
  DID,
  OAuthRecoveryProof,
  RecoveryProof,
  SocialRecoveryProof,
} from './index'

export { isValidAddress, isValidHex }

// ============================================================================
// HTTP Error with Status
// ============================================================================

/**
 * HTTP Error with status code for API error handling.
 */
export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }

  /**
   * Check if an error is retryable (5xx status codes)
   */
  isRetryable(): boolean {
    return this.status >= 500 && this.status < 600
  }
}

// ============================================================================
// Empty/Pending Value Constants
// ============================================================================

/**
 * Empty Ethereum address (0x0000...0000).
 */
export const EMPTY_ADDRESS =
  '0x0000000000000000000000000000000000000000' as const
export type EmptyAddress = typeof EMPTY_ADDRESS

/**
 * Empty hex value.
 */
export const EMPTY_HEX = '0x' as const
export type EmptyHex = typeof EMPTY_HEX

/**
 * Pending DID placeholder for async operations.
 */
export const PENDING_DID =
  'did:jeju:pending:0x0000000000000000000000000000000000000000' as const
export type PendingDID = typeof PENDING_DID

// ============================================================================
// DID Utilities
// ============================================================================

/**
 * Check if a string is a valid DID format.
 */
export function isDID(value: string): value is DID {
  return /^did:jeju:[a-z]+:0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Create a DID from network and identifier.
 * Returns properly typed DID without casts.
 */
export function makeDID(
  network: 'mainnet' | 'testnet' | 'localnet',
  identifier: `0x${string}`,
): DID {
  const did = `did:jeju:${network}:${identifier}`
  if (!isDID(did)) {
    throw new Error(
      `Invalid DID components: network=${network}, identifier=${identifier}`,
    )
  }
  return did
}

// ============================================================================
// Hex Utilities
// ============================================================================

/**
 * Check if a string is a valid hex string.
 * @deprecated Use isHex from @babylon/shared directly
 */
export function isHex(value: string): value is Hex {
  return sharedIsHex(value)
}

/**
 * Convert a string to Hex type with validation.
 */
export function toHexStrict(value: string): Hex {
  return toHexString(value)
}

/**
 * Convert a Buffer/Uint8Array to Hex.
 */
export function bufferToHex(buffer: Uint8Array | Buffer): Hex {
  const hex = Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}`
}

// ============================================================================
// Address Utilities
// ============================================================================

/**
 * Check if a string is a valid Ethereum address.
 * @deprecated Use isAddress from @babylon/shared directly
 */
export function isAddress(value: string): value is Address {
  return sharedIsAddress(value)
}

/**
 * Convert a string to Address type with validation.
 */
export function toAddressStrict(value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`Invalid Ethereum address: ${value}`)
  }
  return value
}

// ============================================================================
// Recovery Proof Type Guards
// ============================================================================

/**
 * Check if a RecoveryProof is a backup recovery.
 */
export function isBackupRecovery(
  proof: RecoveryProof,
): proof is RecoveryProof & { type: 'backup'; data: BackupRecoveryProof } {
  return proof.type === 'backup'
}

/**
 * Check if a RecoveryProof is an OAuth recovery.
 */
export function isOAuthRecovery(
  proof: RecoveryProof,
): proof is RecoveryProof & { type: 'oauth'; data: OAuthRecoveryProof } {
  return proof.type === 'oauth'
}

/**
 * Check if a RecoveryProof is a social recovery.
 */
export function isSocialRecovery(
  proof: RecoveryProof,
): proof is RecoveryProof & { type: 'social'; data: SocialRecoveryProof } {
  return proof.type === 'social'
}

// ============================================================================
// API Response Validators
// ============================================================================

/** MPC Key Generation Response */
export interface MPCKeyGenResponse {
  keyId: string
  publicKey?: Hex
  address?: Address
}

export function isMPCKeyGenResponse(
  value: unknown,
): value is MPCKeyGenResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'keyId')) return false
  return true
}

/** MPC Signature Response */
export interface MPCSignResponse {
  signature: Hex
  mode?: 'mpc' | 'development'
  keyId?: string
  signedAt?: number
}

export function isMPCSignResponse(value: unknown): value is MPCSignResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'signature')) return false
  if (!isHex(value.signature)) return false
  return true
}

/** MPC Key Rotation Response */
export interface MPCKeyRotationResponse {
  newKeyId: string
}

export function isMPCKeyRotationResponse(
  value: unknown,
): value is MPCKeyRotationResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'newKeyId')) return false
  return true
}

/** Nonce Response */
export interface NonceResponse {
  nonce: string
}

export function isNonceResponse(value: unknown): value is NonceResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'nonce')) return false
  return true
}

/** RPC Balance Response */
export interface RpcBalanceResponse {
  result: string
}

export function isRpcBalanceResponse(
  value: unknown,
): value is RpcBalanceResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'result')) return false
  return true
}

// ============================================================================
// Ethereum Provider Type
// ============================================================================

/**
 * Ethereum provider interface for wallet interactions.
 */
export interface EthereumProvider {
  request: (args: {
    method: string
    params?: (string | number | boolean | Address | Hex | null)[]
  }) => Promise<string | string[]>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void
}

/**
 * Window with ethereum provider.
 */
type WindowWithEthereum = Window & {
  ethereum?: EthereumProvider
}

/**
 * Get the Ethereum provider from window.
 * Returns undefined if not available (SSR or no wallet).
 */
export function getEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  return (window as WindowWithEthereum).ethereum
}
