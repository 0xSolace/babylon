/**
 * DID Utilities
 *
 * Helper functions for DID creation and parsing.
 */

import { type Hex, keccak256, toHex } from 'viem';
import type { DID } from '../types/index';

/**
 * Create a DID from a public key
 */
export function createDID(publicKey: Hex, network = 'mainnet'): DID {
  // Take first 20 bytes of keccak256 hash for compactness
  const hash = keccak256(publicKey);
  const shortHash = hash.slice(0, 42); // 0x + 40 hex chars
  return `did:jeju:${network}:${shortHash}` as DID;
}

/**
 * Parse a DID string into components
 */
export function parseDID(did: DID): {
  method: 'jeju';
  network: string;
  identifier: string;
} {
  const parts = did.split(':');

  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== 'jeju') {
    throw new Error(`Invalid DID format: ${did}`);
  }

  return {
    method: 'jeju',
    network: parts[2] ?? 'mainnet',
    identifier: parts[3] ?? '',
  };
}

/**
 * Validate a DID string
 */
export function validateDID(did: string): did is DID {
  if (typeof did !== 'string' || !did || !did.startsWith('did:jeju:')) {
    return false;
  }

  // Check for whitespace
  if (did.trim() !== did) {
    return false;
  }

  const parts = did.split(':');
  if (parts.length !== 4) {
    return false;
  }

  const network = parts[2];
  const identifier = parts[3];

  // Network must be one of the known networks
  if (!['mainnet', 'testnet', 'localnet'].includes(network ?? '')) {
    return false;
  }

  // Identifier must be a valid hex address format
  if (!identifier?.startsWith('0x') || identifier.length !== 42) {
    return false;
  }

  return true;
}

/**
 * Generate a random DID (for testing)
 */
export function generateRandomDID(network = 'localnet'): DID {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = toHex(randomBytes);
  return createDID(publicKey, network);
}

/**
 * Check if two DIDs are equal
 */
export function didEquals(a: DID, b: DID): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Get the network from a DID
 */
export function getNetwork(did: DID): string {
  const { network } = parseDID(did);
  return network;
}

/**
 * Check if a DID is on mainnet
 */
export function isMainnet(did: DID): boolean {
  return getNetwork(did) === 'mainnet';
}

/**
 * Check if a DID is on testnet
 */
export function isTestnet(did: DID): boolean {
  return getNetwork(did) === 'testnet';
}

/**
 * Check if a DID is on localnet
 */
export function isLocalnet(did: DID): boolean {
  return getNetwork(did) === 'localnet';
}
