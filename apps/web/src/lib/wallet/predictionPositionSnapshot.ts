import { PredictionPricing } from '@babylon/core/markets/prediction';
import { logger } from '@babylon/shared';

export interface PredictionPositionSnapshot {
  costBasis: number;
  currentProbability: number;
  currentUnitPrice: number;
  currentValue: number;
  unrealizedPnL: number;
}

export function calculatePredictionPositionSnapshot(params: {
  shares: number;
  avgPrice: number;
  sideKey: 'yes' | 'no';
  yesShares: number;
  noShares: number;
  feeRate: number;
  logContext?: string;
  onSellPreviewError?: 'fallback' | 'throw';
}): PredictionPositionSnapshot {
  const {
    shares,
    avgPrice,
    sideKey,
    yesShares,
    noShares,
    feeRate,
    logContext = 'wallet/predictionPositionSnapshot',
    onSellPreviewError = 'fallback',
  } = params;

  const costBasisNet = shares * avgPrice;
  const costBasis =
    feeRate > 0 && feeRate < 1 ? costBasisNet / (1 - feeRate) : costBasisNet;

  const currentProbability =
    yesShares + noShares > 0
      ? PredictionPricing.getCurrentPrice(yesShares, noShares, sideKey)
      : 0.5;

  if (shares <= 0 || yesShares <= 0 || noShares <= 0) {
    return {
      currentValue: costBasis,
      currentUnitPrice: shares > 0 ? costBasis / shares : 0,
      currentProbability,
      costBasis,
      unrealizedPnL: 0,
    };
  }

  let currentValue = costBasis;

  try {
    const sellPreview = PredictionPricing.calculateSellWithFees(
      yesShares,
      noShares,
      sideKey,
      shares,
      feeRate
    );
    currentValue = sellPreview.netProceeds ?? sellPreview.totalCost;
  } catch (error) {
    if (onSellPreviewError === 'throw') {
      throw error;
    }

    logger.warn(
      'Failed to calculate prediction sell preview; falling back to cost basis',
      {
        side: sideKey,
        shares,
        yesShares,
        noShares,
        error: error instanceof Error ? error.message : String(error),
      },
      logContext
    );
  }

  const currentUnitPrice = shares > 0 ? currentValue / shares : 0;
  const unrealizedPnL = currentValue - costBasis;

  return {
    currentValue,
    currentUnitPrice,
    currentProbability,
    costBasis,
    unrealizedPnL,
  };
}
