/**
 * @packageDocumentation
 * @module @babylon/contracts/deployment/addresses
 *
 * Contract Address Loader
 *
 * Loads deployed contract addresses based on the current network environment.
 * Uses canonical config from @babylon/shared/config for network detection.
 *
 * NOTE: Babylon now uses Jeju Network contracts for:
 * - GameOracle: packages/contracts/src/games/GameOracle.sol
 * - IdentityRegistry: packages/contracts/src/registry/IdentityRegistry.sol
 * - BanManager: packages/contracts/src/moderation/BanManager.sol
 *
 * @remarks Base mainnet support will be added when contracts are deployed.
 */

import { getCurrentChainId, getCurrentRpcUrl } from '@babylon/shared';
import type { Address } from 'viem';
import baseSepoliaDeployment from '../../deployments/base-sepolia';
import localDeployment from '../../deployments/local';

/**
 * Deployed contract addresses for the current network.
 *
 * Architecture:
 * - Diamond: Upgradeable proxy with facets for prediction markets
 * - Jeju GameOracle: The game IS the prediction oracle (IPredictionOracle)
 * - External contracts query: gameOracle.getOutcome(sessionId)
 */
export interface DeployedContracts {
  /** Diamond proxy contract address */
  diamond: Address;
  /** Jeju GameOracle - THE GAME IS THE PREDICTION ORACLE */
  gameOracle: Address;
  /** Prediction Market Facet address */
  predictionMarketFacet: Address;
  /** Jeju IdentityRegistry contract address */
  identityRegistry: Address;
  /** Jeju ReputationRegistry contract address */
  reputationSystem: Address;
  /** Jeju BanManager contract address */
  banManager: Address;
  /** Chain ID for the network */
  chainId: number;
  /** Network name identifier */
  network: string;
}

/**
 * Get deployed contract addresses for the current network.
 *
 * Automatically detects the network from `NEXT_PUBLIC_CHAIN_ID` environment variable
 * and returns the corresponding contract addresses.
 *
 * @returns Contract addresses for the detected network
 * @throws Error if Base mainnet is detected (not yet deployed)
 *
 * @example
 * ```typescript
 * const addresses = getContractAddresses();
 * console.log(addresses.diamond); // Main Diamond proxy address
 * console.log(addresses.gameOracle); // Jeju GameOracle address
 * ```
 */
export function getContractAddresses(): DeployedContracts {
  const chainId = getCurrentChainId();

  if (chainId === 31337) {
    const contracts = localDeployment.contracts as Record<string, string>;
    return {
      diamond: contracts.diamond as Address,
      gameOracle: contracts.gameOracle as Address,
      predictionMarketFacet: contracts.predictionMarketFacet as Address,
      identityRegistry: contracts.identityRegistry as Address,
      reputationSystem: contracts.reputationSystem as Address,
      banManager: contracts.banManager as Address,
      chainId: 31337,
      network: 'localnet',
    };
  }

  if (chainId === 84532) {
    const contracts = baseSepoliaDeployment.contracts as Record<string, string>;
    return {
      diamond: contracts.diamond as Address,
      gameOracle: contracts.gameOracle as Address,
      predictionMarketFacet: contracts.predictionMarketFacet as Address,
      identityRegistry: contracts.identityRegistry as Address,
      reputationSystem: contracts.reputationSystem as Address,
      banManager: contracts.banManager as Address,
      chainId: 84532,
      network: 'base-sepolia',
    };
  }

  if (chainId === 8453) {
    throw new Error(
      'Base mainnet contracts are not yet deployed. Use localnet or base-sepolia.'
    );
  }

  // Default to localnet for unknown chains
  const contracts = localDeployment.contracts as Record<string, string>;
  return {
    diamond: contracts.diamond as Address,
    gameOracle: contracts.gameOracle as Address,
    predictionMarketFacet: contracts.predictionMarketFacet as Address,
    identityRegistry: contracts.identityRegistry as Address,
    reputationSystem: contracts.reputationSystem as Address,
    banManager: contracts.banManager as Address,
    chainId: 31337,
    network: 'localnet',
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
