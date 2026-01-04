/**
 * Canonical Public Configuration for Babylon
 *
 * Static configuration from public-config.json.
 * No environment variables in browser builds.
 *
 * Server-side code can use process.env to override defaults.
 */

import type { Address, Chain } from 'viem'
import { isAddress } from 'viem'
import { base, getChainById, hardhat, isJejuChain } from '../constants/chains'
import configData from './public-config.json'

// =============================================================================
// Deployment configuration
// =============================================================================

export * from './deployment'

// =============================================================================
// Types
// =============================================================================

/**
 * Contract addresses as stored in JSON (plain strings)
 */
interface RawContractAddresses {
  diamond: string
  identityRegistry: string
  reputationSystem: string
  predictionMarketFacet: string
  oracleFacet: string
  gameOracle?: string
}

/**
 * Raw network config from JSON
 */
interface RawNetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  contracts: RawContractAddresses
}

/**
 * Raw config structure matching public-config.json
 */
interface RawPublicConfig {
  version: string
  description: string
  external: ExternalConfig
  networks: {
    local: RawNetworkConfig
    jejuTestnet: RawNetworkConfig
    jejuMainnet: RawNetworkConfig
    baseSepolia: RawNetworkConfig
    base: RawNetworkConfig
  }
  environments: {
    localnet: EnvironmentConfig
    testnet: EnvironmentConfig
    mainnet: EnvironmentConfig
  }
}

export interface CoreContractAddresses {
  diamond: Address
  identityRegistry: Address
  reputationSystem: Address
  predictionMarketFacet: Address
  oracleFacet: Address
}

export interface LocalContractAddresses extends CoreContractAddresses {
  gameOracle: Address
}

export interface NetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  contracts: CoreContractAddresses | LocalContractAddresses
}

export interface EndpointsConfig {
  apiBaseUrl: string
  frontendUrl: string
  a2aEndpoint: string
  mcpEndpoint: string
  ipfsGateway: string
}

export interface EnvironmentConfig {
  network: string
  endpoints: EndpointsConfig
}

export interface FarcasterConfig {
  hub: string
  api: string
}

export interface ExternalConfig {
  farcaster: {
    localnet: FarcasterConfig
    testnet: FarcasterConfig
    mainnet: FarcasterConfig
  }
}

export interface PublicConfig {
  version: string
  description: string
  external: ExternalConfig
  networks: {
    local: NetworkConfig
    jejuTestnet: NetworkConfig
    jejuMainnet: NetworkConfig
    baseSepolia: NetworkConfig
    base: NetworkConfig
  }
  environments: {
    localnet: EnvironmentConfig
    testnet: EnvironmentConfig
    mainnet: EnvironmentConfig
  }
}

// =============================================================================
// Address Conversion Helper
// =============================================================================

/**
 * Convert a string to Address, throwing if invalid.
 * Used to properly type addresses from JSON config.
 */
function toAddress(value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`Invalid address in config: ${value}`)
  }
  return value
}

/**
 * Convert raw contract addresses from JSON to typed addresses
 */
function convertContractAddresses(
  raw: RawContractAddresses,
): CoreContractAddresses | LocalContractAddresses {
  const core: CoreContractAddresses = {
    diamond: toAddress(raw.diamond),
    identityRegistry: toAddress(raw.identityRegistry),
    reputationSystem: toAddress(raw.reputationSystem),
    predictionMarketFacet: toAddress(raw.predictionMarketFacet),
    oracleFacet: toAddress(raw.oracleFacet),
  }

  if (raw.gameOracle) {
    return {
      ...core,
      gameOracle: toAddress(raw.gameOracle),
    }
  }

  return core
}

/**
 * Convert raw network config to typed network config
 */
function convertNetworkConfig(raw: RawNetworkConfig): NetworkConfig {
  return {
    chainId: raw.chainId,
    name: raw.name,
    rpcUrl: raw.rpcUrl,
    contracts: convertContractAddresses(raw.contracts),
  }
}

/**
 * Convert raw public config to typed public config
 */
