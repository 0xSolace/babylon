/**
 * Jeju Network Integration Configuration
 *
 * When JEJU_NETWORK is set, Babylon uses Jeju's:
 * - Decentralized compute marketplace for LLM inference
 * - Decentralized storage via IPFS/Arweave
 * - On-chain settlement and payments
 *
 * Environment Variables:
 * - JEJU_NETWORK: 'localnet' | 'testnet' | 'mainnet'
 * - JEJU_RPC_URL: Override RPC endpoint
 * - JEJU_COMPUTE_API_URL: Override compute marketplace API
 * - JEJU_STORAGE_API_URL: Override storage API
 * - JEJU_IPFS_GATEWAY: Override IPFS gateway
 * - JEJU_WALLET_ADDRESS: Wallet for authenticated operations
 * - JEJU_PAYMENT_TOKEN: Preferred payment token ('JEJU' | 'ETH' | 'USDC')
 * - USE_JEJU_STORAGE: 'true' | 'false' - Force enable/disable Jeju storage
 *
 * @example
 * ```typescript
 * import { getJejuConfig, isJejuMode } from '@babylon/shared';
 *
 * if (isJejuMode()) {
 *   const config = getJejuConfig();
 *   console.log(`Using Jeju ${config.network} network`);
 * }
 * ```
 */

import { jejuLocalnet, jejuMainnet, jejuTestnet } from './constants/chains'

export type JejuNetworkType = 'localnet' | 'testnet' | 'mainnet'
export type PaymentToken = 'JEJU' | 'ETH' | 'USDC'
export type NetworkMode = 'jeju' | 'standalone'

export interface JejuNetworkConfig {
  rpcUrl: string
  computeApiUrl: string
  storageApiUrl: string
  ipfsGateway: string
  explorerUrl: string | null
  chainId: number
}

export interface JejuConfig {
  /** Current network */
  network: JejuNetworkType
  /** Network-specific configuration */
  networkConfig: JejuNetworkConfig
  /** Wallet address for authenticated operations */
  walletAddress: string | null
  /** Preferred payment token */
  paymentToken: PaymentToken
  /** Whether storage integration is enabled */
  storageEnabled: boolean
  /** Whether compute integration is enabled */
  computeEnabled: boolean
}

// Port configuration defaults
const L2_RPC_PORT = '6546'
const COMPUTE_PORT = '5010'
const STORAGE_PORT = '5004'
const IPFS_GATEWAY_PORT = '8080'

// Default Jeju network configuration - can be overridden at build time
let DEFAULT_JEJU_NETWORK: JejuNetworkType | null = null
let DEFAULT_JEJU_RPC_URL: string | null = null
let DEFAULT_JEJU_COMPUTE_API_URL: string | null = null
let DEFAULT_JEJU_STORAGE_API_URL: string | null = null
let DEFAULT_JEJU_IPFS_GATEWAY: string | null = null
let DEFAULT_JEJU_WALLET_ADDRESS: string | null = null
let DEFAULT_JEJU_PAYMENT_TOKEN: PaymentToken = 'JEJU'
let DEFAULT_USE_JEJU_STORAGE: boolean = true
let DEFAULT_USE_JEJU_COMPUTE: boolean = true

/**
 * Set default Jeju network (for build-time configuration)
 */
export function setDefaultJejuNetwork(network: JejuNetworkType | null): void {
  DEFAULT_JEJU_NETWORK = network
}

/**
 * Set default Jeju RPC URL (for build-time configuration)
 */
export function setDefaultJejuRpcUrl(url: string | null): void {
  DEFAULT_JEJU_RPC_URL = url
}

/**
 * Set default Jeju compute API URL (for build-time configuration)
 */
export function setDefaultJejuComputeApiUrl(url: string | null): void {
  DEFAULT_JEJU_COMPUTE_API_URL = url
}

/**
 * Set default Jeju storage API URL (for build-time configuration)
 */
export function setDefaultJejuStorageApiUrl(url: string | null): void {
  DEFAULT_JEJU_STORAGE_API_URL = url
}

/**
 * Set default Jeju IPFS gateway (for build-time configuration)
 */
export function setDefaultJejuIpfsGateway(url: string | null): void {
  DEFAULT_JEJU_IPFS_GATEWAY = url
}

/**
 * Set default Jeju wallet address (for build-time configuration)
 */
export function setDefaultJejuWalletAddress(address: string | null): void {
  DEFAULT_JEJU_WALLET_ADDRESS = address
}

/**
 * Set default Jeju payment token (for build-time configuration)
 */
export function setDefaultJejuPaymentToken(token: PaymentToken): void {
  DEFAULT_JEJU_PAYMENT_TOKEN = token
}

/**
 * Set default Jeju storage enabled (for build-time configuration)
 */
export function setDefaultUseJejuStorage(enabled: boolean): void {
  DEFAULT_USE_JEJU_STORAGE = enabled
}

/**
 * Set default Jeju compute enabled (for build-time configuration)
 */
export function setDefaultUseJejuCompute(enabled: boolean): void {
  DEFAULT_USE_JEJU_COMPUTE = enabled
}

/**
 * Default network configurations
 */
