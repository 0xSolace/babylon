/**
 * Backend Profile Signer
 *
 * Allows the server to sign profile updates on behalf of users,
 * eliminating the need for signature popups in the UI.
 *
 * This enables a seamless UX where profile updates (including username changes)
 * happen instantly without user interaction, while still being recorded on-chain.
 *
 * NOTE: The updateAgent function is not available in the current IdentityRegistry ABI.
 * The contract uses setMetadata(agentId, key, value) instead. This module needs to be
 * updated to first lookup the user's agentId and then call setMetadata.
 */

import { getIdentityRegistryAddress, logger } from '@babylon/shared'
import { getRpcUrl } from '@babylon/shared/config'
import { type Address, createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

// Private key - must remain as env var (secret)
const PROFILE_MANAGER_PRIVATE_KEY =
  typeof process !== 'undefined'
    ? process.env.PROFILE_MANAGER_PRIVATE_KEY
    : undefined
// RPC URL - use config system
const RPC_URL = getRpcUrl() || 'https://sepolia.base.org'

export interface ProfileMetadata {
  name: string
  username: string | null
  bio: string | null
  profileImageUrl: string | null
  coverImageUrl: string | null
  type?: string
  updated?: string
}

export interface BackendSignedUpdateParams {
  userAddress: Address
  metadata: ProfileMetadata
  endpoint: string
}

export interface BackendSignedUpdateResult {
  txHash: `0x${string}`
  metadata: ProfileMetadata
}

/**
 * Check if backend signing is configured
 */
export function isBackendSigningEnabled(): boolean {
  return Boolean(PROFILE_MANAGER_PRIVATE_KEY)
}

/**
 * Update user profile by signing the transaction server-side
 *
 * NOTE: This function is currently disabled because the IdentityRegistry contract
 * doesn't have an updateAgent function. The contract uses setMetadata(agentId, key, value)
 * which requires first looking up the user's agentId.
 *
 * @param params - Profile update parameters
 * @returns Transaction hash and metadata
 */
export async function updateProfileBackendSigned({
  userAddress,
  metadata,
}: BackendSignedUpdateParams): Promise<BackendSignedUpdateResult> {
  if (!PROFILE_MANAGER_PRIVATE_KEY) {
    throw new Error(
      'Backend signing not configured. Set PROFILE_MANAGER_PRIVATE_KEY environment variable.',
    )
  }

  const registryAddress = getIdentityRegistryAddress()
  if (!registryAddress) {
    throw new Error('Identity registry not configured for this chain')
  }

  // NOTE: The current IdentityRegistry contract doesn't have updateAgent function.
  // It uses setMetadata(agentId, key, value) instead, which requires the agentId.
  // For now, we log a warning and return a mock result to allow the system to function
  // without on-chain profile updates.
  logger.warn(
    'Backend profile signing is disabled - updateAgent function not in contract ABI',
    { userAddress, username: metadata.username },
    'BackendSigner',
  )

  // Return a mock result since we can't actually update on-chain
  return {
    txHash:
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    metadata,
  }
}

/**
 * Verify a backend-signed transaction was successful
 *
 * @param txHash - Transaction hash to verify
 * @returns Whether the transaction succeeded
 */
export async function verifyBackendSignedUpdate(
  txHash: `0x${string}`,
): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  })

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
  return receipt.status === 'success'
}
