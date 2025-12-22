/**
 * Moderation Client - interfaces with Jeju ModerationMarketplace and BanManager contracts.
 */

import { logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  http,
  keccak256,
  type PublicClient,
  toHex,
  zeroHash,
} from 'viem';
import { BAN_MANAGER_ABI, MODERATION_MARKETPLACE_ABI } from './abis';
import { JejuModerationConfigSchema } from './schemas';
import type {
  BanCase,
  JejuModerationConfig,
  StakeInfo,
  Vote,
  VotePosition,
} from './types';

export class ModerationClient {
  private readonly publicClient: PublicClient;
  private readonly config: JejuModerationConfig;

  constructor(config: JejuModerationConfig) {
    // Validate config - throws ZodError on invalid input
    JejuModerationConfigSchema.parse(config);
    this.config = config;
    this.publicClient = createPublicClient({
      transport: http(this.config.rpcUrl),
    });
    logger.debug('ModerationClient initialized', { chainId: config.chainId });
  }

  async getStake(address: Address): Promise<StakeInfo> {
    const result = (await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getStake',
      args: [address],
    })) as {
      amount: bigint;
      stakedAt: bigint;
      stakedBlock: bigint;
      lastActivityBlock: bigint;
      isStaked: boolean;
    };

    return {
      amount: result.amount,
      stakedAt: Number(result.stakedAt),
      stakedBlock: Number(result.stakedBlock),
      lastActivityBlock: Number(result.lastActivityBlock),
      isStaked: result.isStaked,
    };
  }

  async getCase(caseId: `0x${string}`): Promise<BanCase> {
    const result = (await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getCase',
      args: [caseId],
    })) as {
      caseId: `0x${string}`;
      reporter: Address;
      target: Address;
      reporterStake: bigint;
      targetStake: bigint;
      reason: string;
      evidenceHash: `0x${string}`;
      status: number;
      createdAt: bigint;
      marketOpenUntil: bigint;
      yesVotes: bigint;
      noVotes: bigint;
      totalPot: bigint;
      resolved: boolean;
      outcome: number;
      appealCount: bigint;
    };

    return {
      caseId: result.caseId,
      reporter: result.reporter,
      target: result.target,
      reporterStake: result.reporterStake,
      targetStake: result.targetStake,
      reason: result.reason,
      evidenceHash: result.evidenceHash,
      status: result.status as import('./types').BanStatus,
      createdAt: Number(result.createdAt),
      marketOpenUntil: Number(result.marketOpenUntil),
      yesVotes: result.yesVotes,
      noVotes: result.noVotes,
      totalPot: result.totalPot,
      resolved: result.resolved,
      outcome: result.outcome as import('./types').MarketOutcome,
      appealCount: Number(result.appealCount),
    };
  }

  async getActiveCase(target: Address): Promise<`0x${string}` | null> {
    logger.debug('Getting active case', { target });
    const caseId = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'activeCase',
      args: [target],
    });
    return caseId === zeroHash ? null : (caseId as `0x${string}`);
  }

  async getVote(caseId: `0x${string}`, voter: Address): Promise<Vote> {
    const result = (await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getVote',
      args: [caseId, voter],
    })) as {
      position: number;
      weight: bigint;
      stakedAt: bigint;
      hasVoted: boolean;
      hasClaimed: boolean;
    };

    return {
      position: result.position as VotePosition,
      weight: result.weight,
      stakedAt: Number(result.stakedAt),
      hasVoted: result.hasVoted,
      hasClaimed: result.hasClaimed,
    };
  }

  async isBanned(address: Address, appId?: `0x${string}`): Promise<boolean> {
    logger.debug('Checking ban status', { address, appId });
    if (appId) {
      return this.publicClient.readContract({
        address: this.config.banManager,
        abi: BAN_MANAGER_ABI,
        functionName: 'isAppBanned',
        args: [address, appId],
      }) as Promise<boolean>;
    }
    return this.publicClient.readContract({
      address: this.config.banManager,
      abi: BAN_MANAGER_ABI,
      functionName: 'isNetworkBanned',
      args: [address],
    }) as Promise<boolean>;
  }

  async canReport(address: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'canReport',
      args: [address],
    }) as Promise<boolean>;
  }

  async getAllCaseIds(): Promise<`0x${string}`[]> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getAllCaseIds',
      args: [],
    }) as Promise<`0x${string}`[]>;
  }

  buildStakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stake' as const,
      args: [] as const,
      value: amount,
    };
  }

  buildUnstakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'unstake' as const,
      args: [amount] as const,
    };
  }

  buildOpenCaseRequest(
    target: Address,
    reason: string,
    evidenceHash: `0x${string}` = zeroHash
  ) {
    logger.debug('Building open case request', { target, reason });
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'openCase' as const,
      args: [target, reason, evidenceHash] as const,
    };
  }

  buildChallengeCaseRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'challengeCase' as const,
      args: [caseId] as const,
      value: stakeAmount,
    };
  }

  buildVoteRequest(caseId: `0x${string}`, position: VotePosition) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'vote' as const,
      args: [caseId, position] as const,
    };
  }

  buildResolveCaseRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'resolveCase' as const,
      args: [caseId] as const,
    };
  }

  buildReReviewRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'requestReReview' as const,
      args: [caseId] as const,
      value: stakeAmount,
    };
  }

  buildClaimRewardsRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'claimRewards' as const,
      args: [caseId] as const,
    };
  }

  static categoryToAppId(category: string): `0x${string}` {
    return keccak256(toHex(category));
  }

  async getMinReporterStake(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minReporterStake',
      args: [],
    }) as Promise<bigint>;
  }

  async getMinChallengeStake(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minChallengeStake',
      args: [],
    }) as Promise<bigint>;
  }
}

export const createModerationClient = (config: JejuModerationConfig) =>
  new ModerationClient(config);
