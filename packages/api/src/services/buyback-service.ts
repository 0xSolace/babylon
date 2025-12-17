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
 * 2. Fees accumulate in feeAccumulator
 * 3. When threshold is met, triggerBuyback() is called
 * 4. On-chain BabylonRevenue contract executes the buyback
 * 5. Results are recorded in buybackRecords
 */

import {
  buybackRecords,
  db,
  eq,
  feeAccumulator,
  feeContributions,
} from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  type Hex,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default buyback threshold in wei (1 ETH) */
const DEFAULT_THRESHOLD = parseEther('1');

/** Distribution percentages in basis points */
const BBLN_BUYBACK_BPS = 3000n; // 30%
const ELIZA_BUYBACK_BPS = 2000n; // 20%
// Note: TREASURY_BPS = 5000n (50%) - implied from 100% - BBLN - ELIZA
const TOTAL_BPS = 10000n;

// =============================================================================
// TYPES
// =============================================================================

export interface BuybackConfig {
  /** BabylonRevenue contract address */
  revenueContractAddress: Address;
  /** RPC URL for Jeju network */
  rpcUrl: string;
  /** Private key for executing buybacks (should be operator key) */
  operatorPrivateKey?: Hex;
  /** Chain ID */
  chainId: number;
  /** Chain name (for display) */
  chainName?: string;
}

export interface BuybackResult {
  success: boolean;
  buybackId: string;
  totalEth: bigint;
  bblnBought?: bigint;
  elizaBought?: bigint;
  treasuryEth?: bigint;
  txHash?: string;
  error?: string;
}

export interface AccumulatorStatus {
  accumulatedFees: bigint;
  threshold: bigint;
  canExecute: boolean;
  lastBuybackAt: Date | null;
  totalBuybacks: number;
}

// =============================================================================
// BUYBACK SERVICE
// =============================================================================

export class BuybackService {
  private static config: BuybackConfig | null = null;

  /**
   * Initialize the buyback service with configuration
   */
  static initialize(config: BuybackConfig): void {
    BuybackService.config = config;
    logger.info(
      'BuybackService initialized',
      {
        revenueContract: config.revenueContractAddress,
        chainId: config.chainId,
      },
      'BuybackService'
    );
  }

  /**
   * Record a fee contribution from a trade
   */
  static async recordFeeContribution(
    tradingFeeId: string,
    userId: string,
    feeAmount: bigint,
    tradeType: string,
    marketId?: string
  ): Promise<{ accumulated: bigint; thresholdMet: boolean }> {
    const contributionId = await generateSnowflakeId();
    const now = new Date();

    // Insert fee contribution
    await db.insert(feeContributions).values({
      id: contributionId,
      tradingFeeId,
      userId,
      feeAmount: feeAmount.toString(),
      tradeType,
      marketId: marketId ?? null,
      includedInBuyback: false,
      createdAt: now,
    });

    // Update accumulator
    const [accumulator] = await db
      .select()
      .from(feeAccumulator)
      .where(eq(feeAccumulator.id, 'singleton'))
      .limit(1);

    const currentAccumulated = BigInt(accumulator?.accumulatedFees ?? '0');
    const threshold = BigInt(
      accumulator?.buybackThreshold ?? DEFAULT_THRESHOLD.toString()
    );
    const newAccumulated = currentAccumulated + feeAmount;
    const totalAccumulated =
      BigInt(accumulator?.totalFeesAccumulated ?? '0') + feeAmount;

    if (accumulator) {
      await db
        .update(feeAccumulator)
        .set({
          accumulatedFees: newAccumulated.toString(),
          totalFeesAccumulated: totalAccumulated.toString(),
          lastAccumulatedAt: now,
          updatedAt: now,
        })
        .where(eq(feeAccumulator.id, 'singleton'));
    } else {
      await db.insert(feeAccumulator).values({
        id: 'singleton',
        accumulatedFees: newAccumulated.toString(),
        buybackThreshold: DEFAULT_THRESHOLD.toString(),
        lastAccumulatedAt: now,
        totalFeesAccumulated: totalAccumulated.toString(),
        totalBuybacksExecuted: 0,
        updatedAt: now,
      });
    }

    const thresholdMet = newAccumulated >= threshold;

    logger.debug(
      'Fee contribution recorded',
      {
        contributionId,
        feeAmount: formatEther(feeAmount),
        newAccumulated: formatEther(newAccumulated),
        threshold: formatEther(threshold),
        thresholdMet,
      },
      'BuybackService'
    );

    return { accumulated: newAccumulated, thresholdMet };
  }

