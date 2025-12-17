/**
 * Chain Configuration for Babylon
 *
 * Supports multiple environments:
 * - When running inside Jeju: Uses Jeju localnet/testnet/mainnet
 * - When running standalone: Uses Hardhat/Base Sepolia/Base
 *
 * Environment variables:
 * - JEJU_NETWORK: 'localnet' | 'testnet' | 'mainnet' (indicates running inside Jeju)
 * - NEXT_PUBLIC_CHAIN_ID / CHAIN_ID: Explicit chain ID override
 * - NEXT_PUBLIC_RPC_URL / RPC_URL: Explicit RPC URL override
 */

import { type Chain, defineChain } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

// ============================================================================
// Jeju Network Definitions
// ============================================================================

export const jejuLocalnet = defineChain({
  id: 1337,
  name: 'Jeju Localnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9545'] },
  },
  testnet: true,
});

export const jejuTestnet = defineChain({
  id: 420690,
  name: 'Jeju Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.jeju.network'] },
  },
  blockExplorers: {
    default: {
      name: 'Jeju Explorer',
      url: 'https://testnet-explorer.jeju.network',
    },
  },
  testnet: true,
});

export const jejuMainnet = defineChain({
  id: 420691,
  name: 'Jeju',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.jeju.network'] },
  },
  blockExplorers: {
    default: { name: 'Jeju Explorer', url: 'https://explorer.jeju.network' },
  },
});

// Local Hardhat chain definition (for standalone mode)
export const hardhat = defineChain({
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
  testnet: true,
});

// ============================================================================
// Environment Detection
// ============================================================================

export type JejuNetwork = 'localnet' | 'testnet' | 'mainnet';
export type NetworkMode = 'jeju' | 'standalone';

/**
 * Check if running inside Jeju ecosystem
 * Determined by JEJU_NETWORK env var or Jeju-specific chain ID
 */
export function isRunningInJeju(): boolean {
  const jejuNetwork =
    process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK;
  if (jejuNetwork && ['localnet', 'testnet', 'mainnet'].includes(jejuNetwork)) {
    return true;
  }

  // Also check if chain ID is a Jeju chain
  const chainId = getChainIdFromEnv();
  return (
    chainId === jejuLocalnet.id ||
    chainId === jejuTestnet.id ||
    chainId === jejuMainnet.id
  );
}

/**
 * Get the current Jeju network (if running inside Jeju)
 */
export function getJejuNetwork(): JejuNetwork | null {
  const jejuNetwork =
    process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK;
  if (jejuNetwork && ['localnet', 'testnet', 'mainnet'].includes(jejuNetwork)) {
    return jejuNetwork as JejuNetwork;
  }

  // Infer from chain ID
  const chainId = getChainIdFromEnv();
  if (chainId === jejuLocalnet.id) return 'localnet';
  if (chainId === jejuTestnet.id) return 'testnet';
  if (chainId === jejuMainnet.id) return 'mainnet';

  return null;
}

/**
 * Get the network mode (jeju or standalone)
 */
export function getNetworkMode(): NetworkMode {
  return isRunningInJeju() ? 'jeju' : 'standalone';
}

// ============================================================================
// Chain Resolution
// ============================================================================

/**
 * Get chain ID from environment, supporting both NEXT_PUBLIC_ and plain env vars
 */
function getChainIdFromEnv(): number {
  const chainId =
    process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || '';
  return Number(chainId);
}

/**
 * Get RPC URL from environment, supporting both NEXT_PUBLIC_ and plain env vars
 */
function getRpcUrlFromEnv(): string {
  // Jeju-specific RPC URLs take precedence when in Jeju mode
  if (isRunningInJeju()) {
    const jejuRpc =
      process.env.JEJU_RPC_URL || process.env.NEXT_PUBLIC_JEJU_RPC_URL;
    if (jejuRpc) return jejuRpc.trim();
  }
  return (process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || '').trim();
}

/**
 * Get all supported chains based on network mode
 */
export function getSupportedChains(): Chain[] {
  if (isRunningInJeju()) {
    return [jejuLocalnet, jejuTestnet, jejuMainnet];
  }
  // Standalone: support both Jeju chains (for ERC-8004 compatibility) and Base
  return [jejuTestnet, jejuMainnet, base, baseSepolia, hardhat];
}

const rawChainId = getChainIdFromEnv();

/**
 * Resolve the active chain based on environment
 */
function resolveChain(): Chain {
  // Check Jeju networks first
  if (rawChainId === jejuLocalnet.id) return jejuLocalnet;
  if (rawChainId === jejuTestnet.id) return jejuTestnet;
  if (rawChainId === jejuMainnet.id) return jejuMainnet;

  // Check if running inside Jeju (via JEJU_NETWORK)
  const jejuNetwork = getJejuNetwork();
  if (jejuNetwork) {
    switch (jejuNetwork) {
      case 'localnet':
        return jejuLocalnet;
      case 'testnet':
        return jejuTestnet;
      case 'mainnet':
        return jejuMainnet;
    }
  }

  // Standalone mode: check other chains
  if (rawChainId === hardhat.id) return hardhat;
  if (rawChainId === base.id) return base;
  if (rawChainId === mainnet.id) return mainnet;
  if (rawChainId === sepolia.id) return sepolia;

  // Default behavior
  if (process.env.NODE_ENV === 'development' && !rawChainId) {
    // In development without explicit config, check if Jeju localnet is available
    return isRunningInJeju() ? jejuLocalnet : hardhat;
  }

  // Production default: Jeju testnet if in Jeju, Base Sepolia otherwise
  return isRunningInJeju() ? jejuTestnet : baseSepolia;
}

export const CHAIN = resolveChain();
export const CHAIN_ID = CHAIN.id;

/**
 * Network type based on chain ID
 */
export const NETWORK: 'mainnet' | 'testnet' =
  CHAIN_ID === base.id || CHAIN_ID === mainnet.id || CHAIN_ID === jejuMainnet.id
    ? 'mainnet'
    : 'testnet';

/**
 * Whether we're on a Jeju network
 */
export const IS_JEJU_NETWORK =
  CHAIN_ID === jejuLocalnet.id ||
  CHAIN_ID === jejuTestnet.id ||
  CHAIN_ID === jejuMainnet.id;

const DEFAULT_RPC = CHAIN.rpcUrls?.default?.http?.[0] ?? '';
export const RPC_URL = getRpcUrlFromEnv() || DEFAULT_RPC;

// Re-export chain definitions for direct use
export { base, baseSepolia, mainnet, sepolia };
