/**
 * Encrypted trajectory storage using Jeju KMS MPC encryption.
 * TEE workers and AI CEO can decrypt for training/benchmarking.
 */

import {
  getKMSClient,
  type PolicyCondition,
  type SecretPolicy,
} from '@babylon/api'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'
import type {
  AccessCondition,
  AccessControlPolicy,
} from '../mpc/ProductionMPCConfig'
import type { TrajectoryStep } from '../training/types'
import {
  type EncryptedPayload,
  isCIDResponse,
  isEncryptedPayload,
} from '../type-guards'

export interface EncryptedTrajectory {
  id: string
  agentId: string
  archetype: string
  scenarioId: string
  windowId: string
  stepCount: number
  totalReward: number
  createdAt: number
  /** CID of encrypted data on IPFS */
  encryptedCid: string
  /** Policy for decryption */
  policyHash: string
  /** Metadata (unencrypted) */
  metadata: {
    durationMs: number
    finalBalance?: number
    finalPnL?: number
    episodeLength: number
    finalStatus: string
  }
}

export interface TrajectoryBatch {
  batchId: string
  archetype: string
  trajectoryCount: number
  totalSteps: number
  trajectoryIds: string[]
  encryptedCid: string
  createdAt: number
  /** For training orchestrator */
  datasetCidBytes32: `0x${string}`
}

export interface StorageConfig {
  /** Jeju storage endpoint */
  storageEndpoint: string
  /** Chain ID for policy conditions */
  chainId: string
  /** Training orchestrator address (for policy) */
  trainingOrchestratorAddress: Address
  /** AI CEO address (for policy) */
  aiCEOAddress: Address
  /** TEE registry address (for worker attestation) */
  teeRegistryAddress: Address
  /** Minimum TEE stake to decrypt */
  minTEEStakeUSD: number
  /** Enable MPC encryption (vs simpler AES for dev) */
  useMPC: boolean
  /** MPC threshold (e.g., 3 of 5) */
  mpcThreshold: number
  /** MPC party count */
  mpcParties: number
}

