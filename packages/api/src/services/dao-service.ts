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

import { buybackRecords, db, desc } from '@babylon/db'
import {
  type Chain,
  createBabylonPublicClient,
  logger,
  readContract,
} from '@babylon/shared'
import { type Address, formatEther, formatUnits, type PublicClient } from 'viem'
import { base, baseSepolia, hardhat } from 'viem/chains'
import { getEnvironment } from '../config/environment'

function getChainFromId(chainId: number): Chain {
  switch (chainId) {
    case 8453:
      return base
    case 84532:
      return baseSepolia
    default:
      return hardhat
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface AIChiefStatus {
  /** AI CEO wallet address */
  address: Address
  /** AI CEO's ERC-8004 agent ID */
  agentId: string
  /** Current model powering the AI CEO */
  currentModel: {
    modelId: string
    name: string
    provider: string
  }
  /** Decision statistics */
  stats: {
    totalDecisions: number
    approvedDecisions: number
    rejectedDecisions: number
    approvalRate: string
  }
  /** Is AI CEO active? */
  isActive: boolean
  /** Last decision timestamp */
  lastDecisionAt: Date | null
}

// biome-ignore lint/correctness/noUnusedVariables: Documents contract return type
interface DAOProposal {
  proposalId: string
  proposalType:
    | 'TREASURY_SPEND'
    | 'MODEL_DEPLOYMENT'
    | 'TRAINING_JOB'
    | 'GAME_PARAMETER'
    | 'PROTOCOL_UPGRADE'
    | 'INFRASTRUCTURE'
    | 'EMERGENCY'
  target: Address
  value: bigint
  description: string
  reasoning: string
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'VETOED' | 'EXPIRED'
  createdAt: Date
  executeAfter: Date
  expiresAt: Date
  vetoable: boolean
}

export interface TreasuryStats {
  /** ETH balance in treasury */
  ethBalance: bigint
  /** BBLN token balance in treasury */
  bblnBalance: bigint
  /** Total ETH ever distributed */
  totalETHDistributed: bigint
  /** Total BBLN ever distributed */
  totalBBLNDistributed: bigint
  /** Approved vaults count */
  approvedVaultsCount: number
}

export interface RevenueStats {
  /** Accumulated fees awaiting buyback */
  accumulatedFees: bigint
  /** Threshold to trigger buyback */
  buybackThreshold: bigint
  /** Total fees ever received */
  totalFeesReceived: bigint
  /** Total BBLN bought back */
  totalBBLNBought: bigint
  /** Total ELIZA bought back */
  totalELIZABought: bigint
  /** Total ETH sent to treasury */
  totalTreasuryETH: bigint
  /** Total buyback executions */
  totalBuybacks: number
  /** Can execute buyback now? */
  canExecuteBuyback: boolean
  /** Is paused? */
  isPaused: boolean
}

export interface BuybackRecord {
  id: string
  totalEthInput: string
  bblnBought: string | null
  elizaBought: string | null
  treasuryEth: string
  status: string
  txHash: string | null
  initiatedAt: Date
  completedAt: Date | null
}

export interface DAOOverview {
  aiCEO: AIChiefStatus
  treasury: TreasuryStats
  revenue: RevenueStats
  proposals: {
    total: number
    pending: number
    approved: number
    executed: number
  }
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
    name: 'getProposalCount',
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
  {
    name: 'getProposalsByStatus',
    type: 'function',
    inputs: [{ type: 'uint8', name: 'status' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getAICEOStats',
    type: 'function',
    inputs: [],
    outputs: [
      { type: 'uint256', name: 'totalDecisions' },
      { type: 'uint256', name: 'approvedDecisions' },
      { type: 'uint256', name: 'rejectedDecisions' },
      { type: 'uint256', name: 'lastDecisionTimestamp' },
    ],
    stateMutability: 'view',
  },
] as const

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
  {
    name: 'getApprovedVaultsCount',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

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
] as const

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// =============================================================================
// SERVICE CONFIG
// =============================================================================

export interface DAOServiceConfig {
  rpcUrl: string
  daoAddress: Address
  treasuryAddress: Address
  revenueAddress: Address
  bblnTokenAddress: Address
  chainId: number
}

let daoConfig: DAOServiceConfig | null = null

/**
 * Initialize DAO service with contract addresses
 */
export function initializeDAOService(config: DAOServiceConfig): void {
  daoConfig = config
  logger.info(
    'DAOService initialized',
    {
      dao: config.daoAddress,
      treasury: config.treasuryAddress,
      revenue: config.revenueAddress,
    },
    'DAOService',
  )
}

/**
 * Initialize from environment variables
 * Call this at app startup to auto-configure the DAO service
 */
function _initializeDAOServiceFromEnvironment(): boolean {
  const env = getEnvironment()

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
      'DAOService',
    )
    return false
  }

  initializeDAOService({
    rpcUrl: env.rpcUrl,
    daoAddress: env.daoAddress as Address,
    treasuryAddress: env.treasuryAddress as Address,
    revenueAddress: env.revenueAddress as Address,
    bblnTokenAddress: env.bblnTokenAddress as Address,
    chainId: env.chainId,
  })

  return true
}

/**
 * Check if DAO service is configured
 */
function _isDAOServiceConfigured(): boolean {
  return daoConfig !== null
}

/**
 * Get the public client for reading contract data
 * Returns a PublicClient that works with any chain type.
 */
function getDAOClient(): PublicClient {
  if (!daoConfig) {
    throw new Error('DAOService not initialized')
  }

  return createBabylonPublicClient({
    chain: getChainFromId(daoConfig.chainId),
    rpcUrl: daoConfig.rpcUrl,
  }) as PublicClient
}

/**
 * Get AI CEO status
 */
export async function getAICEOStatus(): Promise<AIChiefStatus> {
  if (!daoConfig) {
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
    }
  }

  const client = getDAOClient()

  const [aiCEOAddress, agentId, emergencyPaused, ceoStats] = (await Promise.all(
    [
      readContract(client, {
        address: daoConfig.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'aiCEO',
      }),
      readContract(client, {
        address: daoConfig.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'aiCEOAgentId',
      }),
      readContract(client, {
        address: daoConfig.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'emergencyPaused',
      }),
      readContract(client, {
        address: daoConfig.daoAddress,
        abi: BABYLON_DAO_ABI,
        functionName: 'getAICEOStats',
      }).catch(() => [0n, 0n, 0n, 0n] as const),
    ],
  )) as [
    `0x${string}`,
    bigint,
    boolean,
    readonly [bigint, bigint, bigint, bigint],
  ]

  const totalDecisions = Number(ceoStats[0])
  const approvedDecisions = Number(ceoStats[1])
  const rejectedDecisions = Number(ceoStats[2])
  const lastDecisionTimestamp = Number(ceoStats[3])

  const approvalRate =
    totalDecisions > 0
      ? `${Math.round((approvedDecisions / totalDecisions) * 100)}%`
      : '100%'

  return {
    address: aiCEOAddress,
    agentId: agentId.toString(),
    currentModel: {
      modelId: 'jeju-compute',
      name: 'Monkey King',
      provider: 'Jeju Compute',
    },
    stats: {
      totalDecisions,
      approvedDecisions,
      rejectedDecisions,
      approvalRate,
    },
    isActive: !emergencyPaused,
    lastDecisionAt:
      lastDecisionTimestamp > 0 ? new Date(lastDecisionTimestamp * 1000) : null,
  }
}

/**
 * Get treasury stats
 */
export async function getTreasuryStats(): Promise<TreasuryStats> {
  if (!daoConfig) {
    return {
      ethBalance: 0n,
      bblnBalance: 0n,
      totalETHDistributed: 0n,
      totalBBLNDistributed: 0n,
      approvedVaultsCount: 0,
    }
  }

  const client = getDAOClient()

  const [
    ethBalance,
    bblnBalance,
    totalETHDistributed,
    totalBBLNDistributed,
    approvedVaultsCount,
  ] = (await Promise.all([
    client.getBalance({ address: daoConfig.treasuryAddress }),
    readContract(client, {
      address: daoConfig.bblnTokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [daoConfig.treasuryAddress],
    }),
    readContract(client, {
      address: daoConfig.treasuryAddress,
      abi: BABYLON_TREASURY_ABI,
      functionName: 'totalETHDistributed',
    }),
    readContract(client, {
      address: daoConfig.treasuryAddress,
      abi: BABYLON_TREASURY_ABI,
      functionName: 'totalBBLNDistributed',
    }),
    readContract(client, {
      address: daoConfig.treasuryAddress,
      abi: BABYLON_TREASURY_ABI,
      functionName: 'getApprovedVaultsCount',
    }).catch(() => 0n),
  ])) as [bigint, bigint, bigint, bigint, bigint]

  return {
    ethBalance,
    bblnBalance,
    totalETHDistributed,
    totalBBLNDistributed,
    approvedVaultsCount: Number(approvedVaultsCount),
  }
}

/**
 * Get revenue stats from BabylonRevenue contract
 */
export async function getRevenueStats(): Promise<RevenueStats> {
  if (!daoConfig) {
    throw new Error('DAOService not initialized - call initialize() first')
  }

  const client = getDAOClient()

  const [stats, canExecute, isPaused] = (await Promise.all([
    readContract(client, {
      address: daoConfig.revenueAddress,
      abi: BABYLON_REVENUE_ABI,
      functionName: 'getStats',
    }),
    readContract(client, {
      address: daoConfig.revenueAddress,
      abi: BABYLON_REVENUE_ABI,
      functionName: 'canExecuteBuyback',
    }),
    readContract(client, {
      address: daoConfig.revenueAddress,
      abi: BABYLON_REVENUE_ABI,
      functionName: 'paused',
    }),
  ])) as [
    readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
    boolean,
    boolean,
  ]

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
  }
}

