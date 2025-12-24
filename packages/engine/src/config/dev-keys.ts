/**
 * Development Key Utilities
 *
 * Provides dev-safe key management for local development.
 * In dev mode, uses Hardhat's default account #0.
 * In production, requires proper env vars.
 */

import type { Hex } from 'viem'

// Hardhat account #0 - well-known dev key, NEVER use in production
export const HARDHAT_DEV_PRIVATE_KEY: Hex =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

export const HARDHAT_DEV_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/**
 * Check if we're in development mode
 */
export function isDevMode(): boolean {
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') return false

  // Check chain ID - localnet is 31337
  const chainId = Number(process.env.PUBLIC_CHAIN_ID || 31337)
  if (chainId !== 31337) return false

  return true
}

/**
 * Get deployer private key with dev fallback
 *
 * @throws Error in production if DEPLOYER_PRIVATE_KEY not set
 */
export function getDeployerPrivateKey(): Hex {
  const envKey = process.env.DEPLOYER_PRIVATE_KEY
  if (envKey) return envKey as Hex

  if (isDevMode()) {
    return HARDHAT_DEV_PRIVATE_KEY
  }

  throw new Error('DEPLOYER_PRIVATE_KEY must be set in production')
}

/**
 * Get oracle private key with dev fallback
 *
 * @throws Error in production if ORACLE_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY not set
 */
export function getOraclePrivateKey(): Hex {
  const envKey =
    process.env.ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  if (envKey) return envKey as Hex

  if (isDevMode()) {
    return HARDHAT_DEV_PRIVATE_KEY
  }

  throw new Error(
    'ORACLE_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY must be set in production',
  )
}

/**
 * Get NPC master key with dev fallback
 *
 * @throws Error in production if NPC_MASTER_KEY not set
 */
export function getNPCMasterKey(): Hex {
  const envKey = process.env.NPC_MASTER_KEY
  if (envKey) return envKey as Hex

  if (isDevMode()) {
    return HARDHAT_DEV_PRIVATE_KEY
  }

  throw new Error('NPC_MASTER_KEY must be set in production')
}

/**
 * Check if a private key is available (env or dev fallback)
 * Use this before attempting on-chain operations
 */
export function hasDeployerKey(): boolean {
  return !!process.env.DEPLOYER_PRIVATE_KEY || isDevMode()
}

/**
 * Check if oracle key is available
 */
export function hasOracleKey(): boolean {
  return (
    !!process.env.ORACLE_PRIVATE_KEY ||
    !!process.env.DEPLOYER_PRIVATE_KEY ||
    isDevMode()
  )
}
