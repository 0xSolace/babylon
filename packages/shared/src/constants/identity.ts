/**
 * Identity-related constants and utilities for Babylon
 *
 * Provides ERC-8004 identity registry functionality including
 * ABIs and address resolution.
 */

import type { Address } from 'viem'
import { zeroAddress } from 'viem'
import { CHAIN_ID } from '../config'
import { IDENTITY_REGISTRY_ABI, REPUTATION_SYSTEM_ABI } from '../contracts/abis'
import { getERC8004ContractAddresses } from '../contracts/addresses'

/**
 * Capabilities hash constant for ERC-8004 identity registry
 */
export const CAPABILITIES_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000001'

export { IDENTITY_REGISTRY_ABI, REPUTATION_SYSTEM_ABI }

/**
 * Get the identity registry contract address for the current chain
 *
 * @returns The identity registry address, or null if not deployed
 */
export function getIdentityRegistryAddress(): Address | null {
  const { identityRegistry } = getERC8004ContractAddresses(CHAIN_ID)

  if (!identityRegistry || identityRegistry === zeroAddress) {
    // Return null instead of throwing to allow graceful degradation in test/dev environments
    return null
  }

  return identityRegistry
}
