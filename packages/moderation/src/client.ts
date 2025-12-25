/**
 * Moderation Client - interfaces with Jeju ModerationMarketplace and BanManager contracts.
 */

import {
  BAN_MANAGER_ABI,
  BanStatus,
  logger,
  MODERATION_MARKETPLACE_ABI,
  VotePosition,
} from '@babylon/shared'
import {
  type Address,
  createPublicClient,
  http,
  keccak256,
  type PublicClient,
  toHex,
  zeroHash,
} from 'viem'
import { z } from 'zod'
import { JejuModerationConfigSchema } from './schemas'
import type { BanCase, JejuModerationConfig, StakeInfo, Vote } from './types'

// Contract read result schemas for type-safe parsing
const StakeInfoResultSchema = z.object({
  amount: z.bigint(),
  stakedAt: z.bigint(),
  stakedBlock: z.bigint(),
  lastActivityBlock: z.bigint(),
  isStaked: z.boolean(),
})

const CaseResultSchema = z.object({
  caseId: z.string(),
  reporter: z.string(),
  target: z.string(),
  reporterStake: z.bigint(),
  targetStake: z.bigint(),
  reason: z.string(),
  evidenceHash: z.string(),
  status: z.number(),
  createdAt: z.bigint(),
  marketOpenUntil: z.bigint(),
  yesVotes: z.bigint(),
  noVotes: z.bigint(),
  totalPot: z.bigint(),
  resolved: z.boolean(),
  outcome: z.number(),
  appealCount: z.bigint(),
})

const VoteResultSchema = z.object({
  position: z.number(),
  weight: z.bigint(),
  stakedAt: z.bigint(),
  hasVoted: z.boolean(),
  hasClaimed: z.boolean(),
})

// Helper to validate status enums
function toBanStatus(value: number): BanStatus {
  if (Object.values(BanStatus).includes(value)) {
    return value
  }
  return BanStatus.NONE
}

function toVotePosition(value: number): VotePosition {
  if (Object.values(VotePosition).includes(value)) {
    return value
  }
  return VotePosition.NONE
}

export class ModerationClient {
  private readonly publicClient: PublicClient
  private readonly config: JejuModerationConfig

  constructor(config: JejuModerationConfig) {
    JejuModerationConfigSchema.parse(config)
    this.config = config
    this.publicClient = createPublicClient({
      transport: http(this.config.rpcUrl),
    })
    logger.debug('ModerationClient initialized', { chainId: config.chainId })
  }

  async getStake(address: Address): Promise<StakeInfo> {
    const rawResult = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getStake',
      args: [address],
    })
    const result = StakeInfoResultSchema.parse(rawResult)

    return {
      amount: result.amount,
      stakedAt: Number(result.stakedAt),
      stakedBlock: Number(result.stakedBlock),
      lastActivityBlock: Number(result.lastActivityBlock),
      isStaked: result.isStaked,
    }
  }

  async getCase(caseId: `0x${string}`): Promise<BanCase> {
    const rawResult = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getCase',
      args: [caseId],
    })
    const result = CaseResultSchema.parse(rawResult)

    return {
      caseId: result.caseId as `0x${string}`,
      reporter: result.reporter as Address,
      target: result.target as Address,
      reporterStake: result.reporterStake,
      targetStake: result.targetStake,
      reason: result.reason,
      evidenceHash: result.evidenceHash as `0x${string}`,
      status: toBanStatus(result.status),
      createdAt: Number(result.createdAt),
      marketOpenUntil: Number(result.marketOpenUntil),
      yesVotes: result.yesVotes,
      noVotes: result.noVotes,
      totalPot: result.totalPot,
      resolved: result.resolved,
      outcome: result.outcome,
      appealCount: Number(result.appealCount),
    }
  }

  async getActiveCase(target: Address): Promise<`0x${string}` | null> {
    logger.debug('Getting active case', { target })
    const caseId = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'activeCase',
      args: [target],
    })
    if (typeof caseId !== 'string') return null
    return caseId === zeroHash ? null : (caseId as `0x${string}`)
  }

  async getVote(caseId: `0x${string}`, voter: Address): Promise<Vote> {
    const rawResult = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getVote',
      args: [caseId, voter],
    })
    const result = VoteResultSchema.parse(rawResult)

    return {
      position: toVotePosition(result.position),
      weight: result.weight,
      stakedAt: Number(result.stakedAt),
      hasVoted: result.hasVoted,
      hasClaimed: result.hasClaimed,
    }
  }

  async isBanned(address: Address, appId?: `0x${string}`): Promise<boolean> {
    logger.debug('Checking ban status', { address, appId })
    const result = appId
      ? await this.publicClient.readContract({
          address: this.config.banManager,
          abi: BAN_MANAGER_ABI,
          functionName: 'isAppBanned',
          args: [address, appId],
        })
      : await this.publicClient.readContract({
          address: this.config.banManager,
          abi: BAN_MANAGER_ABI,
          functionName: 'isNetworkBanned',
          args: [address],
        })
    return typeof result === 'boolean' ? result : false
  }

  async canReport(address: Address): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'canReport',
      args: [address],
    })
    return typeof result === 'boolean' ? result : false
  }

  async getAllCaseIds(): Promise<`0x${string}`[]> {
    const result = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getAllCaseIds',
      args: [],
    })
    if (!Array.isArray(result)) return []
    return result.filter((id): id is `0x${string}` => typeof id === 'string')
  }

  buildStakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stake' as const,
      args: [] as const,
      value: amount,
    }
  }

  buildUnstakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'unstake' as const,
      args: [amount] as const,
    }
  }

  buildOpenCaseRequest(
    target: Address,
    reason: string,
    evidenceHash: `0x${string}` = zeroHash,
  ) {
    logger.debug('Building open case request', { target, reason })
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'openCase' as const,
      args: [target, reason, evidenceHash] as const,
    }
  }

  buildChallengeCaseRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'challengeCase' as const,
      args: [caseId] as const,
      value: stakeAmount,
    }
  }

  buildVoteRequest(caseId: `0x${string}`, position: VotePosition) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'vote' as const,
      args: [caseId, position] as const,
    }
  }

  buildResolveCaseRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'resolveCase' as const,
      args: [caseId] as const,
    }
  }

  buildReReviewRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'requestReReview' as const,
      args: [caseId] as const,
      value: stakeAmount,
    }
  }

  buildClaimRewardsRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'claimRewards' as const,
      args: [caseId] as const,
    }
  }

  static categoryToAppId(category: string): `0x${string}` {
    return keccak256(toHex(category))
  }

  async getMinReporterStake(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minReporterStake',
      args: [],
    })
    return typeof result === 'bigint' ? result : BigInt(0)
  }

  async getMinChallengeStake(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minChallengeStake',
      args: [],
    })
    return typeof result === 'bigint' ? result : BigInt(0)
  }
}

export const createModerationClient = (config: JejuModerationConfig) =>
  new ModerationClient(config)
