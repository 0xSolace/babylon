/**
 * Block Explorer URL Utilities
 *
 * Provides chain-aware URLs for viewing transactions on block explorers.
 * Supports Ethereum mainnet and Sepolia testnet (plus local dev chain).
 */

import { CHAIN } from '@babylon/shared';

/**
 * Get the block explorer URL for a transaction hash based on the current chain.
 *
 * @param txHash - The transaction hash to link to
 * @returns The full URL to view the transaction, or empty string for local chains
 *
 * @example
 * ```typescript
 * const url = getExplorerTxUrl('0x123...');
 * // Returns 'https://etherscan.io/tx/0x123...' on Ethereum mainnet
 * // Returns 'https://sepolia.etherscan.io/tx/0x123...' on Ethereum Sepolia
 * ```
 */
export function getExplorerTxUrl(txHash: string): string {
  const chainId = CHAIN.id;
  switch (chainId) {
    case 1: // Ethereum Mainnet
      return `https://etherscan.io/tx/${txHash}`;
    case 11155111: // Ethereum Sepolia
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    case 31337: // Hardhat/Local - no explorer
      return '';
    default:
      // Fallback to Sepolia for unknown chains
      return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
}

/**
 * Get the base block explorer URL for the current chain (without transaction path).
 *
 * @returns The base URL of the block explorer, or empty string for local chains
 */
export function getExplorerBaseUrl(): string {
  const chainId = CHAIN.id;
  switch (chainId) {
    case 1:
      return 'https://etherscan.io';
    case 11155111:
      return 'https://sepolia.etherscan.io';
    case 31337:
      return '';
    default:
      return 'https://sepolia.etherscan.io';
  }
}

/**
 * Get the display name for the current chain's block explorer.
 *
 * @returns Human-readable name like "BaseScan" or "Etherscan"
 */
export function getExplorerName(): string {
  const chainId = CHAIN.id;
  switch (chainId) {
    case 1:
    case 11155111:
      return 'Etherscan';
    case 31337:
      return 'Local';
    default:
      return 'Etherscan';
  }
}
