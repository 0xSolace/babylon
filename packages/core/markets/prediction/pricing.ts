/**
 * Prediction Market AMM Pricing — Constant Product Market Maker (CPMM)
 *
 * Framework-free math utilities for Babylon's YES/NO offchain markets.
 *
 * Pricing model: k = yesShares x noShares (constant product invariant)
 */

export interface ShareCalculation {
  sharesBought: number;
  avgPrice: number;
  newYesPrice: number;
  newNoPrice: number;
  priceImpact: number;
  totalCost: number;
  newYesShares: number;
  newNoShares: number;
}

export interface ShareCalculationWithFees extends ShareCalculation {
  fee: number;
  netAmount: number;
  totalWithFee?: number;
  netProceeds?: number;
}

export class PredictionPricing {
  static getCurrentPrice(
    yesShares: number,
    noShares: number,
    side: 'yes' | 'no'
  ): number {
    const total = yesShares + noShares;
    if (total <= 0) return 0.5;
    return side === 'yes' ? noShares / total : yesShares / total;
  }

  /**
   * Calculate a winner's resolution payout using pool-proportional distribution.
   *
   * Winners receive their net cost basis back plus their proportional share
   * of all loser deposits. This is zero-sum among traders: losers fund
   * winners, and seed liquidity stays in the pool.
   *
   * @param shares - Winner's shares held
   * @param avgPrice - Winner's average purchase price per share
   * @param totalWinnerShares - Sum of all winning positions' shares
   * @param totalLoserDeposits - Sum of (shares × avgPrice) for all losing positions
   * @returns Gross payout to this winner
   */
  static calculateExpectedPayout(
    shares: number,
    avgPrice: number,
    totalWinnerShares: number = 0,
    totalLoserDeposits: number = 0
  ): number {
    const costBasis = shares * avgPrice;
    if (totalWinnerShares <= 0) return costBasis;
    const proportion = shares / totalWinnerShares;
    return costBasis + proportion * totalLoserDeposits;
  }

  /**
   * Initialize a market with configurable starting probability and liquidity.
   */
  static initializeMarket(initialLiquidity = 10_000, yesProbability = 0.5) {
    const clampedYesProbability = Math.max(
      0.05,
      Math.min(0.95, yesProbability)
    );
    const noShares = Math.max(1, initialLiquidity * clampedYesProbability);
    const yesShares = Math.max(1, initialLiquidity - noShares);
    return { yesShares, noShares };
  }

  static calculateBuy(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    usdAmount: number
  ): ShareCalculation {
    if (usdAmount <= 0) throw new Error('Trade amount must be positive');
    const k = currentYesShares * currentNoShares;
    if (k <= 0) throw new Error('Market has insufficient liquidity');

    let newYesShares: number;
    let newNoShares: number;
    let sharesBought: number;

    if (side === 'yes') {
      newNoShares = currentNoShares + usdAmount;
      newYesShares = k / newNoShares;
      sharesBought = currentYesShares - newYesShares;
    } else {
      newYesShares = currentYesShares + usdAmount;
      newNoShares = k / newYesShares;
      sharesBought = currentNoShares - newNoShares;
    }

    if (sharesBought <= 0)
      throw new Error('Calculated shares must be positive');

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;
    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    const priceImpact =
      side === 'yes'
        ? ((newYesPrice - currentYesPrice) / currentYesPrice) * 100
        : ((newNoPrice - currentNoPrice) / currentNoPrice) * 100;

    return {
      sharesBought,
      avgPrice: usdAmount / sharesBought,
      newYesPrice,
      newNoPrice,
      priceImpact,
      totalCost: usdAmount,
      newYesShares,
      newNoShares,
    };
  }

  static calculateSell(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    sharesToSell: number
  ): ShareCalculation {
    if (sharesToSell <= 0) throw new Error('Shares to sell must be positive');
    const k = currentYesShares * currentNoShares;
    if (k <= 0) throw new Error('Market has insufficient liquidity');

    let newYesShares: number;
    let newNoShares: number;
    let proceeds: number;

    if (side === 'yes') {
      newYesShares = currentYesShares + sharesToSell;
      newNoShares = k / newYesShares;
      proceeds = currentNoShares - newNoShares;
    } else {
      newNoShares = currentNoShares + sharesToSell;
      newYesShares = k / newNoShares;
      proceeds = currentYesShares - newYesShares;
    }

    if (!Number.isFinite(proceeds) || proceeds <= 0) {
      throw new Error('Calculated proceeds must be positive');
    }

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;
    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    const priceImpact =
      side === 'yes'
        ? ((newYesPrice - currentYesPrice) / currentYesPrice) * 100
        : ((newNoPrice - currentNoPrice) / currentNoPrice) * 100;

    return {
      sharesBought: sharesToSell,
      avgPrice: proceeds / sharesToSell,
      newYesPrice,
      newNoPrice,
      priceImpact,
      totalCost: proceeds,
      newYesShares,
      newNoShares,
    };
  }

  static calculateBuyWithFees(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    totalAmount: number,
    feeRate: number
  ): ShareCalculationWithFees {
    const fee = totalAmount * feeRate;
    const netAmount = totalAmount - fee;
    const base = this.calculateBuy(
      currentYesShares,
      currentNoShares,
      side,
      netAmount
    );
    return {
      ...base,
      fee,
      netAmount,
      totalWithFee: totalAmount,
      totalCost: netAmount,
    };
  }

  static calculateSellWithFees(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    sharesToSell: number,
    feeRate: number
  ): ShareCalculationWithFees {
    const base = this.calculateSell(
      currentYesShares,
      currentNoShares,
      side,
      sharesToSell
    );
    const gross = base.totalCost;
    const fee = gross * feeRate;
    const netProceeds = gross - fee;
    return {
      ...base,
      fee,
      netAmount: netProceeds,
      netProceeds,
      totalCost: gross,
    };
  }
}

export function calculateExpectedPayout(
  shares: number,
  avgPrice: number,
  totalWinnerShares: number = 0,
  totalLoserDeposits: number = 0
): number {
  return PredictionPricing.calculateExpectedPayout(
    shares,
    avgPrice,
    totalWinnerShares,
    totalLoserDeposits
  );
}