  /**
   * Get current accumulator status
   */
  static async getAccumulatorStatus(): Promise<AccumulatorStatus> {
    const [accumulator] = await db
      .select()
      .from(feeAccumulator)
      .where(eq(feeAccumulator.id, 'singleton'))
      .limit(1);

    const accumulatedFees = BigInt(accumulator?.accumulatedFees ?? '0');
    const threshold = BigInt(
      accumulator?.buybackThreshold ?? DEFAULT_THRESHOLD.toString()
    );

    return {
      accumulatedFees,
      threshold,
      canExecute: accumulatedFees >= threshold,
      lastBuybackAt: accumulator?.lastBuybackAt ?? null,
      totalBuybacks: accumulator?.totalBuybacksExecuted ?? 0,
    };
  }

  /**
   * Update buyback threshold
   */
  static async setThreshold(newThreshold: bigint): Promise<void> {
    const [accumulator] = await db
      .select()
      .from(feeAccumulator)
      .where(eq(feeAccumulator.id, 'singleton'))
      .limit(1);

    if (accumulator) {
      await db
        .update(feeAccumulator)
        .set({
          buybackThreshold: newThreshold.toString(),
          updatedAt: new Date(),
        })
        .where(eq(feeAccumulator.id, 'singleton'));
    } else {
      await db.insert(feeAccumulator).values({
        id: 'singleton',
        accumulatedFees: '0',
        buybackThreshold: newThreshold.toString(),
        totalFeesAccumulated: '0',
        totalBuybacksExecuted: 0,
        updatedAt: new Date(),
      });
    }

    logger.info(
      'Buyback threshold updated',
      { newThreshold: formatEther(newThreshold) },
      'BuybackService'
    );
  }

  /**
   * Trigger buyback execution (on-chain)
   */
  static async triggerBuyback(): Promise<BuybackResult> {
    const config = BuybackService.config;
    if (!config) {
      return {
        success: false,
        buybackId: '',
        totalEth: 0n,
        error: 'BuybackService not initialized',
      };
    }

    if (!config.operatorPrivateKey) {
      return {
        success: false,
        buybackId: '',
        totalEth: 0n,
        error: 'Operator private key not configured',
      };
    }

    const status = await BuybackService.getAccumulatorStatus();
    if (!status.canExecute) {
      return {
        success: false,
        buybackId: '',
        totalEth: status.accumulatedFees,
        error: `Below threshold. Accumulated: ${formatEther(status.accumulatedFees)}, Threshold: ${formatEther(status.threshold)}`,
      };
    }

    const buybackId = await generateSnowflakeId();
    const totalEth = status.accumulatedFees;
    const now = new Date();

    // Calculate distribution
    const bblnEth = (totalEth * BBLN_BUYBACK_BPS) / TOTAL_BPS;
    const elizaEth = (totalEth * ELIZA_BUYBACK_BPS) / TOTAL_BPS;
    const treasuryEth = totalEth - bblnEth - elizaEth;

    // Create buyback record (pending)
    await db.insert(buybackRecords).values({
      id: buybackId,
      totalEthInput: totalEth.toString(),
      bblnEthAmount: bblnEth.toString(),
      elizaEthAmount: elizaEth.toString(),
      treasuryEthAmount: treasuryEth.toString(),
      status: 'executing',
      dexUsed: 'jeju-dex',
      slippageBps: 100,
      initiatedAt: now,
      createdAt: now,
    });

    // Execute on-chain buyback
    const account = privateKeyToAccount(config.operatorPrivateKey);
    // Create a minimal chain definition for the buyback
    const buybackChain = defineChain({
      id: config.chainId,
      name: 'Buyback Chain',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    });
    const publicClient = createPublicClient({
      chain: buybackChain,
      transport: http(config.rpcUrl),
    });
    const walletClient = createWalletClient({
      account,
      chain: buybackChain,
      transport: http(config.rpcUrl),
    });

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
    ] as const;

