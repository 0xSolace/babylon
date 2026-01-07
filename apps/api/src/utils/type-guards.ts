/**
 * Server Type Guards and Converters
 *
 * Server-specific type validation and conversion utilities.
 * For base type guards, import from @babylon/shared.
 */

import { isValidHex } from '@babylon/shared'

// =============================================================================
// HEX STRING GUARDS
// =============================================================================

/**
 * Type guard: checks if a string is a valid hex string (0x prefixed)
 */
export function isHexString(value: string): value is `0x${string}` {
  return isValidHex(value)
}

// =============================================================================
// NETWORK GUARDS
// =============================================================================

const VALID_NETWORKS = ['localnet', 'testnet', 'mainnet'] as const
export type NetworkType = (typeof VALID_NETWORKS)[number]

/**
 * Type guard: checks if a string is a valid network type
 */
export function isValidNetwork(network: string): network is NetworkType {
  return (VALID_NETWORKS as readonly string[]).includes(network)
}

/**
 * Converter: returns valid network or default
 */
export function toNetwork(
  network: string,
  defaultNetwork: NetworkType = 'localnet',
): NetworkType {
  return isValidNetwork(network) ? network : defaultNetwork
}

// =============================================================================
// POOL FEE GUARDS (Uniswap V3)
// =============================================================================

const VALID_POOL_FEES = [500, 3000, 10000] as const
export type PoolFee = (typeof VALID_POOL_FEES)[number]

/**
 * Type guard: checks if a number is a valid Uniswap V3 pool fee
 */
export function isPoolFee(value: number): value is PoolFee {
  return (VALID_POOL_FEES as readonly number[]).includes(value)
}

/**
 * Converter: throws if not a valid pool fee
 */
export function toPoolFee(value: number): PoolFee {
  if (!isPoolFee(value)) {
    throw new Error(`Invalid pool fee: ${value}. Must be 500, 3000, or 10000`)
  }
  return value
}
