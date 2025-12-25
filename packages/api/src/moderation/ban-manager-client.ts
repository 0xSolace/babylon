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

import { BAN_MANAGER_ABI, logger } from '@babylon/shared'

import { type Address, createPublicClient, type Hex, http } from 'viem'
import { base, baseSepolia, hardhat } from 'viem/chains'

// Babylon's app ID for app-specific bans
const BABYLON_APP_ID = ('0x' +
  Buffer.from('babylon').toString('hex').padEnd(64, '0')) as Hex

export enum BanType {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  PERMANENT = 3,
}

// biome-ignore lint/correctness/noUnusedVariables: Documents contract return type
interface BanRecord {
  isBanned: boolean
  bannedAt: bigint
  reason: string
  proposalId: Hex
}

// biome-ignore lint/correctness/noUnusedVariables: Documents contract return type
interface ExtendedBanRecord {
  isBanned: boolean
  banType: BanType
  bannedAt: bigint
  expiresAt: bigint
  reason: string
  proposalId: Hex
  reporter: Address
  caseId: Hex
}

export interface BanCheckResult {
  allowed: boolean
  reason?: string
  banType?: BanType
  bannedAt?: Date
  caseId?: Hex
}

export class BanManagerClient {
  private client
  private contractAddress: Address

  constructor() {
    const network = process.env.PUBLIC_JEJU_NETWORK || 'localnet'
    const rpcUrl = process.env.JEJU_RPC_URL || this.getDefaultRpcUrl(network)
    const contractAddr = process.env.BAN_MANAGER_ADDRESS as Address | undefined

    if (!contractAddr) {
      throw new Error('[BanManager] BAN_MANAGER_ADDRESS not configured')
    }

    this.contractAddress = contractAddr
    this.client = createPublicClient({
      chain: this.getChain(network),
      transport: http(rpcUrl),
    })
  }

  private getDefaultRpcUrl(network: string): string {
    switch (network) {
      case 'mainnet':
        return 'https://rpc.jeju.network'
      case 'testnet':
        return 'https://testnet-rpc.jeju.network'
      default:
        return 'http://127.0.0.1:6546'
    }
  }

  private getChain(network: string) {
    switch (network) {
      case 'mainnet':
        return base
      case 'testnet':
        return baseSepolia
      default:
        return hardhat
    }
  }

  /**
   * Check if an address is network-banned
   */
  async isNetworkBanned(address: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [address],
    })
  }

  /**
   * Check if an address is banned from a specific app
   */
  async isAppBanned(
    address: Address,
    appId: Hex = BABYLON_APP_ID,
  ): Promise<boolean> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'isAppBanned',
      args: [address, appId],
    })
  }

  /**
   * Get ban reason for an address
   */
  async getBanReason(
    address: Address,
    appId: Hex = BABYLON_APP_ID,
  ): Promise<string> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'getBanReason',
      args: [address, appId],
    })
  }

  /**
   * Get ban status for an address (returns BanType enum value)
   */
  async getBanStatus(address: Address): Promise<BanType> {
    const status = await this.client.readContract({
      address: this.contractAddress,
      abi: BAN_MANAGER_ABI,
      functionName: 'getBanStatus',
      args: [address],
    })
    return status as BanType
  }

  /**
   * Check if an address has access to Babylon (not banned)
   */
  async isAddressAccessAllowed(address: Address): Promise<BanCheckResult> {
    // Check network-level ban first
    const networkBanned = await this.isNetworkBanned(address)
    if (networkBanned) {
      const reason = await this.getBanReason(address)
      const banType = await this.getBanStatus(address)
      return {
        allowed: false,
        reason,
        banType,
      }
    }

    // Check app-specific ban
    const appBanned = await this.isAppBanned(address, BABYLON_APP_ID)
    if (appBanned) {
      const reason = await this.getBanReason(address, BABYLON_APP_ID)
      const banType = await this.getBanStatus(address)
      return {
        allowed: false,
        reason,
        banType,
      }
    }

    return { allowed: true }
  }

  /**
   * Check if an agent ID has access to Babylon
   * Note: Agent IDs are converted to addresses for ban checking
   */
  async isAgentAccessAllowed(_agentId: bigint): Promise<BanCheckResult> {
    // Agent IDs don't have direct ban checks in current ABI
    // Return allowed for now - implement when contract supports agent bans
    return { allowed: true }
  }

  /**
   * Check if address is currently on notice (pending moderation market)
   */
  async isOnNotice(address: Address): Promise<boolean> {
    const status = await this.getBanStatus(address)
    return status === BanType.ON_NOTICE
  }

  /**
   * Check if address is permanently banned
   */
  async isPermanentlyBanned(address: Address): Promise<boolean> {
    const status = await this.getBanStatus(address)
    return status === BanType.PERMANENT
  }
}

// Singleton instance
let banManagerClient: BanManagerClient | null = null

export function getBanManagerClient(): BanManagerClient {
  if (!banManagerClient) {
    banManagerClient = new BanManagerClient()
  }
  return banManagerClient
}

function _resetBanManagerClient(): void {
  banManagerClient = null
}

/**
 * Check if a user/agent has access to Babylon
 * Uses both address-based and agent ID-based checks
 */
export async function checkBabylonAccess(
  walletAddress?: Address,
  agentId?: bigint,
): Promise<BanCheckResult> {
  const client = getBanManagerClient()

  if (walletAddress) {
    const addressResult = await client.isAddressAccessAllowed(walletAddress)
    if (!addressResult.allowed) {
      logger.warn(
        'Access denied for address',
        { walletAddress, reason: addressResult.reason },
        'BanManager',
      )
      return addressResult
    }
  }

  if (agentId) {
    const agentResult = await client.isAgentAccessAllowed(agentId)
    if (!agentResult.allowed) {
      logger.warn(
        'Access denied for agent',
        { agentId: agentId.toString(), reason: agentResult.reason },
        'BanManager',
      )
      return agentResult
    }
  }

  return { allowed: true }
}

/**
 * Middleware helper to check ban status
 * Returns null if allowed, or an error response if banned
 */
async function _enforceBan(
  walletAddress?: Address,
  agentId?: bigint,
): Promise<{
  status: number
  body: { error: string; reason?: string; banType?: string }
} | null> {
  const result = await checkBabylonAccess(walletAddress, agentId)

  if (result.allowed) {
    return null
  }

  const banTypeString =
    result.banType !== undefined ? BanType[result.banType] : undefined

  return {
    status: 403,
    body: {
      error: 'Access denied - account is banned from Babylon',
      reason: result.reason,
      banType: banTypeString,
    },
  }
}
