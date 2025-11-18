/**
 * Perpetuals Settlement Service
 *
 * Bridges off-chain trading engine (PR #128) with on-chain contracts (PR #129)
 *
 * Modes:
 * - offchain: No blockchain settlement (fast MVP)
 * - onchain: Every trade settles to blockchain (decentralized)
 * - hybrid: Periodic batch settlement (best of both)
 */

import { PERP_CONFIG, isHybridMode, isOnChainEnabled } from '@/lib/config/perp-modes';
import { logger } from '@/lib/logger';
import { prisma, prismaBase } from '@/lib/prisma';
import type { PerpPosition } from '@/shared/perps-types';
import type { Prisma } from '@prisma/client';

// Perpetual Market Facet ABI (minimal)
const _PERP_FACET_ABI = [
  {
    name: 'openPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_side', type: 'uint8' },
      { name: '_size', type: 'uint256' },
      { name: '_collateral', type: 'uint256' },
      { name: '_maxPrice', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'closePosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_marketId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

export type SettlementResult = {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: bigint;
};

export class PerpSettlementService {
  /**
   * Initialize settlement service (for hybrid mode)
   */
  static initialize(): void {
    if (!isHybridMode()) {
      return;
    }

    // Start periodic batch settlement
    PerpSettlementService.batchTimer = setInterval(
      () => PerpSettlementService.executeBatchSettlement(),
      PERP_CONFIG.hybridBatchInterval
    );

    logger.info(
      'Hybrid settlement service initialized',
      {
        batchInterval: PERP_CONFIG.hybridBatchInterval,
        batchSize: PERP_CONFIG.hybridBatchSize,
      },
      'PerpSettlementService'
    );
  }

  /**
   * Shutdown settlement service
   */
  static shutdown(): void {
    if (PerpSettlementService.batchTimer) {
      clearInterval(PerpSettlementService.batchTimer);
      PerpSettlementService.batchTimer = null;
    }
  }

  /**
   * Settle position opening to blockchain
   */
  static async settleOpenPosition(position: PerpPosition): Promise<SettlementResult> {
    if (!isOnChainEnabled()) {
      return { success: true }; // Skip settlement in offchain mode
    }

    // In hybrid mode, queue for batch settlement
    if (isHybridMode()) {
      PerpSettlementService.unsettledPositions.add(position.id);
      await PerpSettlementService.markPositionUnsettled(position.id);
      return { success: true }; // Queued successfully
    }

    // In onchain mode, settle immediately
    return await PerpSettlementService.settleToContract('open', position);
  }

  /**
   * Settle position closing to blockchain
   */
  static async settleClosePosition(position: PerpPosition): Promise<SettlementResult> {
    if (!isOnChainEnabled()) {
      return { success: true }; // Skip settlement in offchain mode
    }

    // In hybrid mode, queue for batch settlement
    if (isHybridMode()) {
      PerpSettlementService.unsettledPositions.add(position.id);
      await PerpSettlementService.markPositionUnsettled(position.id);
      return { success: true }; // Queued successfully
    }

    // In onchain mode, settle immediately
    return await PerpSettlementService.settleToContract('close', position);
  }

  /**
   * Get settlement stats
   */
  static async getSettlementStats(): Promise<{
    mode: string;
    unsettledCount: number;
    totalPositions: number;
    settlementRate: number;
  }> {
    const totalPositions = await prisma.perpPosition.count();

    // Type assertion needed due to TypeScript language server cache issues
    // The fields exist in Prisma types but TS can't infer them through the proxy
    const unsettledCount = await prismaBase.perpPosition.count({
      where: { settledToChain: false } as Prisma.PerpPositionWhereInput,
    });

    return {
      mode: PERP_CONFIG.settlementMode,
      unsettledCount,
      totalPositions,
      settlementRate:
        totalPositions > 0 ? ((totalPositions - unsettledCount) / totalPositions) * 100 : 100,
    };
  }
}

// Initialize service on module load (for hybrid mode)
if (typeof window === 'undefined') {
  // Server-side only
  PerpSettlementService.initialize();
}
