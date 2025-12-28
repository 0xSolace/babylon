/**
 * Deployment Configuration Manager
 *
 * Manages deployment configuration stored in deployment-config.json.
 * Provides idempotent access to deployed contract addresses and network config.
 * All addresses are stored in config files, NOT environment variables.
 *
 * Browser-safe: Uses static import of JSON config for reads
 * Server-side: Dynamic writes use Node.js fs APIs (only available in server context)
 */

import type { Address } from 'viem'
import { isAddress } from 'viem'
import deploymentConfigData from './deployment-config.json'

// =============================================================================
// TYPES
// =============================================================================

export type NetworkName = 'localnet' | 'testnet' | 'mainnet'

export interface BBLNContracts {
  token: Address | null
  presale: Address | null
  xlpRewardPool: Address | null
}

export interface DAOContracts {
  governor: Address | null
  timelock: Address | null
  treasury: Address | null
}

export interface GameContracts {
  diamond: Address | null
  identityRegistry: Address | null
  reputationSystem: Address | null
  predictionMarketFacet: Address | null
  oracleFacet: Address | null
  gameOracle?: Address | null
}

export interface LiquidityContracts {
  xlpV2Factory: Address | null
  xlpRouter: Address | null
  lpLocker: Address | null
  feeDistributor: Address | null
  ethBblnPair: Address | null
  jejuBblnPair: Address | null
}

export interface NetworkContracts {
  bbln: BBLNContracts
  dao: DAOContracts
  game: GameContracts
  liquidity: LiquidityContracts
}

export interface LiquidityConfig {
  ethBblnInitialEth: string
  ethBblnInitialBbln: string
  jejuBblnInitialJeju: string
  jejuBblnInitialBbln: string
  lpLockDurationDays: number
  lpLockPercentage: number
}

export interface NPCFundingConfig {
  enabled: boolean
  sTierAllocation: string
  aTierAllocation: string
  bTierAllocation: string
  cTierAllocation: string
}

export interface TokenomicsConfig {
  initialUserAirdrop: string
  signupBonus: string
  profileCompletionBonus: string
  referralBonus: string
  socialLinkBonus: string
}

export interface NetworkDeploymentConfig {
  chainId: number
  name: string
  rpcUrl: string
  initialized: boolean
  deployedAt: string | null
  contracts: NetworkContracts
  liquidity: LiquidityConfig
  npcFunding: NPCFundingConfig
  tokenomics: TokenomicsConfig
}

export interface DeploymentConfig {
  version: string
  description: string
  localnet: NetworkDeploymentConfig
  testnet: NetworkDeploymentConfig
  mainnet: NetworkDeploymentConfig
}

// =============================================================================
// CONFIG LOADER (Browser-Safe)
// =============================================================================

// Parse the JSON import into typed config (cached from static import)
let cachedConfig: DeploymentConfig = parseDeploymentConfig(deploymentConfigData)

/**
 * Parse raw JSON config into typed DeploymentConfig
 */
function parseDeploymentConfig(
  raw: typeof deploymentConfigData,
): DeploymentConfig {
  return {
    version: raw.version,
    description: raw.description,
    localnet: parseNetworkConfig(raw.localnet),
    testnet: parseNetworkConfig(raw.testnet),
    mainnet: parseNetworkConfig(raw.mainnet),
  }
}

