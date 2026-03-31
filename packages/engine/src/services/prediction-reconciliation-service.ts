/**
 * Prediction Market Reconciliation Service
 *
 * Syncs onchain prediction market state to the database.
 * Onchain state is authoritative for all financial data.
 *
 * Use cases:
 * - Periodic reconciliation to catch drift between DB and chain
 * - Manual audit of specific markets
 * - Post-incident recovery
 */

import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { Address, Hex } from 'viem';
import {
  getOnChainPredictionMarketService,
  type OnchainPredictionMarketSnapshot,
} from './onchain-prediction-service';

export type ReconciliationDiscrepancy = {
  field: string;
  dbValue: string | number;
  chainValue: string | number;
  severity: 'info' | 'warning' | 'critical';
};

export type MarketReconciliationResult = {
  marketId: string;
  marketKey: Hex;
  discrepancies: ReconciliationDiscrepancy[];
  positionsReconciled: number;
  corrected: boolean;
};

export type ReconciliationSummary = {
  totalMarkets: number;
  marketsWithDiscrepancies: number;
  totalDiscrepancies: number;
  results: MarketReconciliationResult[];
};

function normalizeAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

/**
 * Audit a single market for discrepancies between DB and chain state.
 * Does NOT write corrections — use reconcileMarket for that.
 */
export async function auditMarket(
  marketId: string
): Promise<MarketReconciliationResult> {
  const service = getOnChainPredictionMarketService();
  const decimals = await service.getCollateralDecimals();

  const marketRecord = await db.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      onChainMarketId: true,
      yesShares: true,
      noShares: true,
      liquidity: true,
      resolved: true,
    },
  });

  if (!marketRecord?.onChainMarketId) {
    return {
      marketId,
      marketKey: '0x' as Hex,
      discrepancies: [],
      positionsReconciled: 0,
      corrected: false,
    };
  }

  const marketKey = marketRecord.onChainMarketId as Hex;
  let chainSnapshot: OnchainPredictionMarketSnapshot;

  try {
    chainSnapshot = await service.getMarket(marketKey);
  } catch (error) {
    logger.warn('Failed to read onchain market state for reconciliation', {
      marketId,
      marketKey,
      error: String(error),
    });
    return {
      marketId,
      marketKey,
      discrepancies: [
        {
          field: 'chain_read',
          dbValue: 'N/A',
          chainValue: 'UNREACHABLE',
          severity: 'critical',
        },
      ],
      positionsReconciled: 0,
      corrected: false,
    };
  }

  const discrepancies: ReconciliationDiscrepancy[] = [];

  const chainYesShares = normalizeAmount(chainSnapshot.reserveYes, decimals);
  const chainNoShares = normalizeAmount(chainSnapshot.reserveNo, decimals);
  const chainLiquidity = normalizeAmount(chainSnapshot.liquidity, decimals);
  const dbYesShares = Number(marketRecord.yesShares);
  const dbNoShares = Number(marketRecord.noShares);
  const dbLiquidity = Number(marketRecord.liquidity);

  const TOLERANCE = 0.01; // 1 cent tolerance

  if (Math.abs(dbYesShares - chainYesShares) > TOLERANCE) {
    discrepancies.push({
      field: 'yesShares',
      dbValue: dbYesShares,
      chainValue: chainYesShares,
      severity: 'warning',
    });
  }

  if (Math.abs(dbNoShares - chainNoShares) > TOLERANCE) {
    discrepancies.push({
      field: 'noShares',
      dbValue: dbNoShares,
      chainValue: chainNoShares,
      severity: 'warning',
    });
  }

  if (Math.abs(dbLiquidity - chainLiquidity) > TOLERANCE) {
    discrepancies.push({
      field: 'liquidity',
      dbValue: dbLiquidity,
      chainValue: chainLiquidity,
      severity: 'warning',
    });
  }

  // Check resolution state
  const chainResolved = chainSnapshot.state !== 0; // 0 = OPEN
  if (marketRecord.resolved !== chainResolved) {
    discrepancies.push({
      field: 'resolved',
      dbValue: marketRecord.resolved ? 'true' : 'false',
      chainValue: chainResolved ? 'true' : 'false',
      severity: 'critical',
    });
  }

  // Check user positions for this market
  const positions = await db.position.findMany({
    where: { marketId },
    select: {
      id: true,
      userId: true,
      side: true,
      shares: true,
    },
  });

  // Get unique wallet addresses for position holders
  const userIds = [...new Set(positions.map((p) => p.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, walletAddress: true },
  });

  const userWalletMap = new Map(
    users
      .filter((u) => u.walletAddress)
      .map((u) => [u.id, u.walletAddress!.toLowerCase() as Address])
  );

  let positionsReconciled = 0;
  for (const position of positions) {
    const walletAddress = userWalletMap.get(position.userId);
    if (!walletAddress) continue;

    try {
      const chainPosition = await service.getPosition(walletAddress, marketKey);

      const chainShares =
        position.side === true
          ? normalizeAmount(chainPosition.yesBalance, decimals)
          : normalizeAmount(chainPosition.noBalance, decimals);
      const dbShares = Number(position.shares);

      if (Math.abs(dbShares - chainShares) > TOLERANCE) {
        discrepancies.push({
          field: `position:${position.id}:shares`,
          dbValue: dbShares,
          chainValue: chainShares,
          severity: 'warning',
        });
      }

      positionsReconciled++;
    } catch {
      // Skip positions where chain read fails
    }
  }

  return {
    marketId,
    marketKey,
    discrepancies,
    positionsReconciled,
    corrected: false,
  };
}

