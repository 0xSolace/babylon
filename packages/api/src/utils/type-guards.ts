/**
 * API Type Guards
 *
 * API-specific type guards and parsing utilities for runtime type checking.
 * For base type guards, import from @babylon/shared.
 */

import type { AuthenticatedUser, JsonValue } from '@babylon/shared'
import {
  first,
  getErrorMessage,
  isJsonValue,
  isObject,
  isStringArray,
  parseJsonAs,
  toError,
  toJsonValueOrNull,
} from '@babylon/shared'
import type { Address, Hex } from 'viem'

// Re-export error helpers for consumers
export { getErrorMessage, toError, toJsonValueOrNull }

// =============================================================================
// Viem Type Guards (Address, Hex)
// =============================================================================

/**
 * Check if string is a valid Ethereum address
 */
export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Check if string is a valid hex string
 */
export function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value)
}

/**
 * Check if string is a valid hex signature (65 bytes = 130 hex chars)
 */
export function isHexSignature(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{130}$/.test(value)
}

/**
 * Parse string as Address, returns null if invalid
 */
export function parseAddress(value: unknown): Address | null {
  return isAddress(value) ? value : null
}

/**
 * Parse string as Hex, returns null if invalid
 */
export function parseHex(value: unknown): Hex | null {
  return isHex(value) ? value : null
}

/**
 * Require value to be a valid Address, throws if invalid
 */
export function requireAddress(value: unknown, fieldName = 'address'): Address {
  if (!isAddress(value)) {
    throw new Error(
      `Invalid ${fieldName}: expected Ethereum address, got ${typeof value}`,
    )
  }
  return value
}

/**
 * Require value to be a valid Hex string, throws if invalid
 */
export function requireHex(value: unknown, fieldName = 'hex'): Hex {
  if (!isHex(value)) {
    throw new Error(
      `Invalid ${fieldName}: expected hex string, got ${typeof value}`,
    )
  }
  return value
}

// =============================================================================
// Auth Type Guards
// =============================================================================

/**
 * Check if AuthenticatedUser has a database user ID
 */
export function hasDbUserId(
  user: AuthenticatedUser,
): user is AuthenticatedUser & { dbUserId: string } {
  return typeof user.dbUserId === 'string' && user.dbUserId.length > 0
}

/**
 * Check if AuthenticatedUser has a wallet address
 */
export function hasWalletAddress(
  user: AuthenticatedUser,
): user is AuthenticatedUser & { walletAddress: string } {
  return typeof user.walletAddress === 'string' && user.walletAddress.length > 0
}

// =============================================================================
// Agent Session Type Guards
// =============================================================================

/**
 * Agent session structure
 */
export interface AgentSessionData {
  sessionToken: string
  agentId: string
  expiresAt: number
}

/**
 * Check if value is a valid AgentSession
 */
export function isAgentSession(value: unknown): value is AgentSessionData {
  if (!isObject(value)) return false
  return (
    typeof value.sessionToken === 'string' &&
    typeof value.agentId === 'string' &&
    typeof value.expiresAt === 'number'
  )
}

/**
 * Parse JSON string to AgentSession with validation
 */
export function parseAgentSession(json: string): AgentSessionData {
  return parseJsonAs(json, isAgentSession, 'Invalid AgentSession data')
}

// =============================================================================
// Compute Proof Type Guards
// =============================================================================

/**
 * Compute proof structure for cron auth
 */
export interface ComputeProofData {
  nodeAddress: Address
  signature: `0x${string}`
  timestamp: number
  jobId: string
}

/**
 * Check if value is a valid ComputeProof
 */
export function isComputeProof(value: unknown): value is ComputeProofData {
  if (!isObject(value)) return false
  return (
    isAddress(value.nodeAddress) &&
    isHex(value.signature) &&
    typeof value.timestamp === 'number' &&
    typeof value.jobId === 'string'
  )
}

/**
 * Parse compute proof from headers
 */
export function parseComputeProof(
  nodeAddress: string | null | undefined,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  jobId: string | null | undefined,
): ComputeProofData | null {
  if (!nodeAddress || !signature || !timestamp || !jobId) {
    return null
  }

  if (!isAddress(nodeAddress)) return null
  if (!isHex(signature)) return null

  const ts = parseInt(timestamp, 10)
  if (Number.isNaN(ts)) return null

  return {
    nodeAddress,
    signature: signature as `0x${string}`,
    timestamp: ts,
    jobId,
  }
}

