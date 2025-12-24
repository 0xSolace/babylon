/**
 * Contract Address Configuration
 *
 * ERC-8004 Identity, Reputation, and Prediction Market contract addresses.
 * Supports: localnet (Hardhat), Base Sepolia (staging), Base Mainnet (production).
 *
 * @see packages/shared/src/config/default-config.ts for the canonical source
 */

import type { Address } from 'viem'
import {
  type CoreContractAddresses,
  areContractsDeployed as checkContractsDeployed,
  type LocalContractAddresses,
  PUBLIC_CONFIG,
} from '../config'

// =============================================================================
// Types
// =============================================================================

/**
 * Contract addresses for ERC-8004 and prediction market operations
 */
export interface ERC8004ContractAddresses {
  identityRegistry: Address
  reputationSystem: Address
  diamond: Address
  predictionMarketFacet: Address
  oracleFacet: Address
  gameOracle?: Address
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if contracts include gameOracle (local network only)
 */
function isLocalContractAddresses(
  contracts: CoreContractAddresses | LocalContractAddresses,
): contracts is LocalContractAddresses {
  return 'gameOracle' in contracts
}

/**
 * Convert config contracts to ERC8004 contract addresses
 */
function toERC8004Contracts(
  contracts: CoreContractAddresses | LocalContractAddresses,
): ERC8004ContractAddresses {
  const base: ERC8004ContractAddresses = {
    identityRegistry: contracts.identityRegistry,
    reputationSystem: contracts.reputationSystem,
    diamond: contracts.diamond,
    predictionMarketFacet: contracts.predictionMarketFacet,
    oracleFacet: contracts.oracleFacet,
  }

  if (isLocalContractAddresses(contracts)) {
    base.gameOracle = contracts.gameOracle
  }

  return base
}

// =============================================================================
// Network Contract Exports
// =============================================================================

/** Localnet (Hardhat) - Chain ID: 31337 */
export const LOCAL_CONTRACTS: ERC8004ContractAddresses = toERC8004Contracts(
  PUBLIC_CONFIG.networks.local.contracts,
)

/** Base Sepolia (Staging) - Chain ID: 84532 */
export const BASE_SEPOLIA_CONTRACTS: ERC8004ContractAddresses =
  toERC8004Contracts(PUBLIC_CONFIG.networks.baseSepolia.contracts)

/** Base Mainnet (Production) - Chain ID: 8453 */
export const BASE_MAINNET_CONTRACTS: ERC8004ContractAddresses =
  toERC8004Contracts(PUBLIC_CONFIG.networks.base.contracts)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get contract addresses for the specified chain ID
 */
export function getERC8004ContractAddresses(
  chainId: number,
): ERC8004ContractAddresses {
  switch (chainId) {
    case 31337:
      return LOCAL_CONTRACTS
    case 84532:
      return BASE_SEPOLIA_CONTRACTS
    case 8453:
      return BASE_MAINNET_CONTRACTS
    default:
      return BASE_SEPOLIA_CONTRACTS
  }
}

/**
 * Check if contracts are deployed on the given chain
 */
export function areERC8004ContractsDeployed(chainId: number): boolean {
  return checkContractsDeployed(chainId)
}

export type { CoreContractAddresses }

/**
 * Get contract addresses for the current environment
 * Compatibility shim for @jejunetwork/contracts imports
 */
export function getContractAddresses(): ERC8004ContractAddresses {
  // Default to local chain ID (31337)
  // Can be overridden at build time via setDefaultChainId
  const chainId = 31337
  return getERC8004ContractAddresses(chainId)
}