    // Check if on-chain contract can execute
    const canExecute = await publicClient.readContract({
      address: config.revenueContractAddress,
      abi: REVENUE_ABI,
      functionName: 'canExecuteBuyback',
    });

    if (!canExecute) {
      // Update record as failed
      await db
        .update(buybackRecords)
        .set({
          status: 'failed',
          errorMessage: 'On-chain contract not ready for buyback',
        })
        .where(eq(buybackRecords.id, buybackId));

      return {
        success: false,
        buybackId,
        totalEth,
        error: 'On-chain contract not ready for buyback',
      };
    }

    // Execute buyback transaction
    const txHash = await walletClient.writeContract({
      address: config.revenueContractAddress,
      abi: REVENUE_ABI,
      functionName: 'executeBuyback',
      chain: buybackChain,
      account,
    });

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== 'success') {
      await db
        .update(buybackRecords)
        .set({
          status: 'failed',
          errorMessage: 'Transaction reverted',
          bblnSwapTxHash: txHash,
        })
        .where(eq(buybackRecords.id, buybackId));

      return {
        success: false,
        buybackId,
        totalEth,
        txHash,
        error: 'Transaction reverted',
      };
    }

    // Update buyback record as completed
    // Note: In production, we'd parse events to get actual amounts bought
    await db
      .update(buybackRecords)
      .set({
        status: 'completed',
        bblnSwapTxHash: txHash,
        bblnSwapStatus: 'completed',
        elizaSwapTxHash: txHash,
        elizaSwapStatus: 'completed',
        treasuryTxHash: txHash,
        treasuryStatus: 'completed',
        completedAt: new Date(),
      })
      .where(eq(buybackRecords.id, buybackId));

    // Mark fee contributions as included
    await db
      .update(feeContributions)
      .set({
        includedInBuyback: true,
        buybackRecordId: buybackId,
      })
      .where(eq(feeContributions.includedInBuyback, false));

    // Reset accumulator
    await db
      .update(feeAccumulator)
      .set({
        accumulatedFees: '0',
        lastBuybackAt: new Date(),
        totalBuybacksExecuted: status.totalBuybacks + 1,
        updatedAt: new Date(),
      })
      .where(eq(feeAccumulator.id, 'singleton'));

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
      'BuybackService'
    );

    return {
      success: true,
      buybackId,
      totalEth,
      bblnBought: 0n, // Would be parsed from events
      elizaBought: 0n, // Would be parsed from events
      treasuryEth,
      txHash,
    };
  }

  /**
   * Get buyback history
   */
  static async getBuybackHistory(
    limit = 20
  ): Promise<(typeof buybackRecords.$inferSelect)[]> {
    return db
      .select()
      .from(buybackRecords)
      .orderBy(buybackRecords.initiatedAt)
      .limit(limit);
  }

  /**
   * Get total stats
   */
  static async getStats(): Promise<{
    totalFeesReceived: bigint;
    totalBuybacks: number;
    currentAccumulated: bigint;
    threshold: bigint;
    canExecute: boolean;
  }> {
    const status = await BuybackService.getAccumulatorStatus();

    const [accumulator] = await db
      .select()
      .from(feeAccumulator)
      .where(eq(feeAccumulator.id, 'singleton'))
      .limit(1);

    return {
      totalFeesReceived: BigInt(accumulator?.totalFeesAccumulated ?? '0'),
      totalBuybacks: accumulator?.totalBuybacksExecuted ?? 0,
      currentAccumulated: status.accumulatedFees,
      threshold: status.threshold,
      canExecute: status.canExecute,
    };
  }
}
