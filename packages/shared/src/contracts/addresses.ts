/**
 * Contract Address Configuration
 *
 * ERC-8004 Identity, Reputation, and Prediction Market contract addresses.
 * Supports: localnet (Hardhat), Ethereum Sepolia (testnet), Ethereum Mainnet.
 *
 * @see packages/shared/src/config/default-config.ts for the canonical source
 */

import type { Address } from 'viem';
import {
  type CoreContractAddresses,
  areContractsDeployed as checkContractsDeployed,
  PUBLIC_CONFIG,
} from '../config';

// =============================================================================
// Types
// =============================================================================

/**
 * Contract addresses for ERC-8004 and prediction market operations
 */
export interface ERC8004ContractAddresses {
  identityRegistry: Address;
  reputationSystem: Address;
  diamond: Address;
  predictionMarketFacet: Address;
  oracleFacet: Address;
}

// =============================================================================
// Network Contract Exports
// =============================================================================

/** Localnet (Hardhat) - Chain ID: 31337 */
export const LOCAL_CONTRACTS: ERC8004ContractAddresses = {
  identityRegistry: PUBLIC_CONFIG.networks.local.contracts
    .identityRegistry as Address,
  reputationSystem: PUBLIC_CONFIG.networks.local.contracts
    .reputationSystem as Address,
  diamond: PUBLIC_CONFIG.networks.local.contracts.diamond as Address,
  predictionMarketFacet: PUBLIC_CONFIG.networks.local.contracts
    .predictionMarketFacet as Address,
  oracleFacet: PUBLIC_CONFIG.networks.local.contracts.oracleFacet as Address,
};

/** Ethereum Sepolia (Testnet) - Chain ID: 11155111 */
export const SEPOLIA_CONTRACTS: ERC8004ContractAddresses = {
  identityRegistry: PUBLIC_CONFIG.networks.sepolia.contracts
    .identityRegistry as Address,
  reputationSystem: PUBLIC_CONFIG.networks.sepolia.contracts
    .reputationSystem as Address,
  diamond: PUBLIC_CONFIG.networks.sepolia.contracts.diamond as Address,
  predictionMarketFacet: PUBLIC_CONFIG.networks.sepolia.contracts
    .predictionMarketFacet as Address,
  oracleFacet: PUBLIC_CONFIG.networks.sepolia.contracts.oracleFacet as Address,
};

/** Ethereum Mainnet (Production) - Chain ID: 1 */
export const MAINNET_CONTRACTS: ERC8004ContractAddresses = {
  identityRegistry: PUBLIC_CONFIG.networks.mainnet.contracts
    .identityRegistry as Address,
  reputationSystem: PUBLIC_CONFIG.networks.mainnet.contracts
    .reputationSystem as Address,
  diamond: PUBLIC_CONFIG.networks.mainnet.contracts.diamond as Address,
  predictionMarketFacet: PUBLIC_CONFIG.networks.mainnet.contracts
    .predictionMarketFacet as Address,
  oracleFacet: PUBLIC_CONFIG.networks.mainnet.contracts.oracleFacet as Address,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get contract addresses for the specified chain ID
 */
export function getERC8004ContractAddresses(
  chainId: number
): ERC8004ContractAddresses {
  switch (chainId) {
    case 31337:
      return LOCAL_CONTRACTS;
    case 11155111:
      return SEPOLIA_CONTRACTS;
    case 1:
      return MAINNET_CONTRACTS;
    default:
      return SEPOLIA_CONTRACTS;
  }
}

/**
 * Check if contracts are deployed on the given chain
 */
export function areERC8004ContractsDeployed(chainId: number): boolean {
  return checkContractsDeployed(chainId);
}

export { CoreContractAddresses };
