/**
 * Jeju Network Integration Configuration
 *
 * Consolidated configuration for Jeju decentralized infrastructure integration.
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

import {
  getJejuNetwork,
  getNetworkMode,
  isRunningInJeju,
} from './constants/chains';

export type JejuNetworkType = 'localnet' | 'testnet' | 'mainnet';
export type PaymentToken = 'JEJU' | 'ETH' | 'USDC';

export interface JejuNetworkConfig {
  rpcUrl: string;
  computeApiUrl: string;
  storageApiUrl: string;
  ipfsGateway: string;
  explorerUrl: string | null;
  chainId: number;
}

export interface JejuConfig {
  /** Current network */
  network: JejuNetworkType;
  /** Network-specific configuration */
  networkConfig: JejuNetworkConfig;
  /** Wallet address for authenticated operations */
  walletAddress: string | null;
  /** Preferred payment token */
  paymentToken: PaymentToken;
  /** Whether storage integration is enabled */
  storageEnabled: boolean;
  /** Whether compute integration is enabled */
  computeEnabled: boolean;
}

/**
 * Default network configurations
 */
const NETWORK_CONFIGS: Record<JejuNetworkType, JejuNetworkConfig> = {
  localnet: {
    rpcUrl: 'http://127.0.0.1:9545',
    computeApiUrl: 'http://127.0.0.1:5010',
    storageApiUrl: 'http://127.0.0.1:5004',
    ipfsGateway: 'http://127.0.0.1:8080',
    explorerUrl: null,
    chainId: 1337,
  },
  testnet: {
    rpcUrl: 'https://testnet-rpc.jeju.network',
    computeApiUrl: 'https://compute.jeju.network',
    storageApiUrl: 'https://storage.jeju.network',
    ipfsGateway: 'https://ipfs.jeju.network',
    explorerUrl: 'https://testnet-explorer.jeju.network',
    chainId: 420690,
  },
  mainnet: {
    rpcUrl: 'https://rpc.jeju.network',
    computeApiUrl: 'https://compute.jeju.network',
    storageApiUrl: 'https://storage.jeju.network',
    ipfsGateway: 'https://ipfs.jeju.network',
    explorerUrl: 'https://explorer.jeju.network',
    chainId: 420691,
  },
};

/**
 * Check if running in Jeju mode
 */
export function isJejuMode(): boolean {
  return isRunningInJeju();
}

/**
 * Get current Jeju network or null if not in Jeju mode
 */
export function getCurrentJejuNetwork(): JejuNetworkType | null {
  return getJejuNetwork();
}

/**
 * Get current network mode ('jeju' or 'standalone')
 */
export { getNetworkMode };

/**
 * Get complete Jeju configuration
 * Returns null if not running in Jeju mode
 */
export function getJejuConfig(): JejuConfig | null {
  const network = getJejuNetwork();
  if (!network) {
    return null;
  }

  const defaultConfig = NETWORK_CONFIGS[network];

  // Allow environment variable overrides
  const networkConfig: JejuNetworkConfig = {
    rpcUrl: process.env.JEJU_RPC_URL || defaultConfig.rpcUrl,
    computeApiUrl:
      process.env.JEJU_COMPUTE_API_URL || defaultConfig.computeApiUrl,
    storageApiUrl:
      process.env.JEJU_STORAGE_API_URL || defaultConfig.storageApiUrl,
    ipfsGateway: process.env.JEJU_IPFS_GATEWAY || defaultConfig.ipfsGateway,
    explorerUrl: defaultConfig.explorerUrl,
    chainId: defaultConfig.chainId,
  };

  const paymentToken =
    (process.env.JEJU_PAYMENT_TOKEN as PaymentToken) || 'JEJU';
  const storageEnabled = process.env.USE_JEJU_STORAGE !== 'false';
  const computeEnabled = process.env.USE_JEJU_COMPUTE !== 'false';

  return {
    network,
    networkConfig,
    walletAddress: process.env.JEJU_WALLET_ADDRESS || null,
    paymentToken,
    storageEnabled,
    computeEnabled,
  };
}

/**
 * Get RPC URL for current environment
 * Uses Jeju RPC if in Jeju mode, otherwise falls back to chain-specific defaults
 */
export function getRpcUrl(): string {
  const jejuConfig = getJejuConfig();
  if (jejuConfig) {
    return jejuConfig.networkConfig.rpcUrl;
  }

  // Fallback to explicit env or hardhat default
  return (
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    'http://localhost:8545'
  );
}

/**
 * Get chain ID for current environment
 */
export function getChainId(): number {
  const jejuConfig = getJejuConfig();
  if (jejuConfig) {
    return jejuConfig.networkConfig.chainId;
  }

  // Fallback to explicit env or hardhat default
  const envChainId = process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID;
  return envChainId ? parseInt(envChainId, 10) : 31337;
}

/**
 * Get explorer URL for a transaction hash
 */
export function getExplorerTxUrl(txHash: string): string | null {
  const jejuConfig = getJejuConfig();
  if (jejuConfig?.networkConfig.explorerUrl) {
    return `${jejuConfig.networkConfig.explorerUrl}/tx/${txHash}`;
  }
  return null;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string | null {
  const jejuConfig = getJejuConfig();
  if (jejuConfig?.networkConfig.explorerUrl) {
    return `${jejuConfig.networkConfig.explorerUrl}/address/${address}`;
  }
  return null;
}

/**
 * Log current Jeju configuration (for debugging)
 */
export function logJejuConfig(): void {
  const config = getJejuConfig();
  if (!config) {
    console.log('[Jeju] Not running in Jeju mode (standalone)');
    return;
  }

  console.log('[Jeju] Configuration:');
  console.log(`  Network: ${config.network}`);
  console.log(`  Chain ID: ${config.networkConfig.chainId}`);
  console.log(`  RPC URL: ${config.networkConfig.rpcUrl}`);
  console.log(`  Compute API: ${config.networkConfig.computeApiUrl}`);
  console.log(`  Storage API: ${config.networkConfig.storageApiUrl}`);
  console.log(`  IPFS Gateway: ${config.networkConfig.ipfsGateway}`);
  console.log(`  Storage Enabled: ${config.storageEnabled}`);
  console.log(`  Compute Enabled: ${config.computeEnabled}`);
  console.log(`  Payment Token: ${config.paymentToken}`);
  if (config.walletAddress) {
    console.log(`  Wallet: ${config.walletAddress.slice(0, 10)}...`);
  }
}
