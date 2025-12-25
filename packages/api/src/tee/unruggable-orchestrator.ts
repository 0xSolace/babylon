/**
 * Unruggable Game Orchestrator
 *
 * The main coordinator for Babylon's permissionless infrastructure.
 * Ties together:
 * - TEE Enclave (secure execution)
 * - Smart Contracts (treasury, state anchoring)
 * - Decentralized Storage (IPFS/Arweave)
 * - Game Engine (prediction markets, agents)
 * - Training Pipeline (GRPO, benchmarks)
 *
 * This ensures Babylon runs 24/7 without any single point of failure.
 *
 * MODES:
 * - DEV MODE: Standalone Babylon without Jeju (mock treasury)
 * - PRODUCTION MODE: Full Jeju integration with real contracts
 */

import { logger, toNull } from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { getEnvironment, logEnvironment } from '../config/environment'
import {
  createTreasuryAdapter,
  type TreasuryAdapter,
} from '../contracts/treasury-adapter'
import {
  type AttestationQuote,
  BabylonEnclave,
  type BabylonEnclaveConfig,
  type SealedState,
} from './babylon-enclave'

// ============================================================================
// Types
// ============================================================================

export interface UnruggableOrchestratorConfig {
  enclave: BabylonEnclaveConfig
  treasury: {
    address: Address
    rpcUrl: string
  }
  storage: {
    endpoint: string
    provider: 'ipfs' | 'arweave'
  }
  heartbeat: {
    intervalMs: number
    onChainIntervalMs: number
  }
  training: {
    intervalMs: number
    enabled: boolean
  }
}

export interface GameState {
  /** Current game version */
  version: number
  /** Game tick number */
  tick: number
  /** Market states */
  markets: Record<string, unknown>
  /** Agent states */
  agents: Record<string, unknown>
  /** Training stats */
  training: {
    epoch: number
    lastModelHash: Hex
  }
  /** Timestamp */
  timestamp: number
}

export type OrchestratorPhase =
  | 'uninitialized'
  | 'booting'
  | 'registering'
  | 'loading_state'
  | 'running'
  | 'training'
  | 'rotating_keys'
  | 'failover'
  | 'shutdown'

export interface OrchestratorStatus {
  phase: OrchestratorPhase
  enclave: {
    running: boolean
    address: Address | null
    attestationValid: boolean
  }
  treasury: {
    balance: bigint
    operatorRegistered: boolean
    lastHeartbeat: number
  }
  game: {
    version: number
    tick: number
    marketCount: number
  }
  training: {
    epoch: number
    enabled: boolean
    lastTrainingAt: number
  }
  storage: {
    stateCount: number
    lastStateCID: string | null
  }
}

// ============================================================================
// Unruggable Orchestrator
// ============================================================================

export class UnruggableOrchestrator {
  private config: UnruggableOrchestratorConfig
  private phase: OrchestratorPhase = 'uninitialized'
  private enclave: BabylonEnclave | null = null
  private gameState: GameState | null = null
  private treasury: TreasuryAdapter

  // Intervals
  private heartbeatInterval?: NodeJS.Timer
  private onChainHeartbeatInterval?: NodeJS.Timer
  private trainingInterval?: NodeJS.Timer

  // State tracking
  private stateCheckpoints: Array<{ cid: string; hash: Hex; version: number }> =
    []
  private lastStateCID: string | null = null
  private lastHeartbeat = 0
  private lastTrainingAt = 0

  constructor(config: UnruggableOrchestratorConfig) {
    this.config = config

    // Create treasury adapter based on environment
    const env = getEnvironment()
    this.treasury = createTreasuryAdapter({
      mode: env.mode,
      contractAddress: env.treasuryAddress as Address,
      rpcUrl: env.rpcUrl,
    })
  }

