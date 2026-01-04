/**
 * Babylon Configuration Helper
 *
 * Bridges @jejunetwork/config and Babylon-specific config.
 * Provides a unified interface for accessing public configuration.
 *
 * Private secrets (private keys, API keys) should still use process.env directly.
 */

import {
  type ContractCategoryName,
  getContract,
  getCurrentNetwork,
  getDWSComputeUrl,
  getDWSUrl,
  getIpfsApiUrl,
  getIpfsGatewayUrl,
  getChainId as getJejuChainId,
  getRpcUrl as getJejuRpcUrl,
  getKMSUrl,
  getServicesConfig,
  getServiceUrl,
  getSQLitUrl,
  type NetworkType,
} from '@jejunetwork/config'
import {
  type EnvironmentName,
  getFarcasterApiUrl as getBabylonFarcasterApiUrl,
  getFarcasterHubUrl as getBabylonFarcasterHubUrl,
  getCurrentRpcUrl as getBabylonRpcUrl,
  getCurrentContractAddresses,
  getCurrentEnvironment,
} from './index'

/**
 * Get RPC URL for current network
 * Uses Jeju config first, falls back to Babylon config
 */
export function getRpcUrl(network?: NetworkType): string {
  const jejuUrl = getJejuRpcUrl(network)
  if (jejuUrl && jejuUrl !== '') {
    return jejuUrl
  }
  return getBabylonRpcUrl()
}

/**
 * Get DWS endpoint URL
 */
export function getDWSEndpoint(network?: NetworkType): string {
  return getDWSUrl(network)
}

/**
 * Get SQLit block producer endpoint
 */
export function getSQLitEndpoint(network?: NetworkType): string {
  return getSQLitUrl(network)
}

/**
 * Get KMS endpoint URL
 */
export function getKMSEndpoint(network?: NetworkType): string {
  return getKMSUrl(network)
}

/**
 * Get Storage service URL
 */
export function getStorageServiceUrl(network?: NetworkType): string {
  return getIpfsApiUrl(network)
}

/**
 * Get IPFS Gateway URL
 */
export function getIPFSGatewayUrl(network?: NetworkType): string {
  return getIpfsGatewayUrl(network)
}

/**
 * Get Jeju Compute endpoint for LLM inference
 * Falls back to DWS endpoint if compute-specific endpoint not available
 */
export function getJejuComputeEndpoint(network?: NetworkType): string {
  // Check for explicit override first
  if (typeof process !== 'undefined' && process.env.JEJU_COMPUTE_ENDPOINT) {
    return process.env.JEJU_COMPUTE_ENDPOINT
  }

  // Try to get compute-specific endpoint from config
  try {
    const computeUrl = getDWSComputeUrl(network)
    if (computeUrl && computeUrl !== '') {
      return computeUrl
    }
  } catch {
    // Fall through to DWS endpoint
  }

  // Fall back to DWS endpoint
  const dwsUrl = getDWSUrl(network)
  if (dwsUrl && dwsUrl !== '') {
    return dwsUrl
  }

  // Final fallback based on network
  const net = network ?? getCurrentNetwork()
  if (net === 'mainnet') {
    return 'https://compute.jejunetwork.org'
  }
  if (net === 'testnet') {
    return 'https://compute.testnet.jejunetwork.org'
  }

  // Localnet default
  const port =
    (typeof process !== 'undefined'
      ? process.env.JEJU_COMPUTE_PORT
      : undefined) ?? '5010'
  return `http://localhost:${port}`
}

/**
 * Get Gateway URL
 */
export function getGatewayUrl(network?: NetworkType): string {
  return getServiceUrl('gateway', 'ui', network)
}

/**
 * Get Gateway API URL
 */
export function getGatewayApiUrl(network?: NetworkType): string {
  return getServiceUrl('gateway', 'api', network)
}

/**
 * Get Farcaster Hub URL
 * Uses Babylon config (which uses public-config.json)
 */
export function getFarcasterHubUrl(): string {
  return getBabylonFarcasterHubUrl()
}

/**
 * Get Farcaster API URL
 */
