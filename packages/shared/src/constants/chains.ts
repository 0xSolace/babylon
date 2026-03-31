/**
 * Chain Configuration for Babylon
 *
 * Supports multiple environments: localnet, testnets, and mainnets.
 * Environment variables can be NEXT_PUBLIC_ prefixed (for Next.js) or plain.
 */

import { defineChain } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';
import { getRpcUrlForChainId } from '../config';

// Local Anvil chain definition
const hardhat = defineChain({
  id: 31337,
  name: 'Anvil Local',
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
 * Get chain ID from environment, supporting both NEXT_PUBLIC_ and plain env vars
 */
function getChainIdFromEnv(): number {
  const chainId =
    process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || '';
  return Number(chainId);
}

const rawChainId = getChainIdFromEnv();

const resolveChain = () => {
  if (rawChainId === hardhat.id) return hardhat;
  if (rawChainId === base.id) return base;
  if (rawChainId === mainnet.id) return mainnet;
  if (rawChainId === sepolia.id) return sepolia;

  // Default to local Anvil in development if no chain ID is set
  if (process.env.NODE_ENV === 'development' && !rawChainId) {
    return hardhat;
  }

  return baseSepolia;
};

export const CHAIN = resolveChain();
export const CHAIN_ID = CHAIN.id;
export const NETWORK: 'mainnet' | 'testnet' =
  CHAIN_ID === base.id || CHAIN_ID === mainnet.id ? 'mainnet' : 'testnet';
export const RPC_URL = getRpcUrlForChainId(CHAIN_ID);

// Re-export chain definitions for direct use
export { base, baseSepolia, hardhat, mainnet, sepolia };
