/**
 * Blockchain Type Guards and Validation Utilities
 *
 * Provides runtime type validation for blockchain-related types
 * including addresses, hex strings, and network identifiers.
 *
 * @packageDocumentation
 */

import {
  type Address,
  type Hex,
  isAddress as viemIsAddress,
  isHex as viemIsHex,
} from 'viem'

// =============================================================================
// Hex Address Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid Ethereum address
 */
export function isValidAddress(value: string): value is Address {
  return viemIsAddress(value)
}

/**
 * Type guard to check if an unknown value is a valid Ethereum address
 * Convenience wrapper that accepts unknown instead of string
 */
export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && viemIsAddress(value)
}

/**
 * Validates and returns an Address, or throws if invalid
 * @throws Error if the value is not a valid Ethereum address
 */
export function toAddress(value: string | undefined | null): Address {
  if (!value) {
    throw new Error('Address value is required')
  }
  if (!viemIsAddress(value)) {
    throw new Error(`Invalid Ethereum address: ${value}`)
  }
  return value
}

/**
 * Converts a string to Address if valid, returns null otherwise
 */
export function toAddressOrNull(
  value: string | undefined | null,
): Address | null {
  if (!value || !viemIsAddress(value)) {
    return null
  }
  return value
}

/**
 * Converts a string to Address if valid, returns default otherwise
 */
export function toAddressOrDefault(
  value: string | undefined | null,
  defaultValue: Address,
): Address {
  if (!value || !viemIsAddress(value)) {
    return defaultValue
  }
  return value
}

/**
 * Validates an array of strings as Ethereum addresses
 * @throws Error if any value is not a valid address
 */
export function toAddressArray(values: string[] | undefined): Address[] {
  if (!values) return []
  return values.map((v, i) => {
    if (!viemIsAddress(v)) {
      throw new Error(`Invalid Ethereum address at index ${i}: ${v}`)
    }
    return v
  })
}

/**
 * Converts an array of strings to Address array, filtering out invalid ones
 */
export function toAddressArraySafe(values: string[] | undefined): Address[] {
  if (!values) return []
  return values.filter((v): v is Address => viemIsAddress(v))
}

// =============================================================================
// Hex String Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid hex string
 */
export function isValidHex(value: string): value is Hex {
  return viemIsHex(value)
}

/**
 * Type guard to check if an unknown value is a valid hex string
 * Convenience wrapper that accepts unknown instead of string
 */
export function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && viemIsHex(value)
}

/**
 * Validates and returns a Hex, or throws if invalid
 * @throws Error if the value is not a valid hex string
 */
export function toHexString(value: string | undefined | null): Hex {
  if (!value) {
    throw new Error('Hex value is required')
  }
  if (!viemIsHex(value)) {
    throw new Error(`Invalid hex string: ${value}`)
  }
  return value
}

/**
 * Converts a string to Hex if valid, returns null otherwise
 */
export function toHexOrNull(value: string | undefined | null): Hex | null {
  if (!value || !viemIsHex(value)) {
    return null
  }
  return value
}

/**
 * Type guard to check if a string is a valid hex address (0x-prefixed)
 */
export function isHexAddress(address: string): address is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// =============================================================================
// Agent0 ID Type Guards
// =============================================================================

/**
 * Agent0 ID format: `chainId:tokenId`
 */
export type Agent0Id = `${number}:${number}`

/**
 * Regex pattern for Agent0 ID format
 */
const AGENT0_ID_PATTERN = /^\d+:\d+$/

/**
 * Type guard to check if a value is a valid Agent0 ID
 */
export function isAgent0Id(value: string): value is Agent0Id {
  return AGENT0_ID_PATTERN.test(value)
}

/**
 * Validates and returns an Agent0Id, or throws if invalid
 * @throws Error if the value is not a valid Agent0 ID format
 */
export function toAgent0Id(value: string | undefined | null): Agent0Id {
  if (!value) {
    throw new Error('Agent0 ID value is required')
  }
  if (!isAgent0Id(value)) {
    throw new Error(
      `Invalid Agent0 ID format (expected chainId:tokenId): ${value}`,
    )
  }
  return value
}