export function getFarcasterApiUrl(): string {
  return getBabylonFarcasterApiUrl()
}

/**
 * Get current network name
 */
export function getNetworkName(): NetworkType {
  return getCurrentNetwork()
}

/**
 * Get current environment name
 */
export function getEnvironmentName(): EnvironmentName {
  return getCurrentEnvironment()
}

/**
 * Get contract address
 * Tries Jeju config first, then Babylon config
 */
export function getContractAddress(
  category: string,
  name: string,
  network?: NetworkType,
): string {
  try {
    return getContract(category as ContractCategoryName, name, network)
  } catch {
    // Fallback to Babylon contracts
    const contracts = getCurrentContractAddresses()
    const contractMap: Record<string, Record<string, string>> = {
      babylon: {
        diamond: contracts.diamond,
        identityRegistry: contracts.identityRegistry,
        reputationSystem: contracts.reputationSystem,
        predictionMarketFacet: contracts.predictionMarketFacet,
        oracleFacet: contracts.oracleFacet,
        ...('gameOracle' in contracts
          ? { gameOracle: contracts.gameOracle }
          : {}),
      },
    }
    return contractMap[category]?.[name] ?? ''
  }
}

/**
 * Get chain ID for current network
 */
export function getChainId(network?: NetworkType): number {
  return getJejuChainId(network)
}

/**
 * Get all service URLs for current network
 */
export function getServiceUrls(network?: NetworkType) {
  const services = getServicesConfig(network)
  return {
    rpc: services.rpc.l2,
    ws: services.rpc.ws,
    sqlit: services.sqlit.blockProducer,
    dws: services.dws.api,
    kms: services.kms.api,
    storage: services.storage.api,
    ipfsGateway: services.storage.ipfsGateway,
    gateway: services.gateway.ui,
    gatewayApi: services.gateway.api,
    indexer: services.indexer.graphql,
  }
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'development' ||
      process.env.DEV_MODE === 'true' ||
      getCurrentNetwork() === 'localnet')
  )
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'production' &&
    getCurrentNetwork() === 'mainnet'
  )
}

/**
 * Get Babylon API port
 * Env override takes precedence, then defaults to 5009
 */
export function getBabylonPort(): number | undefined {
  if (typeof process === 'undefined') return undefined
  const port = process.env.PORT || process.env.BABYLON_API_PORT
  return port ? Number(port) : undefined
}

/**
 * Get Babylon API host
 * Env override takes precedence, then defaults to '0.0.0.0'
 */
export function getBabylonHost(): string | undefined {
  if (typeof process === 'undefined') return undefined
  return process.env.HOST
}

/**
 * Get TEE provider
 * Returns 'tee' or 'simulator' based on environment
 */
export function getTeeProvider(): string {
  if (typeof process === 'undefined') return 'simulator'
  return process.env.TEE_PROVIDER || 'simulator'
}

/**
 * Get JEJU_ROOT address (for token bootstrap)
 * This is a contract address, should come from config
 */
export function getJejuRoot(network?: NetworkType): string {
  try {
    return getContractAddress('governance', 'root', network)
  } catch {
    // Fallback to env var if config not available
    return (
      (typeof process !== 'undefined' ? process.env.JEJU_ROOT : undefined) ?? ''
    )
  }
}

/**
 * Get WETH address
 * This is a token address, should come from config
 */
export function getWethAddress(network?: NetworkType): string {
  try {
    return getContractAddress('tokens', 'weth', network)
  } catch {
    // Fallback to env var if config not available
    return (
      (typeof process !== 'undefined' ? process.env.WETH_ADDRESS : undefined) ??
      ''
    )
  }
}

/**
 * Get BBLN token address
 * This is a token address, should come from config
 */
export function getJejuTokenAddress(network?: NetworkType): string {
  try {
    return getContractAddress('tokens', 'bbln', network)
  } catch {
    // Fallback to env var if config not available
    return (
      (typeof process !== 'undefined'
        ? process.env.JEJU_TOKEN_ADDRESS
        : undefined) ?? ''
    )
  }
}
