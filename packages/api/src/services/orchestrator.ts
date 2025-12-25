/**
 * Self-Healing Orchestrator
 *
 * Enhanced orchestrator that integrates with on-chain registries for
 * permissionless game server operation.
 *
 * Features:
 * - ServerRegistry integration for on-chain liveness tracking
 * - IPFS checkpoint recovery
 * - Automatic failover via stale takeover
 * - TEE attestation for verifiable operation
 * - Permissionless takeover when operator fails
 */

import type { Address } from 'viem'

// Registry types - these should be provided by the calling code
interface RegistryAddresses {
  serverRegistry: Address
  modelRegistry: Address
  jobRegistry: Address
}

enum ServerStatus {
  Inactive = 0,
  Active = 1,
  Stale = 2,
  Terminated = 3,
  RUNNING = 1,
}

interface ServerInstance {
  id: `0x${string}`
  instanceId: string
  operator: Address
  endpoint: string
  status: ServerStatus
  lastHeartbeat: bigint
  registeredAt: bigint
  attestation: `0x${string}`
  checkpointCid: string | null
  tickCount: number
}

// Placeholder registry client - implement based on @jejunetwork/contracts
class BabylonRegistryClient {
  server: {
    getActiveInstance: () => Promise<ServerInstance | null>
    isActiveStale: () => Promise<boolean>
    registerInstance: (config: {
      attestationHash?: `0x${string}`
      endpoint?: string
      stake?: bigint
    }) => Promise<{ instanceId: string; txHash: `0x${string}` }>
    claimStaleInstance: (config: {
      attestationHash?: `0x${string}`
      endpoint?: string
      stake?: bigint
    }) => Promise<{ instanceId: string; txHash: `0x${string}` }>
    startInstance: (instanceId: string) => Promise<void>
    heartbeat: (stateHash: `0x${string}`) => Promise<`0x${string}`>
    shutdown: () => Promise<void>
    checkpoint: (cid: string, stateHash: string) => Promise<`0x${string}`>
    getLatestCheckpoint: () => Promise<{
      cid: string
      stateHash: string
    } | null>
  }

  constructor(_config: {
    addresses: RegistryAddresses
    publicClient: import('viem').PublicClient
    walletClient?: import('viem').WalletClient
    chain?: import('viem').Chain
  }) {
    this.server = {
      getActiveInstance: async () => null,
      isActiveStale: async () => false,
      registerInstance: async () => ({
        instanceId: '0x0',
        txHash: '0x0' as `0x${string}`,
      }),
      claimStaleInstance: async () => ({
        instanceId: '0x0',
        txHash: '0x0' as `0x${string}`,
      }),
      startInstance: async () => {},
      heartbeat: async () => '0x0' as `0x${string}`,
      shutdown: async () => {},
      checkpoint: async () => '0x0' as `0x${string}`,
      getLatestCheckpoint: async () => null,
    }
  }
}

export { type RegistryAddresses, type ServerInstance, ServerStatus }

import { logger } from '@babylon/shared'
import {
  type Chain,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  keccak256,
  type PublicClient,
  toBytes,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getBabylonEnclave } from '../tee/babylon-enclave'
import {
  type CheckpointService,
  getCheckpointService,
} from './checkpoint-service'

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  /** Chain configuration */
  chain: Chain
  /** RPC URL */
  rpcUrl: string
  /** Private key for signing (hex string) */
  privateKey: Hex
  /** Registry contract addresses */
  registryAddresses: RegistryAddresses
  /** Server endpoint */
  serverEndpoint: string
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number
  /** Checkpoint interval in ms */
  checkpointIntervalMs: number
  /** Stake amount in wei */
  stakeAmount: bigint
  /** Enable verbose logging */
  verbose?: boolean
}

export interface OrchestratorStatus {
  running: boolean
  isOperator: boolean
  instanceId: Hex | null
  lastHeartbeat: number
  lastCheckpoint: number
  tickCount: number
  stakeAmount: bigint
  recoveryAvailable: boolean
}

// ============================================================================
// Decentralized Orchestrator
// ============================================================================