/**
 * Get buyback history from database (for DAO dashboard)
 */
async function _getDAOBuybackHistory(limit = 20): Promise<BuybackRecord[]> {
  const records = await db
    .select()
    .from(buybackRecords)
    .orderBy(desc(buybackRecords.initiatedAt))
    .limit(limit)

  return records
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      id: String(r.id),
      totalEthInput: String(r.totalEthInput),
      bblnBought: r.bblnReceived ? String(r.bblnReceived) : null,
      elizaBought: r.elizaReceived ? String(r.elizaReceived) : null,
      treasuryEth: String(r.treasuryEthAmount),
      status: String(r.status),
      txHash: r.bblnSwapTxHash ? String(r.bblnSwapTxHash) : null,
      initiatedAt: r.initiatedAt as Date,
      completedAt: r.completedAt as Date | null,
    }))
}

/**
 * Get DAO overview with all stats
 */
async function _getDAOOverview(): Promise<DAOOverview> {
  const [aiCEO, treasury, revenue, proposals] = await Promise.all([
    getAICEOStatus(),
    getTreasuryStats(),
    getRevenueStats(),
    getProposalCounts(),
  ])

  return {
    aiCEO,
    treasury,
    revenue,
    proposals,
  }
}

/**
 * Get proposal counts by status from contract
 */
