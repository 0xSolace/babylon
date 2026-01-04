/**
 * Chain Definitions for Babylon
 *
 * Static chain configurations. No environment variables.
 * Chain resolution happens in config/index.ts based on public-config.json.
 */

import { type Chain, defineChain } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'

// ============================================================================
// Jeju Network Definitions
// ============================================================================

export const jejuLocalnet = defineChain({
  id: 31337,
  name: 'Jeju Localnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:6546'] },
  },
  testnet: true,
})

export const jejuTestnet = defineChain({
  id: 420690,
  name: 'Jeju Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.jejunetwork.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Jeju Explorer',
      url: 'https://testnet-explorer.jejunetwork.org',
    },
  },
  testnet: true,
})

export const jejuMainnet = defineChain({
  id: 420691,
  name: 'Jeju',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.jejunetwork.org'] },
  },
  blockExplorers: {
    default: { name: 'Jeju Explorer', url: 'https://explorer.jejunetwork.org' },
  },
})

// Local Hardhat chain definition
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
      http: ['http://localhost:6546'],
    },
  },
  testnet: true,
})

// ============================================================================
// Chain Lookup
// ============================================================================

/**
 * All supported chains indexed by ID
 */
export const CHAINS_BY_ID: Record<number, Chain> = {
  [jejuLocalnet.id]: jejuLocalnet,
  [jejuTestnet.id]: jejuTestnet,
  [jejuMainnet.id]: jejuMainnet,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
}

/**
 * Get chain by ID
 */
export function getChainById(chainId: number): Chain | undefined {
  return CHAINS_BY_ID[chainId]
}

/**
 * All supported chains
 */
export const ALL_CHAINS: Chain[] = [
  jejuLocalnet,
  jejuTestnet,
  jejuMainnet,
  base,
  baseSepolia,
  mainnet,
  sepolia,
]

/**
 * Jeju-specific chains
 */
export const JEJU_CHAINS: Chain[] = [jejuLocalnet, jejuTestnet, jejuMainnet]

/**
 * Check if chain ID is a Jeju network
 */
export function isJejuChain(chainId: number): boolean {
  return (
    chainId === jejuLocalnet.id ||
    chainId === jejuTestnet.id ||
    chainId === jejuMainnet.id
  )
}

export { base, baseSepolia, mainnet, sepolia }
