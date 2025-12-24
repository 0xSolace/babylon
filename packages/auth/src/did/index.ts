/**
 * Decentralized Identity (DID) Module
 *
 * Provides DID creation, parsing, and validation utilities.
 * Browser-safe implementation without server-side dependencies.
 */

import { isHexAddress } from '@babylon/shared'
import { type Hex, keccak256, toHex } from 'viem'
import type { DID } from '../types/index'

/**
 * Create a DID from a public key.
 * The returned string is validated to ensure it matches the DID format.
 */
export function createDID(publicKey: Hex, network = 'mainnet'): DID {
  const hash = keccak256(publicKey)
  const shortHash = hash.slice(0, 42) // 0x + 40 hex chars
  const did = `did:jeju:${network}:${shortHash}`
  // Runtime validation to ensure format is correct
  if (!validateDID(did)) {
    throw new Error(`Failed to create valid DID from publicKey: ${publicKey}`)
  }
  return did
}

/**
 * Parse a DID string into components
 */
export function parseDID(did: DID): {
  method: 'jeju'
  network: string
  identifier: string
} {
  const parts = did.split(':')

  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== 'jeju') {
    throw new Error(`Invalid DID format: ${did}`)
  }

  return {
    method: 'jeju',
    network: parts[2] ?? 'mainnet',
    identifier: parts[3] ?? '',
  }
}

/**
 * Validate a DID string
 */
export function validateDID(did: string): did is DID {
  if (typeof did !== 'string' || !did || !did.startsWith('did:jeju:')) {
    return false
  }

  if (did.trim() !== did) {
    return false
  }

  const parts = did.split(':')
  if (parts.length !== 4) {
    return false
  }

  const network = parts[2]
  const identifier = parts[3]

  if (!['mainnet', 'testnet', 'localnet'].includes(network ?? '')) {
    return false
  }

  if (!identifier?.startsWith('0x') || identifier.length !== 42) {
    return false
  }

  return true
}

/**
 * Generate a random DID (for testing)
 */
export function generateRandomDID(network = 'localnet'): DID {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const publicKey = toHex(randomBytes)
  return createDID(publicKey, network)
}

/**
 * Check if two DIDs are equal
 */
export function didEquals(a: DID, b: DID): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Get the network from a DID
 */
export function getNetwork(did: DID): string {
  const { network } = parseDID(did)
  return network
}

/**
 * Check if a DID is on mainnet
 */
export function isMainnet(did: DID): boolean {
  return getNetwork(did) === 'mainnet'
}

/**
 * Check if a DID is on testnet
 */
export function isTestnet(did: DID): boolean {
  return getNetwork(did) === 'testnet'
}

/**
 * Check if a DID is on localnet
 */
export function isLocalnet(did: DID): boolean {
  return getNetwork(did) === 'localnet'
}

// ============================================================================
// DIDManager Class
// ============================================================================

export interface DIDManagerConfig {
  network: 'mainnet' | 'testnet' | 'localnet'
}

export interface CreateIdentityResult {
  did: DID
  publicKey: Hex
}

/**
 * DID Manager for creating and managing decentralized identities.
 *
 * Note: Full MPC-based identity creation requires running MPC nodes.
 * In dev mode, uses deterministic key derivation.
 */
export class DIDManager {
  private readonly network: string

  constructor(config: DIDManagerConfig) {
    this.network = config.network
  }

  /**
   * Create a new identity from an auth method.
   * Requires MPC nodes to be running for production use.
   */
  async createIdentity(authMethod: {
    type: string
    address?: string
    signature?: Hex
    message?: string
    timestamp?: number
  }): Promise<CreateIdentityResult> {
    // For wallet auth, derive DID from address
    if (authMethod.type === 'wallet' && authMethod.address) {
      if (!isHexAddress(authMethod.address)) {
        throw new Error(`Invalid wallet address format: ${authMethod.address}`)
      }
      const address = authMethod.address
      const didStr = createDIDFromAddress(address, this.network)
      if (!validateDID(didStr)) {
        throw new Error(`Failed to create valid DID from address: ${address}`)
      }
      return {
        did: didStr,
        // address is already validated as 0x${string} by isHexAddress above
        publicKey: address,
      }
    }

    // For other auth types, generate a deterministic DID
    // In production, this would involve MPC key generation
    const seed = JSON.stringify({
      type: authMethod.type,
      timestamp: authMethod.timestamp ?? Date.now(),
      network: this.network,
    })
    const hash = keccak256(toHex(new TextEncoder().encode(seed)))
    const did = createDID(hash, this.network)

    return {
      did,
      publicKey: hash,
    }
  }

  /**
   * Resolve a DID to its document (requires indexer)
   */
  async resolveDID(_did: DID): Promise<{
    id: DID
    network: string
    identifier: string
  } | null> {
    // In a full implementation, this would query the DID registry
    // For now, just parse the DID
    const parsed = parseDID(_did)
    return {
      id: _did,
      network: parsed.network,
      identifier: parsed.identifier,
    }
  }

  /**
   * Get the configured network
   */
  getNetwork(): string {
    return this.network
  }
}

/**
 * Create DID from address with network
 */
export function createDIDFromAddress(address: string, network: string): string {
  const cleanAddress = address.startsWith('0x')
    ? address.slice(2).toLowerCase()
    : address.toLowerCase()
  return `did:jeju:${network}:0x${cleanAddress}`
}

/**
 * Extract address from DID
 */
export function extractAddressFromDid(did: string): string | null {
  if (!did || !did.startsWith('did:')) {
    return null
  }

  // Handle did:jeju format: did:jeju:network:0xaddress
  const parts = did.split(':')
  if (parts.length >= 4 && parts[1] === 'jeju') {
    return parts[3] ?? null
  }

  // Handle did:pkh format: did:pkh:eip155:chainId:address
  if (parts[1] === 'pkh' && parts.length >= 5) {
    return parts[4] ?? null
  }

  return null
}
