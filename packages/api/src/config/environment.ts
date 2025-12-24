/**
 * Babylon Environment Configuration
 *
 * Detects whether Babylon is running:
 * 1. Standalone (dev mode) - No blockchain required
 * 2. With Jeju (production mode) - Full on-chain integration
 */

export type BabylonMode = 'dev' | 'production'

export interface BabylonEnvironment {
  mode: BabylonMode

  // Is Jeju available?
  hasJeju: boolean

  // Contract addresses (production only)
  treasuryAddress?: string
  registryAddress?: string
  daoAddress?: string
  revenueAddress?: string
  bblnTokenAddress?: string

  // RPC endpoints
  rpcUrl?: string
  chainId: number

  // Storage configuration
  storageMode: 'local' | 'ipfs' | 'jeju'

  // TEE configuration
  teeMode: 'simulated' | 'phala' | 'local'
}

/**
 * Detect the current environment
 */
export function detectEnvironment(): BabylonEnvironment {
  const isProduction = process.env.NODE_ENV === 'production'
  const hasTreasury = !!process.env.BABYLON_TREASURY_ADDRESS
  const hasRpc = !!process.env.RPC_URL
  const hasJeju = hasTreasury && hasRpc

  const mode: BabylonMode = isProduction && hasJeju ? 'production' : 'dev'

  // Determine chain ID from JEJU_NETWORK or default
  const jejuNetwork = process.env.JEJU_NETWORK ?? 'localnet'
  const chainIds: Record<string, number> = {
    localnet: 31337,
    testnet: 84532, // Base Sepolia
    mainnet: 8453, // Base
  }

  return {
    mode,
    hasJeju,
    treasuryAddress: process.env.BABYLON_TREASURY_ADDRESS,
    registryAddress: process.env.BABYLON_REGISTRY_ADDRESS,
    daoAddress: process.env.BABYLON_DAO_ADDRESS,
    revenueAddress: process.env.BABYLON_REVENUE_ADDRESS,
    bblnTokenAddress: process.env.BBLN_TOKEN_ADDRESS,
    rpcUrl: process.env.RPC_URL,
    chainId: chainIds[jejuNetwork] ?? 31337,
    storageMode: detectStorageMode(mode),
    teeMode: detectTeeMode(mode),
  }
}

function detectStorageMode(mode: BabylonMode): 'local' | 'ipfs' | 'jeju' {
  if (process.env.STORAGE_MODE) {
    return process.env.STORAGE_MODE as 'local' | 'ipfs' | 'jeju'
  }
  if (mode === 'dev') return 'local'
  if (process.env.JEJU_STORAGE_URL) return 'jeju'
  return 'ipfs'
}

function detectTeeMode(mode: BabylonMode): 'simulated' | 'phala' | 'local' {
  if (process.env.TEE_MODE) {
    return process.env.TEE_MODE as 'simulated' | 'phala' | 'local'
  }
  if (mode === 'dev') return 'simulated'
  if (process.env.PHALA_ENDPOINT) return 'phala'
  return 'simulated'
}

/**
 * Environment singleton
 */
let cachedEnv: BabylonEnvironment | null = null

export function getEnvironment(): BabylonEnvironment {
  if (!cachedEnv) {
    cachedEnv = detectEnvironment()
  }
  return cachedEnv
}

/**
 * Reset environment (for testing)
 */
export function resetEnvironment(): void {
  cachedEnv = null
}

/**
 * Log environment configuration
 */
export function logEnvironment(): void {
  const env = getEnvironment()
  console.log(
    '╔══════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║              BABYLON ENVIRONMENT                             ║',
  )
  console.log(
    '╚══════════════════════════════════════════════════════════════╝',
  )
  console.log(`  Mode:         ${env.mode.toUpperCase()}`)
  console.log(
    `  Jeju:         ${env.hasJeju ? '✅ Connected' : '❌ Not connected (standalone)'}`,
  )
  console.log(`  Chain ID:     ${env.chainId}`)
  console.log(`  Storage:      ${env.storageMode}`)
  console.log(`  TEE:          ${env.teeMode}`)
  if (env.daoAddress) {
    console.log(`  DAO:          ${env.daoAddress}`)
  }
  if (env.treasuryAddress) {
    console.log(`  Treasury:     ${env.treasuryAddress}`)
  }
  if (env.revenueAddress) {
    console.log(`  Revenue:      ${env.revenueAddress}`)
  }
  if (env.bblnTokenAddress) {
    console.log(`  BBLN Token:   ${env.bblnTokenAddress}`)
  }
  console.log(
    '════════════════════════════════════════════════════════════════\n',
  )
}