/**
 * Converts a string to Agent0Id if valid, returns null otherwise
 */
export function toAgent0IdOrNull(
  value: string | undefined | null,
): Agent0Id | null {
  if (!value || !isAgent0Id(value)) {
    return null
  }
  return value
}

/**
 * Creates an Agent0 ID from chain ID and token ID
 */
export function formatAgent0Id(chainId: number, tokenId: number): Agent0Id {
  // Template literal produces the exact Agent0Id type pattern
  const id: `${number}:${number}` = `${chainId}:${tokenId}`
  return id
}

/**
 * Parses an Agent0 ID into its components
 * @throws Error if the value is not a valid Agent0 ID
 */
export function parseAgent0Id(agentId: Agent0Id): {
  chainId: number
  tokenId: number
} {
  // Agent0Id is validated as `${number}:${number}`, so split always yields two elements
  const parts = agentId.split(':')
  const chainIdStr = parts[0]
  const tokenIdStr = parts[1]

  if (chainIdStr === undefined || tokenIdStr === undefined) {
    throw new Error(`Invalid Agent0Id format: ${agentId}`)
  }

  return {
    chainId: Number.parseInt(chainIdStr, 10),
    tokenId: Number.parseInt(tokenIdStr, 10),
  }
}

// =============================================================================
// Network Type Guards
// =============================================================================

/**
 * Valid Agent0 network names (different from deployment environments)
 * For deployment environments, use NetworkName from config/deployment
 */
export type Agent0NetworkName = 'sepolia' | 'mainnet' | 'localnet'

const VALID_AGENT0_NETWORKS = ['sepolia', 'mainnet', 'localnet'] as const

/**
 * Type guard for Agent0 network names
 */
export function isAgent0NetworkName(value: string): value is Agent0NetworkName {
  return (VALID_AGENT0_NETWORKS as readonly string[]).includes(value)
}

/**
 * Validates and returns an Agent0NetworkName, or returns default
 */
export function toAgent0NetworkName(
  value: string | undefined | null,
  defaultNetwork: Agent0NetworkName = 'sepolia',
): Agent0NetworkName {
  if (!value || !isAgent0NetworkName(value)) {
    return defaultNetwork
  }
  return value
}

// =============================================================================
// Jeju Network Type Guards
// =============================================================================

/**
 * Valid Jeju network environments
 */
export type JejuNetwork = 'localnet' | 'testnet' | 'mainnet'

const VALID_JEJU_NETWORKS = ['localnet', 'testnet', 'mainnet'] as const

/**
 * Type guard for Jeju network names
 */
export function isJejuNetwork(value: string): value is JejuNetwork {
  return (VALID_JEJU_NETWORKS as readonly string[]).includes(value)
}

/**
 * Validates and returns a JejuNetwork, or returns default
 */
export function toJejuNetwork(
  value: string | undefined | null,
  defaultNetwork: JejuNetwork = 'localnet',
): JejuNetwork {
  if (!value || !isJejuNetwork(value)) {
    return defaultNetwork
  }
  return value
}

// =============================================================================
// IPFS Provider Type Guards
// =============================================================================

/**
 * Valid IPFS provider types
 */
export type IpfsProvider = 'node' | 'filecoinPin' | 'pinata'

const VALID_IPFS_PROVIDERS = ['node', 'filecoinPin', 'pinata'] as const

/**
 * Type guard for IPFS provider types
 */
export function isIpfsProvider(value: string): value is IpfsProvider {
  return (VALID_IPFS_PROVIDERS as readonly string[]).includes(value)
}

/**
 * Validates and returns an IpfsProvider, or returns default
 */
export function toIpfsProvider(
  value: string | undefined | null,
  defaultProvider: IpfsProvider = 'node',
): IpfsProvider {
  if (!value || !isIpfsProvider(value)) {
    return defaultProvider
  }
  return value
}

// =============================================================================
// Endpoint Type Guards
// =============================================================================

