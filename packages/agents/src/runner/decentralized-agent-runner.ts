/**
 * Decentralized Agent Runner
 *
 * Runs on any Jeju compute node, pulling agent configurations from SQLit,
 * executing autonomous ticks, and reporting execution on-chain.
 *
 * Architecture:
 * 1. Pull: Fetches agent configs from SQLit database
 * 2. Hydrate: Creates ElizaOS runtime with Jeju Compute plugin
 * 3. Execute: Runs autonomous tick for each agent
 * 4. Report: Records execution results on-chain
 * 5. Settle: x402 payment settlement for compute usage
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db'
import type { AgentRuntime } from '@elizaos/core'
import { generateSnowflakeId } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'
import { autonomousCoordinator } from '../autonomous'
import { agentRuntimeManager } from '../runtime/AgentRuntimeManager'
import { logger } from '../shared/logger'

export interface AgentRunnerConfig {
  /** Node's wallet address for registration and billing */
  nodeAddress: Address
  /** Jeju network: localnet | testnet | mainnet */
  network: 'localnet' | 'testnet' | 'mainnet'
  /** Maximum concurrent agents to run */
  maxConcurrentAgents: number
  /** Tick interval in milliseconds */
  tickIntervalMs: number
  /** Gateway URL for Jeju services */
  gatewayUrl?: string
  /** Enable trajectory recording for RL training */
  recordTrajectories?: boolean
}

export interface AgentExecution {
  agentId: string
  nodeAddress: Address
  startTime: number
  endTime: number
  actionsExecuted: {
    trades: number
    posts: number
    comments: number
    messages: number
    groupMessages: number
    engagements: number
  }
  success: boolean
  error?: string
  trajectoryId?: string
}

export interface ExecutionReport {
  executionId: string
  nodeAddress: Address
  agents: AgentExecution[]
  totalCompute: bigint
  signature?: Hex
}

const GATEWAY_URLS = {
  localnet: 'http://localhost:4200',
  testnet: 'https://gateway.testnet.jejunetwork.org',
  mainnet: 'https://gateway.jejunetwork.org',
} as const

/**
 * Decentralized Agent Runner
 *
 * Runs agent autonomous loops on any Jeju compute node.
 * Pulls configs from SQLit, executes via ElizaOS, reports on-chain.
 */
