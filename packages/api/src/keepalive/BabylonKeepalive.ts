/**
 * Babylon Keepalive Configuration
 *
 * Manages registration and health reporting with Jeju KeepaliveRegistry.
 * Ensures Babylon backend auto-restarts and stays funded.
 *
 * Resources monitored:
 * - Game Engine API (/api/health)
 * - WebSocket connections
 * - Training orchestrator
 * - Agent vault balance
 * - IPFS frontend
 *
 * Auto-recovery:
 * - Auto-fund from treasury when balance low
 * - Re-pin IPFS content if missing
 * - Restart triggers if failed
 *
 * Target: <1 hour downtime recovery
 */

import {
  type BabylonPublicClient,
  type BabylonWalletClient,
  safeReadContract,
  safeWriteContract,
} from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { keccak256, parseEther, toBytes } from 'viem'

// Simple logger for keepalive
const log = (
  level: 'log' | 'warn' | 'error',
  msg: string,
  data?: Record<string, unknown>,
) => console[level](`[Keepalive] ${msg}`, data ?? '')

const logger = {
  info: (msg: string, data?: Record<string, unknown>) => log('log', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) =>
    log('error', msg, data),
  debug: (msg: string, data?: Record<string, unknown>) =>
    process.env.DEBUG && log('log', msg, data),
}

// ============================================================================
// Types
// ============================================================================

export enum ResourceType {
  IPFS_CONTENT = 0,
  COMPUTE_ENDPOINT = 1,
  TRIGGER = 2,
  STORAGE = 3,
  AGENT = 4,
  CUSTOM = 5,
}

export enum HealthStatus {
  UNKNOWN = 0,
  HEALTHY = 1,
  DEGRADED = 2,
  UNHEALTHY = 3,
  UNFUNDED = 4,
}

export interface ResourceConfig {
  type: ResourceType
  identifier: string
  healthEndpoint: string
  minBalance: bigint
  required: boolean
}

export interface KeepaliveConfig {
  /** JNS name node (e.g., babylon.jeju) */
  jnsNode: Hex
  /** ERC-8004 agent ID for AI CEO */
  agentId: bigint
  /** Babylon Agent Vault address */
  vaultAddress: Address
  /** Minimum balance to maintain */
  globalMinBalance: bigint
  /** Health check interval (seconds) */
  checkInterval: number
  /** Amount to auto-fund when low */
  autoFundAmount: bigint
  /** Enable auto-funding */
  autoFundEnabled: boolean
  /** Resources to monitor */
  resources: ResourceConfig[]
  /** Dependencies (other keepalives) */
  dependencies: Hex[]
}

export interface HealthCheckResult {
  status: HealthStatus
  balance: bigint
  healthyResources: number
  totalResources: number
  failedResources: string[]
  latencyMs: number
  timestamp: number
}

// ============================================================================
// ABI (minimal for interaction)
// ============================================================================

