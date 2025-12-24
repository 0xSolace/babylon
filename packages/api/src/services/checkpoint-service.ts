/**
 * Checkpoint Service - encrypted state checkpointing to IPFS
 */

import { last, logger, toNull } from '@babylon/shared'
import type { Hex } from 'viem'
import { keccak256, toBytes } from 'viem'
import {
  getJejuStorageClient,
  isJejuStorageAvailable,
  type JejuStorageClient,
} from '../storage/jeju-storage'
import {
  type BabylonEnclave,
  getBabylonEnclave,
  type SealedState,
} from '../tee/babylon-enclave'

// ============================================================================
// Constants & Types
// ============================================================================

const ZERO_HASH = `0x${'0'.repeat(64)}` as Hex

export interface CheckpointConfig {
  intervalMs: number
  autoCheckpoint: boolean
  maxHistory: number
  verbose?: boolean
}

export interface Checkpoint {
  cid: string
  stateHash: Hex
  version: number
  keyVersion: number
  timestamp: number
  size: number
  tickCount: number
  onChainAnchored: boolean
}

export interface CheckpointServiceStatus {
  running: boolean
  lastCheckpoint: Checkpoint | null
  checkpointCount: number
  totalBytesStored: number
  enclaveReady: boolean
  storageReady: boolean
}

// ============================================================================
// Checkpoint Service
// ============================================================================

