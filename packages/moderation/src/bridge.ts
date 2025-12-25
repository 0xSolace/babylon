/**
 * @fileoverview Cross-chain ban synchronization bridge
 * @module @babylon/moderation/bridge
 *
 * Synchronizes ban status between Jeju and Babylon networks.
 */

import { BAN_MANAGER_ABI, logger } from '@babylon/shared'

/**
 * Type guard for contract read results that should return boolean
 */
function isBooleanResult(result: unknown): result is boolean {
  return typeof result === 'boolean'
}

import {
  type Address,
  createPublicClient,
  http,
  type PublicClient,
  parseAbiItem,
} from 'viem'
import { z } from 'zod'
import type {
  BabylonModerationConfig,
  CrossChainBanSync,
  JejuModerationConfig,
} from './types'

// Schema for BanApplied event args
const BanAppliedArgsSchema = z.object({
  target: z.string(),
  caseId: z.string(),
  reason: z.string(),
})

// Schema for BanRemoved event args
const BanRemovedArgsSchema = z.object({
  target: z.string(),
  caseId: z.string(),
})

// Babylon BanManager uses uint256 for agent IDs
const BABYLON_BAN_MANAGER_ABI = [
  {
    type: 'function',
    name: 'isNetworkBanned',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAccessAllowed',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: 'allowed', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'banFromNetwork',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'proposalId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbanFromNetwork',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'banAddress',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbanAddress',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isAddressBanned',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

/**
 * ModerationBridge handles synchronization of ban status between
 * Jeju's address-based ModerationMarketplace and Babylon's agentId-based BanManager.
 */
export class ModerationBridge {
  private readonly jejuClient: PublicClient
  private readonly babylonClient: PublicClient
  private readonly jejuConfig: JejuModerationConfig
  private readonly babylonConfig: BabylonModerationConfig
  private syncedBans: Map<string, CrossChainBanSync> = new Map()

  constructor(
    jejuConfig: JejuModerationConfig,
    babylonConfig: BabylonModerationConfig,
  ) {
    this.jejuConfig = jejuConfig
    this.babylonConfig = babylonConfig

    this.jejuClient = createPublicClient({
      transport: http(jejuConfig.rpcUrl),
    })

    this.babylonClient = createPublicClient({
      transport: http(babylonConfig.rpcUrl),
    })

    logger.debug('ModerationBridge initialized', {
      jejuChainId: jejuConfig.chainId,
      babylonChainId: babylonConfig.chainId,
    })
  }

  /**
   * Check if an address is banned on Jeju
   */
  async isJejuBanned(address: Address): Promise<boolean> {
    logger.debug('Checking Jeju ban status', { address })
    const result = await this.jejuClient.readContract({
      address: this.jejuConfig.banManager,
      abi: BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [address],
    })
    if (!isBooleanResult(result)) {
      throw new Error('Unexpected contract return type for isNetworkBanned')
    }
    return result
  }

  /**
   * Check if an address is banned on Babylon
   */
  async isBabylonBanned(address: Address): Promise<boolean> {
    logger.debug('Checking Babylon ban status', { address })
    const result = await this.babylonClient.readContract({
      address: this.babylonConfig.banManager,
      abi: BABYLON_BAN_MANAGER_ABI,
      functionName: 'isAddressBanned',
      args: [address],
    })
    if (!isBooleanResult(result)) {
      throw new Error('Unexpected contract return type for isAddressBanned')
    }
    return result
  }

  /**
   * Check if an agent ID is banned on Babylon
   */
  async isBabylonAgentBanned(agentId: bigint): Promise<boolean> {
    const result = await this.babylonClient.readContract({
      address: this.babylonConfig.banManager,
      abi: BABYLON_BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [agentId],
    })
    if (!isBooleanResult(result)) {
      throw new Error('Unexpected contract return type for isNetworkBanned')
    }
    return result
  }

  /**
   * Get the combined ban status across both networks
   */
  async getCombinedBanStatus(address: Address): Promise<{
    jejuBanned: boolean
    babylonBanned: boolean
    effectivelyBanned: boolean
  }> {
    const [jejuBanned, babylonBanned] = await Promise.all([
      this.isJejuBanned(address),
      this.isBabylonBanned(address),
    ])

    return {
      jejuBanned,
      babylonBanned,
      effectivelyBanned: jejuBanned || babylonBanned,
    }
  }

  /**
   * Watch for ban events on Jeju and sync to Babylon
   * This would typically be run by a relayer service
   */
  async watchJejuBans(
    onBanApplied: (
      target: Address,
      caseId: `0x${string}`,
      reason: string,
    ) => Promise<void>,
    onBanRemoved: (target: Address, caseId: `0x${string}`) => Promise<void>,
  ): Promise<() => void> {
    const banAppliedEvent = parseAbiItem(
      'event BanApplied(address indexed target, bytes32 indexed caseId, string reason, uint256 timestamp)',
    )
    const banRemovedEvent = parseAbiItem(
      'event BanRemoved(address indexed target, bytes32 indexed caseId, uint256 timestamp)',
    )

    const unwatch1 = this.jejuClient.watchContractEvent({
      address: this.jejuConfig.moderationMarketplace,
      abi: [banAppliedEvent],
      eventName: 'BanApplied',
      onLogs: async (logs) => {
        for (const log of logs) {
          const parsed = BanAppliedArgsSchema.safeParse(log.args)
          if (!parsed.success) {
            logger.error('Invalid BanApplied event args', {
              error: parsed.error,
            })
            continue
          }
          await onBanApplied(
            parsed.data.target as Address,
            parsed.data.caseId as `0x${string}`,
            parsed.data.reason,
          )
        }
      },
    })

    const unwatch2 = this.jejuClient.watchContractEvent({
      address: this.jejuConfig.moderationMarketplace,
      abi: [banRemovedEvent],
      eventName: 'BanRemoved',
      onLogs: async (logs) => {
        for (const log of logs) {
          const parsed = BanRemovedArgsSchema.safeParse(log.args)
          if (!parsed.success) {
            logger.error('Invalid BanRemoved event args', {
              error: parsed.error,
            })
            continue
          }
          await onBanRemoved(
            parsed.data.target as Address,
            parsed.data.caseId as `0x${string}`,
          )
        }
      },
    })

    return () => {
      unwatch1()
      unwatch2()
    }
  }

  /**
   * Get all synced bans
   */
  getSyncedBans(): CrossChainBanSync[] {
    return Array.from(this.syncedBans.values())
  }

  /**
   * Record a synced ban
   */
  recordSync(sync: CrossChainBanSync): void {
    const key = `${sync.sourceChainId}:${sync.caseId}`
    this.syncedBans.set(key, sync)
    logger.debug('Ban sync recorded', {
      key,
      targetAddress: sync.targetAddress,
    })
  }

  /**
   * Check if a ban has been synced
   */
  isSynced(sourceChainId: number, caseId: `0x${string}`): boolean {
    const key = `${sourceChainId}:${caseId}`
    return this.syncedBans.has(key)
  }
}

/**
 * Create a moderation bridge between Jeju and Babylon
 */
export function createModerationBridge(
  jejuConfig: JejuModerationConfig,
  babylonConfig: BabylonModerationConfig,
): ModerationBridge {
  return new ModerationBridge(jejuConfig, babylonConfig)
}
