/**
 * @fileoverview Moderation client for Babylon-Jeju integration
 * @module @babylon/moderation/client
 */

import {
  type Address,
  createPublicClient,
  http,
  keccak256,
  type PublicClient,
  toHex,
} from 'viem';
import { BAN_MANAGER_ABI, MODERATION_MARKETPLACE_ABI } from './abis';
import type {
  BanCase,
  JejuModerationConfig,
  StakeInfo,
  Vote,
  VotePosition,
} from './types';

/**
 * ModerationClient provides a unified interface for interacting with
 * the Jeju ModerationMarketplace and BanManager contracts.
 */
export class ModerationClient {
  private readonly publicClient: PublicClient;
  private readonly config: JejuModerationConfig;

  constructor(config: JejuModerationConfig) {
    this.config = config;
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get stake info for a user
   */
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

  /**
   * Get a ban case by ID
   */
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

  /**
   * Get active case for a target address
   */
  async getActiveCase(target: Address): Promise<`0x${string}` | null> {
    const caseId = await this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'activeCase',
      args: [target],
    });

    const zeroBytes32 =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    return caseId === zeroBytes32 ? null : (caseId as `0x${string}`);
  }

  /**
   * Get vote info for a case and voter
   */
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

  /**
   * Check if a user is banned
   */
  async isBanned(address: Address, appId?: `0x${string}`): Promise<boolean> {
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

  /**
   * Check if user can report (has sufficient aged stake)
   */
  async canReport(address: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'canReport',
      args: [address],
    }) as Promise<boolean>;
  }

  /**
   * Get all case IDs
   */
  async getAllCaseIds(): Promise<`0x${string}`[]> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getAllCaseIds',
      args: [],
    }) as Promise<`0x${string}`[]>;
  }

  // ============================================================================
  // Write Operations
  // ============================================================================

  /**
   * Build transaction request for staking
   * The caller is responsible for sending the transaction
   */
  buildStakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stake' as const,
      args: [] as const,
      value: amount,
    };
  }

  /**
   * Build transaction request for unstaking
   */
  buildUnstakeRequest(amount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'unstake' as const,
      args: [amount] as const,
    };
  }

  /**
   * Build transaction request for opening a case
   */
  buildOpenCaseRequest(
    target: Address,
    reason: string,
    evidenceHash: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'openCase' as const,
      args: [target, reason, evidenceHash] as const,
    };
  }

  /**
   * Build transaction request for challenging a case
   */
  buildChallengeCaseRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'challengeCase' as const,
      args: [caseId] as const,
      value: stakeAmount,
    };
  }

  /**
   * Build transaction request for voting
   */
  buildVoteRequest(caseId: `0x${string}`, position: VotePosition) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'vote' as const,
      args: [caseId, position] as const,
    };
  }

  /**
   * Build transaction request for resolving a case
   */
  buildResolveCaseRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'resolveCase' as const,
      args: [caseId] as const,
    };
  }

  /**
   * Build transaction request for re-review
   */
  buildReReviewRequest(caseId: `0x${string}`, stakeAmount: bigint) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'requestReReview' as const,
      args: [caseId] as const,
      value: stakeAmount,
    };
  }

  /**
   * Build transaction request for claiming rewards
   */
  buildClaimRewardsRequest(caseId: `0x${string}`) {
    return {
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'claimRewards' as const,
      args: [caseId] as const,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert a category string to bytes32 app ID
   */
  static categoryToAppId(category: string): `0x${string}` {
    return keccak256(toHex(category));
  }

  /**
   * Get minimum stake required for reporting
   */
  async getMinReporterStake(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minReporterStake',
      args: [],
    }) as Promise<bigint>;
  }

  /**
   * Get minimum stake required for challenging
   */
  async getMinChallengeStake(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.config.moderationMarketplace,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minChallengeStake',
      args: [],
    }) as Promise<bigint>;
  }
}

/**
 * Create a moderation client with Jeju network defaults
 */
export function createModerationClient(
  config: Partial<JejuModerationConfig> & { rpcUrl: string }
): ModerationClient {
  const defaultConfig: JejuModerationConfig = {
    moderationMarketplace:
      '0x0000000000000000000000000000000000000000' as Address,
    banManager: '0x0000000000000000000000000000000000000000' as Address,
    identityRegistry: '0x0000000000000000000000000000000000000000' as Address,
    chainId: 1337,
    ...config,
  };

  return new ModerationClient(defaultConfig);
}