/**
 * Valid Agent0 endpoint types
 */
export type EndpointType = 'MCP' | 'A2A' | 'ENS' | 'DID' | 'wallet' | 'OASF'

const VALID_ENDPOINT_TYPES = [
  'MCP',
  'A2A',
  'ENS',
  'DID',
  'wallet',
  'OASF',
] as const

/**
 * Type guard for endpoint types
 */
export function isEndpointType(value: string): value is EndpointType {
  return (VALID_ENDPOINT_TYPES as readonly string[]).includes(value)
}

/**
 * Validates and returns an EndpointType, or throws
 * @throws Error if the value is not a valid endpoint type
 */
export function toEndpointType(value: string): EndpointType {
  if (!isEndpointType(value)) {
    throw new Error(
      `Invalid endpoint type: ${value}. Expected one of: ${VALID_ENDPOINT_TYPES.join(', ')}`,
    )
  }
  return value
}

// =============================================================================
// Contract Return Value Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a bigint
 */
export function isBigint(value: unknown): value is bigint {
  return typeof value === 'bigint'
}

/**
 * Type guard to check if a value is an array of bigints
 */
export function isBigintArray(value: unknown): value is bigint[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'bigint')
}

/**
 * Type guard to check if a value is an array of addresses
 */
export function isAddressArray(value: unknown): value is Address[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && viemIsAddress(v))
  )
}

/**
 * Type guard to check if value is a readonly address array
 */
export function isReadonlyAddressArray(
  value: unknown,
): value is readonly Address[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string' && viemIsAddress(v))
  )
}

/**
 * Type guard for bigint tuple of length 3
 */
export function isBigintTuple3(
  value: unknown,
): value is readonly [bigint, bigint, bigint] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((v) => typeof v === 'bigint')
  )
}

/**
 * Type guard for bigint tuple of length 6
 */
export function isBigintTuple6(
  value: unknown,
): value is readonly [bigint, bigint, bigint, bigint, bigint, bigint] {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every((v) => typeof v === 'bigint')
  )
}

// =============================================================================
// Transaction Hash Type Guards
// =============================================================================

/**
 * Type guard for transaction hash (64 hex chars after 0x)
 */
export function isTransactionHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/**
 * Validates and returns a transaction hash, or throws
 */
export function toTransactionHash(
  value: string | undefined | null,
): `0x${string}` {
  if (!value) {
    throw new Error('Transaction hash is required')
  }
  if (!isTransactionHash(value)) {
    throw new Error(`Invalid transaction hash: ${value}`)
  }
  return value
}

/**
 * Converts to transaction hash if valid, returns null otherwise
 */
export function toTransactionHashOrNull(
  value: string | undefined | null,
): `0x${string}` | null {
  if (!value || !isTransactionHash(value)) {
    return null
  }
  return value
}

// =============================================================================
// IPFS Response Type Guards
// =============================================================================

/**
 * IPFS add response structure
 */
export interface IpfsAddResponse {
  Hash?: string
  cid?: string
  Name?: string
  Size?: string
}

/**
 * Type guard for IPFS add response
 */
export function isIpfsAddResponse(value: unknown): value is IpfsAddResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  // After null check, we can safely check properties using 'in' operator
  // Must have at least Hash or cid
  const hasHash = 'Hash' in value && typeof value.Hash === 'string'
  const hasCid = 'cid' in value && typeof value.cid === 'string'
  return hasHash || hasCid || (!('Hash' in value) && !('cid' in value))
}

/**
 * Extracts CID from IPFS response, throwing if not found
 */
export function extractIpfsCid(response: IpfsAddResponse): string {
  const cid = response.Hash ?? response.cid
  if (!cid) {
    throw new Error('IPFS response missing Hash or cid field')
  }
  return cid
}

/**
 * Parses IPFS add response from JSON, with type safety
 */
export function parseIpfsResponse(json: unknown): IpfsAddResponse {
  if (!isIpfsAddResponse(json)) {
    throw new Error('Invalid IPFS response format')
  }
  return json
}
