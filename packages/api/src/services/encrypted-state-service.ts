/**
 * Encrypted State Service
 *
 * Manages encrypted game state for unruggable Babylon.
 * Coordinates between TEE enclave and decentralized storage.
 *
 * Features:
 * - Encrypted state checkpoints to IPFS/Arweave
 * - On-chain state anchoring
 * - Public training data storage
 * - State recovery from storage
 */

import { last, logger } from '@babylon/shared'
import type { Hex } from 'viem'
import {
  JejuStorageClient,
  type JejuStorageConfig,
} from '../storage/jeju-storage'
import type { BabylonEnclave, SealedState } from '../tee/babylon-enclave'

// ============================================================================
// Types
// ============================================================================

export interface StateCheckpoint {
  /** IPFS/Arweave CID */
  cid: string
  /** Hash of encrypted state */
  hash: Hex
  /** State version number */
  version: number
  /** Encryption key version */
  keyVersion: number
  /** Timestamp of checkpoint */
  timestamp: number
  /** Size in bytes */
  size: number
}

export interface TrainingDataset {
  /** IPFS/Arweave CID */
  cid: string
  /** Training epoch number */
  epoch: number
  /** Number of samples */
  sampleCount: number
  /** Timestamp */
  timestamp: number
  /** Model hash before training */
  modelHashBefore: Hex
  /** Model hash after training */
  modelHashAfter: Hex
}

export interface EncryptedStateServiceConfig {
  /** Storage options */
  storage: JejuStorageConfig
  /** Enable verbose logging */
  verbose?: boolean
}

// ============================================================================
// Encrypted State Service
// ============================================================================

export class EncryptedStateService {
  private enclave: BabylonEnclave
  private storage: JejuStorageClient
  private checkpoints: StateCheckpoint[] = []
  private trainingDatasets: TrainingDataset[] = []
  private currentEpoch = 0
  private verbose: boolean

  constructor(
    enclave: BabylonEnclave,
    storage: JejuStorageClient,
    config?: Partial<EncryptedStateServiceConfig>,
  ) {
    this.enclave = enclave
    this.storage = storage
    this.verbose = config?.verbose ?? false

    if (this.verbose) {
      logger.info('[EncryptedStateService] Initialized')
    }
  }

  /**
   * Save encrypted game state to storage
   */
  async saveState<T extends object>(state: T): Promise<StateCheckpoint> {
    // Encrypt state inside TEE
    const sealed = await this.enclave.sealState(state)

    // Upload to decentralized storage
    const sealedJson = JSON.stringify(sealed)
    const filename = `state-${Date.now()}.json`
    const result = await this.storage.uploadImage({
      file: Buffer.from(sealedJson),
      filename,
      contentType: 'application/json',
      folder: 'encrypted-state',
      metadata: {
        type: 'encrypted_state',
        keyVersion: String(sealed.keyVersion),
        timestamp: String(sealed.sealedAt),
      },
    })

    const hash = `0x${Buffer.from(sealedJson.slice(0, 32))
      .toString('hex')
      .padEnd(64, '0')}` as Hex

    const checkpoint: StateCheckpoint = {
      cid: result.cid,
      hash,
      version: this.checkpoints.length + 1,
      keyVersion: sealed.keyVersion,
      timestamp: Date.now(),
      size: sealedJson.length,
    }

    this.checkpoints.push(checkpoint)

    if (this.verbose) {
      logger.info('[EncryptedStateService] State saved', {
        cid: checkpoint.cid,
        version: checkpoint.version,
      })
    }

    return checkpoint
  }

  /**
   * Load and decrypt state from storage
   */
  async loadState<T extends object>(cid: string): Promise<T> {
    // Retrieve from storage
    const data = await this.storage.download(cid)

    // Parse sealed data
    const sealed: SealedState = JSON.parse(data.toString())

    // Decrypt inside TEE
    const state = await this.enclave.unsealState<T>(sealed)

    if (this.verbose) {
      logger.info('[EncryptedStateService] State loaded', { cid })
    }

    return state
  }

  /**
   * Handle key rotation - re-encrypt and save state
   */
  async rotateKey<T extends object>(currentState: T): Promise<StateCheckpoint> {
    if (this.verbose) {
      logger.info('[EncryptedStateService] Initiating key rotation...')
    }

    // Rotate key in enclave
    const { newVersion } = await this.enclave.rotateKey()

    // Re-encrypt with new key
    const checkpoint = await this.saveState(currentState)

    if (this.verbose) {
      logger.info('[EncryptedStateService] Key rotation complete', {
        newVersion,
        cid: checkpoint.cid,
      })
    }

    return checkpoint
  }

  /**
   * Save public training dataset (not encrypted)
   */
  async saveTrainingData(
    samples: object[],
    modelHashBefore: Hex,
    modelHashAfter: Hex,
  ): Promise<TrainingDataset> {
    this.currentEpoch++

    const dataJson = JSON.stringify({
      epoch: this.currentEpoch,
      timestamp: Date.now(),
      samples,
      modelHashBefore,
      modelHashAfter,
    })

    // Upload publicly (not encrypted)
    const filename = `training-epoch-${this.currentEpoch}.json`
    const result = await this.storage.uploadImage({
      file: Buffer.from(dataJson),
      filename,
      contentType: 'application/json',
      folder: 'training-data',
      metadata: {
        type: 'training_dataset',
        epoch: String(this.currentEpoch),
        sampleCount: String(samples.length),
        public: 'true',
      },
    })

    const dataset: TrainingDataset = {
      cid: result.cid,
      epoch: this.currentEpoch,
      sampleCount: samples.length,
      timestamp: Date.now(),
      modelHashBefore,
      modelHashAfter,
    }

    this.trainingDatasets.push(dataset)

    if (this.verbose) {
      logger.info('[EncryptedStateService] Training data saved', {
        cid: dataset.cid,
        epoch: dataset.epoch,
        samples: samples.length,
      })
    }

    return dataset
  }

  /**
   * Load public training dataset
   */
  async loadTrainingData(cid: string): Promise<{
    epoch: number
    timestamp: number
    samples: object[]
    modelHashBefore: Hex
    modelHashAfter: Hex
  }> {
    const data = await this.storage.download(cid)
    return JSON.parse(data.toString())
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): StateCheckpoint[] {
    return [...this.checkpoints]
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): StateCheckpoint | null {
    return last(this.checkpoints)
  }

  /**
   * Get all training datasets
   */
  getTrainingDatasets(): TrainingDataset[] {
    return [...this.trainingDatasets]
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.currentEpoch
  }

  /**
   * Get stats
   */
  getStats(): {
    checkpoints: number
    trainingDatasets: number
    totalStorageBytes: number
  } {
    const totalBytes = this.checkpoints.reduce((sum, cp) => sum + cp.size, 0)
    return {
      checkpoints: this.checkpoints.length,
      trainingDatasets: this.trainingDatasets.length,
      totalStorageBytes: totalBytes,
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

async function _createEncryptedStateService(
  enclave: BabylonEnclave,
  config?: Partial<EncryptedStateServiceConfig>,
): Promise<EncryptedStateService> {
  // IPFS API port from centralized config (default 5001)
  const ipfsPort = process.env.IPFS_API_PORT ?? '5001'
  const storageConfig: JejuStorageConfig = {
    endpoint:
      process.env.JEJU_STORAGE_ENDPOINT ?? `http://localhost:${ipfsPort}`,
    defaultProvider: 'ipfs',
    replicationFactor: 3,
    ...config?.storage,
  }

  const storage = new JejuStorageClient(storageConfig)

  return new EncryptedStateService(enclave, storage, config)
}