function parseNetworkConfig(
  raw: typeof deploymentConfigData.localnet,
): NetworkDeploymentConfig {
  return {
    chainId: raw.chainId,
    name: raw.name,
    rpcUrl: raw.rpcUrl,
    initialized: raw.initialized,
    deployedAt: raw.deployedAt,
    contracts: {
      bbln: {
        token: raw.contracts.bbln.token as Address | null,
        presale: raw.contracts.bbln.presale as Address | null,
        xlpRewardPool: raw.contracts.bbln.xlpRewardPool as Address | null,
      },
      dao: {
        governor: raw.contracts.dao.governor as Address | null,
        timelock: raw.contracts.dao.timelock as Address | null,
        treasury: raw.contracts.dao.treasury as Address | null,
      },
      game: {
        diamond: raw.contracts.game.diamond as Address | null,
        identityRegistry: raw.contracts.game.identityRegistry as Address | null,
        reputationSystem: raw.contracts.game.reputationSystem as Address | null,
        predictionMarketFacet: raw.contracts.game
          .predictionMarketFacet as Address | null,
        oracleFacet: raw.contracts.game.oracleFacet as Address | null,
        gameOracle:
          'gameOracle' in raw.contracts.game
            ? (raw.contracts.game.gameOracle as Address | null)
            : null,
      },
      liquidity: {
        xlpV2Factory: raw.contracts.liquidity.xlpV2Factory as Address | null,
        xlpRouter: raw.contracts.liquidity.xlpRouter as Address | null,
        lpLocker: raw.contracts.liquidity.lpLocker as Address | null,
        feeDistributor: raw.contracts.liquidity
          .feeDistributor as Address | null,
        ethBblnPair: raw.contracts.liquidity.ethBblnPair as Address | null,
        jejuBblnPair: raw.contracts.liquidity.jejuBblnPair as Address | null,
      },
    },
    liquidity: raw.liquidity,
    npcFunding: raw.npcFunding,
    tokenomics: raw.tokenomics,
  }
}

/**
 * Load deployment config (returns cached config from static import)
 * Browser-safe: No filesystem access needed
 */
export function loadDeploymentConfig(): DeploymentConfig {
  return cachedConfig
}

/**
 * Save deployment config to JSON file
 * Server-side only: Uses dynamic import of node:fs
 */
export async function saveDeploymentConfig(
  config: DeploymentConfig,
): Promise<void> {
  // Dynamic import for server-side only
  const { writeFileSync } = await import('node:fs')
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const configPath = join(__dirname, 'deployment-config.json')

  writeFileSync(configPath, JSON.stringify(config, null, 2))
  cachedConfig = config
}

/**
 * Clear config cache (useful for tests or after file changes)
 */
export function clearConfigCache(): void {
  cachedConfig = parseDeploymentConfig(deploymentConfigData)
}

// =============================================================================
// GETTERS
// =============================================================================

/**
 * Get network deployment config
 */
export function getNetworkConfig(
  network: NetworkName,
): NetworkDeploymentConfig {
  const config = loadDeploymentConfig()
  return config[network]
}

/**
 * Get BBLN contract addresses for network
 */
export function getBBLNContracts(network: NetworkName): BBLNContracts {
  return getNetworkConfig(network).contracts.bbln
}

/**
 * Get DAO contract addresses for network
 */
export function getDAOContracts(network: NetworkName): DAOContracts {
  return getNetworkConfig(network).contracts.dao
}

/**
 * Get game contract addresses for network
 */
export function getGameContracts(network: NetworkName): GameContracts {
  return getNetworkConfig(network).contracts.game
}

/**
 * Get liquidity contract addresses for network
 */
export function getLiquidityContracts(
  network: NetworkName,
): LiquidityContracts {
  return getNetworkConfig(network).contracts.liquidity
}

/**
 * Get liquidity configuration for network
 */
export function getLiquidityConfig(network: NetworkName): LiquidityConfig {
  return getNetworkConfig(network).liquidity
}

/**
 * Get NPC funding configuration for network
 */
export function getNPCFundingConfig(network: NetworkName): NPCFundingConfig {
  return getNetworkConfig(network).npcFunding
}

/**
 * Get tokenomics configuration for network
 */
export function getTokenomicsConfig(network: NetworkName): TokenomicsConfig {
  return getNetworkConfig(network).tokenomics
}

/**
 * Check if network is fully initialized with all contracts
 */
export function isNetworkInitialized(network: NetworkName): boolean {
  const config = getNetworkConfig(network)
  return config.initialized && config.contracts.bbln.token !== null
}

/**
 * Check if BBLN token is deployed on network
 */