export class DecentralizedAgentRunner {
  private config: AgentRunnerConfig
  private gatewayUrl: string
  private running = false
  private activeAgents = new Map<string, AgentRuntime>()
  private tickInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: AgentRunnerConfig) {
    this.config = config
    this.gatewayUrl = config.gatewayUrl ?? GATEWAY_URLS[config.network]
  }

  /**
   * Start the agent runner daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Agent runner already running', undefined, 'AgentRunner')
      return
    }

    logger.info(
      'Starting decentralized agent runner',
      {
        nodeAddress: this.config.nodeAddress,
        network: this.config.network,
        maxConcurrentAgents: this.config.maxConcurrentAgents,
        tickIntervalMs: this.config.tickIntervalMs,
      },
      'AgentRunner',
    )

    // Register node with Jeju network
    await this.registerNode()

    // Start the tick loop
    this.running = true
    this.tickInterval = setInterval(
      () => this.runTickCycle(),
      this.config.tickIntervalMs,
    )

    // Run first tick immediately
    await this.runTickCycle()
  }

  /**
   * Stop the agent runner daemon
   */
  async stop(): Promise<void> {
    if (!this.running) return

    logger.info('Stopping agent runner', undefined, 'AgentRunner')

    this.running = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }

    // Clear all runtimes
    agentRuntimeManager.clearAllRuntimes()
    this.activeAgents.clear()

    // Deregister node
    await this.deregisterNode()
  }

  /**
   * Run a single tick cycle for all assigned agents
   */
  private async runTickCycle(): Promise<void> {
    const cycleStart = Date.now()
    const executionId = await generateSnowflakeId()

    logger.debug(`Starting tick cycle ${executionId}`, undefined, 'AgentRunner')

    // Fetch agents assigned to this node
    const agents = await this.fetchAssignedAgents()

    if (agents.length === 0) {
      logger.debug('No agents assigned to this node', undefined, 'AgentRunner')
      return
    }

    const executions: AgentExecution[] = []

    // Process agents in batches
    const batchSize = this.config.maxConcurrentAgents
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map((agentId) => this.executeAgentTick(agentId)),
      )

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        const agentId = batch[j]
        if (!agentId || !result) continue

        if (result.status === 'fulfilled') {
          executions.push(result.value)
        } else {
          const errorReason = result.reason
          executions.push({
            agentId,
            nodeAddress: this.config.nodeAddress,
            startTime: cycleStart,
            endTime: Date.now(),
            actionsExecuted: {
              trades: 0,
              posts: 0,
              comments: 0,
              messages: 0,
              groupMessages: 0,
              engagements: 0,
            },
            success: false,
            error:
              errorReason instanceof Error
                ? errorReason.message
                : 'Unknown error',
          })
        }
      }
    }

    // Report execution on-chain
    const report: ExecutionReport = {
      executionId,
      nodeAddress: this.config.nodeAddress,
      agents: executions,
      totalCompute: this.calculateComputeUsage(executions),
    }

    await this.reportExecution(report)

    const cycleDuration = Date.now() - cycleStart
    const successCount = executions.filter((e) => e.success).length

    logger.info(
      `Tick cycle completed: ${successCount}/${agents.length} agents, ${cycleDuration}ms`,
      { executionId, successCount, totalAgents: agents.length },
      'AgentRunner',
    )
  }

  /**
   * Execute autonomous tick for a single agent
   */
  private async executeAgentTick(agentId: string): Promise<AgentExecution> {
    const startTime = Date.now()

    // Get or create runtime
    const runtime = await agentRuntimeManager.getRuntime(agentId)
    this.activeAgents.set(agentId, runtime)

    // Execute autonomous tick
    const result = await autonomousCoordinator.executeAutonomousTick(
      agentId,
      runtime,
      this.config.recordTrajectories ?? false,
    )

    const endTime = Date.now()

    return {
      agentId,
      nodeAddress: this.config.nodeAddress,
      startTime,
      endTime,
      actionsExecuted: result.actionsExecuted,
      success: result.success,
      trajectoryId: result.trajectoryId,
    }
  }

  /**
   * Fetch agents assigned to this compute node from SQLit
   */
  private async fetchAssignedAgents(): Promise<string[]> {
    // Query the agent registry for agents assigned to this node
    // In a fully decentralized setup, agents are assigned based on:
    // 1. Agent preferences (specific node requirements)
    // 2. Node capacity and load
    // 3. Geographic distribution for latency
    // 4. Cost optimization

    const response = await fetch(`${this.gatewayUrl}/v1/agents/assigned`, {
      headers: {
        'x-jeju-address': this.config.nodeAddress,
      },
    }).catch(() => null)

    if (!response?.ok) {
      // Fallback to local query if gateway unavailable
      return this.fetchAgentsFromSQLit()
    }

    const data = (await response.json()) as { agents: string[] }
    return data.agents
  }

  /**
   * Fetch agents directly from SQLit database
   */
  private async fetchAgentsFromSQLit(): Promise<string[]> {
    // Query for active autonomous agents using raw SQL
    // Join users with userAgentConfigs to find agents with any autonomous feature enabled
    const results = await db.query<{ id: string }>(
      `SELECT DISTINCT u."id"
       FROM "User" u
       INNER JOIN "UserAgentConfig" uac ON u."id" = uac."userId"
       WHERE u."isAgent" = true
         AND (
           uac."autonomousTrading" = true
           OR uac."autonomousPosting" = true
           OR uac."autonomousCommenting" = true
           OR uac."autonomousDMs" = true
           OR uac."autonomousGroupChats" = true
         )
       LIMIT $1`,
      [this.config.maxConcurrentAgents],
    )

    return results.map((r) => r.id)
  }

  /**
   * Register this node with Jeju network
   */
  private async registerNode(): Promise<void> {
    const response = await fetch(`${this.gatewayUrl}/v1/nodes/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.config.nodeAddress,
      },
      body: JSON.stringify({
        type: 'agent-runner',
        capacity: this.config.maxConcurrentAgents,
        capabilities: [
          'babylon-agents',
          'autonomous-tick',
          'trajectory-recording',
        ],
      }),
    }).catch(() => null)

    if (!response?.ok) {
      logger.warn(
        'Failed to register with Jeju gateway, running in standalone mode',
        undefined,
        'AgentRunner',
      )
    } else {
      logger.info('Registered with Jeju network', undefined, 'AgentRunner')
    }
  }

  /**
   * Deregister this node from Jeju network
   */
  private async deregisterNode(): Promise<void> {
    await fetch(`${this.gatewayUrl}/v1/nodes/deregister`, {
      method: 'POST',
      headers: {
        'x-jeju-address': this.config.nodeAddress,
      },
    }).catch(() => null)
  }

  /**
   * Report execution results to Jeju network
   */
  private async reportExecution(report: ExecutionReport): Promise<void> {
    const response = await fetch(`${this.gatewayUrl}/v1/executions/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.config.nodeAddress,
      },
      body: JSON.stringify(report),
    }).catch(() => null)

    if (!response?.ok) {
      logger.warn(
        'Failed to report execution to gateway',
        { executionId: report.executionId },
        'AgentRunner',
      )
    }
  }

  /**
   * Calculate total compute usage for billing
   */
  private calculateComputeUsage(executions: AgentExecution[]): bigint {
    // Calculate compute units based on:
    // 1. Duration
    // 2. Actions executed
    // 3. LLM tokens used
    let totalUnits = 0n

    for (const exec of executions) {
      const duration = BigInt(exec.endTime - exec.startTime)
      const actions = Object.values(exec.actionsExecuted).reduce(
        (a, b) => a + b,
        0,
      )

      // Base unit: 1 per second of compute
      totalUnits += duration / 1000n

      // Additional units per action
      totalUnits += BigInt(actions) * 10n
    }

    return totalUnits
  }

  /**
   * Get runner status
   */
  getStatus(): {
    running: boolean
    activeAgents: number
    nodeAddress: Address
    network: string
  } {
    return {
      running: this.running,
      activeAgents: this.activeAgents.size,
      nodeAddress: this.config.nodeAddress,
      network: this.config.network,
    }
  }
}