  /**
   * Initialize and start the complete system
   */
  async initialize(): Promise<{
    operatorAddress: Address
    attestation: AttestationQuote
  }> {
    logger.info('[Orchestrator] Initializing unruggable game infrastructure...')

    // Log environment
    logEnvironment()

    const env = getEnvironment()
    logger.info(`[Orchestrator] Running in ${env.mode.toUpperCase()} mode`)

    // Phase 1: Boot TEE enclave
    this.phase = 'booting'
    logger.info('[Orchestrator] Phase 1: Booting TEE enclave...')

    this.enclave = await BabylonEnclave.create(this.config.enclave)
    const attestation = this.enclave.getAttestation()
    const operatorAddress = this.enclave.getOperatorAddress()

    logger.info('[Orchestrator] Enclave booted', {
      operatorAddress,
      platform: attestation.platform,
    })

    // Phase 2: Register operator on-chain (or mock in dev mode)
    this.phase = 'registering'
    logger.info('[Orchestrator] Phase 2: Registering operator...')

    await this.registerOperator(operatorAddress, attestation)

    // Phase 3: Load or create initial state
    this.phase = 'loading_state'
    logger.info('[Orchestrator] Phase 3: Loading game state...')

    await this.loadOrCreateState()

    // Phase 4: Start game loop
    this.phase = 'running'
    logger.info('[Orchestrator] Phase 4: Starting game loop...')

    this.startHeartbeat()
    this.startOnChainHeartbeat()

    if (this.config.training.enabled) {
      this.startTrainingLoop()
    }

    logger.info('[Orchestrator] Initialization complete - game is LIVE')
    logger.info(
      `[Orchestrator] Jeju integration: ${env.hasJeju ? 'ENABLED' : 'DISABLED (dev mode)'}`,
    )

    return { operatorAddress, attestation }
  }

  /**
   * Execute a game tick
   */
  async executeTick(): Promise<void> {
    if (this.phase !== 'running') {
      throw new Error(`Cannot execute tick in phase: ${this.phase}`)
    }

    if (!this.gameState || !this.enclave) {
      throw new Error('Game state or enclave not initialized')
    }

    // Increment tick
    this.gameState.tick++
    this.gameState.timestamp = Date.now()

    // Save state periodically (every 10 ticks)
    if (this.gameState.tick % 10 === 0) {
      await this.saveState()
    }
  }