function convertPublicConfig(raw: RawPublicConfig): PublicConfig {
  return {
    version: raw.version,
    description: raw.description,
    external: raw.external,
    networks: {
      local: convertNetworkConfig(raw.networks.local),
      jejuTestnet: convertNetworkConfig(raw.networks.jejuTestnet),
      jejuMainnet: convertNetworkConfig(raw.networks.jejuMainnet),
      baseSepolia: convertNetworkConfig(raw.networks.baseSepolia),
      base: convertNetworkConfig(raw.networks.base),
    },
    environments: raw.environments,
  }
}

// =============================================================================
// Configuration
// =============================================================================

const rawConfig = configData as RawPublicConfig
export const PUBLIC_CONFIG: PublicConfig = convertPublicConfig(rawConfig)

export type NetworkId = 'local' | 'jejuTestnet' | 'jejuMainnet' | 'baseSepolia' | 'base'
export type EnvironmentName = 'localnet' | 'testnet' | 'mainnet'

const CHAIN_ID_TO_NETWORK: Record<number, NetworkId> = {
  31337: 'local',
  420690: 'jejuTestnet',
  420691: 'jejuMainnet',
  84532: 'baseSepolia',
  8453: 'base',
}

const NETWORK_ID_TO_ENVIRONMENT: Record<NetworkId, EnvironmentName> = {
  local: 'localnet',
  jejuTestnet: 'testnet',
  jejuMainnet: 'mainnet',
  baseSepolia: 'testnet',
  base: 'mainnet',
}

const ENVIRONMENT_TO_NETWORK_ID: Record<EnvironmentName, NetworkId> = {
  localnet: 'local',
  testnet: 'jejuTestnet',
  mainnet: 'jejuMainnet',
}

// Default environment - can be overridden at build time
let DEFAULT_ENVIRONMENT: EnvironmentName = 'localnet'
let DEFAULT_CHAIN_ID: number = 31337

/**
 * Set default environment (for build-time configuration)
 */
export function setDefaultEnvironment(env: EnvironmentName): void {
  DEFAULT_ENVIRONMENT = env
  const networkId = ENVIRONMENT_TO_NETWORK_ID[env]
  DEFAULT_CHAIN_ID = PUBLIC_CONFIG.networks[networkId].chainId
}

/**
 * Set default chain ID (for build-time configuration)
 */
export function setDefaultChainId(chainId: number): void {
  DEFAULT_CHAIN_ID = chainId
  const networkId = CHAIN_ID_TO_NETWORK[chainId]
  if (networkId) {
    DEFAULT_ENVIRONMENT = NETWORK_ID_TO_ENVIRONMENT[networkId]
  }
}

/**
 * Get current environment name - defaults to localnet
 */
export function getCurrentEnvironment(): EnvironmentName {
  return DEFAULT_ENVIRONMENT
}

/**
 * Get current chain ID - defaults to 31337 (local)
 */
export function getCurrentChainId(): number {
  return DEFAULT_CHAIN_ID
}

/**
 * Get network configuration for current environment
 */
export function getCurrentNetworkConfig(): NetworkConfig {
  const env = getCurrentEnvironment()
  const networkId = ENVIRONMENT_TO_NETWORK_ID[env]
  return PUBLIC_CONFIG.networks[networkId]
}

/**
 * Get endpoints configuration for current environment
 */
export function getCurrentEndpoints(): EndpointsConfig {
  return PUBLIC_CONFIG.environments[getCurrentEnvironment()].endpoints
}

// =============================================================================
// Contract Addresses
// =============================================================================

export function getCurrentContractAddresses():
  | CoreContractAddresses
  | LocalContractAddresses {
  return getCurrentNetworkConfig().contracts
}

/**
 * Get contract addresses for a specific chain ID
 */
export function getContractAddressesForChain(
  chainId?: number,
): CoreContractAddresses | LocalContractAddresses {
  const targetChainId = chainId ?? getCurrentChainId()
  const networkId = CHAIN_ID_TO_NETWORK[targetChainId] || 'local'
  return PUBLIC_CONFIG.networks[networkId].contracts
}

