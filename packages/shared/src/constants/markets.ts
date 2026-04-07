/**
 * Perpetual Markets — Constant-Product AMM
 *
 * Each perp market is a virtual x*y=k pool:
 *   baseReserve (synthetic tokens) × quoteReserve (USD) = k (invariant)
 *   spotPrice = quoteReserve / baseReserve
 *
 * Trades shift reserves along the constant-product curve.
 * Larger trades get worse prices (natural slippage).
 * Locked base liquidity prevents price from reaching zero.
 * No artificial clamps, no dampeners, no per-tick limits.
 */

/**
 * Resolution Confidence Configuration
 */
export const RESOLUTION_CONFIDENCE_CONFIG = {
  MANUAL_REVIEW_THRESHOLD: 0.7,
  BASE_CONFIDENCE: 0.95,
  MIN_CONFIDENCE: 0.2,
} as const;

/**
 * AMM Configuration
 */
export const PERP_MARKET_CONFIG = {
  /**
   * Initial base reserve for each market's virtual AMM pool.
   * Higher = deeper liquidity = less price impact per trade.
   *
   * With INITIAL_BASE_RESERVE=5000 and initialPrice=$450:
   *   k = 5000 × $2,250,000 = 11.25B
   *   $10K buy → ~2% impact
   *   $50K buy → ~10% impact
   */
  INITIAL_BASE_RESERVE: 5000,
} as const;

export type PerpMarketConfig = {
  [K in keyof typeof PERP_MARKET_CONFIG]: (typeof PERP_MARKET_CONFIG)[K] extends number
    ? number
    : (typeof PERP_MARKET_CONFIG)[K];
};

// =============================================================================
// AMM Functions
// =============================================================================

/**
 * Get the initial AMM reserves for a market.
 */
export function getInitialReserves(
  initialPrice: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): { baseReserve: number; quoteReserve: number; k: number } {
  const baseReserve = config.INITIAL_BASE_RESERVE;
  const quoteReserve = baseReserve * initialPrice;
  return { baseReserve, quoteReserve, k: baseReserve * quoteReserve };
}

/**
 * Derive current reserves from initial price and cumulative net holdings.
 *
 * netHoldings = Σ(long positions) − Σ(short positions) in USD.
 * Positive = net buying pressure (quote added to pool).
 * Negative = net selling pressure (quote removed from pool).
 */
export function getReservesFromHoldings(
  initialPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): { baseReserve: number; quoteReserve: number; spotPrice: number } {
  const { quoteReserve: initQuote, k } = getInitialReserves(
    initialPrice,
    config
  );
  const currentQuote = Math.max(initQuote + netHoldings, 1);
  const currentBase = k / currentQuote;
  return {
    baseReserve: currentBase,
    quoteReserve: currentQuote,
    spotPrice: currentQuote / currentBase,
  };
}

/**
 * Spot price from net holdings.
 * Primary price function — called after every trade to recompute equilibrium.
 */
export function calculatePriceFromHoldings(
  initialPrice: number,
  _currentPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return getReservesFromHoldings(initialPrice, netHoldings, config).spotPrice;
}

/**
 * Same as calculatePriceFromHoldings (no separate "raw" version needed).
 */
export function calculateRawPriceFromHoldings(
  initialPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return getReservesFromHoldings(initialPrice, netHoldings, config).spotPrice;
}

/**
 * Exact swap output and price impact using Uniswap v2 math.
 *
 * Buy (add quote, get base):  baseOut = B × dx / (Q + dx)
 * Sell (add base, get quote): quoteOut = Q × dy / (B + dy)
 *
 * avgFillPrice = input / output  (always worse than spot = slippage)
 */
export function calculateTradeImpact(
  initialPrice: number,
  netHoldingsBefore: number,
  tradeSize: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): {
  avgFillPrice: number;
  newSpotPrice: number;
  slippage: number;
  baseAmount: number;
} {
  const {
    baseReserve,
    quoteReserve,
    spotPrice: spotBefore,
  } = getReservesFromHoldings(initialPrice, netHoldingsBefore, config);
  const k = baseReserve * quoteReserve;

  if (tradeSize >= 0) {
    // BUY: trader adds quote (USD) to pool, receives base tokens
    const newQuote = quoteReserve + tradeSize;
    const newBase = k / newQuote;
    const baseOut = baseReserve - newBase;
    const avgFillPrice = baseOut > 0 ? tradeSize / baseOut : spotBefore;
    const newSpotPrice = newQuote / newBase;
    const slippage =
      spotBefore > 0 ? Math.abs(avgFillPrice - spotBefore) / spotBefore : 0;
    return { avgFillPrice, newSpotPrice, slippage, baseAmount: baseOut };
  }

  // SELL: trader adds base tokens to pool, receives quote (USD)
  const absTradeSize = Math.abs(tradeSize);
  const baseIn = spotBefore > 0 ? absTradeSize / spotBefore : 0;
  const newBase = baseReserve + baseIn;
  const newQuote = k / newBase;
  const quoteOut = quoteReserve - newQuote;
  const avgFillPrice = baseIn > 0 ? quoteOut / baseIn : spotBefore;
  const newSpotPrice = newQuote / newBase;
  const slippage =
    spotBefore > 0 ? Math.abs(spotBefore - avgFillPrice) / spotBefore : 0;
  return { avgFillPrice, newSpotPrice, slippage, baseAmount: -baseIn };
}