/**
 * Reconcile a single market: audit + apply corrections.
 * Onchain state is authoritative.
 */
export async function reconcileMarket(
  marketId: string
): Promise<MarketReconciliationResult> {
  const audit = await auditMarket(marketId);

  if (audit.discrepancies.length === 0) {
    return audit;
  }

  const service = getOnChainPredictionMarketService();
  const decimals = await service.getCollateralDecimals();

  const marketRecord = await db.market.findUnique({
    where: { id: marketId },
    select: { onChainMarketId: true },
  });

  if (!marketRecord?.onChainMarketId) {
    return audit;
  }

  const marketKey = marketRecord.onChainMarketId as Hex;
  const chainSnapshot = await service.getMarket(marketKey);

  const chainYesShares = normalizeAmount(chainSnapshot.reserveYes, decimals);
  const chainNoShares = normalizeAmount(chainSnapshot.reserveNo, decimals);
  const chainLiquidity = normalizeAmount(chainSnapshot.liquidity, decimals);

  // Correct market reserves from chain
  await db.market.update({
    where: { id: marketId },
    data: {
      yesShares: String(chainYesShares),
      noShares: String(chainNoShares),
      liquidity: String(chainLiquidity),
      updatedAt: new Date(),
    },
  });

  logger.info('Reconciled prediction market reserves from chain', {
    marketId,
    marketKey,
    discrepancies: audit.discrepancies.length,
    chainYesShares,
    chainNoShares,
    chainLiquidity,
  });

  return {
    ...audit,
    corrected: true,
  };
}

/**
 * Reconcile all onchain prediction markets.
 */
export async function reconcileAllPredictionMarkets(): Promise<ReconciliationSummary> {
  const onchainMarkets = await db.market.findMany({
    where: {
      onChainMarketId: { not: null },
    },
    select: { id: true },
  });

  const results: MarketReconciliationResult[] = [];

  for (const market of onchainMarkets) {
    try {
      const result = await reconcileMarket(market.id);
      results.push(result);
    } catch (error) {
      logger.error('Failed to reconcile prediction market', {
        marketId: market.id,
        error: String(error),
      });
      results.push({
        marketId: market.id,
        marketKey: '0x' as Hex,
        discrepancies: [
          {
            field: 'reconciliation',
            dbValue: 'N/A',
            chainValue: 'ERROR',
            severity: 'critical',
          },
        ],
        positionsReconciled: 0,
        corrected: false,
      });
    }
  }

  return {
    totalMarkets: onchainMarkets.length,
    marketsWithDiscrepancies: results.filter((r) => r.discrepancies.length > 0)
      .length,
    totalDiscrepancies: results.reduce(
      (sum, r) => sum + r.discrepancies.length,
      0
    ),
    results,
  };
}
