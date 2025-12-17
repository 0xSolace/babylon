/**
 * Production MPC Configuration for Babylon
 *
 * 5-party MPC with 3-of-5 threshold for production-grade security.
 * Each party runs in a separate TEE enclave.
 *
 * Key Rotation:
 * - Automatic rotation every 30 days
 * - Manual rotation via AI CEO proposal
 * - Old shares invalidated after rotation
 *
 * Party Distribution:
 * - Parties should be geographically distributed
 * - Each party in different cloud provider/region
 * - TEE attestation required for all parties
 */

// ============================================================================
// Types
// ============================================================================

/**
 * MPC Party endpoint configuration
 */
export interface MPCParty {
  id: string;
  endpoint: string;
  publicKey?: string;
}

/**
 * Base MPC Coordinator configuration
 */
export interface MPCCoordinatorConfig {
  /** Number of parties required to reconstruct */
  threshold: number;
  /** Total number of parties */
  totalParties: number;
  /** Timeout for key generation (ms) */
  keyGenerationTimeout?: number;
  /** Timeout for signature operations (ms) */
  signatureTimeout?: number;
}

/**
 * Babylon-specific MPC configuration
 */
export interface BabylonMPCConfig extends MPCCoordinatorConfig {
  /** Party endpoints (TEE enclaves) */
  partyEndpoints: string[];
  /** TEE attestation verification enabled */
  verifyAttestation: boolean;
  /** Key rotation interval (ms) */
  rotationIntervalMs: number;
  /** Max retries for party communication */
  maxRetries: number;
  /** Timeout for signing operations (ms) */
  signingTimeoutMs: number;
}

/**
 * Access control condition for encryption policies
 */
export interface AccessCondition {
  type: 'agent' | 'address' | 'contract' | 'role';
  chainId?: string;
  address?: string;
  agentId?: number;
  role?: string;
  value?: string;
}

/**
 * Access control policy for encrypted data
 */
export interface AccessControlPolicy {
  conditions: AccessCondition[];
  operator: 'and' | 'or';
}

// ============================================================================
// Production Configuration
// ============================================================================

export const PRODUCTION_MPC_CONFIG: BabylonMPCConfig = {
  // Core MPC settings
  threshold: 3,
  totalParties: 5,
  keyGenerationTimeout: 30000,
  signatureTimeout: 10000,

  // Party endpoints (TEE enclaves in Phala)
  partyEndpoints: [
    process.env.MPC_PARTY_1_ENDPOINT ?? 'https://mpc1.babylon.game',
    process.env.MPC_PARTY_2_ENDPOINT ?? 'https://mpc2.babylon.game',
    process.env.MPC_PARTY_3_ENDPOINT ?? 'https://mpc3.babylon.game',
    process.env.MPC_PARTY_4_ENDPOINT ?? 'https://mpc4.babylon.game',
    process.env.MPC_PARTY_5_ENDPOINT ?? 'https://mpc5.babylon.game',
  ],

  // Security settings
  verifyAttestation: process.env.VERIFY_TEE_ATTESTATION !== 'false',
  rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days

  // Communication settings
  maxRetries: 3,
  signingTimeoutMs: 10000,
};

// ============================================================================
// Development Configuration
// ============================================================================

export const DEVELOPMENT_MPC_CONFIG: BabylonMPCConfig = {
  threshold: 2,
  totalParties: 3,
  keyGenerationTimeout: 10000,
  signatureTimeout: 5000,

  // Local party endpoints
  partyEndpoints: [
    process.env.MPC_PARTY_1_ENDPOINT ?? 'http://localhost:8081',
    process.env.MPC_PARTY_2_ENDPOINT ?? 'http://localhost:8082',
    process.env.MPC_PARTY_3_ENDPOINT ?? 'http://localhost:8083',
  ],

  // Relaxed security for development
  verifyAttestation: false,
  rotationIntervalMs: 24 * 60 * 60 * 1000, // 1 day

  // Communication settings
  maxRetries: 1,
  signingTimeoutMs: 5000,
};

// ============================================================================
// Testnet Configuration
// ============================================================================

export const TESTNET_MPC_CONFIG: BabylonMPCConfig = {
  threshold: 2,
  totalParties: 3,
  keyGenerationTimeout: 20000,
  signatureTimeout: 8000,

  // Testnet party endpoints
  partyEndpoints: [
    process.env.MPC_PARTY_1_ENDPOINT ?? 'https://mpc1-testnet.babylon.game',
    process.env.MPC_PARTY_2_ENDPOINT ?? 'https://mpc2-testnet.babylon.game',
    process.env.MPC_PARTY_3_ENDPOINT ?? 'https://mpc3-testnet.babylon.game',
  ],

  // Security settings
  verifyAttestation: process.env.VERIFY_TEE_ATTESTATION !== 'false',
  rotationIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Communication settings
  maxRetries: 2,
  signingTimeoutMs: 8000,
};

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Get the appropriate MPC configuration based on environment
 */
export function getMPCConfig(): BabylonMPCConfig {
  const env = process.env.NODE_ENV ?? 'development';
  const network = process.env.JEJU_NETWORK ?? 'localnet';

  if (env === 'production' || network === 'mainnet') {
    return PRODUCTION_MPC_CONFIG;
  }

  if (network === 'testnet') {
    return TESTNET_MPC_CONFIG;
  }

  return DEVELOPMENT_MPC_CONFIG;
}

// ============================================================================
// Key Rotation
// ============================================================================

export interface KeyRotationSchedule {
  lastRotation: number;
  nextRotation: number;
  rotationInProgress: boolean;
  currentKeyVersion: number;
}

export function getRotationSchedule(
  config: BabylonMPCConfig,
  lastRotation: number
): KeyRotationSchedule {
  const nextRotation = lastRotation + config.rotationIntervalMs;

  return {
    lastRotation,
    nextRotation,
    rotationInProgress: false,
    currentKeyVersion: Math.floor(
      (Date.now() - lastRotation) / config.rotationIntervalMs
    ),
  };
}

// ============================================================================
// Policy Templates
// ============================================================================

/**
 * Get encryption policy for trajectory data
 */
export function getTrajectoryEncryptionPolicy(
  chainId: string,
  trainingOrchestratorAddress: string
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'contract',
        chainId,
        address: trainingOrchestratorAddress,
        role: 'TRAINER_ROLE',
      },
    ],
    operator: 'and',
  };
}

/**
 * Get encryption policy for model weights
 */
export function getModelEncryptionPolicy(
  chainId: string,
  modelRegistryAddress: string
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'contract',
        chainId,
        address: modelRegistryAddress,
        role: 'MODEL_ACCESSOR_ROLE',
      },
    ],
    operator: 'and',
  };
}

/**
 * Get encryption policy for agent-owned data
 */
export function getAgentOwnerPolicy(
  chainId: string,
  agentVaultAddress: string,
  agentId: number
): AccessControlPolicy {
  return {
    conditions: [
      {
        type: 'agent',
        chainId,
        address: agentVaultAddress,
        agentId,
      },
    ],
    operator: 'and',
  };
}