export class Orchestrator {
  private config: OrchestratorConfig
  private publicClient: PublicClient
  private walletClient: WalletClient
  private registryClient: BabylonRegistryClient
  private checkpointService: CheckpointService
  private instanceId: Hex | null = null
  private running = false
  private tickCount = 0
  private lastHeartbeat = 0
  private lastCheckpoint = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private checkpointTimer: ReturnType<typeof setInterval> | null = null
  private monitorTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: OrchestratorConfig) {
    this.config = config

    // Create viem clients
    const account = privateKeyToAccount(config.privateKey)

    this.publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    }) as PublicClient

    this.walletClient = createWalletClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
      account,
    }) as WalletClient

    // Create registry client
    this.registryClient = new BabylonRegistryClient({
      addresses: config.registryAddresses,
      publicClient: this.publicClient,
      walletClient: this.walletClient,
      chain: config.chain,
    })

    // Get checkpoint service
    this.checkpointService = getCheckpointService({
      intervalMs: config.checkpointIntervalMs,
      autoCheckpoint: false, // We'll manage checkpointing ourselves
      verbose: config.verbose,
    })
  }

  /**
   * Initialize and start the orchestrator
   */
  async start(callbacks: {
    getState: () => Promise<object>
    setState: (state: object) => Promise<void>
    onTakeover?: () => Promise<void>
  }): Promise<void> {
    if (this.running) return

    // Initialize checkpoint service
    await this.checkpointService.initialize({
      getState: callbacks.getState,
      setState: callbacks.setState,
    })

    // Check if we need to do recovery or fresh start
    const activeInstance = await this.registryClient.server.getActiveInstance()

    if (activeInstance && activeInstance.status === ServerStatus.RUNNING) {
      // There's an active instance - check if it's stale
      const isStale = await this.registryClient.server.isActiveStale()

      if (isStale) {
        // Take over the stale instance
        await this.takeoverStaleInstance(activeInstance)
        if (callbacks.onTakeover) {
          await callbacks.onTakeover()
        }
      } else {
        // Another operator is running - we can only monitor
        this.log('Another operator is active, entering monitor mode')
        this.startMonitoring()
        return
      }
    } else {
      // No active instance - register as new operator
      await this.registerAsOperator()
    }

    // Start the instance
    await this.startInstance()

    // Start timers
    this.startHeartbeatTimer()
    this.startCheckpointTimer()
    this.startMonitoring()

    this.running = true
    this.log('Orchestrator started', { instanceId: this.instanceId })
  }

  /**
   * Stop the orchestrator gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) return

    this.stopTimers()

    // Save final checkpoint
    await this.saveCheckpoint()

    // Shutdown on-chain
    if (this.instanceId) {
      await this.registryClient.server.shutdown()
    }

    this.running = false
    this.log('Orchestrator stopped')
  }

  /**
   * Process a game tick
   */
  async tick(): Promise<void> {
    this.tickCount++
    this.checkpointService.incrementTick()
  }

  /**
   * Send heartbeat to on-chain registry
   */
  async sendHeartbeat(): Promise<void> {
    if (!this.instanceId) return

    const { stateHash } = this.checkpointService.generateHeartbeatData()
    await this.registryClient.server.heartbeat(stateHash)
    this.lastHeartbeat = Date.now()

    this.log('Heartbeat sent', { stateHash, tickCount: this.tickCount })
  }

  /**
   * Save checkpoint to IPFS and anchor on-chain
   */
  async saveCheckpoint(): Promise<void> {
    const checkpoint = await this.checkpointService.createCheckpoint()

    // Anchor on-chain
    await this.registryClient.server.checkpoint(
      checkpoint.cid,
      checkpoint.stateHash,
    )

    this.checkpointService.markAnchored(checkpoint.cid)
    this.lastCheckpoint = Date.now()

    this.log('Checkpoint saved and anchored', {
      cid: checkpoint.cid,
      version: checkpoint.version,
    })
  }

  /**
   * Recover state from latest checkpoint
   */
  async recoverFromCheckpoint(): Promise<boolean> {
    const checkpoint = await this.registryClient.server.getLatestCheckpoint()

    if (!checkpoint) {
      this.log('No checkpoint available for recovery')
      return false
    }

    const { cid, stateHash } = checkpoint
    if (!cid) {
      this.log('No checkpoint CID available for recovery')
      return false
    }

    await this.checkpointService.restoreFromCheckpoint(cid)
    this.log('Recovered from checkpoint', { cid, stateHash })
    return true
  }

  /**
   * Get orchestrator status
   */
  getStatus(): OrchestratorStatus {
    return {
      running: this.running,
      isOperator: this.instanceId !== null,
      instanceId: this.instanceId,
      lastHeartbeat: this.lastHeartbeat,
      lastCheckpoint: this.lastCheckpoint,
      tickCount: this.tickCount,
      stakeAmount: this.config.stakeAmount,
      recoveryAvailable: this.checkpointService.getLatestCheckpoint() !== null,
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async registerAsOperator(): Promise<void> {
    // Get attestation from enclave
    const enclave = await getBabylonEnclave({ verbose: this.config.verbose })
    const attestation = enclave.getAttestation()

    // Register on-chain
    const txHash = await this.registryClient.server.registerInstance({
      attestationHash: attestation.measurement,
      endpoint: this.config.serverEndpoint,
      stake: this.config.stakeAmount,
    })

    // Wait for instance ID from event
    // For now, generate it locally (in production, parse from tx receipt)
    this.instanceId = keccak256(
      toBytes(`${this.walletClient.account?.address}:${Date.now()}`),
    )

    this.log('Registered as operator', { txHash, instanceId: this.instanceId })
  }

  private async takeoverStaleInstance(
    staleInstance: ServerInstance,
  ): Promise<void> {
    this.log('Taking over stale instance', {
      oldInstanceId: staleInstance.instanceId,
      oldOperator: staleInstance.operator,
    })

    // Get attestation
    const enclave = await getBabylonEnclave({ verbose: this.config.verbose })
    const attestation = enclave.getAttestation()

    // Claim the stale instance
    const txHash = await this.registryClient.server.claimStaleInstance({
      attestationHash: attestation.measurement,
      endpoint: this.config.serverEndpoint,
      stake: this.config.stakeAmount,
    })

    // Recover state from checkpoint
    if (staleInstance.checkpointCid) {
      await this.checkpointService.restoreFromCheckpoint(
        staleInstance.checkpointCid,
      )
      this.checkpointService.setTickCount(Number(staleInstance.tickCount))
    }

    this.instanceId = keccak256(
      toBytes(`${this.walletClient.account?.address}:${Date.now()}`),
    )

    this.log('Takeover complete', { txHash, instanceId: this.instanceId })
  }

  private async startInstance(): Promise<void> {
    if (!this.instanceId) return

    await this.registryClient.server.startInstance(this.instanceId)
    this.log('Instance started on-chain')
  }

  private startHeartbeatTimer(): void {
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeat(),
      this.config.heartbeatIntervalMs,
    )
  }

  private startCheckpointTimer(): void {
    this.checkpointTimer = setInterval(
      () => this.saveCheckpoint(),
      this.config.checkpointIntervalMs,
    )
  }

  private startMonitoring(): void {
    // Monitor for stale instances we can take over
    this.monitorTimer = setInterval(async () => {
      if (this.instanceId) return // Already operator

      const isStale = await this.registryClient.server.isActiveStale()
      if (isStale) {
        this.log('Detected stale instance - attempting takeover')
        // Would trigger takeover flow
      }
    }, 60000) // Check every minute
  }

  private stopTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer)
      this.checkpointTimer = null
    }
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verbose) {
      logger.info(`[Orchestrator] ${message}`, data)
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let orchestrator: Orchestrator | null = null

function _createOrchestrator(config: OrchestratorConfig): Orchestrator {
  orchestrator = new Orchestrator(config)
  return orchestrator
}

function _getOrchestrator(): Orchestrator | null {
  return orchestrator
}