export function isBBLNDeployed(network: NetworkName): boolean {
  const bbln = getBBLNContracts(network)
  return bbln.token !== null && isAddress(bbln.token)
}

/**
 * Check if DAO is deployed on network
 */
export function isDAODeployed(network: NetworkName): boolean {
  const dao = getDAOContracts(network)
  return dao.governor !== null && isAddress(dao.governor)
}

/**
 * Check if liquidity pools are set up on network
 */
export function isLiquiditySetup(network: NetworkName): boolean {
  const liq = getLiquidityContracts(network)
  return liq.ethBblnPair !== null && isAddress(liq.ethBblnPair)
}

// =============================================================================
// SETTERS (for deployment scripts - server-side only)
// =============================================================================

/**
 * Update BBLN contract addresses
 * Server-side only: Writes to config file
 */
export async function setBBLNContracts(
  network: NetworkName,
  contracts: Partial<BBLNContracts>,
): Promise<void> {
  const config = loadDeploymentConfig()
  config[network].contracts.bbln = {
    ...config[network].contracts.bbln,
    ...contracts,
  }
  await saveDeploymentConfig(config)
}

/**
 * Update DAO contract addresses
 * Server-side only: Writes to config file
 */
export async function setDAOContracts(
  network: NetworkName,
  contracts: Partial<DAOContracts>,
): Promise<void> {
  const config = loadDeploymentConfig()
  config[network].contracts.dao = {
    ...config[network].contracts.dao,
    ...contracts,
  }
  await saveDeploymentConfig(config)
}

/**
 * Update game contract addresses
 * Server-side only: Writes to config file
 */
export async function setGameContracts(
  network: NetworkName,
  contracts: Partial<GameContracts>,
): Promise<void> {
  const config = loadDeploymentConfig()
  config[network].contracts.game = {
    ...config[network].contracts.game,
    ...contracts,
  }
  await saveDeploymentConfig(config)
}

/**
 * Update liquidity contract addresses
 * Server-side only: Writes to config file
 */
export async function setLiquidityContracts(
  network: NetworkName,
  contracts: Partial<LiquidityContracts>,
): Promise<void> {
  const config = loadDeploymentConfig()
  config[network].contracts.liquidity = {
    ...config[network].contracts.liquidity,
    ...contracts,
  }
  await saveDeploymentConfig(config)
}

/**
 * Mark network as initialized
 * Server-side only: Writes to config file
 */
export async function markNetworkInitialized(
  network: NetworkName,
): Promise<void> {
  const config = loadDeploymentConfig()
  config[network].initialized = true
  config[network].deployedAt = new Date().toISOString()
  await saveDeploymentConfig(config)
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get current network from environment or default to localnet
 */
export function getCurrentNetwork(): NetworkName {
  const env = process.env.JEJU_NETWORK || process.env.NETWORK || 'localnet'
  if (env === 'local' || env === 'localnet' || env === 'development') {
    return 'localnet'
  }
  if (env === 'testnet' || env === 'staging') {
    return 'testnet'
  }
  if (env === 'mainnet' || env === 'production') {
    return 'mainnet'
  }
  return 'localnet'
}

/**
 * Get BBLN token address for current network
 */
export function getBBLNTokenAddress(): Address | null {
  return getBBLNContracts(getCurrentNetwork()).token
}

/**
 * Get DAO treasury address for current network
 */
export function getDAOTreasuryAddress(): Address | null {
  return getDAOContracts(getCurrentNetwork()).treasury
}

/**
 * Convert network name to chain ID
 */
export function networkToChainId(network: NetworkName): number {
  const config = getNetworkConfig(network)
  return config.chainId
}

/**
 * Convert chain ID to network name
 */
export function chainIdToNetwork(chainId: number): NetworkName {
  const config = loadDeploymentConfig()
  if (chainId === config.localnet.chainId) return 'localnet'
  if (chainId === config.testnet.chainId) return 'testnet'
  if (chainId === config.mainnet.chainId) return 'mainnet'
  return 'localnet'
}