const NETWORK_CONFIGS: Record<JejuNetworkType, JejuNetworkConfig> = {
  localnet: {
    rpcUrl: `http://127.0.0.1:${L2_RPC_PORT}`,
    computeApiUrl: `http://127.0.0.1:${COMPUTE_PORT}`,
    storageApiUrl: `http://127.0.0.1:${STORAGE_PORT}`,
    ipfsGateway: `http://127.0.0.1:${IPFS_GATEWAY_PORT}`,
    explorerUrl: null,
    chainId: jejuLocalnet.id,
  },
  testnet: {
    rpcUrl: 'https://testnet-rpc.jeju.network',
    computeApiUrl: 'https://compute.jeju.network',
    storageApiUrl: 'https://storage.jeju.network',
    ipfsGateway: 'https://ipfs.jeju.network',
    explorerUrl: 'https://testnet-explorer.jeju.network',
    chainId: jejuTestnet.id,
  },
  mainnet: {
    rpcUrl: 'https://rpc.jeju.network',
    computeApiUrl: 'https://compute.jeju.network',
    storageApiUrl: 'https://storage.jeju.network',
    ipfsGateway: 'https://ipfs.jeju.network',
    explorerUrl: 'https://explorer.jeju.network',
    chainId: jejuMainnet.id,
  },
}

/**
 * Get the current Jeju network - defaults to null (standalone mode)
 */
export function getJejuNetwork(): JejuNetworkType | null {
  return DEFAULT_JEJU_NETWORK
}

/**
 * Check if running inside Jeju ecosystem
 */
export function isRunningInJeju(): boolean {
  return getJejuNetwork() !== null
}

/**
 * Get network mode ('jeju' or 'standalone')
 */
export function getNetworkMode(): NetworkMode {
  return isRunningInJeju() ? 'jeju' : 'standalone'
}

/**
 * Check if running in Jeju mode
 */
export function isJejuMode(): boolean {
  return isRunningInJeju()
}

/**
 * Get current Jeju network or null if not in Jeju mode
 */
export function getCurrentJejuNetwork(): JejuNetworkType | null {
  return getJejuNetwork()
}

/**
 * Get complete Jeju configuration
 * Returns null if not running in Jeju mode
 */
export function getJejuConfig(): JejuConfig | null {
  const network = getJejuNetwork()
  if (!network) {
    return null
  }

  const defaultConfig = NETWORK_CONFIGS[network]

  // Use defaults or overrides set at build time
  const networkConfig: JejuNetworkConfig = {
    rpcUrl: DEFAULT_JEJU_RPC_URL || defaultConfig.rpcUrl,
    computeApiUrl: DEFAULT_JEJU_COMPUTE_API_URL || defaultConfig.computeApiUrl,
    storageApiUrl: DEFAULT_JEJU_STORAGE_API_URL || defaultConfig.storageApiUrl,
    ipfsGateway: DEFAULT_JEJU_IPFS_GATEWAY || defaultConfig.ipfsGateway,
    explorerUrl: defaultConfig.explorerUrl,
    chainId: defaultConfig.chainId,
  }

  return {
    network,
    networkConfig,
    walletAddress: DEFAULT_JEJU_WALLET_ADDRESS,
    paymentToken: DEFAULT_JEJU_PAYMENT_TOKEN,
    storageEnabled: DEFAULT_USE_JEJU_STORAGE,
    computeEnabled: DEFAULT_USE_JEJU_COMPUTE,
  }
}

/**
 * Get RPC URL for current environment
 * Uses Jeju RPC if in Jeju mode, otherwise falls back to hardhat default
 */
export function getRpcUrl(): string {
  const jejuConfig = getJejuConfig()
  if (jejuConfig) {
    return jejuConfig.networkConfig.rpcUrl
  }

  // Fallback to hardhat default
  return 'http://localhost:6545'
}

/**
 * Get chain ID for current environment
 */
export function getChainId(): number {
  const jejuConfig = getJejuConfig()
  if (jejuConfig) {
    return jejuConfig.networkConfig.chainId
  }

  // Fallback to hardhat default
  return 31337
}

/**
 * Get explorer URL for a transaction hash
 */
export function getExplorerTxUrl(txHash: string): string | null {
  const jejuConfig = getJejuConfig()
  if (jejuConfig?.networkConfig.explorerUrl) {
    return `${jejuConfig.networkConfig.explorerUrl}/tx/${txHash}`
  }
  return null
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string | null {
  const jejuConfig = getJejuConfig()
  if (jejuConfig?.networkConfig.explorerUrl) {
    return `${jejuConfig.networkConfig.explorerUrl}/address/${address}`
  }
  return null
}

/**
 * Log current Jeju configuration (for debugging)
 */
export function logJejuConfig(): void {
  const config = getJejuConfig()
  if (!config) {
    console.log('[Jeju] Not running in Jeju mode (standalone)')
    return
  }

  console.log('[Jeju] Configuration:')
  console.log(`  Network: ${config.network}`)
  console.log(`  Chain ID: ${config.networkConfig.chainId}`)
  console.log(`  RPC URL: ${config.networkConfig.rpcUrl}`)
  console.log(`  Compute API: ${config.networkConfig.computeApiUrl}`)
  console.log(`  Storage API: ${config.networkConfig.storageApiUrl}`)
  console.log(`  IPFS Gateway: ${config.networkConfig.ipfsGateway}`)
  console.log(`  Storage Enabled: ${config.storageEnabled}`)
  console.log(`  Compute Enabled: ${config.computeEnabled}`)
  console.log(`  Payment Token: ${config.paymentToken}`)
  if (config.walletAddress) {
    console.log(`  Wallet: ${config.walletAddress.slice(0, 10)}...`)
  }
}