export class CheckpointService {
  private config: CheckpointConfig
  private enclave: BabylonEnclave | null = null
  private storage: JejuStorageClient | null = null
  private checkpoints: Checkpoint[] = []
  private currentVersion = 0
  private tickCount = 0
  private checkpointTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  // Callbacks for state serialization
  private getStateCallback: (() => Promise<object>) | null = null
  private setStateCallback: ((state: object) => Promise<void>) | null = null

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = {
      intervalMs: 5 * 60 * 1000, // 5 minutes default
      autoCheckpoint: true,
      maxHistory: 24, // Keep 24 checkpoints (2 hours at 5-min interval)
      verbose: false,
      ...config,
    }
  }

  /**
   * Initialize the checkpoint service
   */
  async initialize(callbacks: {
    getState: () => Promise<object>
    setState: (state: object) => Promise<void>
  }): Promise<void> {
    this.getStateCallback = callbacks.getState
    this.setStateCallback = callbacks.setState

    // Initialize enclave
    this.enclave = await getBabylonEnclave({
      verbose: this.config.verbose,
    })

    // Initialize storage if available
    if (isJejuStorageAvailable()) {
      this.storage = getJejuStorageClient()
      if (this.storage) {
        await this.storage.initialize()
      }
    }

    if (this.config.verbose) {
      logger.info('[CheckpointService] Initialized', {
        enclaveReady: !!this.enclave,
        storageReady: !!this.storage,
      })
    }
  }

  /**
   * Start the checkpoint service
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    if (this.config.autoCheckpoint && this.config.intervalMs > 0) {
      this.checkpointTimer = setInterval(
        () => this.createCheckpoint(),
        this.config.intervalMs,
      )
    }

    if (this.config.verbose) {
      logger.info('[CheckpointService] Started', {
        autoCheckpoint: this.config.autoCheckpoint,
        intervalMs: this.config.intervalMs,
      })
    }
  }

  /**
   * Stop the checkpoint service
   */
  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer)
      this.checkpointTimer = null
    }

    if (this.config.verbose) {
      logger.info('[CheckpointService] Stopped')
    }
  }

  /**
   * Create a checkpoint of current state
   */
  async createCheckpoint(): Promise<Checkpoint> {
    if (!this.enclave) {
      throw new Error('Enclave not initialized')
    }

    if (!this.getStateCallback) {
      throw new Error('State callback not configured')
    }

    // Get current state
    const state = await this.getStateCallback()

    // Encrypt state
    const sealed = await this.enclave.sealState(state)

    // Calculate state hash
    const stateJson = JSON.stringify(sealed)
    const stateHash = keccak256(toBytes(stateJson))

    this.currentVersion++

    const checkpoint: Checkpoint = {
      cid: '',
      stateHash,
      version: this.currentVersion,
      keyVersion: sealed.keyVersion,
      timestamp: Date.now(),
      size: stateJson.length,
      tickCount: this.tickCount,
      onChainAnchored: false,
    }

    // Upload to IPFS if storage is available
    if (this.storage) {
      const filename = `checkpoint-${this.currentVersion}.json`
      const result = await this.storage.uploadImage({
        file: Buffer.from(stateJson),
        filename,
        contentType: 'application/json',
        folder: 'checkpoints',
        metadata: {
          version: String(this.currentVersion),
          keyVersion: String(sealed.keyVersion),
          stateHash,
          tickCount: String(this.tickCount),
        },
      })

      checkpoint.cid = result.cid

      if (this.config.verbose) {
        logger.info('[CheckpointService] Checkpoint saved to IPFS', {
          cid: checkpoint.cid,
          version: checkpoint.version,
        })
      }
    } else {
      // Generate local CID-like identifier
      checkpoint.cid = `local-${stateHash.slice(2, 48)}`
    }

    // Add to history
    this.checkpoints.push(checkpoint)

    // Prune old checkpoints
    while (this.checkpoints.length > this.config.maxHistory) {
      this.checkpoints.shift()
    }

    if (this.config.verbose) {
      logger.info('[CheckpointService] Checkpoint created', {
        version: checkpoint.version,
        size: checkpoint.size,
        tickCount: checkpoint.tickCount,
      })
    }

    return checkpoint
  }

  /**
   * Restore state from a checkpoint
   */
  async restoreFromCheckpoint(
    cid: string,
    _keyVersion?: number,
  ): Promise<void> {
    if (!this.enclave) {
      throw new Error('Enclave not initialized')
    }

    if (!this.setStateCallback) {
      throw new Error('State callback not configured')
    }

    let sealedJson: string

    // Try to load from IPFS
    if (this.storage && !cid.startsWith('local-')) {
      const data = await this.storage.download(cid)
      sealedJson = data.toString('utf-8')
    } else {
      // Look for local checkpoint
      const checkpoint = this.checkpoints.find((cp) => cp.cid === cid)
      if (!checkpoint) {
        throw new Error(`Checkpoint not found: ${cid}`)
      }

      // Get from enclave's sealed state
      const sealed = this.enclave.getSealedState()
      if (!sealed) {
        throw new Error('No sealed state available')
      }
      sealedJson = JSON.stringify(sealed)
    }

    // Parse and decrypt
    const sealed: SealedState = JSON.parse(sealedJson)
    const state = await this.enclave.unsealState<object>(sealed)

    // Restore state
    await this.setStateCallback(state)

    if (this.config.verbose) {
      logger.info('[CheckpointService] State restored from checkpoint', {
        cid,
        keyVersion: sealed.keyVersion,
      })
    }
  }

  /**
   * Restore from latest checkpoint
   */
  async restoreFromLatest(): Promise<boolean> {
    const latest = this.getLatestCheckpoint()
    if (!latest) {
      return false
    }

    await this.restoreFromCheckpoint(latest.cid, latest.keyVersion)
    return true
  }

  /**
   * Rotate encryption key and re-checkpoint
   */
  async rotateKey(): Promise<Checkpoint> {
    if (!this.enclave) {
      throw new Error('Enclave not initialized')
    }

    if (!this.getStateCallback) {
      throw new Error('State callback not configured')
    }

    // Validate state callback is available
    await this.getStateCallback()

    // Rotate key
    const { newVersion } = await this.enclave.rotateKey()

    if (this.config.verbose) {
      logger.info('[CheckpointService] Key rotated', { newVersion })
    }

    // Re-encrypt with new key
    return this.createCheckpoint()
  }

  /**
   * Update tick count (called by game loop)
   */
  incrementTick(): void {
    this.tickCount++
  }

  /**
   * Set tick count (for recovery)
   */
  setTickCount(count: number): void {
    this.tickCount = count
  }

  /**
   * Get the latest checkpoint
   */
  getLatestCheckpoint(): Checkpoint | null {
    return last(this.checkpoints)
  }

  /**
   * Get checkpoint by CID
   */
  getCheckpoint(cid: string): Checkpoint | null {
    return toNull(this.checkpoints.find((cp) => cp.cid === cid))
  }

  /**
   * Get checkpoint by version
   */
  getCheckpointByVersion(version: number): Checkpoint | null {
    return toNull(this.checkpoints.find((cp) => cp.version === version))
  }

  /**
   * Get all checkpoints
   */
  getAllCheckpoints(): Checkpoint[] {
    return [...this.checkpoints]
  }

  /**
   * Get current state hash
   */
  getCurrentStateHash(): Hex | null {
    const latest = this.getLatestCheckpoint()
    return toNull(latest?.stateHash)
  }

  /**
   * Get service status
   */
  getStatus(): CheckpointServiceStatus {
    return {
      running: this.running,
      lastCheckpoint: this.getLatestCheckpoint(),
      checkpointCount: this.checkpoints.length,
      totalBytesStored: this.checkpoints.reduce((sum, cp) => sum + cp.size, 0),
      enclaveReady: !!this.enclave,
      storageReady: !!this.storage,
    }
  }

  /** Generate heartbeat data for on-chain registration */
  generateHeartbeatData(): {
    stateHash: Hex
    tickCount: number
    timestamp: number
  } {
    const latest = this.getLatestCheckpoint()
    return {
      stateHash: latest?.stateHash ?? ZERO_HASH,
      tickCount: this.tickCount,
      timestamp: Date.now(),
    }
  }

  /**
   * Get checkpoint CID and hash for on-chain anchoring
   */
  getCheckpointForAnchor(): { cid: string; stateHash: Hex } | null {
    const latest = this.getLatestCheckpoint()
    if (!latest) return null

    return {
      cid: latest.cid,
      stateHash: latest.stateHash,
    }
  }

  /**
   * Mark a checkpoint as anchored on-chain
   */
  markAnchored(cid: string): void {
    const checkpoint = this.checkpoints.find((cp) => cp.cid === cid)
    if (checkpoint) {
      checkpoint.onChainAnchored = true
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let checkpointService: CheckpointService | null = null

export function getCheckpointService(
  config?: Partial<CheckpointConfig>,
): CheckpointService {
  if (!checkpointService) {
    checkpointService = new CheckpointService(config)
  }
  return checkpointService
}

export async function initializeCheckpointService(
  callbacks: {
    getState: () => Promise<object>
    setState: (state: object) => Promise<void>
  },
  config?: Partial<CheckpointConfig>,
): Promise<CheckpointService> {
  const service = getCheckpointService(config)
  await service.initialize(callbacks)
  return service
}
