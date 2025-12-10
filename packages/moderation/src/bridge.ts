/**
 * @fileoverview Cross-chain ban synchronization bridge
 * @module @babylon/moderation/bridge
 *
 * Synchronizes ban status between Jeju and Babylon networks.
 */

import {
  type Address,
  createPublicClient,
  http,
  type PublicClient,
  parseAbiItem,
} from 'viem';
import { BAN_MANAGER_ABI } from './abis';
import type {
  BabylonModerationConfig,
  CrossChainBanSync,
  JejuModerationConfig,
} from './types';

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
] as const;

/**
 * ModerationBridge handles synchronization of ban status between
 * Jeju's address-based ModerationMarketplace and Babylon's agentId-based BanManager.
 */
export class ModerationBridge {
  private readonly jejuClient: PublicClient;
  private readonly babylonClient: PublicClient;
  private readonly jejuConfig: JejuModerationConfig;
  private readonly babylonConfig: BabylonModerationConfig;
  private syncedBans: Map<string, CrossChainBanSync> = new Map();

  constructor(
    jejuConfig: JejuModerationConfig,
    babylonConfig: BabylonModerationConfig
  ) {
    this.jejuConfig = jejuConfig;
    this.babylonConfig = babylonConfig;

    this.jejuClient = createPublicClient({
      transport: http(jejuConfig.rpcUrl),
    });

    this.babylonClient = createPublicClient({
      transport: http(babylonConfig.rpcUrl),
    });
  }

  /**
   * Check if an address is banned on Jeju
   */
  async isJejuBanned(address: Address): Promise<boolean> {
    return this.jejuClient.readContract({
      address: this.jejuConfig.banManager,
      abi: BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [address],
    }) as Promise<boolean>;
  }

  /**
   * Check if an address is banned on Babylon
   */
  async isBabylonBanned(address: Address): Promise<boolean> {
    return this.babylonClient.readContract({
      address: this.babylonConfig.banManager,
      abi: BABYLON_BAN_MANAGER_ABI,
      functionName: 'isAddressBanned',
      args: [address],
    }) as Promise<boolean>;
  }

  /**
   * Check if an agent ID is banned on Babylon
   */
  async isBabylonAgentBanned(agentId: bigint): Promise<boolean> {
    return this.babylonClient.readContract({
      address: this.babylonConfig.banManager,
      abi: BABYLON_BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [agentId],
    }) as Promise<boolean>;
  }

  /**
   * Get the combined ban status across both networks
   */
  async getCombinedBanStatus(address: Address): Promise<{
    jejuBanned: boolean;
    babylonBanned: boolean;
    effectivelyBanned: boolean;
  }> {
    const [jejuBanned, babylonBanned] = await Promise.all([
      this.isJejuBanned(address),
      this.isBabylonBanned(address),
    ]);

    return {
      jejuBanned,
      babylonBanned,
      effectivelyBanned: jejuBanned || babylonBanned,
    };
  }

  /**
   * Watch for ban events on Jeju and sync to Babylon
   * This would typically be run by a relayer service
   */
  async watchJejuBans(
    onBanApplied: (
      target: Address,
      caseId: `0x${string}`,
      reason: string
    ) => Promise<void>,
    onBanRemoved: (target: Address, caseId: `0x${string}`) => Promise<void>
  ): Promise<() => void> {
    const banAppliedEvent = parseAbiItem(
      'event BanApplied(address indexed target, bytes32 indexed caseId, string reason, uint256 timestamp)'
    );
    const banRemovedEvent = parseAbiItem(
      'event BanRemoved(address indexed target, bytes32 indexed caseId, uint256 timestamp)'
    );

    const unwatch1 = this.jejuClient.watchContractEvent({
      address: this.jejuConfig.moderationMarketplace,
      abi: [banAppliedEvent],
      eventName: 'BanApplied',
      onLogs: async (logs) => {
        for (const log of logs) {
          const { target, caseId, reason } = log.args as {
            target: Address;
            caseId: `0x${string}`;
            reason: string;
          };
          await onBanApplied(target, caseId, reason);
        }
      },
    });

    const unwatch2 = this.jejuClient.watchContractEvent({
      address: this.jejuConfig.moderationMarketplace,
      abi: [banRemovedEvent],
      eventName: 'BanRemoved',
      onLogs: async (logs) => {
        for (const log of logs) {
          const { target, caseId } = log.args as {
            target: Address;
            caseId: `0x${string}`;
          };
          await onBanRemoved(target, caseId);
        }
      },
    });

    return () => {
      unwatch1();
      unwatch2();
    };
  }

  /**
   * Get all synced bans
   */
  getSyncedBans(): CrossChainBanSync[] {
    return Array.from(this.syncedBans.values());
  }

  /**
   * Record a synced ban
   */
  recordSync(sync: CrossChainBanSync): void {
    const key = `${sync.sourceChainId}:${sync.caseId}`;
    this.syncedBans.set(key, sync);
  }

  /**
   * Check if a ban has been synced
   */
  isSynced(sourceChainId: number, caseId: `0x${string}`): boolean {
    const key = `${sourceChainId}:${caseId}`;
    return this.syncedBans.has(key);
  }
}

/**
 * Create a moderation bridge between Jeju and Babylon
 */
export function createModerationBridge(
  jejuConfig: JejuModerationConfig,
  babylonConfig: BabylonModerationConfig
): ModerationBridge {
  return new ModerationBridge(jejuConfig, babylonConfig);
}