/**
 * Create and start a decentralized agent runner
 */
export function createAgentRunner(
  config: Partial<AgentRunnerConfig> & { nodeAddress: Address },
): DecentralizedAgentRunner {
  const fullConfig: AgentRunnerConfig = {
    network:
      (process.env.JEJU_NETWORK as 'localnet' | 'testnet' | 'mainnet') ??
      'localnet',
    maxConcurrentAgents: 10,
    tickIntervalMs: 60_000, // 1 minute default
    recordTrajectories: process.env.RECORD_TRAJECTORIES === 'true',
    ...config,
  }

  return new DecentralizedAgentRunner(fullConfig)
}

/**
 * Main entry point for running as a standalone daemon
 */
export async function runAgentDaemon(): Promise<void> {
  const nodeAddress = process.env.JEJU_WALLET_ADDRESS as Address
  if (!nodeAddress) {
    throw new Error('JEJU_WALLET_ADDRESS is required to run agent daemon')
  }

  const runner = createAgentRunner({
    nodeAddress,
    maxConcurrentAgents: Number(process.env.MAX_CONCURRENT_AGENTS ?? 10),
    tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 60_000),
    recordTrajectories: process.env.RECORD_TRAJECTORIES === 'true',
  })

  // Handle shutdown gracefully
  const shutdown = async () => {
    logger.info('Shutting down agent daemon...', undefined, 'AgentRunner')
    await runner.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await runner.start()

  logger.info(
    'Agent daemon running. Press Ctrl+C to stop.',
    undefined,
    'AgentRunner',
  )
}
