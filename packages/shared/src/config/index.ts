/**
 * Canonical Public Configuration for Babylon
 *
 * Environment-aware configuration for contract addresses and endpoints.
 * Import this instead of reading from environment variables.
 */

import type { Address } from 'viem';
import { CHAIN_ID, RPC_URL } from '../constants/chains';
import configData from './public-config.json';

// =============================================================================
// Types
// =============================================================================

export interface CoreContractAddresses {
  diamond: Address;
  identityRegistry: Address;
  reputationSystem: Address;
  predictionMarketFacet: Address;
  oracleFacet: Address;
}

export interface LocalContractAddresses extends CoreContractAddresses {
  babylonOracle: Address;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: CoreContractAddresses | LocalContractAddresses;
}

export interface EndpointsConfig {
  apiBaseUrl: string;
  a2aEndpoint: string;
  mcpEndpoint: string;
}

export interface PublicConfig {
  version: string;
  networks: {
    local: NetworkConfig;
    sepolia: NetworkConfig;
    mainnet: NetworkConfig;
  };
  environments: {
    development: { network: string; endpoints: EndpointsConfig };
    staging: { network: string; endpoints: EndpointsConfig };
    production: { network: string; endpoints: EndpointsConfig };
  };
}

// =============================================================================
// Configuration
// =============================================================================

export const PUBLIC_CONFIG = configData as PublicConfig;

type NetworkId = 'local' | 'sepolia' | 'mainnet';
type EnvironmentName = 'development' | 'staging' | 'production';

const CHAIN_ID_TO_NETWORK: Record<number, NetworkId> = {
  31337: 'local',
  11155111: 'sepolia',
  1: 'mainnet',
};

const NETWORK_TO_ENVIRONMENT: Record<NetworkId, EnvironmentName> = {
  local: 'development',
  sepolia: 'staging',
  mainnet: 'production',
};

export function getCurrentChainId(): number {
  return CHAIN_ID;
}

function getCurrentEnvironment(): EnvironmentName {
  const networkId = CHAIN_ID_TO_NETWORK[getCurrentChainId()];
  return networkId ? NETWORK_TO_ENVIRONMENT[networkId] : 'development';
}

function getCurrentNetwork(): NetworkConfig {
  const networkId = CHAIN_ID_TO_NETWORK[getCurrentChainId()] || 'sepolia';
  return PUBLIC_CONFIG.networks[networkId];
}

function getCurrentEndpoints(): EndpointsConfig {
  return PUBLIC_CONFIG.environments[getCurrentEnvironment()].endpoints;
}

// =============================================================================
// Contract Addresses
// =============================================================================

export function getCurrentContractAddresses():
  | CoreContractAddresses
  | LocalContractAddresses {
  return getCurrentNetwork().contracts;
}

export function areContractsDeployed(chainId: number): boolean {
  const networkId = CHAIN_ID_TO_NETWORK[chainId] || 'local';
  const contracts = PUBLIC_CONFIG.networks[networkId].contracts;
  return (
    contracts.identityRegistry !== '0x0000000000000000000000000000000000000000'
  );
}

export const LOCAL_CONTRACT_ADDRESSES = PUBLIC_CONFIG.networks.local
  .contracts as LocalContractAddresses;

export const CURRENT_CONTRACT_ADDRESSES = getCurrentContractAddresses();
export const DIAMOND_ADDRESS = CURRENT_CONTRACT_ADDRESSES.diamond as Address;
export const IDENTITY_REGISTRY_ADDRESS =
  CURRENT_CONTRACT_ADDRESSES.identityRegistry as Address;
export const REPUTATION_SYSTEM_ADDRESS =
  CURRENT_CONTRACT_ADDRESSES.reputationSystem as Address;

/**
 * @deprecated Use `IDENTITY_REGISTRY_ADDRESS` (single-network app).
 */
export const IDENTITY_REGISTRY_BASE_SEPOLIA = PUBLIC_CONFIG.networks.sepolia
  .contracts.identityRegistry as Address;
/**
 * @deprecated Use `REPUTATION_SYSTEM_ADDRESS` (single-network app).
 */
export const REPUTATION_SYSTEM_BASE_SEPOLIA = PUBLIC_CONFIG.networks.sepolia
  .contracts.reputationSystem as Address;

// =============================================================================
// RPC & Endpoints
// =============================================================================

export function getCurrentRpcUrl(): string {
  return RPC_URL || getCurrentNetwork().rpcUrl;
}

export function getAPIBaseUrl(): string {
  return getCurrentEndpoints().apiBaseUrl;
}

export function getA2AEndpoint(): string {
  return getCurrentEndpoints().a2aEndpoint;
}

export function getMCPEndpoint(): string {
  return getCurrentEndpoints().mcpEndpoint;
}
