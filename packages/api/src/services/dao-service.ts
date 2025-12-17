/**
 * DAO Service
 *
 * @description Provides access to Babylon AI DAO governance data.
 *
 * Exposes:
 * - AI CEO (Monkey King) status and decisions
 * - Proposals (treasury, model deployment, game parameters)
 * - Treasury and revenue stats
 * - Buyback execution history
 *
 * Integrates with:
 * - BabylonDAO contract (AI CEO governance)
 * - BabylonTreasury contract (protocol treasury)
 * - BabylonRevenue contract (fee distribution)
 */

import { buybackRecords, db, eq, feeAccumulator } from '@babylon/db';
import { logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  formatEther,
  formatUnits,
  http,
} from 'viem';
import { getEnvironment } from '../config/environment';

// =============================================================================
// TYPES
// =============================================================================

export interface AIChiefStatus {
  /** AI CEO wallet address */
  address: Address;
  /** AI CEO's ERC-8004 agent ID */
  agentId: string;
  /** Current model powering the AI CEO */
  currentModel: {
    modelId: string;
    name: string;
    provider: string;
  };
  /** Decision statistics */
  stats: {
    totalDecisions: number;
    approvedDecisions: number;
    rejectedDecisions: number;
    approvalRate: string;
  };
  /** Is AI CEO active? */
  isActive: boolean;
  /** Last decision timestamp */
  lastDecisionAt: Date | null;
}

export interface DAOProposal {
  proposalId: string;
  proposalType:
    | 'TREASURY_SPEND'
    | 'MODEL_DEPLOYMENT'
    | 'TRAINING_JOB'
    | 'GAME_PARAMETER'
    | 'PROTOCOL_UPGRADE'
    | 'INFRASTRUCTURE'
    | 'EMERGENCY';
  target: Address;
  value: bigint;
  description: string;
  reasoning: string;
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'VETOED' | 'EXPIRED';
  createdAt: Date;
  executeAfter: Date;
  expiresAt: Date;
  vetoable: boolean;
}

export interface TreasuryStats {
  /** ETH balance in treasury */
  ethBalance: bigint;
  /** BBLN token balance in treasury */
  bblnBalance: bigint;
  /** Total ETH ever distributed */
  totalETHDistributed: bigint;
  /** Total BBLN ever distributed */
  totalBBLNDistributed: bigint;
  /** Approved vaults count */
  approvedVaultsCount: number;
}

export interface RevenueStats {
  /** Accumulated fees awaiting buyback */
  accumulatedFees: bigint;
  /** Threshold to trigger buyback */
  buybackThreshold: bigint;
  /** Total fees ever received */
  totalFeesReceived: bigint;
  /** Total BBLN bought back */
  totalBBLNBought: bigint;
  /** Total ELIZA bought back */
  totalELIZABought: bigint;
  /** Total ETH sent to treasury */
  totalTreasuryETH: bigint;
  /** Total buyback executions */
  totalBuybacks: number;
  /** Can execute buyback now? */
  canExecuteBuyback: boolean;
  /** Is paused? */
  isPaused: boolean;
}

export interface BuybackRecord {
  id: string;
  totalEthInput: string;
  bblnBought: string | null;
  elizaBought: string | null;
  treasuryEth: string;
  status: string;
  txHash: string | null;
  initiatedAt: Date;
  completedAt: Date | null;
}

export interface DAOOverview {
  aiCEO: AIChiefStatus;
  treasury: TreasuryStats;
  revenue: RevenueStats;
  proposals: {
    total: number;
    pending: number;
    approved: number;
    executed: number;
  };
}

// =============================================================================
// CONTRACT ABIS
// =============================================================================

