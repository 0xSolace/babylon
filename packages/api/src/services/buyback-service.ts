/**
 * Buyback Service
 *
 * @description Manages threshold-based programmatic buybacks from trading fees.
 *
 * Revenue Distribution:
 * - 30% → BBLN buyback (held in treasury)
 * - 20% → ELIZA buyback (sent to Eliza Foundation)
 * - 50% → Treasury (ETH for operations)
 *
 * Flow:
 * 1. Trading fees are recorded via recordFeeContribution()
 * 2. Fees accumulate in FeeAccumulator
 * 3. When threshold is met, triggerBuyback() is called
 * 4. On-chain BabylonRevenue contract executes the buyback
 * 5. Results are recorded in BuybackRecord
 */

import { db } from '@babylon/db'
import {
  type Chain,
  createBabylonPublicClient,
  generateSnowflakeId,
  logger,
  safeReadContract,
  safeWriteContract,
  toNull,
} from '@babylon/shared'
import {
  type Address,
  createWalletClient,
  defineChain,
  formatEther,
  type Hex,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default buyback threshold in wei (1 ETH) */
const DEFAULT_THRESHOLD = parseEther('1')

/** Distribution percentages in basis points */
const BBLN_BUYBACK_BPS = 3000n // 30%
const ELIZA_BUYBACK_BPS = 2000n // 20%
// Note: TREASURY_BPS = 5000n (50%) - implied from 100% - BBLN - ELIZA
const TOTAL_BPS = 10000n

// =============================================================================
// TYPES
// =============================================================================

export interface BuybackConfig {
  /** BabylonRevenue contract address */
  revenueContractAddress: Address
  /** RPC URL for Jeju network */
  rpcUrl: string
  /** Private key for executing buybacks (should be operator key) */
  operatorPrivateKey?: Hex
  /** Chain ID */
  chainId: number
  /** Chain name (for display) */
  chainName?: string
}

export interface BuybackResult {
  success: boolean
  buybackId: string
  totalEth: bigint
  bblnBought?: bigint
  elizaBought?: bigint
  treasuryEth?: bigint
  txHash?: string
  error?: string
}

export interface AccumulatorStatus {
  accumulatedFees: bigint
  threshold: bigint
  canExecute: boolean
  lastBuybackAt: Date | null
  totalBuybacks: number
}

interface FeeAccumulatorRow {
  id: string
  accumulatedFees: string
  buybackThreshold: string
  lastAccumulatedAt: Date | null
  lastBuybackAt: Date | null
  totalFeesAccumulated: string
  totalBuybacksExecuted: number
  updatedAt: Date
}

interface BuybackRecordRow {
  id: string
  totalEthInput: string
  bblnEthAmount: string
  bblnReceived: string | null
  bblnSwapTxHash: string | null
  bblnSwapStatus: string
  elizaEthAmount: string
  elizaReceived: string | null
  elizaSwapTxHash: string | null
  elizaRecipient: string | null
  elizaSwapStatus: string
  treasuryEthAmount: string
  treasuryTxHash: string | null
  treasuryStatus: string
  status: string
  errorMessage: string | null
  dexUsed: string
  bblnSwapPrice: string | null
  elizaSwapPrice: string | null
  slippageBps: number
  initiatedAt: Date
  completedAt: Date | null
  createdAt: Date
}

// =============================================================================
// BUYBACK SERVICE
// =============================================================================

let buybackConfig: BuybackConfig | null = null

/**
 * Initialize the buyback service with configuration
 */
export function initializeBuybackService(config: BuybackConfig): void {
  buybackConfig = config
  logger.info(
    'BuybackService initialized',
    {
      revenueContract: config.revenueContractAddress,
      chainId: config.chainId,
    },
    'BuybackService',
  )
}

/**
 * Record a fee contribution from a trade
 */
export async function recordFeeContribution(
  tradingFeeId: string,
  userId: string,
  feeAmount: bigint,
  tradeType: string,
  marketId?: string,
): Promise<{ accumulated: bigint; thresholdMet: boolean }> {
  const contributionId = await generateSnowflakeId()
  const now = new Date()

  // Insert fee contribution
  await db.exec(
    `INSERT INTO "FeeContribution" (
        id, "tradingFeeId", "userId", "feeAmount", "tradeType", "marketId",
        "includedInBuyback", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      contributionId,
      tradingFeeId,
      userId,
      feeAmount.toString(),
      tradeType,
      toNull(marketId),
      false,
      now.toISOString(),
    ],
  )

  // Get accumulator
  const accumulators = await db.query<FeeAccumulatorRow>(
    'SELECT * FROM "FeeAccumulator" WHERE id = $1 LIMIT 1',
    ['singleton'],
  )
  const accumulator = accumulators[0]

  const currentAccumulated = BigInt(String(accumulator?.accumulatedFees ?? '0'))
  const threshold = BigInt(
    String(accumulator?.buybackThreshold ?? DEFAULT_THRESHOLD.toString()),
  )
  const newAccumulated = currentAccumulated + feeAmount
  const totalAccumulated =
    BigInt(String(accumulator?.totalFeesAccumulated ?? '0')) + feeAmount

  if (accumulator) {
    await db.exec(
      `UPDATE "FeeAccumulator" SET
          "accumulatedFees" = $1,
          "totalFeesAccumulated" = $2,
          "lastAccumulatedAt" = $3,
          "updatedAt" = $4
        WHERE id = $5`,
      [
        newAccumulated.toString(),
        totalAccumulated.toString(),
        now.toISOString(),
        now.toISOString(),
        'singleton',
      ],
    )
  } else {
    await db.exec(
      `INSERT INTO "FeeAccumulator" (
          id, "accumulatedFees", "buybackThreshold", "lastAccumulatedAt",
          "totalFeesAccumulated", "totalBuybacksExecuted", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'singleton',
        newAccumulated.toString(),
        DEFAULT_THRESHOLD.toString(),
        now.toISOString(),
        totalAccumulated.toString(),
        0,
        now.toISOString(),
      ],
    )
  }

  const thresholdMet = newAccumulated >= threshold

  logger.debug(
    'Fee contribution recorded',
    {
      contributionId,
      feeAmount: formatEther(feeAmount),
      newAccumulated: formatEther(newAccumulated),
      threshold: formatEther(threshold),
      thresholdMet,
    },
    'BuybackService',
  )

  return { accumulated: newAccumulated, thresholdMet }
}

