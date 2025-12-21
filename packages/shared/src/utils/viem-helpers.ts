/**
 * Viem Utility Helpers
 *
 * Common utilities for working with viem - replaces ethers.js patterns.
 * This module provides wallet generation, random bytes, and other helpers
 * that were commonly used from ethers.
 *
 * @packageDocumentation
 */

import type { Chain, PublicClient, WalletClient } from 'viem';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  type Hex,
  http,
  keccak256,
  parseEther,
  parseUnits,
  stringToHex,
  toHex,
  verifyMessage,
  zeroHash,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

/**
 * Generated wallet interface - contains address and private key
 */
export interface GeneratedWallet {
  address: Address;
  privateKey: Hex;
}

/**
 * Generate a random wallet (address + private key)
 * Replaces ethers.Wallet.createRandom()
 */
export function generateRandomWallet(): GeneratedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKey,
  };
}

/**
 * Create an account from a private key
 * Replaces new ethers.Wallet(privateKey)
 */
export function createAccount(privateKey: Hex) {
  return privateKeyToAccount(privateKey);
}

/**
 * Get address from a private key
 */
export function privateKeyToAddress(privateKey: Hex): Address {
  return privateKeyToAccount(privateKey).address;
}

/**
 * Generate random bytes as hex string
 * Replaces ethers.hexlify(ethers.randomBytes(n))
 */
export function randomBytesHex(length: number): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toHex(bytes);
}

/**
 * Generate a random 32-byte salt
 */
export function generateSalt(): Hex {
  return randomBytesHex(32);
}

/**
 * Create a public client for read operations
 * Replaces new ethers.JsonRpcProvider(rpcUrl)
 */
export function createViemPublicClient(
  rpcUrl: string,
  chain?: Chain
): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Create a wallet client for write operations
 * Replaces new ethers.Wallet(privateKey, provider)
 */
export function createViemWalletClient(
  privateKey: Hex,
  rpcUrl: string,
  chain?: Chain
): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Sign a message with a private key
 * Replaces wallet.signMessage()
 */
export async function signMessageWithKey(
  privateKey: Hex,
  message: string
): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

/**
 * Verify a signed message - re-export from viem
 */
export { verifyMessage };

/**
 * Format ETH value from wei - re-export from viem
 */
export { formatEther };

/**
 * Parse ETH value to wei - re-export from viem
 */
export { parseEther };

/**
 * Format units - re-export from viem
 */
export { formatUnits };

/**
 * Parse units - re-export from viem
 */
export { parseUnits };

/**
 * Keccak256 hash - re-export from viem
 */
export { keccak256 };

/**
 * Convert to hex - re-export from viem
 */
export { toHex };

/**
 * Convert string to hex - re-export from viem
 */
export { stringToHex };

/**
 * Zero hash constant (32 zero bytes)
 * Replaces ethers.ZeroHash
 */
export { zeroHash };

/**
 * Zero address constant
 */
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as Address;

// Re-export types
export type { Address, Hex, Chain, PublicClient, WalletClient };