// =============================================================================
// JSON Value Utilities (API-specific extensions)
// =============================================================================

/**
 * Safely cast to JsonValue with validation
 */
export function toJsonValue(value: unknown): JsonValue {
  if (!isJsonValue(value)) {
    throw new Error('Value is not a valid JsonValue')
  }
  return value
}

/**
 * Safely cast record to JsonValue record
 */
export function toJsonRecord(value: unknown): Record<string, JsonValue> {
  if (!isObject(value)) {
    throw new Error('Value is not an object')
  }
  const result: Record<string, JsonValue> = {}
  for (const [key, val] of Object.entries(value)) {
    if (isJsonValue(val)) {
      result[key] = val
    }
  }
  return result
}

/**
 * Safely convert record with unknown values to JsonValue record
 * Non-serializable values are omitted
 */
export function safeToJsonRecord(
  value: Record<string, unknown> | undefined,
): Record<string, JsonValue> {
  if (!value) return {}
  const result: Record<string, JsonValue> = {}
  for (const [key, val] of Object.entries(value)) {
    if (isJsonValue(val)) {
      result[key] = val
    }
  }
  return result
}

// =============================================================================
// Generic Parsing Utilities
// =============================================================================

/**
 * Parse JSON with type guard validation (legacy name for parseJsonAs)
 */
export function parseJson<T>(
  json: string,
  guard: (value: unknown) => value is T,
  errorMessage = 'Invalid JSON structure',
): T {
  return parseJsonAs(json, guard, errorMessage)
}

/**
 * Safely get first element from array
 */
export { first }

// =============================================================================
// Cache Response Type Guards
// =============================================================================

/**
 * Cache GET response shape
 */
export interface CacheGetResponse<T> {
  value: T | null
  found: boolean
}

/**
 * Check if value is a CacheGetResponse
 */
export function isCacheGetResponse<T>(
  value: unknown,
  valueGuard?: (v: unknown) => v is T,
): value is CacheGetResponse<T> {
  if (!isObject(value)) return false
  if (typeof value.found !== 'boolean') return false
  if (value.value !== null && valueGuard && !valueGuard(value.value)) {
    return false
  }
  return true
}

/**
 * Cache success response shape
 */
export interface CacheSuccessResponse {
  success: boolean
}

/**
 * Check if value is a CacheSuccessResponse
 */
export function isCacheSuccessResponse(
  value: unknown,
): value is CacheSuccessResponse {
  return isObject(value) && typeof value.success === 'boolean'
}

/**
 * Cache TTL response shape
 */
export interface CacheTtlResponse {
  ttl: number
}

/**
 * Check if value is a CacheTtlResponse
 */
export function isCacheTtlResponse(value: unknown): value is CacheTtlResponse {
  return isObject(value) && typeof value.ttl === 'number'
}

/**
 * Cache keys response shape
 */
export interface CacheKeysResponse {
  keys: string[]
}

/**
 * Check if value is a CacheKeysResponse
 */
export function isCacheKeysResponse(
  value: unknown,
): value is CacheKeysResponse {
  return isObject(value) && isStringArray(value.keys)
}

/**
 * Cache entries response shape (for mget)
 */
export interface CacheEntriesResponse<T> {
  entries: Record<string, T | null>
}

/**
 * Check if value is a CacheEntriesResponse
 */
export function isCacheEntriesResponse<T>(
  value: unknown,
): value is CacheEntriesResponse<T> {
  return isObject(value) && isObject(value.entries)
}

/**
 * Cache health response shape
 */
export interface CacheHealthResponse {
  status: string
}

/**
 * Check if value is a CacheHealthResponse
 */
export function isCacheHealthResponse(
  value: unknown,
): value is CacheHealthResponse {
  return isObject(value) && typeof value.status === 'string'
}

/**
 * Cache stats response from Jeju
 */
export interface JejuCacheStatsResponse {
  stats: {
    totalKeys: number
    usedMemoryMb: number
    hits: number
    misses: number
    hitRate: number
  }
}

/**
 * Check if value is a JejuCacheStatsResponse
 */
export function isJejuCacheStatsResponse(
  value: unknown,
): value is JejuCacheStatsResponse {
  if (!isObject(value)) return false
  if (!isObject(value.stats)) return false
  const stats = value.stats
  return (
    typeof stats.totalKeys === 'number' &&
    typeof stats.usedMemoryMb === 'number' &&
    typeof stats.hits === 'number' &&
    typeof stats.misses === 'number' &&
    typeof stats.hitRate === 'number'
  )
}