/**
 * Get current accumulator status
 */
export async function getAccumulatorStatus(): Promise<AccumulatorStatus> {
  const accumulators = await db.query<FeeAccumulatorRow>(
    'SELECT * FROM "FeeAccumulator" WHERE id = $1 LIMIT 1',
    ['singleton'],
  )
  const accumulator = accumulators[0]

  const accumulatedFees = BigInt(String(accumulator?.accumulatedFees ?? '0'))
  const threshold = BigInt(
    String(accumulator?.buybackThreshold ?? DEFAULT_THRESHOLD.toString()),
  )

  const lastBuybackAtRaw = accumulator?.lastBuybackAt
  const lastBuybackAt = lastBuybackAtRaw
    ? lastBuybackAtRaw instanceof Date
      ? lastBuybackAtRaw
      : new Date(String(lastBuybackAtRaw))
    : null

  return {
    accumulatedFees,
    threshold,
    canExecute: accumulatedFees >= threshold,
    lastBuybackAt,
    totalBuybacks: Number(accumulator?.totalBuybacksExecuted ?? 0),
  }
}

/**
 * Update buyback threshold
 */
export async function setBuybackThreshold(newThreshold: bigint): Promise<void> {
  const accumulators = await db.query<FeeAccumulatorRow>(
    'SELECT * FROM "FeeAccumulator" WHERE id = $1 LIMIT 1',
    ['singleton'],
  )
  const accumulator = accumulators[0]

  if (accumulator) {
    await db.exec(
      `UPDATE "FeeAccumulator" SET
          "buybackThreshold" = $1,
          "updatedAt" = $2
        WHERE id = $3`,
      [newThreshold.toString(), new Date().toISOString(), 'singleton'],
    )
  } else {
    await db.exec(
      `INSERT INTO "FeeAccumulator" (
          id, "accumulatedFees", "buybackThreshold", "totalFeesAccumulated",
          "totalBuybacksExecuted", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'singleton',
        '0',
        newThreshold.toString(),
        '0',
        0,
        new Date().toISOString(),
      ],
    )
  }

  logger.info(
    'Buyback threshold updated',
    { newThreshold: formatEther(newThreshold) },
    'BuybackService',
  )
}

/**
 * Trigger buyback execution (on-chain)
 */
export async function triggerBuyback(): Promise<BuybackResult> {
  const config = buybackConfig
  if (!config) {
    return {
      success: false,
      buybackId: '',
      totalEth: 0n,
      error: 'BuybackService not initialized',
    }
  }

  if (!config.operatorPrivateKey) {
    return {
      success: false,
      buybackId: '',
      totalEth: 0n,
      error: 'Operator private key not configured',
    }
  }

  const status = await getAccumulatorStatus()
  if (!status.canExecute) {
    return {
      success: false,
      buybackId: '',
      totalEth: status.accumulatedFees,
      error: `Below threshold. Accumulated: ${formatEther(status.accumulatedFees)}, Threshold: ${formatEther(status.threshold)}`,
    }
  }

  const buybackId = await generateSnowflakeId()
  const totalEth = status.accumulatedFees
  const now = new Date()

  // Calculate distribution
  const bblnEth = (totalEth * BBLN_BUYBACK_BPS) / TOTAL_BPS
  const elizaEth = (totalEth * ELIZA_BUYBACK_BPS) / TOTAL_BPS
  const treasuryEth = totalEth - bblnEth - elizaEth

  // Create buyback record (pending)
  await db.exec(
    `INSERT INTO "BuybackRecord" (
        id, "totalEthInput", "bblnEthAmount", "elizaEthAmount", "treasuryEthAmount",
        status, "dexUsed", "slippageBps", "initiatedAt", "createdAt",
        "bblnSwapStatus", "elizaSwapStatus", "treasuryStatus"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      buybackId,
      totalEth.toString(),
      bblnEth.toString(),
      elizaEth.toString(),
      treasuryEth.toString(),
      'executing',
      'jeju-dex',
      100,
      now.toISOString(),
      now.toISOString(),
      'pending',
      'pending',
      'pending',
    ],
  )

  // Execute on-chain buyback
  const account = privateKeyToAccount(config.operatorPrivateKey)
  // Create a minimal chain definition for the buyback
  const buybackChain = defineChain({
    id: config.chainId,
    name: 'Buyback Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  })
  const publicClient = createBabylonPublicClient({
    chain: buybackChain as Chain,
    rpcUrl: config.rpcUrl,
  })
  const walletClient = createWalletClient({
    account,
    chain: buybackChain,
    transport: http(config.rpcUrl),
  })

  // ABI for executeBuyback function
  const REVENUE_ABI = [
    {
      name: 'executeBuyback',
      type: 'function',
      inputs: [],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      name: 'canExecuteBuyback',
      type: 'function',
      inputs: [],
      outputs: [{ type: 'bool' }],
      stateMutability: 'view',
    },
  ] as const

  // Check if on-chain contract can execute
  const canExecute = await safeReadContract<boolean>(publicClient, {
    address: config.revenueContractAddress,
    abi: REVENUE_ABI,
    functionName: 'canExecuteBuyback',
  })

  if (!canExecute) {
    // Update record as failed
    await db.exec(
      `UPDATE "BuybackRecord" SET status = $1, "errorMessage" = $2 WHERE id = $3`,
      ['failed', 'On-chain contract not ready for buyback', buybackId],
    )

    return {
      success: false,
      buybackId,
      totalEth,
      error: 'On-chain contract not ready for buyback',
    }
  }

  // Execute buyback transaction
  const txHash = await safeWriteContract(walletClient, {
    address: config.revenueContractAddress,
    abi: REVENUE_ABI,
    functionName: 'executeBuyback',
    chain: buybackChain,
    account,
  })

  // Wait for transaction confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  })

  if (receipt.status !== 'success') {
    await db.exec(
      `UPDATE "BuybackRecord" SET
          status = $1,
          "errorMessage" = $2,
          "bblnSwapTxHash" = $3
        WHERE id = $4`,
      ['failed', 'Transaction reverted', txHash, buybackId],
    )

    return {
      success: false,
      buybackId,
      totalEth,
      txHash,
      error: 'Transaction reverted',
    }
  }

  // Update buyback record as completed
  // Note: In production, we'd parse events to get actual amounts bought
  await db.exec(
    `UPDATE "BuybackRecord" SET
        status = $1,
        "bblnSwapTxHash" = $2,
        "bblnSwapStatus" = $3,
        "elizaSwapTxHash" = $4,
        "elizaSwapStatus" = $5,
        "treasuryTxHash" = $6,
        "treasuryStatus" = $7,
        "completedAt" = $8
      WHERE id = $9`,
    [
      'completed',
      txHash,
      'completed',
      txHash,
      'completed',
      txHash,
      'completed',
      new Date().toISOString(),
      buybackId,
    ],
  )

  // Mark fee contributions as included
  await db.exec(
    `UPDATE "FeeContribution" SET
        "includedInBuyback" = $1,
        "buybackRecordId" = $2
      WHERE "includedInBuyback" = $3`,
    [true, buybackId, false],
  )

  // Reset accumulator
  await db.exec(
    `UPDATE "FeeAccumulator" SET
        "accumulatedFees" = $1,
        "lastBuybackAt" = $2,
        "totalBuybacksExecuted" = $3,
        "updatedAt" = $4
      WHERE id = $5`,
    [
      '0',
      new Date().toISOString(),
      status.totalBuybacks + 1,
      new Date().toISOString(),
      'singleton',
    ],
  )

  logger.info(
    'Buyback executed successfully',
    {
      buybackId,
      totalEth: formatEther(totalEth),
      bblnEth: formatEther(bblnEth),
      elizaEth: formatEther(elizaEth),
      treasuryEth: formatEther(treasuryEth),
      txHash,
    },
    'BuybackService',
  )

  return {
    success: true,
    buybackId,
    totalEth,
    bblnBought: 0n, // Would be parsed from events
    elizaBought: 0n, // Would be parsed from events
    treasuryEth,
    txHash,
  }
}

/**
 * Get buyback history
 */
export async function getBuybackHistory(
  limit = 20,
): Promise<BuybackRecordRow[]> {
  const records = await db.query<BuybackRecordRow>(
    `SELECT * FROM "BuybackRecord" ORDER BY "initiatedAt" DESC LIMIT $1`,
    [limit],
  )
  return records
}

/**
 * Get total stats
 */
export async function getBuybackStats(): Promise<{
  totalFeesReceived: bigint
  totalBuybacks: number
  currentAccumulated: bigint
  threshold: bigint
  canExecute: boolean
}> {
  const status = await getAccumulatorStatus()

  const accumulators = await db.query<FeeAccumulatorRow>(
    'SELECT * FROM "FeeAccumulator" WHERE id = $1 LIMIT 1',
    ['singleton'],
  )
  const accumulator = accumulators[0]

  return {
    totalFeesReceived: BigInt(String(accumulator?.totalFeesAccumulated ?? '0')),
    totalBuybacks: Number(accumulator?.totalBuybacksExecuted ?? 0),
    currentAccumulated: status.accumulatedFees,
    threshold: status.threshold,
    canExecute: status.canExecute,
  }
}