const KEEPALIVE_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerKeepalive',
    inputs: [
      { name: 'jnsNode', type: 'bytes32' },
      { name: 'agentId', type: 'uint256' },
      { name: 'vaultAddress', type: 'address' },
      { name: 'globalMinBalance', type: 'uint256' },
      { name: 'checkInterval', type: 'uint256' },
      { name: 'autoFundAmount', type: 'uint256' },
      { name: 'autoFundEnabled', type: 'bool' },
    ],
    outputs: [{ name: 'keepaliveId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addResource',
    inputs: [
      { name: 'keepaliveId', type: 'bytes32' },
      { name: 'resourceType', type: 'uint8' },
      { name: 'identifier', type: 'string' },
      { name: 'healthEndpoint', type: 'string' },
      { name: 'minBalance', type: 'uint256' },
      { name: 'required', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordHealthCheck',
    inputs: [
      { name: 'keepaliveId', type: 'bytes32' },
      { name: 'status', type: 'uint8' },
      { name: 'balance', type: 'uint256' },
      { name: 'healthyResources', type: 'uint8' },
      { name: 'totalResources', type: 'uint8' },
      { name: 'failedResources', type: 'string[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStatus',
    inputs: [{ name: 'keepaliveId', type: 'bytes32' }],
    outputs: [
      { name: 'funded', type: 'bool' },
      { name: 'status', type: 'uint8' },
      { name: 'lastCheck', type: 'uint256' },
      { name: 'balance', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

// ============================================================================
// Default Babylon Configuration
// ============================================================================

export function getDefaultBabylonKeepaliveConfig(): KeepaliveConfig {
  // JNS node hash for "babylon.jeju"
  const jnsNode = keccak256(toBytes('babylon.jeju')) as Hex

  return {
    jnsNode,
    agentId: BigInt(process.env.AI_CEO_AGENT_ID ?? '1'),
    vaultAddress: (process.env.BABYLON_AGENT_VAULT_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    globalMinBalance: parseEther('0.1'), // 0.1 ETH minimum
    checkInterval: 300, // 5 minutes
    autoFundAmount: parseEther('1'), // 1 ETH top-up
    autoFundEnabled: true,
    resources: [
      // Game Engine API
      {
        type: ResourceType.COMPUTE_ENDPOINT,
        identifier: process.env.BABYLON_API_URL ?? 'https://api.babylon.game',
        healthEndpoint: '/api/health',
        minBalance: 0n,
        required: true,
      },
      // WebSocket endpoint
      {
        type: ResourceType.COMPUTE_ENDPOINT,
        identifier: process.env.BABYLON_WS_URL ?? 'wss://ws.babylon.game',
        healthEndpoint: '/health',
        minBalance: 0n,
        required: true,
      },
      // Training orchestrator
      {
        type: ResourceType.COMPUTE_ENDPOINT,
        identifier:
          process.env.TRAINING_API_URL ?? 'https://training.babylon.game',
        healthEndpoint: '/health',
        minBalance: 0n,
        required: false, // Degraded if down, not unhealthy
      },
      // IPFS frontend
      {
        type: ResourceType.IPFS_CONTENT,
        identifier: process.env.BABYLON_FRONTEND_CID ?? '',
        healthEndpoint: '',
        minBalance: 0n,
        required: true,
      },
      // Agent vault balance
      {
        type: ResourceType.CUSTOM,
        identifier: 'agent-vault-balance',
        healthEndpoint: '',
        minBalance: parseEther('0.05'), // 0.05 ETH minimum
        required: true,
      },
    ],
    dependencies: [],
  }
}

// ============================================================================
// BabylonKeepalive Service
// ============================================================================

export class BabylonKeepalive {
  private config: KeepaliveConfig
  private keepaliveId: Hex | null = null
  private registryAddress: Address
  private publicClient: BabylonPublicClient
  private walletClient: BabylonWalletClient | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private isRunning: boolean = false

  constructor(
    registryAddress: Address,
    publicClient: BabylonPublicClient,
    walletClient: BabylonWalletClient | null = null,
    config?: Partial<KeepaliveConfig>,
  ) {
    this.registryAddress = registryAddress
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.config = { ...getDefaultBabylonKeepaliveConfig(), ...config }
  }

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /**
   * Register Babylon with KeepaliveRegistry
   */
  async register(): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for registration')
    }

    logger.info('[Keepalive] Registering Babylon keepalive')

    const hash = await safeWriteContract(this.walletClient, {
      address: this.registryAddress,
      abi: KEEPALIVE_REGISTRY_ABI,
      functionName: 'registerKeepalive',
      args: [
        this.config.jnsNode,
        this.config.agentId,
        this.config.vaultAddress,
        this.config.globalMinBalance,
        BigInt(this.config.checkInterval),
        this.config.autoFundAmount,
        this.config.autoFundEnabled,
      ],
      chain: this.walletClient.chain,
      account: this.walletClient.account,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    // Extract keepaliveId from logs
    // In production, decode from KeepaliveRegistered event
    this.keepaliveId = keccak256(
      toBytes(
        `${this.walletClient.account?.address}:${this.config.jnsNode}:${Date.now()}`,
      ),
    ) as Hex

    logger.info('[Keepalive] Registered', {
      keepaliveId: this.keepaliveId,
      txHash: hash,
      blockNumber: receipt.blockNumber,
    })

    // Add resources
    await this.addResources()

    return this.keepaliveId
  }

  /**
   * Add resources to monitor
   */
  private async addResources(): Promise<void> {
    if (!this.walletClient || !this.keepaliveId) {
      throw new Error('Must register before adding resources')
    }

    for (const resource of this.config.resources) {
      if (!resource.identifier) continue

      const hash = await safeWriteContract(this.walletClient, {
        address: this.registryAddress,
        abi: KEEPALIVE_REGISTRY_ABI,
        functionName: 'addResource',
        args: [
          this.keepaliveId,
          resource.type,
          resource.identifier,
          resource.healthEndpoint,
          resource.minBalance,
          resource.required,
        ],
        chain: this.walletClient.chain,
        account: this.walletClient.account,
      })

      await this.publicClient.waitForTransactionReceipt({ hash })

      logger.info('[Keepalive] Added resource', {
        type: ResourceType[resource.type],
        identifier: resource.identifier,
      })
    }
  }

  // --------------------------------------------------------------------------
  // Health Checking
  // --------------------------------------------------------------------------

  /**
   * Start automatic health checking
   */
  startHealthChecking(intervalMs: number = 60_000): void {
    if (this.isRunning) return

    this.isRunning = true
    logger.info('[Keepalive] Starting health check loop', { intervalMs })

    // Initial check
    this.performHealthCheck().catch((err) =>
      logger.error('[Keepalive] Health check failed', { error: err }),
    )

    // Periodic checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck().catch((err) =>
        logger.error('[Keepalive] Health check failed', { error: err }),
      )
    }, intervalMs)
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.isRunning = false
    logger.info('[Keepalive] Stopped health check loop')
  }

  /**
   * Perform a health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    const failedResources: string[] = []
    let healthyCount = 0

    // Check each resource
    for (const resource of this.config.resources) {
      const healthy = await this.checkResource(resource)
      if (healthy) {
        healthyCount++
      } else {
        failedResources.push(resource.identifier)
      }
    }

    // Get vault balance
    const balance = await this.getVaultBalance()

    // Determine overall status
    let status = HealthStatus.HEALTHY

    if (balance < this.config.globalMinBalance) {
      status = HealthStatus.UNFUNDED
    } else if (failedResources.length > 0) {
      const requiredFailed = this.config.resources.filter(
        (r) => r.required && failedResources.includes(r.identifier),
      )
      status =
        requiredFailed.length > 0
          ? HealthStatus.UNHEALTHY
          : HealthStatus.DEGRADED
    }

    const result: HealthCheckResult = {
      status,
      balance,
      healthyResources: healthyCount,
      totalResources: this.config.resources.length,
      failedResources,
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
    }

    // Report to chain if we have wallet and keepaliveId
    if (this.walletClient && this.keepaliveId) {
      await this.reportHealthCheck(result)
    }

    logger.info('[Keepalive] Health check complete', {
      status: HealthStatus[status],
      healthy: healthyCount,
      total: this.config.resources.length,
      failed: failedResources,
      balance: balance.toString(),
      latencyMs: result.latencyMs,
    })

    return result
  }

  /**
   * Check a single resource
   */
  private async checkResource(resource: ResourceConfig): Promise<boolean> {
    // Balance check
    if (
      resource.type === ResourceType.CUSTOM &&
      resource.identifier === 'agent-vault-balance'
    ) {
      return (await this.getVaultBalance()) >= resource.minBalance
    }

    // IPFS content check
    if (resource.type === ResourceType.IPFS_CONTENT) {
      return !resource.identifier || this.checkIPFSContent(resource.identifier)
    }

    // HTTP health check
    if (!resource.healthEndpoint) return true

    const separator = resource.identifier.endsWith('/') ? '' : '/'
    const endpoint = resource.healthEndpoint.replace(/^\//, '')
    const url = `${resource.identifier}${separator}${endpoint}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)
    return response?.ok ?? false
  }

  /**
   * Check IPFS content is pinned
   */
  private async checkIPFSContent(cid: string): Promise<boolean> {
    const gatewayUrl = process.env.IPFS_GATEWAY ?? 'https://ipfs.io/ipfs'
    const response = await fetch(`${gatewayUrl}/${cid}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    }).catch(() => null)

    return response?.ok ?? false
  }

  private readonly ZERO_ADDRESS =
    '0x0000000000000000000000000000000000000000' as Address

  /**
   * Get agent vault balance
   */
  private async getVaultBalance(): Promise<bigint> {
    if (
      !this.config.vaultAddress ||
      this.config.vaultAddress === this.ZERO_ADDRESS
    ) {
      return 0n
    }
    return this.publicClient.getBalance({ address: this.config.vaultAddress })
  }

  /**
   * Report health check to chain
   */
  private async reportHealthCheck(result: HealthCheckResult): Promise<void> {
    if (!this.walletClient || !this.keepaliveId) return

    const hash = await safeWriteContract(this.walletClient, {
      address: this.registryAddress,
      abi: KEEPALIVE_REGISTRY_ABI,
      functionName: 'recordHealthCheck',
      args: [
        this.keepaliveId,
        result.status,
        result.balance,
        result.healthyResources,
        result.totalResources,
        result.failedResources,
      ],
      chain: this.walletClient.chain,
      account: this.walletClient.account,
    })

    await this.publicClient.waitForTransactionReceipt({ hash })

    logger.debug('[Keepalive] Reported health check', {
      txHash: hash,
      status: HealthStatus[result.status],
    })
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  /**
   * Get current status from chain
   */
  async getStatus(): Promise<{
    funded: boolean
    status: HealthStatus
    lastCheck: bigint
    balance: bigint
  } | null> {
    if (!this.keepaliveId) return null

    const [funded, status, lastCheck, balance] = await safeReadContract<
      [boolean, number, bigint, bigint]
    >(this.publicClient, {
      address: this.registryAddress,
      abi: KEEPALIVE_REGISTRY_ABI,
      functionName: 'getStatus',
      args: [this.keepaliveId],
    })

    return {
      funded,
      status: status as HealthStatus,
      lastCheck,
      balance,
    }
  }

  getKeepaliveId(): Hex | null {
    return this.keepaliveId
  }

  getConfig(): KeepaliveConfig {
    return this.config
  }

  isHealthChecking(): boolean {
    return this.isRunning
  }

  /**
   * Set keepalive ID (for existing registrations)
   */
  setKeepaliveId(id: Hex): void {
    this.keepaliveId = id
  }
}

// ============================================================================
// Factory
// ============================================================================

let _instance: BabylonKeepalive | null = null

export function getBabylonKeepalive(): BabylonKeepalive | null {
  return _instance
}

export function initBabylonKeepalive(
  registryAddress: Address,
  publicClient: BabylonPublicClient,
  walletClient?: BabylonWalletClient,
  config?: Partial<KeepaliveConfig>,
): BabylonKeepalive {
  _instance = new BabylonKeepalive(
    registryAddress,
    publicClient,
    walletClient,
    config,
  )
  return _instance
}

export function resetBabylonKeepalive(): void {
  if (_instance) {
    _instance.stopHealthChecking()
    _instance = null
  }
}