export interface AuthSignature {
  sig: string
  derivedVia: string
  signedMessage: string
  address: string
}

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: StorageConfig = {
  storageEndpoint: process.env.JEJU_STORAGE_ENDPOINT ?? 'http://localhost:4400',
  chainId: process.env.CHAIN_ID ?? '420691',
  trainingOrchestratorAddress: (process.env.TRAINING_ORCHESTRATOR_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as Address,
  aiCEOAddress: (process.env.AI_CEO_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as Address,
  teeRegistryAddress: (process.env.TEE_REGISTRY_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as Address,
  minTEEStakeUSD: parseFloat(process.env.MIN_TEE_STAKE_USD ?? '1000'),
  useMPC: process.env.USE_MPC_ENCRYPTION === 'true',
  mpcThreshold: parseInt(process.env.MPC_THRESHOLD ?? '3', 10),
  mpcParties: parseInt(process.env.MPC_PARTIES ?? '5', 10),
}

function policyToKMSPolicy(policy: AccessControlPolicy): SecretPolicy {
  const conditions: PolicyCondition[] = policy.conditions.map((c) => {
    if (c.type === 'role' && c.address)
      return { type: 'address' as const, value: c.address }
    if (c.type === 'contract' && c.address)
      return { type: 'tee' as const, value: c.address }
    return { type: 'timestamp' as const, value: 0 }
  })
  return { conditions, operator: policy.operator }
}

async function encryptWithPolicy(
  data: string,
  policy: AccessControlPolicy,
  options: { metadata?: Record<string, string> },
): Promise<EncryptedPayload> {
  const kms = getKMSClient()
  if (!kms.isInitialized()) await kms.initialize()

  const kmsPolicy = policyToKMSPolicy(policy)

  logger.debug('[EncryptedStorage] Encrypting with KMS', {
    conditions: policy.conditions.length,
    metadata: options.metadata,
  })

  // Call real KMS encryption
  const result = await kms.encrypt({
    data,
    name: options.metadata?.trajectoryId ?? `trajectory-${Date.now()}`,
    policy: kmsPolicy,
    metadata: options.metadata,
  })

  // Compute data hash
  const dataHash = hashString(data)

  return {
    ciphertext: result.encryptedPayload,
    dataHash,
    accessControlConditions: policy.conditions,
    accessControlConditionType: 'unified',
    encryptedSymmetricKey: result.id,
    chain: policy.conditions[0]?.chainId,
  }
}

async function decryptJSON<T>(
  encrypted: EncryptedPayload,
  authSig: AuthSignature,
): Promise<T> {
  const kms = getKMSClient()
  if (!kms.isInitialized()) await kms.initialize()

  logger.debug('[EncryptedStorage] Decrypting', {
    keyId: encrypted.encryptedSymmetricKey,
  })

  const decrypted = await kms.decrypt({
    payload: encrypted.ciphertext as Hex,
    proof: authSig.sig as Hex,
  })
  return JSON.parse(decrypted) as T
}

function hashString(str: string): string {
  const data = new TextEncoder().encode(str)

  // Simple hash for now - in production use crypto.subtle.digest
  let hash = 0
  for (const byte of data) {
    hash = (hash << 5) - hash + byte
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ============================================================================
// EncryptedTrajectoryStorage
// ============================================================================

export class EncryptedTrajectoryStorage {
  private config: StorageConfig
  private initialized: boolean = false

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Verify storage endpoint is available
    const response = await fetch(`${this.config.storageEndpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)

    if (!response?.ok) {
      logger.warn(
        '[EncryptedStorage] Storage endpoint not available, using fallback',
      )
    }

    this.initialized = true
    logger.info('[EncryptedStorage] Initialized', {
      storageEndpoint: this.config.storageEndpoint,
      useMPC: this.config.useMPC,
      mpcConfig: this.config.useMPC
        ? `${this.config.mpcThreshold}-of-${this.config.mpcParties}`
        : 'disabled',
    })
  }

  // --------------------------------------------------------------------------
  // Store Trajectory
  // --------------------------------------------------------------------------

  /**
   * Store a trajectory with encryption
   *
   * @param trajectory - The trajectory data to store
   * @param steps - Trajectory steps (will be encrypted)
   * @returns Encrypted trajectory metadata
   */
  async storeTrajectory(
    trajectory: {
      agentId: string
      archetype: string
      scenarioId: string
      windowId: string
      startTime: number
      endTime: number
      totalReward: number
      finalBalance?: number
      finalPnL?: number
      finalStatus: string
    },
    steps: TrajectoryStep[],
  ): Promise<EncryptedTrajectory> {
    await this.initialize()

    const trajectoryId = await generateSnowflakeId()

    // Build access policy
    const policy = this.buildTrajectoryPolicy()

    // Encrypt steps
    const stepsJson = JSON.stringify(steps)
    const encrypted = await encryptWithPolicy(stepsJson, policy, {
      metadata: {
        trajectoryId,
        archetype: trajectory.archetype,
        type: 'trajectory-steps',
      },
    })

    // Upload to IPFS
    const encryptedCid = await this.uploadToIPFS(encrypted)

    // Create metadata record
    const encryptedTrajectory: EncryptedTrajectory = {
      id: trajectoryId,
      agentId: trajectory.agentId,
      archetype: trajectory.archetype,
      scenarioId: trajectory.scenarioId,
      windowId: trajectory.windowId,
      stepCount: steps.length,
      totalReward: trajectory.totalReward,
      createdAt: Date.now(),
      encryptedCid,
      policyHash: this.hashPolicy(policy),
      metadata: {
        durationMs: trajectory.endTime - trajectory.startTime,
        finalBalance: trajectory.finalBalance,
        finalPnL: trajectory.finalPnL,
        episodeLength: steps.length,
        finalStatus: trajectory.finalStatus,
      },
    }

    logger.info('[EncryptedStorage] Stored trajectory', {
      trajectoryId,
      archetype: trajectory.archetype,
      steps: steps.length,
      cid: encryptedCid,
    })

    return encryptedTrajectory
  }

  // --------------------------------------------------------------------------
  // Batch Trajectories
  // --------------------------------------------------------------------------

  /**
   * Create a batch of trajectories for training
   *
   * @param archetype - Agent archetype
   * @param trajectories - Encrypted trajectories to batch
   * @returns Batch metadata with CID
   */
  async createBatch(
    archetype: string,
    trajectories: EncryptedTrajectory[],
  ): Promise<TrajectoryBatch> {
    await this.initialize()

    const batchId = await generateSnowflakeId()

    // Create batch manifest
    const manifest = {
      batchId,
      archetype,
      trajectoryCount: trajectories.length,
      totalSteps: trajectories.reduce((sum, t) => sum + t.stepCount, 0),
      trajectories: trajectories.map((t) => ({
        id: t.id,
        cid: t.encryptedCid,
        steps: t.stepCount,
        reward: t.totalReward,
      })),
      createdAt: Date.now(),
    }

    // Build policy for batch
    const policy = this.buildTrajectoryPolicy()

    // Encrypt manifest
    const encrypted = await encryptWithPolicy(
      JSON.stringify(manifest),
      policy,
      {
        metadata: {
          batchId,
          archetype,
          type: 'trajectory-batch',
        },
      },
    )

    // Upload to IPFS
    const encryptedCid = await this.uploadToIPFS(encrypted)

    // Convert CID to bytes32 for contract
    const datasetCidBytes32 = this.cidToBytes32(encryptedCid)

    const batch: TrajectoryBatch = {
      batchId,
      archetype,
      trajectoryCount: trajectories.length,
      totalSteps: manifest.totalSteps,
      trajectoryIds: trajectories.map((t) => t.id),
      encryptedCid,
      createdAt: Date.now(),
      datasetCidBytes32,
    }

    logger.info('[EncryptedStorage] Created batch', {
      batchId,
      archetype,
      trajectoryCount: trajectories.length,
      totalSteps: manifest.totalSteps,
      cid: encryptedCid,
    })

    return batch
  }

  // --------------------------------------------------------------------------
  // Retrieve (for TEE workers)
  // --------------------------------------------------------------------------

  /**
   * Retrieve and decrypt trajectory steps (TEE workers only)
   *
   * @param encryptedCid - CID of encrypted data
   * @param authSig - Authentication signature from TEE
   * @returns Decrypted trajectory steps
   */
  async retrieveTrajectory(
    encryptedCid: string,
    authSig: AuthSignature,
  ): Promise<TrajectoryStep[]> {
    await this.initialize()

    // Download from IPFS
    const encrypted = await this.downloadFromIPFS(encryptedCid)

    // Decrypt with auth
    const decrypted = await decryptJSON<TrajectoryStep[]>(encrypted, authSig)

    logger.info('[EncryptedStorage] Retrieved trajectory', {
      cid: encryptedCid,
      steps: decrypted.length,
    })

    return decrypted
  }

  // --------------------------------------------------------------------------
  // Policy Building
  // --------------------------------------------------------------------------

  /**
   * Build access control policy for trajectories
   *
   * Only authorized entities can decrypt:
   * 1. TEE training workers with valid stake
   * 2. AI CEO for benchmarking
   */
  private buildTrajectoryPolicy(): AccessControlPolicy {
    // Conditions that authorize decryption
    const conditions: AccessCondition[] = [
      // TEE workers with stake
      {
        type: 'role',
        chainId: this.config.chainId,
        address: this.config.teeRegistryAddress,
        role: 'TEE_WORKER',
      },
      // AI CEO
      {
        type: 'role',
        chainId: this.config.chainId,
        address: this.config.trainingOrchestratorAddress,
        role: 'AI_CEO',
      },
    ]

    // Either condition allows access
    return {
      conditions,
      operator: 'or',
    }
  }

  /**
   * Build policy for TEE-only access (more restrictive)
   */
  buildTEEOnlyPolicy(): AccessControlPolicy {
    return {
      conditions: [
        {
          type: 'role',
          chainId: this.config.chainId,
          address: this.config.teeRegistryAddress,
          role: 'TEE_WORKER',
        },
        {
          type: 'contract',
          chainId: this.config.chainId,
          address: this.config.teeRegistryAddress,
          role: 'VERIFIED_ATTESTATION',
        },
      ],
      operator: 'and',
    }
  }

  // --------------------------------------------------------------------------
  // IPFS Operations
  // --------------------------------------------------------------------------

  private async uploadToIPFS(data: EncryptedPayload): Promise<string> {
    const response = await fetch(`${this.config.storageEndpoint}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: JSON.stringify(data),
        pin: true,
        encrypt: false, // Already encrypted
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to upload to IPFS: ${response.statusText}`)
    }

    const result: unknown = await response.json()
    if (!isCIDResponse(result)) {
      throw new Error('Invalid IPFS upload response')
    }
    return result.cid
  }

  private async downloadFromIPFS(cid: string): Promise<EncryptedPayload> {
    const response = await fetch(
      `${this.config.storageEndpoint}/download/${cid}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to download from IPFS: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isEncryptedPayload(data)) {
      throw new Error('Invalid encrypted payload from IPFS')
    }
    return data
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private hashPolicy(policy: AccessControlPolicy): string {
    // Simple hash for policy identification
    const policyStr = JSON.stringify(policy)
    return `policy-${hashString(policyStr)}`
  }

  private cidToBytes32(cid: string): `0x${string}` {
    // Convert CID to bytes32 for contract storage
    // In production, use proper CID encoding
    const hex = Buffer.from(cid).toString('hex').padEnd(64, '0').slice(0, 64)
    return `0x${hex}` as `0x${string}`
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  getConfig(): StorageConfig {
    return this.config
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _storage: EncryptedTrajectoryStorage | null = null

export function getEncryptedTrajectoryStorage(
  config?: Partial<StorageConfig>,
): EncryptedTrajectoryStorage {
  if (!_storage) {
    _storage = new EncryptedTrajectoryStorage(config)
  }
  return _storage
}

export function resetEncryptedTrajectoryStorage(): void {
  _storage = null
}
