/**
 * Consolidated Network Configuration
 *
 * Single source of truth for network configs used across deployment scripts.
 * Eliminates duplication in deploy-token.ts, test-cross-chain.ts, etc.
 */

import type { JejuNetwork } from '@babylon/shared';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { base, baseSepolia, hardhat, sepolia } from 'viem/chains';
import type { DeployedNetwork, SolanaConfig } from '../schemas';

// =============================================================================
// Deployment Network Configs (for deploy scripts)
// =============================================================================

/** @deprecated Use JejuNetwork from @babylon/shared instead */
export type NetworkType = JejuNetwork;

export interface DeploymentNetworkConfig {
  chain: typeof hardhat | typeof baseSepolia | typeof sepolia | typeof base;
  rpcUrl: string;
  isHomeChain: boolean;
}

/**
 * Network configurations for token deployment scripts
 */
export const DEPLOYMENT_CONFIGS: Record<JejuNetwork, DeploymentNetworkConfig> =
  {
    localnet: {
      chain: hardhat,
      rpcUrl: 'http://localhost:8545',
      isHomeChain: true,
    },
    testnet: {
      chain: baseSepolia,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
      isHomeChain: false,
    },
    mainnet: {
      chain: base,
      rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
      isHomeChain: true,
    },
  };

/**
 * Additional testnet configurations (for multi-chain scripts)
 */
export const TESTNET_SEPOLIA_CONFIG: DeploymentNetworkConfig = {
  chain: sepolia,
  rpcUrl:
    process.env.SEPOLIA_RPC_URL ??
    'https://ethereum-sepolia-rpc.publicnode.com',
  isHomeChain: true,
};

// =============================================================================
// Deployed Contract Addresses (for cross-chain and bridge scripts)
// =============================================================================

/**
 * Deployed BBLN token and warp route addresses on EVM testnets
 */
export const DEPLOYED_NETWORKS = {
  baseSepolia: {
    chainId: 84532,
    domainId: 84532,
    token: getAddress('0x3586d05d61523c81d2d79c4e1132ffa1b3bcad5f'),
    warpRoute: getAddress('0x2071a7d3b7e72ed0ee7a60da6d98edaeebdb3d2d'),
    igp: getAddress('0x28B02B97a850872C4D33C3E024fab6499ad96564'),
    mailbox: getAddress('0x6966b0E55883d49BFB24539356a2f8A673E02039'),
    rpc: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
  },
  sepolia: {
    chainId: 11155111,
    domainId: 11155111,
    token: getAddress('0xa8f3b42dfb4cb9c583b487beec75c2d90e9cecab'),
    warpRoute: getAddress('0x5ea72ab480fa99f9bc8a00786faaf0d01fe88eb1'),
    igp: getAddress('0x6f2756380FD49228ae25Aa7F2817993cB74Ecc56'),
    rpc:
      process.env.SEPOLIA_RPC_URL ??
      'https://ethereum-sepolia-rpc.publicnode.com',
  },
} as const satisfies Record<string, DeployedNetwork>;

/**
 * Solana devnet configuration for cross-chain bridging
 */
export const SOLANA_DEVNET: SolanaConfig = {
  mint: 'GXEEEAuq37vT7aQvNCvcoNsE2C1pXhrNt3PsG1pph2hF',
  domainId: 1399811150,
  mailbox: 'E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi',
  igp: '3TJMcAhHRE7JN98URK7s5eeGfmVSvL4GAgegPq5K2nYg',
  rpc: 'https://api.devnet.solana.com',
};

// =============================================================================
// Hyperlane Infrastructure Addresses
// =============================================================================

export const HYPERLANE_TESTNETS = {
  baseSepolia: {
    chainId: 84532,
    domainId: 84532,
    mailbox: '0x6966b0E55883d49BFB24539356a2f8A673E02039' as Address,
    igp: '0x28B02B97a850872C4D33C3E024fab6499ad96564' as Address,
    validatorAnnounce: '0x32E88ba6B2F59D21e26B3C18f6fca1D75a4e7b06' as Address,
    merkleTreeHook: '0x4917a9746A7B6E0A57159cCb7F5a6744247f2d0d' as Address,
  },
  sepolia: {
    chainId: 11155111,
    domainId: 11155111,
    mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766' as Address,
    igp: '0x6f2756380FD49228ae25Aa7F2817993cB74Ecc56' as Address,
    validatorAnnounce: '0xE6105C59480a1B7F3aC2b6ae71739Cd8F8d7E49B' as Address,
    merkleTreeHook: '0x4917a9746A7B6E0A57159cCb7F5a6744247f2d0d' as Address,
  },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get deployment config for a network type
 */
export function getDeploymentConfig(
  network: JejuNetwork
): DeploymentNetworkConfig {
  const config = DEPLOYMENT_CONFIGS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }
  return config;
}

/**
 * Get deployed network info by name
 */
export function getDeployedNetwork(
  name: keyof typeof DEPLOYED_NETWORKS
): DeployedNetwork {
  return DEPLOYED_NETWORKS[name];
}

/**
 * Get RPC URL for a deployed network, with env var override
 */
export function getRpcUrl(network: keyof typeof DEPLOYED_NETWORKS): string {
  return DEPLOYED_NETWORKS[network].rpc;
}

/**
 * Validate network type from CLI argument
 */
export function parseNetworkType(value: string): JejuNetwork {
  if (value === 'localnet' || value === 'testnet' || value === 'mainnet') {
    return value;
  }
  throw new Error(
    `Invalid network: ${value}. Must be localnet, testnet, or mainnet.`
  );
}
