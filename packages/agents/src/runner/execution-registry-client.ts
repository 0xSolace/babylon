/**
 * Execution Registry Client
 *
 * TypeScript client for interacting with the AgentExecutionRegistry contract.
 * Enables on-chain reporting and settlement of agent executions.
 *
 * @packageDocumentation
 */

import {
  type BabylonPublicClient,
  type BabylonWalletClient,
  safeReadContract,
} from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { logger } from '../shared/logger'

// Contract ABI (minimal for client usage)
const EXECUTION_REGISTRY_ABI = [
  {
    name: 'registerNode',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'capacity', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'deregisterNode',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'reportExecution',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'executionId', type: 'bytes32' },
      { name: 'agentId', type: 'bytes32' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'actionsExecuted', type: 'uint256' },
      { name: 'success', type: 'bool' },
      { name: 'trajectoryHash', type: 'bytes32' },
      { name: 'computeUnits', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'nodes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'operator', type: 'address' },
      { name: 'stake', type: 'uint256' },
      { name: 'capacity', type: 'uint256' },
      { name: 'totalExecutions', type: 'uint256' },
      { name: 'successfulExecutions', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
  },
  {
    name: 'agentStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'totalExecutions', type: 'uint256' },
      { name: 'successfulExecutions', type: 'uint256' },
      { name: 'totalActions', type: 'uint256' },
      { name: 'totalComputeUnits', type: 'uint256' },
      { name: 'lastExecutionTime', type: 'uint256' },
    ],
  },
  {
    name: 'getNodeSuccessRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isNodeAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export interface ExecutionNode {
  operator: Address
  stake: bigint
  capacity: bigint
  totalExecutions: bigint
  successfulExecutions: bigint
  active: boolean
  registeredAt: bigint
}

export interface AgentStats {
  totalExecutions: bigint
  successfulExecutions: bigint
  totalActions: bigint
  totalComputeUnits: bigint
  lastExecutionTime: bigint
}

export interface ExecutionReportParams {
  executionId: Hex
  agentId: Hex
  startTime: bigint
  endTime: bigint
  actionsExecuted: bigint
  success: boolean
  trajectoryHash: Hex
  computeUnits: bigint
}

/**
 * Client for the AgentExecutionRegistry contract
 */
export class ExecutionRegistryClient {
  private publicClient: BabylonPublicClient
  private walletClient: BabylonWalletClient | null
  private contractAddress: Address

  constructor(config: {
    publicClient: BabylonPublicClient
    walletClient?: BabylonWalletClient | null
    contractAddress: Address
  }) {
    this.publicClient = config.publicClient
    this.walletClient =
      config.walletClient !== undefined ? config.walletClient : null
    this.contractAddress = config.contractAddress
  }

  /**
   * Register as an execution node
   */
  async registerNode(capacity: bigint, stakeAmount: bigint): Promise<Hex> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for registration')
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'registerNode',
      args: [capacity],
      value: stakeAmount,
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    })

    logger.info(
      'Node registration submitted',
      { hash, capacity: capacity.toString() },
      'ExecutionRegistry',
    )

    return hash
  }

  /**
   * Deregister as an execution node
   */
  async deregisterNode(): Promise<Hex> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for deregistration')
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'deregisterNode',
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    })

    logger.info('Node deregistration submitted', { hash }, 'ExecutionRegistry')

    return hash
  }

  /**
   * Report an agent execution on-chain
   */
  async reportExecution(params: ExecutionReportParams): Promise<Hex> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for reporting')
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'reportExecution',
      args: [
        params.executionId,
        params.agentId,
        params.startTime,
        params.endTime,
        params.actionsExecuted,
        params.success,
        params.trajectoryHash,
        params.computeUnits,
      ],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    })

    logger.debug(
      'Execution report submitted',
      { hash, executionId: params.executionId },
      'ExecutionRegistry',
    )

    return hash
  }

  /**
   * Get node information
   */
  async getNode(address: Address): Promise<ExecutionNode> {
    const result = await safeReadContract<
      [Address, bigint, bigint, bigint, bigint, boolean, bigint]
    >(this.publicClient, {
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'nodes',
      args: [address],
    })

    const [
      operator,
      stake,
      capacity,
      totalExecutions,
      successfulExecutions,
      active,
      registeredAt,
    ] = result

    return {
      operator,
      stake,
      capacity,
      totalExecutions,
      successfulExecutions,
      active,
      registeredAt,
    }
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId: Hex): Promise<AgentStats> {
    const result = await safeReadContract<
      [bigint, bigint, bigint, bigint, bigint]
    >(this.publicClient, {
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'agentStats',
      args: [agentId],
    })

    const [
      totalExecutions,
      successfulExecutions,
      totalActions,
      totalComputeUnits,
      lastExecutionTime,
    ] = result

    return {
      totalExecutions,
      successfulExecutions,
      totalActions,
      totalComputeUnits,
      lastExecutionTime,
    }
  }

  /**
   * Get node success rate (0-1 scale)
   */
  async getNodeSuccessRate(address: Address): Promise<number> {
    const result = await safeReadContract<bigint>(this.publicClient, {
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'getNodeSuccessRate',
      args: [address],
    })

    // Result is scaled by 1e18
    return Number(result) / 1e18
  }

  /**
   * Check if node is available
   */
  async isNodeAvailable(address: Address): Promise<boolean> {
    const result = await safeReadContract<boolean>(this.publicClient, {
      address: this.contractAddress,
      abi: EXECUTION_REGISTRY_ABI,
      functionName: 'isNodeAvailable',
      args: [address],
    })
    return result
  }
}

/**
 * Convert a string to bytes32 hash for contract calls
 */
export function stringToBytes32(str: string): Hex {
  // Use keccak256 for consistent hashing
  const encoder = new TextEncoder()
  const data = encoder.encode(str)

  // Simple hash - in production use proper keccak256
  let hash = 0n
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 8n) | BigInt(data[i] ?? 0)
    if (hash > 2n ** 256n) {
      hash = hash % 2n ** 256n
    }
  }

  return `0x${hash.toString(16).padStart(64, '0')}` as Hex
}

/**
 * Create execution registry client from environment
 */
export function createExecutionRegistryClient(config: {
  publicClient: BabylonPublicClient
  walletClient?: BabylonWalletClient
}): ExecutionRegistryClient | null {
  const contractAddress = process.env
    .AGENT_EXECUTION_REGISTRY_ADDRESS as Address

  if (!contractAddress) {
    logger.warn(
      'AGENT_EXECUTION_REGISTRY_ADDRESS not set, on-chain reporting disabled',
      undefined,
      'ExecutionRegistry',
    )
    return null
  }

  return new ExecutionRegistryClient({
    ...config,
    contractAddress,
  })
}
