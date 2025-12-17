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

import { logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, hardhat } from 'viem/chains';

// ModerationMarketplace ABI (minimal)
const MODERATION_MARKETPLACE_ABI = [
  // View functions
  {
    name: 'getCase',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [
      {
        name: 'banCase',
        type: 'tuple',
        components: [
          { name: 'caseId', type: 'bytes32' },
          { name: 'reporter', type: 'address' },
          { name: 'target', type: 'address' },
          { name: 'reporterStake', type: 'uint256' },
          { name: 'targetStake', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'outcome', type: 'uint8' },
          { name: 'yesVotes', type: 'uint256' },
          { name: 'noVotes', type: 'uint256' },
          { name: 'reason', type: 'string' },
          { name: 'evidence', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'votingEndsAt', type: 'uint256' },
          { name: 'resolvedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getStake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'stakedAt', type: 'uint256' },
          { name: 'stakedBlock', type: 'uint256' },
          { name: 'lastActivityBlock', type: 'uint256' },
          { name: 'isStaked', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getVotingPower',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'power', type: 'uint256' }],
  },
  {
    name: 'isStaked',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'minStake',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'stakingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // Write functions
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'reportUser',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidence', type: 'string' },
    ],
    outputs: [{ name: 'caseId', type: 'bytes32' }],
  },
  {
    name: 'challengeBan',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'vote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'caseId', type: 'bytes32' },
      { name: 'position', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'resolveCase',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'requestReReview',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'caseId', type: 'bytes32' },
      { name: 'newEvidence', type: 'string' },
    ],
    outputs: [{ name: 'appealCaseId', type: 'bytes32' }],
  },
] as const;

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
  YES = 0, // Support ban
  NO = 1, // Oppose ban
}

export interface BanCase {
  caseId: Hex;
  reporter: Address;
  target: Address;
  reporterStake: bigint;
  targetStake: bigint;
  status: BanStatus;
  outcome: MarketOutcome;
  yesVotes: bigint;
  noVotes: bigint;
  reason: string;
  evidence: string;
  createdAt: Date;
  votingEndsAt: Date;
  resolvedAt: Date | null;
}

export interface StakeInfo {
  amount: bigint;
  stakedAt: Date;
  stakedBlock: bigint;
  lastActivityBlock: bigint;
  isStaked: boolean;
}

export interface ReportParams {
  target: Address;
  reason: string;
  evidence: string;
}

export class ModerationMarketplaceClient {
  private publicClient;
  private walletClient;
  private contractAddress: Address;
  private account;

  constructor(privateKey?: Hex) {
    const network =
      process.env.JEJU_NETWORK ||
      process.env.NEXT_PUBLIC_JEJU_NETWORK ||
      'localnet';
    const rpcUrl = process.env.JEJU_RPC_URL || this.getDefaultRpcUrl(network);
    const contractAddr = process.env.MODERATION_MARKETPLACE_ADDRESS as
      | Address
      | undefined;

    if (!contractAddr) {
      throw new Error(
        '[ModerationMarketplace] MODERATION_MARKETPLACE_ADDRESS not configured'
      );
    }

    this.contractAddress = contractAddr;
    const chain = this.getChain(network);

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // Only create wallet client if private key provided
    if (privateKey) {
      this.account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });
    }
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

  private requireWallet(): void {
    if (!this.walletClient || !this.account) {
      throw new Error(
        '[ModerationMarketplace] Wallet required for this operation'
      );
    }
  }

  /**
   * Get minimum stake required
   */
  async getMinStake(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'minStake',
    });
  }

  /**
   * Get staking token address
   */
  async getStakingToken(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stakingToken',
    });
  }

  /**
   * Check if user is staked
   */
  async isStaked(user: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'isStaked',
      args: [user],
    });
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
    });

    return {
      amount: info.amount,
      stakedAt: new Date(Number(info.stakedAt) * 1000),
      stakedBlock: info.stakedBlock,
      lastActivityBlock: info.lastActivityBlock,
      isStaked: info.isStaked,
    };
  }

  /**
   * Get user's voting power
   */
  async getVotingPower(user: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'getVotingPower',
      args: [user],
    });
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
    });

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
      evidence: banCase.evidence,
      createdAt: new Date(Number(banCase.createdAt) * 1000),
      votingEndsAt: new Date(Number(banCase.votingEndsAt) * 1000),
      resolvedAt:
        banCase.resolvedAt > 0n
          ? new Date(Number(banCase.resolvedAt) * 1000)
          : null,
    };
  }

  /**
   * Stake tokens to participate in moderation
   */
  async stake(amount: bigint): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'stake',
      args: [amount],
    });

    logger.info(
      'Staked for moderation',
      { amount: amount.toString(), hash },
      'ModerationMarketplace'
    );
    return hash;
  }

  /**
   * Report a user for moderation
   * Must be staked to report
   */
  async reportUser(params: ReportParams): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'reportUser',
      args: [params.target, params.reason, params.evidence],
    });

    logger.info(
      'Reported user',
      { target: params.target, reason: params.reason, hash },
      'ModerationMarketplace'
    );
    return hash;
  }

  /**
   * Challenge an ON_NOTICE ban by staking
   */
  async challengeBan(caseId: Hex): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'challengeBan',
      args: [caseId],
    });

    logger.info('Challenged ban', { caseId, hash }, 'ModerationMarketplace');
    return hash;
  }

  /**
   * Vote on a moderation case
   */
  async vote(
    caseId: Hex,
    position: VotePosition,
    amount: bigint
  ): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'vote',
      args: [caseId, position, amount],
    });

    logger.info(
      'Voted on case',
      {
        caseId,
        position: VotePosition[position],
        amount: amount.toString(),
        hash,
      },
      'ModerationMarketplace'
    );
    return hash;
  }

  /**
   * Resolve a case after voting period ends
   */
  async resolveCase(caseId: Hex): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'resolveCase',
      args: [caseId],
    });

    logger.info('Resolved case', { caseId, hash }, 'ModerationMarketplace');
    return hash;
  }

  /**
   * Request re-review of a ban (appeal)
   * Requires 10x the original stake
   */
  async requestReReview(caseId: Hex, newEvidence: string): Promise<Hex> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      address: this.contractAddress,
      abi: MODERATION_MARKETPLACE_ABI,
      functionName: 'requestReReview',
      args: [caseId, newEvidence],
    });

    logger.info(
      'Requested re-review',
      { caseId, hash },
      'ModerationMarketplace'
    );
    return hash;
  }
}

// Read-only singleton
let publicModerationClient: ModerationMarketplaceClient | null = null;

export function getModerationMarketplaceClient(): ModerationMarketplaceClient {
  if (!publicModerationClient) {
    publicModerationClient = new ModerationMarketplaceClient();
  }
  return publicModerationClient;
}

export function resetModerationMarketplaceClient(): void {
  publicModerationClient = null;
}

/**
 * Create a client with write capabilities
 */
export function createModerationClient(
  privateKey: Hex
): ModerationMarketplaceClient {
  return new ModerationMarketplaceClient(privateKey);
}