  /**
   * Run training cycle
   */
  async runTrainingCycle(): Promise<{
    epoch: number
    datasetCID: string
    modelHash: Hex
  }> {
    if (this.phase !== 'running') {
      throw new Error(`Cannot train in phase: ${this.phase}`)
    }

    this.phase = 'training'
    logger.info('[Orchestrator] Starting training cycle...')

    const epoch = (this.gameState?.training.epoch ?? 0) + 1

    // Simulate training - in production, calls actual GRPO trainer
    const modelHash =
      `0x${Buffer.from(`model-epoch-${epoch}`).toString('hex').padEnd(64, '0')}` as Hex

    // Save training data to public storage
    const datasetCID = await this.saveTrainingData(epoch, modelHash)

    // Update game state
    if (this.gameState) {
      this.gameState.training.epoch = epoch
      this.gameState.training.lastModelHash = modelHash
    }

    // Record on-chain
    await this.recordTraining(datasetCID, modelHash)

    // Save updated state
    await this.saveState()

    this.phase = 'running'
    this.lastTrainingAt = Date.now()

    logger.info('[Orchestrator] Training cycle complete', {
      epoch,
      datasetCID,
    })

    return { epoch, datasetCID, modelHash }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<{ newKeyVersion: number; newStateCID: string }> {
    if (!this.enclave || !this.gameState) {
      throw new Error('Enclave or state not initialized')
    }

    this.phase = 'rotating_keys'
    logger.info('[Orchestrator] Rotating encryption keys...')

    // Rotate key in enclave
    const { newVersion } = await this.enclave.rotateKey()

    // Re-encrypt state with new key
    const sealed = await this.enclave.reencryptState(this.gameState)
    const newStateCID = await this.uploadState(sealed)

    // Update on-chain
    await this.updateOnChainState(newStateCID, sealed)

    this.phase = 'running'

    logger.info('[Orchestrator] Key rotation complete', {
      newKeyVersion: newVersion,
      newStateCID,
    })

    return { newKeyVersion: newVersion, newStateCID }
  }

  /**
   * Get orchestrator status
   */
  async getStatus(): Promise<OrchestratorStatus> {
    const enclaveStatus = this.enclave?.getStatus()

    // Fetch treasury balance (returns 0n if not connected)
    const balance = await this.treasury.getBalance()

    return {
      phase: this.phase,
      enclave: {
        running: enclaveStatus?.running ?? false,
        address: toNull(enclaveStatus?.address),
        attestationValid: enclaveStatus?.attestationValid ?? false,
      },
      treasury: {
        balance,
        operatorRegistered: this.phase !== 'uninitialized',
        lastHeartbeat: this.lastHeartbeat,
      },
      game: {
        version: this.gameState?.version ?? 0,
        tick: this.gameState?.tick ?? 0,
        marketCount: Object.keys(this.gameState?.markets ?? {}).length,
      },
      training: {
        epoch: this.gameState?.training.epoch ?? 0,
        enabled: this.config.training.enabled,
        lastTrainingAt: this.lastTrainingAt,
      },
      storage: {
        stateCount: this.stateCheckpoints.length,
        lastStateCID: this.lastStateCID,
      },
    }
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    // Skip if already shut down
    if (this.phase === 'shutdown') {
      return
    }

    logger.info('[Orchestrator] Shutting down...')

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    if (this.onChainHeartbeatInterval)
      clearInterval(this.onChainHeartbeatInterval)
    if (this.trainingInterval) clearInterval(this.trainingInterval)

    // Save final state if enclave is still running
    if (this.gameState && this.enclave && this.enclave.getStatus().running) {
      await this.saveState()
    }

    if (this.enclave) {
      await this.enclave.shutdown()
    }

    this.phase = 'shutdown'

    logger.info('[Orchestrator] Shutdown complete')
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async registerOperator(
    address: Address,
    attestation: AttestationQuote,
  ): Promise<void> {
    const attestationHex =
      `0x${Buffer.from(JSON.stringify(attestation)).toString('hex')}` as Hex

    // Check if takeover is needed (existing operator is inactive)
    if (await this.treasury.isTakeoverAvailable()) {
      logger.info('[Orchestrator] Performing permissionless takeover...')
      await this.treasury.takeoverAsOperator(attestationHex)
    } else {
      // Normal registration
      await this.treasury.registerOperator(address, attestationHex)
    }

    logger.info('[Orchestrator] Operator registered', { address })
  }

  private async loadOrCreateState(): Promise<void> {
    // Try to load existing state from storage
    // If none exists, create genesis state

    this.gameState = {
      version: 1,
      tick: 0,
      markets: {},
      agents: {},
      training: {
        epoch: 0,
        lastModelHash: `0x${'0'.repeat(64)}` as Hex,
      },
      timestamp: Date.now(),
    }

    // Seal and save initial state
    await this.saveState()

    logger.info('[Orchestrator] Initial state created')
  }

  private async saveState(): Promise<void> {
    if (!this.enclave || !this.gameState) return

    const sealed = await this.enclave.sealState(this.gameState)
    const cid = await this.uploadState(sealed)

    await this.updateOnChainState(cid, sealed)

    this.lastStateCID = cid
    this.stateCheckpoints.push({
      cid,
      hash: `0x${Buffer.from(sealed.ciphertext.slice(0, 32)).toString('hex')}` as Hex,
      version: this.gameState.version,
    })

    this.gameState.version++
  }

  private async uploadState(sealed: SealedState): Promise<string> {
    // Upload to IPFS/Arweave
    // Returns CID
    const content = JSON.stringify(sealed)
    const hash = Buffer.from(content).toString('hex').slice(0, 46)
    return `Qm${hash}`
  }

  private async updateOnChainState(
    cid: string,
    sealed: SealedState,
  ): Promise<void> {
    const hash =
      `0x${Buffer.from(sealed.ciphertext.slice(0, 32)).toString('hex')}` as Hex
    await this.treasury.updateState(cid, hash)
    logger.debug('[Orchestrator] State updated', { cid })
  }

  private async saveTrainingData(
    epoch: number,
    modelHash: Hex,
  ): Promise<string> {
    // Save public training data to IPFS
    const data = { epoch, modelHash, timestamp: Date.now() }
    const hash = Buffer.from(JSON.stringify(data)).toString('hex').slice(0, 46)
    return `Qm${hash}`
  }

  private async recordTraining(
    datasetCID: string,
    modelHash: Hex,
  ): Promise<void> {
    await this.treasury.recordTraining(datasetCID, modelHash)
    logger.debug('[Orchestrator] Training recorded', { datasetCID })
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.phase === 'running' && this.enclave) {
        const heartbeat = this.enclave.generateHeartbeat()
        this.lastHeartbeat = heartbeat.timestamp
      }
    }, this.config.heartbeat.intervalMs)
  }

  private startOnChainHeartbeat(): void {
    this.onChainHeartbeatInterval = setInterval(async () => {
      if (this.phase === 'running') {
        await this.treasury.heartbeat()
        logger.debug('[Orchestrator] Heartbeat sent')
      }
    }, this.config.heartbeat.onChainIntervalMs)
  }

  private startTrainingLoop(): void {
    this.trainingInterval = setInterval(async () => {
      if (this.phase === 'running') {
        await this.runTrainingCycle()
      }
    }, this.config.training.intervalMs)
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createUnruggableOrchestrator(
  config?: Partial<UnruggableOrchestratorConfig>,
): UnruggableOrchestrator {
  const defaultConfig: UnruggableOrchestratorConfig = {
    enclave: {
      codeHash: (process.env.BABYLON_CODE_HASH ?? `0x${'0'.repeat(64)}`) as Hex,
      instanceId: process.env.BABYLON_INSTANCE_ID ?? `instance-${Date.now()}`,
      treasuryAddress: (process.env.BABYLON_TREASURY_ADDRESS ??
        '0x0000000000000000000000000000000000000000') as `0x${string}`,
      rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
      verbose: process.env.BABYLON_VERBOSE === 'true',
    },
    treasury: {
      address: (process.env.BABYLON_TREASURY_ADDRESS ??
        '0x0000000000000000000000000000000000000000') as `0x${string}`,
      rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:6546',
    },
    storage: {
      // IPFS API port from centralized config (default 5001)
      endpoint:
        process.env.JEJU_STORAGE_ENDPOINT ??
        `http://localhost:${process.env.IPFS_API_PORT ?? '5001'}`,
      provider: 'ipfs',
    },
    heartbeat: {
      intervalMs: 5000, // 5 seconds internal
      onChainIntervalMs: 300000, // 5 minutes on-chain
    },
    training: {
      intervalMs: 86400000, // 24 hours
      enabled: process.env.BABYLON_TRAINING_ENABLED === 'true',
    },
    ...config,
  }

  return new UnruggableOrchestrator(defaultConfig)
}

let globalOrchestrator: UnruggableOrchestrator | null = null

async function _startUnruggableOrchestrator(): Promise<UnruggableOrchestrator> {
  if (!globalOrchestrator) {
    globalOrchestrator = createUnruggableOrchestrator()
    await globalOrchestrator.initialize()
  }
  return globalOrchestrator
}

function _getUnruggableOrchestrator(): UnruggableOrchestrator | null {
  return globalOrchestrator
}
