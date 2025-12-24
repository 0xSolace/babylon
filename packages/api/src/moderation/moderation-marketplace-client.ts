/**
 * ModerationMarketplace Client
 *
 * Integrates with Jeju's futarchy-based moderation system.
 * Allows users to stake and report bad actors, creating prediction markets
 * where the community votes on ban outcomes.
 *
 * Features:
 * - Report users/agents for moderation
 * - Stake to participate in moderation
 * - Vote on active moderation cases
 * - Appeal bans through re-review markets
 *
 * @see https://github.com/elizaos/jeju/packages/contracts/src/moderation/ModerationMarketplace.sol
 */

import { logger, MODERATION_MARKETPLACE_ABI } from '@babylon/shared'

import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, hardhat } from 'viem/chains'

export enum BanStatus {
  NONE = 0,
  ON_NOTICE = 1,
  CHALLENGED = 2,
  BANNED = 3,
  CLEARED = 4,
  APPEALING = 5,
}

export enum MarketOutcome {
  PENDING = 0,
  BAN_UPHELD = 1,
  BAN_REJECTED = 2,
}

export enum VotePosition {
  YES = 0,
  NO = 1,
}

export interface BanCase {
  caseId: Hex
  reporter: Address
  target: Address
  reporterStake: bigint
  targetStake: bigint
  status: BanStatus
  outcome: MarketOutcome
  yesVotes: bigint
  noVotes: bigint
  reason: string
  evidenceHash: Hex
  createdAt: Date
  marketOpenUntil: Date
  resolved: boolean
  totalPot: bigint
  appealCount: bigint
}

export interface StakeInfo {
  amount: bigint
  stakedAt: Date
  stakedBlock: bigint
  lastActivityBlock: bigint
  isStaked: boolean
}

export interface ReportParams {
  target: Address
  reason: string
  evidenceHash: Hex
}

export class ModerationMarketplaceClient {
  private publicClient
  private walletClient
  private contractAddress: Address
  private account

  constructor(privateKey?: Hex) {
    const network = process.env.PUBLIC_JEJU_NETWORK || 'localnet'
    const rpcUrl = process.env.JEJU_RPC_URL || this.getDefaultRpcUrl(network)
    const contractAddr = process.env.MODERATION_MARKETPLACE_ADDRESS as
      | Address
      | undefined

    if (!contractAddr) {
      throw new Error(
        '[ModerationMarketplace] MODERATION_MARKETPLACE_ADDRESS not configured',
      )
    }

    this.contractAddress = contractAddr
    const chain = this.getChain(network)

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    if (privateKey) {
      this.account = privateKeyToAccount(privateKey)
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      })
    }
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

  private requireWallet(): NonNullable<typeof this.walletClient> {
    if (!this.walletClient || !this.account) {
      throw new Error(
        '[ModerationMarketplace] Wallet required for this operation',
      )
    }
    return this.walletClient
  }

  /**
   * Get user's stake info
   */
  async getStake(user: Address): Promise<StakeInfo> {
    const info = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getStake',
      args: [user],
    })

    return {
      amount: info.amount,
      stakedAt: new Date(Number(info.stakedAt) * 1000),
      stakedBlock: info.stakedBlock,
      lastActivityBlock: info.lastActivityBlock,
      isStaked: info.isStaked,
    }
  }

  /**
   * Check if user is staked
   */
  async isStaked(user: Address): Promise<boolean> {
    const stakeInfo = await this.getStake(user)
    return stakeInfo.isStaked
  }

  /**
   * Check if user is banned
   */
  async isBanned(user: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'isBanned',
      args: [user],
    })
  }

  /**
   * Get case details
   */
  async getCase(caseId: Hex): Promise<BanCase> {
    const banCase = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getCase',
      args: [caseId],
    })

    return {
      caseId: banCase.caseId,
      reporter: banCase.reporter,
      target: banCase.target,
      reporterStake: banCase.reporterStake,
      targetStake: banCase.targetStake,
      status: banCase.status as BanStatus,
      outcome: banCase.outcome as MarketOutcome,
      yesVotes: banCase.yesVotes,
      noVotes: banCase.noVotes,
      reason: banCase.reason,
      evidenceHash: banCase.evidenceHash,
      createdAt: new Date(Number(banCase.createdAt) * 1000),
      marketOpenUntil: new Date(Number(banCase.marketOpenUntil) * 1000),
      resolved: banCase.resolved,
      totalPot: banCase.totalPot,
      appealCount: banCase.appealCount,
    }
  }

  /**
   * Stake tokens to participate in moderation
   * Note: stake() is payable - send ETH as value
   */
  async stake(): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stake',
      args: [],
    })

    logger.info('Staked for moderation', { hash }, 'ModerationMarketplace')
    return hash
  }

  /**
   * Unstake tokens
   */
  async unstake(amount: bigint): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'unstake',
      args: [amount],
    })

    logger.info(
      'Unstaked from moderation',
      { amount: amount.toString(), hash },
      'ModerationMarketplace',
    )
    return hash
  }

  /**
   * Open a moderation case against a user
   * Must be staked to open cases
   */
  async openCase(params: ReportParams): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'openCase',
      args: [params.target, params.reason, params.evidenceHash],
    })

    logger.info(
      'Opened moderation case',
      { target: params.target, reason: params.reason, hash },
      'ModerationMarketplace',
    )
    return hash
  }

  /**
   * Challenge a case by staking
   * Note: challengeCase is payable
   */
  async challengeCase(caseId: Hex): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'challengeCase',
      args: [caseId],
    })

    logger.info('Challenged case', { caseId, hash }, 'ModerationMarketplace')
    return hash
  }

  /**
   * Vote on a moderation case
   */
  async vote(caseId: Hex, position: VotePosition): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'vote',
      args: [caseId, position],
    })

    logger.info(
      'Voted on case',
      {
        caseId,
        position: VotePosition[position],
        hash,
      },
      'ModerationMarketplace',
    )
    return hash
  }

  /**
   * Resolve a case after voting period ends
   */
  async resolveCase(caseId: Hex): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'resolveCase',
      args: [caseId],
    })

    logger.info('Resolved case', { caseId, hash }, 'ModerationMarketplace')
    return hash
  }

  /**
   * Request re-review of a case (appeal)
   * Note: requestReReview is payable
   */
  async requestReReview(caseId: Hex): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'requestReReview',
      args: [caseId],
    })

    logger.info(
      'Requested re-review',
      { caseId, hash },
      'ModerationMarketplace',
    )
    return hash
  }

  /**
   * Claim rewards from a resolved case
   */
  async claimRewards(caseId: Hex): Promise<Hex> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'claimRewards',
      args: [caseId],
    })

    logger.info('Claimed rewards', { caseId, hash }, 'ModerationMarketplace')
    return hash
  }
}

// Read-only singleton
let publicModerationClient: ModerationMarketplaceClient | null = null

export function getModerationMarketplaceClient(): ModerationMarketplaceClient {
  if (!publicModerationClient) {
    publicModerationClient = new ModerationMarketplaceClient()
  }
  return publicModerationClient
}

export function resetModerationMarketplaceClient(): void {
  publicModerationClient = null
}

/**
 * Create a client with write capabilities
 */
export function createModerationClient(
  privateKey: Hex,
): ModerationMarketplaceClient {
  return new ModerationMarketplaceClient(privateKey)
}