export function areContractsDeployed(chainId: number): boolean {
  const networkId = CHAIN_ID_TO_NETWORK[chainId] || 'local'
  const contracts = PUBLIC_CONFIG.networks[networkId].contracts
  return (
    contracts.identityRegistry !== '0x0000000000000000000000000000000000000000'
  )
}

/**
 * Check if contracts include gameOracle (local network only)
 */
function isLocalContractAddresses(
  contracts: CoreContractAddresses | LocalContractAddresses,
): contracts is LocalContractAddresses {
  return 'gameOracle' in contracts
}

export const LOCAL_CONTRACT_ADDRESSES: LocalContractAddresses =
  isLocalContractAddresses(PUBLIC_CONFIG.networks.local.contracts)
    ? PUBLIC_CONFIG.networks.local.contracts
    : {
        ...PUBLIC_CONFIG.networks.local.contracts,
        gameOracle: toAddress('0x0000000000000000000000000000000000000000'),
      }

export const DIAMOND_ADDRESS = LOCAL_CONTRACT_ADDRESSES.diamond
export const REPUTATION_SYSTEM_BASE_SEPOLIA =
  PUBLIC_CONFIG.networks.baseSepolia.contracts.reputationSystem
export const IDENTITY_REGISTRY_BASE_SEPOLIA =
  PUBLIC_CONFIG.networks.baseSepolia.contracts.identityRegistry

// =============================================================================
// RPC & Endpoints
// =============================================================================

export function getCurrentRpcUrl(): string {
  return getCurrentNetworkConfig().rpcUrl
}

export function getAPIBaseUrl(): string {
  return getCurrentEndpoints().apiBaseUrl
}

export function getFrontendUrl(): string {
  return getCurrentEndpoints().frontendUrl
}

export function getA2AEndpoint(): string {
  return getCurrentEndpoints().a2aEndpoint
}

export function getMCPEndpoint(): string {
  return getCurrentEndpoints().mcpEndpoint
}

export function getIpfsGateway(): string {
  return getCurrentEndpoints().ipfsGateway
}

// =============================================================================
// Farcaster Configuration
// =============================================================================

/**
 * Get Farcaster hub URL for current environment
 * Config-first: uses public-config.json, no env vars in browser
 */
export function getFarcasterHubUrl(): string {
  const env = getCurrentEnvironment()
  return PUBLIC_CONFIG.external.farcaster[env].hub
}

/**
 * Get Farcaster API URL (Neynar) for current environment
 */
export function getFarcasterApiUrl(): string {
  const env = getCurrentEnvironment()
  return PUBLIC_CONFIG.external.farcaster[env].api
}

/**
 * Get full Farcaster config for current environment
 */
export function getFarcasterConfig(): FarcasterConfig {
  const env = getCurrentEnvironment()
  return PUBLIC_CONFIG.external.farcaster[env]
}

// =============================================================================
// Chain Exports (dynamic getters for correct environment resolution)
// =============================================================================

/**
 * Current chain ID based on configuration
 * Note: Use getCurrentChainId() directly for up-to-date value after setDefaultEnvironment()
 * @deprecated Use getCurrentChainId() instead to get current value
 */
export const CHAIN_ID = getCurrentChainId()

/**
 * Get current chain object based on configuration
 * This is a getter function to ensure correct value after setDefaultEnvironment()
 */
export function getChain(): Chain {
  return getChainById(getCurrentChainId()) ?? hardhat
}

/**
 * Current chain object based on configuration
 * Note: For backwards compatibility - use getChain() for dynamic resolution
 * @deprecated Use getChain() instead
 */
export const CHAIN: Chain = getChainById(CHAIN_ID) ?? hardhat

/**
 * Current RPC URL based on configuration
 */
export const RPC_URL = getCurrentRpcUrl()

/**
 * Network type based on chain ID
 */
export const NETWORK: 'mainnet' | 'testnet' =
  CHAIN_ID === base.id || CHAIN_ID === 8453 ? 'mainnet' : 'testnet'

/**
 * Whether we're on a Jeju network
 */
export const IS_JEJU_NETWORK = isJejuChain(CHAIN_ID)

// =============================================================================
// Babylon config helper
// =============================================================================

export * from './babylon-config'
