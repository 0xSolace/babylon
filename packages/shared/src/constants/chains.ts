/**
 * Chain Configuration for Babylon
 *
 * Target: two public modes only:
 * - Ethereum Mainnet
 * - Ethereum Sepolia
 *
 * Build-time selection via a single env var: `BABYLON_NETWORK`:
 * - "mainnet" → Ethereum Mainnet
 * - "sepolia" → Ethereum Sepolia
 *
 * Legacy env vars (`NEXT_PUBLIC_CHAIN_ID`, `CHAIN_ID`, etc.) are still accepted
 * as fallbacks to avoid breaking existing flows, but should be removed over time.
 */

import { defineChain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

// Local Hardhat chain definition
const hardhat = defineChain({
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
});

/**
 * Babylon network selector (single env var).
 */
export type BabylonNetwork = 'mainnet' | 'sepolia';

function normalizeNetwork(
  raw: string | undefined
): BabylonNetwork | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'mainnet' || v === 'eth-mainnet' || v === 'ethereum-mainnet') {
    return 'mainnet';
  }
  if (v === 'sepolia' || v === 'testnet' || v === 'eth-sepolia') {
    return 'sepolia';
  }
  return undefined;
}

/**
 * Get chain ID from legacy env vars (fallback only).
 */
function getLegacyChainIdFromEnv(): number {
  const chainId =
    process.env.NEXT_PUBLIC_CHAIN_ID ||
    process.env.CHAIN_ID ||
    process.env.BABYLON_CHAIN_ID ||
    '';
  return Number(chainId);
}

function resolveBabylonChain(): typeof mainnet | typeof sepolia | typeof hardhat {
  const explicitNetwork = normalizeNetwork(process.env.BABYLON_NETWORK);
  if (explicitNetwork === 'mainnet') return mainnet;
  if (explicitNetwork === 'sepolia') return sepolia;

  const legacyChainId = getLegacyChainIdFromEnv();
  if (legacyChainId === hardhat.id) return hardhat;
  if (legacyChainId === mainnet.id) return mainnet;
  if (legacyChainId === sepolia.id) return sepolia;

  // Legacy Base chain IDs: map to the closest intended ETH networks.
  // - Base (8453) was production → Ethereum Mainnet (1)
  // - Base Sepolia (84532) was staging → Ethereum Sepolia (11155111)
  if (legacyChainId === 8453) return mainnet;
  if (legacyChainId === 84532) return sepolia;

  // Default: safest dev default is Sepolia, production defaults to Mainnet.
  if (process.env.NODE_ENV === 'production') return mainnet;
  return sepolia;
}

/**
 * Get RPC URL from environment (optional override).
 *
 * Kept for backward-compat (ex: existing `NEXT_PUBLIC_RPC_URL` usage),
 * but not required when `BABYLON_NETWORK` is set.
 */
function getRpcUrlFromEnv(): string {
  return (
    process.env.BABYLON_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.RPC_URL ||
    ''
  ).trim();
}

export const CHAIN = resolveBabylonChain();
export const CHAIN_ID = CHAIN.id;
export const NETWORK: 'mainnet' | 'testnet' =
  CHAIN_ID === mainnet.id ? 'mainnet' : 'testnet';
const DEFAULT_RPC = CHAIN.rpcUrls?.default?.http?.[0] ?? '';
export const RPC_URL = getRpcUrlFromEnv() || DEFAULT_RPC;

// Re-export chain definitions for direct use
export { hardhat, mainnet, sepolia };
