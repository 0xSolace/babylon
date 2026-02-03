/**
 * @packageDocumentation
 * @module @babylon/contracts/deployment/addresses
 *
 * Contract Address Loader
 *
 * Loads deployed contract addresses based on the current network environment.
 * Uses canonical config from @babylon/shared/config for network detection.
 *
 * @remarks Network selection is driven by `BABYLON_NETWORK` (mainnet|sepolia)
 * and resolved via @babylon/shared.
 */

import { getCurrentChainId, getCurrentContractAddresses, getCurrentRpcUrl } from '@babylon/shared';
import type { Address } from 'viem';

/**
 * Deployed contract addresses for the current network.
 *
 * Architecture:
 * - Diamond: Upgradeable proxy with facets for prediction markets
 * - BabylonGameOracle: The game IS the prediction oracle (IPredictionOracle)
 * - External contracts query: babylonOracle.getOutcome(sessionId)
 */
export interface DeployedContracts {
  /** Diamond proxy contract address */
  diamond: Address;
  /** Babylon Game Oracle - THE GAME IS THE PREDICTION ORACLE */
  babylonOracle: Address;
  /** Prediction Market Facet address */
  predictionMarketFacet: Address;
  /** ERC-8004 Identity Registry contract address */
  identityRegistry: Address;
  /** ERC-8004 Reputation System contract address */
  reputationSystem: Address;
  /** Chain ID for the network */
  chainId: number;
  /** Network name identifier */
  network: string;
}

/**
 * Get deployed contract addresses for the current network.
 *
 * Automatically detects the network from `BABYLON_NETWORK` (or legacy chain ID env vars)
 * and returns the corresponding contract addresses.
 *
 * @returns Contract addresses for the detected network
 * @throws Error if Base mainnet is detected (not yet deployed)
 *
 * @example
 * ```typescript
 * const addresses = getContractAddresses();
 * console.log(addresses.diamond); // Main Diamond proxy address
 * ```
 */
export function getContractAddresses(): DeployedContracts {
  const chainId = getCurrentChainId();
  const contracts = getCurrentContractAddresses();
  const babylonOracle =
    'babylonOracle' in contracts
      ? (contracts.babylonOracle as Address)
      : (contracts.oracleFacet as Address);

  return {
    diamond: contracts.diamond as Address,
    babylonOracle,
    predictionMarketFacet: contracts.predictionMarketFacet as Address,
    identityRegistry: contracts.identityRegistry as Address,
    reputationSystem: contracts.reputationSystem as Address,
    chainId,
    network:
      chainId === 1 ? 'mainnet' : chainId === 11155111 ? 'sepolia' : 'localnet',
  };
}

/**
 * Check if the current environment is localnet (Hardhat).
 *
 * @returns `true` if chain ID is 31337 (Hardhat local network)
 */
export function isLocalnet(): boolean {
  return getCurrentChainId() === 31337;
}

/**
 * Get the RPC URL for the current network.
 *
 * Returns the appropriate RPC endpoint from canonical config.
 * Supports env var override via NEXT_PUBLIC_RPC_URL.
 *
 * @returns RPC URL string for the current network
 *
 * @example
 * ```typescript
 * const rpcUrl = getRpcUrl();
 * const provider = new ethers.JsonRpcProvider(rpcUrl);
 * ```
 */
export function getRpcUrl(): string {
  return getCurrentRpcUrl();
}