export async function getProposalCounts(): Promise<{
  total: number
  pending: number
  approved: number
  executed: number
}> {
  if (!daoConfig) {
    return { total: 0, pending: 0, approved: 0, executed: 0 }
  }

  const client = getDAOClient()

  // Proposal status enum: PENDING=0, APPROVED=1, EXECUTED=2, VETOED=3, EXPIRED=4
  const [total, pending, approved, executed] = await Promise.all([
    readContract(client, {
      address: daoConfig.daoAddress,
      abi: BABYLON_DAO_ABI,
      functionName: 'getProposalCount',
    }).catch(() => 0n),
    readContract(client, {
      address: daoConfig.daoAddress,
      abi: BABYLON_DAO_ABI,
      functionName: 'getProposalsByStatus',
      args: [0],
    }).catch(() => 0n),
    readContract(client, {
      address: daoConfig.daoAddress,
      abi: BABYLON_DAO_ABI,
      functionName: 'getProposalsByStatus',
      args: [1],
    }).catch(() => 0n),
    readContract(client, {
      address: daoConfig.daoAddress,
      abi: BABYLON_DAO_ABI,
      functionName: 'getProposalsByStatus',
      args: [2],
    }).catch(() => 0n),
  ])

  return {
    total: Number(total),
    pending: Number(pending),
    approved: Number(approved),
    executed: Number(executed),
  }
}

/**
 * Format stats for display
 */
function _formatDAOStats(overview: DAOOverview): {
  treasury: {
    ethBalance: string
    bblnBalance: string
    totalDistributed: string
  }
  revenue: {
    accumulated: string
    threshold: string
    totalReceived: string
    totalBuybacks: number
    bblnBought: string
    elizaBought: string
  }
  aiCEO: {
    address: string
    model: string
    isActive: boolean
    approvalRate: string
  }
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
  }
}
