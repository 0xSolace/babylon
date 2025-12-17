/**
 * BanManager Client
 *
 * Integrates with Jeju's BanManager contract for network-level moderation.
 * Provides ban checking and enforcement for all API endpoints.
 *
 * Features:
 * - Network-wide ban checking
 * - App-specific ban checking
 * - Address-based ban checking (for wallet addresses)
 * - Integration with ERC-8004 agent identities
 * - On-chain ban verification
 *
 * @see https://github.com/elizaos/jeju/packages/contracts/src/moderation/BanManager.sol
 */

import { logger } from '@babylon/shared';
import { type Address, createPublicClient, type Hex, http } from 'viem';
import { base, baseSepolia, hardhat } from 'viem/chains';

// BanManager ABI (minimal for read operations)
const BAN_MANAGER_ABI = [
  {
    name: 'isAccessAllowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: 'allowed', type: 'bool' }],
  },
  {
    name: 'isNetworkBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isAppBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isAddressBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isOnNotice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isPermanentlyBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isAddressAccessAllowed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getNetworkBan',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'ban',
        type: 'tuple',
        components: [
          { name: 'isBanned', type: 'bool' },
          { name: 'bannedAt', type: 'uint256' },
          { name: 'reason', type: 'string' },
          { name: 'proposalId', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'getAddressBan',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [
      {
        name: 'ban',
        type: 'tuple',
        components: [
          { name: 'isBanned', type: 'bool' },
          { name: 'banType', type: 'uint8' },
          { name: 'bannedAt', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'reason', type: 'string' },
          { name: 'proposalId', type: 'bytes32' },
          { name: 'reporter', type: 'address' },
          { name: 'caseId', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'getBanReason',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: 'reason', type: 'string' }],
  },
] as const;

// Babylon's app ID for app-specific bans
const BABYLON_APP_ID = ('0x' +
  Buffer.from('babylon').toString('hex').padEnd(64, '0')) as Hex;

export enum BanType {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  PERMANENT = 3,
}

export interface BanRecord {
  isBanned: boolean;
  bannedAt: bigint;
  reason: string;
  proposalId: Hex;
}

export interface ExtendedBanRecord {
  isBanned: boolean;
  banType: BanType;
  bannedAt: bigint;
  expiresAt: bigint;
  reason: string;
  proposalId: Hex;
  reporter: Address;
  caseId: Hex;
}

export interface BanCheckResult {
  allowed: boolean;
  reason?: string;
  banType?: BanType;
  bannedAt?: Date;
  caseId?: Hex;
}

export class BanManagerClient {
  private client;
  private contractAddress: Address;

  constructor() {
    const network =
      process.env.JEJU_NETWORK ||
      process.env.NEXT_PUBLIC_JEJU_NETWORK ||
      'localnet';
    const rpcUrl = process.env.JEJU_RPC_URL || this.getDefaultRpcUrl(network);
    const contractAddr = process.env.BAN_MANAGER_ADDRESS as Address | undefined;

    if (!contractAddr) {
      throw new Error('[BanManager] BAN_MANAGER_ADDRESS not configured');
    }

    this.contractAddress = contractAddr;
    this.client = createPublicClient({
      chain: this.getChain(network),
      transport: http(rpcUrl),
    });
  }

  private getDefaultRpcUrl(network: string): string {
    switch (network) {
      case 'mainnet':
        return 'https://rpc.jeju.network';
      case 'testnet':
        return 'https://testnet-rpc.jeju.network';
      default:
        return 'http://127.0.0.1:9545';
    }
  }

  private getChain(network: string) {
    switch (network) {
      case 'mainnet':
        return base;
      case 'testnet':
        return baseSepolia;
      default:
        return hardhat;
    }
  }

  /**
   * Check if an agent ID has access to Babylon
   */
  async isAgentAccessAllowed(agentId: bigint): Promise<BanCheckResult> {
    const allowed = await this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isAccessAllowed',
      args: [agentId, BABYLON_APP_ID],
    });

    if (allowed) {
      return { allowed: true };
    }

    // Get ban details
    const ban = await this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'getNetworkBan',
      args: [agentId],
    });

    return {
      allowed: false,
      reason: ban.reason,
      bannedAt: new Date(Number(ban.bannedAt) * 1000),
    };
  }

  /**
   * Check if a wallet address has access to Babylon
   */
  async isAddressAccessAllowed(address: Address): Promise<BanCheckResult> {
    const allowed = await this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isAddressAccessAllowed',
      args: [address, BABYLON_APP_ID],
    });

    if (allowed) {
      return { allowed: true };
    }

    // Get extended ban details
    const ban = await this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'getAddressBan',
      args: [address],
    });

    return {
      allowed: false,
      reason: ban.reason,
      banType: ban.banType as BanType,
      bannedAt: new Date(Number(ban.bannedAt) * 1000),
      caseId: ban.caseId,
    };
  }

  /**
   * Check if address is currently on notice (pending moderation market)
   */
  async isOnNotice(address: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isOnNotice',
      args: [address],
    });
  }

  /**
   * Check if address is permanently banned
   */
  async isPermanentlyBanned(address: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isPermanentlyBanned',
      args: [address],
    });
  }

  /**
   * Get ban reason for an agent
   */
  async getBanReason(agentId: bigint): Promise<string> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'getBanReason',
      args: [agentId, BABYLON_APP_ID],
    });
  }
}

// Singleton instance
let banManagerClient: BanManagerClient | null = null;

export function getBanManagerClient(): BanManagerClient {
  if (!banManagerClient) {
    banManagerClient = new BanManagerClient();
  }
  return banManagerClient;
}

export function resetBanManagerClient(): void {
  banManagerClient = null;
}

/**
 * Check if a user/agent has access to Babylon
 * Uses both address-based and agent ID-based checks
 */
export async function checkBabylonAccess(
  walletAddress?: Address,
  agentId?: bigint
): Promise<BanCheckResult> {
  const client = getBanManagerClient();

  // Check address ban first (most common)
  if (walletAddress) {
    const addressResult = await client.isAddressAccessAllowed(walletAddress);
    if (!addressResult.allowed) {
      logger.warn(
        'Access denied for address',
        { walletAddress, reason: addressResult.reason },
        'BanManager'
      );
      return addressResult;
    }
  }

  // Check agent ID ban (for registered agents)
  if (agentId) {
    const agentResult = await client.isAgentAccessAllowed(agentId);
    if (!agentResult.allowed) {
      logger.warn(
        'Access denied for agent',
        { agentId: agentId.toString(), reason: agentResult.reason },
        'BanManager'
      );
      return agentResult;
    }
  }

  return { allowed: true };
}

/**
 * Middleware helper to check ban status
 * Returns null if allowed, or an error response if banned
 */
export async function enforceBan(
  walletAddress?: Address,
  agentId?: bigint
): Promise<{
  status: number;
  body: { error: string; reason?: string; banType?: string };
} | null> {
  const result = await checkBabylonAccess(walletAddress, agentId);

  if (result.allowed) {
    return null;
  }

  const banTypeString =
    result.banType !== undefined ? BanType[result.banType] : undefined;

  return {
    status: 403,
    body: {
      error: 'Access denied - account is banned from Babylon',
      reason: result.reason,
      banType: banTypeString,
    },
  };
}