const BABYLON_DAO_ABI = [
  {
    name: 'aiCEO',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'aiCEOAgentId',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'proposalCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'councilSize',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'emergencyPaused',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

const BABYLON_TREASURY_ABI = [
  {
    name: 'totalETHDistributed',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'totalBBLNDistributed',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const BABYLON_REVENUE_ABI = [
  {
    name: 'getStats',
    type: 'function',
    inputs: [],
    outputs: [
      { type: 'uint256', name: 'accumulatedFees' },
      { type: 'uint256', name: 'buybackThreshold' },
      { type: 'uint256', name: 'totalFeesReceived' },
      { type: 'uint256', name: 'totalBBLNBought' },
      { type: 'uint256', name: 'totalELIZABought' },
      { type: 'uint256', name: 'totalTreasuryETH' },
      { type: 'uint256', name: 'totalBuybacks' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'canExecuteBuyback',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'paused',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getGovernanceInfo',
    type: 'function',
    inputs: [],
    outputs: [
      { type: 'address', name: 'dao' },
      { type: 'address', name: 'treasury' },
      { type: 'address', name: 'elizaFoundation' },
      { type: 'address', name: 'dexRouter' },
      { type: 'bool', name: 'isPaused' },
    ],
    stateMutability: 'view',
  },
] as const;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// =============================================================================
// SERVICE
// =============================================================================

export interface DAOServiceConfig {
  rpcUrl: string;
  daoAddress: Address;
  treasuryAddress: Address;
  revenueAddress: Address;
  bblnTokenAddress: Address;
  chainId: number;
}

export class DAOService {
  private static config: DAOServiceConfig | null = null;

  /**
   * Initialize DAO service with contract addresses
   */
  static initialize(config: DAOServiceConfig): void {
    DAOService.config = config;
    logger.info(
      'DAOService initialized',
      {
        dao: config.daoAddress,
        treasury: config.treasuryAddress,
        revenue: config.revenueAddress,
      },
      'DAOService'
    );
  }

  /**
   * Initialize from environment variables
   * Call this at app startup to auto-configure the DAO service
   */
  static initializeFromEnvironment(): boolean {
    const env = getEnvironment();

    if (
      !env.daoAddress ||
      !env.treasuryAddress ||
      !env.revenueAddress ||
      !env.bblnTokenAddress ||
      !env.rpcUrl
    ) {
      logger.debug(
        'DAOService not initialized - missing environment config',
        {
          hasDao: !!env.daoAddress,
          hasTreasury: !!env.treasuryAddress,
          hasRevenue: !!env.revenueAddress,
          hasBbln: !!env.bblnTokenAddress,
          hasRpc: !!env.rpcUrl,
        },
        'DAOService'
      );
      return false;
    }

    DAOService.initialize({
      rpcUrl: env.rpcUrl,
      daoAddress: env.daoAddress as Address,
      treasuryAddress: env.treasuryAddress as Address,
      revenueAddress: env.revenueAddress as Address,
      bblnTokenAddress: env.bblnTokenAddress as Address,
      chainId: env.chainId,
    });

    return true;
  }

  /**
   * Check if DAO service is configured
   */
  static isConfigured(): boolean {
    return DAOService.config !== null;
  }

  /**
   * Get the public client for reading contract data
   */
  private static getClient() {
    const config = DAOService.config;
    if (!config) {
      throw new Error('DAOService not initialized');
    }

    return createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  /**
   * Get AI CEO status
   */
  static async getAICEOStatus(): Promise<AIChiefStatus> {
    const config = DAOService.config;
    if (!config) {
      // Return mock data if not configured
      return {
        address: '0x0000000000000000000000000000000000000000',
        agentId: '0',
        currentModel: {
          modelId: 'jeju-compute',
          name: 'Monkey King',
          provider: 'Jeju Compute',
        },
        stats: {
          totalDecisions: 0,
          approvedDecisions: 0,
          rejectedDecisions: 0,
          approvalRate: '0%',
        },
        isActive: false,
        lastDecisionAt: null,
      };
    }

    const client = DAOService.getClient();

    const [aiCEOAddress, agentId, emergencyPaused] = await Promise.all([
      client.readContract({
        address: config.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'aiCEO',
      }),
      client.readContract({
        address: config.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'aiCEOAgentId',
      }),
      client.readContract({
        address: config.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'emergencyPaused',
      }),
    ]);

    // TODO: Fetch actual decision stats from on-chain events or database
    return {
      address: aiCEOAddress,
      agentId: agentId.toString(),
      currentModel: {
        modelId: 'jeju-compute',
        name: 'Monkey King',
        provider: 'Jeju Compute',
      },
      stats: {
        totalDecisions: 0,
        approvedDecisions: 0,
        rejectedDecisions: 0,
        approvalRate: '100%',
      },
      isActive: !emergencyPaused,
      lastDecisionAt: null,
    };
  }

  /**
   * Get treasury stats
   */
  static async getTreasuryStats(): Promise<TreasuryStats> {
    const config = DAOService.config;
    if (!config) {
      return {
        ethBalance: 0n,
        bblnBalance: 0n,
        totalETHDistributed: 0n,
        totalBBLNDistributed: 0n,
        approvedVaultsCount: 0,
      };
    }

    const client = DAOService.getClient();

    const [ethBalance, bblnBalance, totalETHDistributed, totalBBLNDistributed] =
      await Promise.all([
        client.getBalance({ address: config.treasuryAddress }),
        client.readContract({
          address: config.bblnTokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [config.treasuryAddress],
        }),
        client.readContract({
          address: config.treasuryAddress,
          abi: BABYLON_TREASURY_ABI,
          functionName: 'totalETHDistributed',
        }),
        client.readContract({
          address: config.treasuryAddress,
          abi: BABYLON_TREASURY_ABI,
          functionName: 'totalBBLNDistributed',
        }),
      ]);

    return {
      ethBalance,
      bblnBalance,
      totalETHDistributed,
      totalBBLNDistributed,
      approvedVaultsCount: 0, // TODO: Count from contract
    };
  }

  /**
   * Get revenue stats from BabylonRevenue contract
   */
  static async getRevenueStats(): Promise<RevenueStats> {
    const config = DAOService.config;
    if (!config) {
      // Fallback to database if contract not configured
      const [accumulator] = await db
        .select()
        .from(feeAccumulator)
        .where(eq(feeAccumulator.id, 'singleton'))
        .limit(1);

      return {
        accumulatedFees: BigInt(accumulator?.accumulatedFees ?? '0'),
        buybackThreshold: BigInt(accumulator?.buybackThreshold ?? '0'),
        totalFeesReceived: BigInt(accumulator?.totalFeesAccumulated ?? '0'),
        totalBBLNBought: 0n,
        totalELIZABought: 0n,
        totalTreasuryETH: 0n,
        totalBuybacks: accumulator?.totalBuybacksExecuted ?? 0,
        canExecuteBuyback: false,
        isPaused: false,
      };
    }

    const client = DAOService.getClient();

    const [stats, canExecute, isPaused] = await Promise.all([
      client.readContract({
        address: config.revenueAddress,
        abi: BABYLON_REVENUE_ABI,
        functionName: 'getStats',
      }),
      client.readContract({
        address: config.revenueAddress,
        abi: BABYLON_REVENUE_ABI,
        functionName: 'canExecuteBuyback',
      }),
      client.readContract({
        address: config.revenueAddress,
        abi: BABYLON_REVENUE_ABI,
        functionName: 'paused',
      }),
    ]);

    return {
      accumulatedFees: stats[0],
      buybackThreshold: stats[1],
      totalFeesReceived: stats[2],
      totalBBLNBought: stats[3],
      totalELIZABought: stats[4],
      totalTreasuryETH: stats[5],
      totalBuybacks: Number(stats[6]),
      canExecuteBuyback: canExecute,
      isPaused,
    };
  }

  /**
   * Get buyback history from database
   */
  static async getBuybackHistory(limit = 20): Promise<BuybackRecord[]> {
    const records = await db
      .select()
      .from(buybackRecords)
      .orderBy(buybackRecords.initiatedAt)
      .limit(limit);

    return records.map((r) => ({
      id: r.id,
      totalEthInput: r.totalEthInput,
      bblnBought: r.bblnReceived,
      elizaBought: r.elizaReceived,
      treasuryEth: r.treasuryEthAmount,
      status: r.status,
      txHash: r.bblnSwapTxHash,
      initiatedAt: r.initiatedAt,
      completedAt: r.completedAt,
    }));
  }

  /**
   * Get DAO overview with all stats
   */
  static async getOverview(): Promise<DAOOverview> {
    const [aiCEO, treasury, revenue] = await Promise.all([
      DAOService.getAICEOStatus(),
      DAOService.getTreasuryStats(),
      DAOService.getRevenueStats(),
    ]);

    // TODO: Fetch actual proposal counts from contract
    const proposals = {
      total: 0,
      pending: 0,
      approved: 0,
      executed: 0,
    };

    return {
      aiCEO,
      treasury,
      revenue,
      proposals,
    };
  }

  /**
   * Format stats for display
   */
  static formatStats(overview: DAOOverview): {
    treasury: {
      ethBalance: string;
      bblnBalance: string;
      totalDistributed: string;
    };
    revenue: {
      accumulated: string;
      threshold: string;
      totalReceived: string;
      totalBuybacks: number;
      bblnBought: string;
      elizaBought: string;
    };
    aiCEO: {
      address: string;
      model: string;
      isActive: boolean;
      approvalRate: string;
    };
  } {
    return {
      treasury: {
        ethBalance: formatEther(overview.treasury.ethBalance),
        bblnBalance: formatUnits(overview.treasury.bblnBalance, 18),
        totalDistributed: formatEther(overview.treasury.totalETHDistributed),
      },
      revenue: {
        accumulated: formatEther(overview.revenue.accumulatedFees),
        threshold: formatEther(overview.revenue.buybackThreshold),
        totalReceived: formatEther(overview.revenue.totalFeesReceived),
        totalBuybacks: overview.revenue.totalBuybacks,
        bblnBought: formatUnits(overview.revenue.totalBBLNBought, 18),
        elizaBought: formatUnits(overview.revenue.totalELIZABought, 18),
      },
      aiCEO: {
        address: overview.aiCEO.address,
        model: overview.aiCEO.currentModel.name,
        isActive: overview.aiCEO.isActive,
        approvalRate: overview.aiCEO.stats.approvalRate,
      },
    };
  }
}
