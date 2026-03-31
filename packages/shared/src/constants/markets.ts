/**
 * Perpetual Markets Configuration
 *
 * Centralized configuration for perp market pricing mechanics.
 * Used by both real-time price impact (API routes) and periodic updates (game-tick).
 */

/**
 * Resolution Confidence Configuration
 *
 * Thresholds for the manual resolution review system.
 */
export const RESOLUTION_CONFIDENCE_CONFIG = {
  /**
   * Confidence threshold below which resolutions require manual review.
   * Resolutions with confidence < this value are flagged for admin approval.
   */
  MANUAL_REVIEW_THRESHOLD: 0.7,

  /**
   * Base confidence score when no speculative signals are detected.
   */
  BASE_CONFIDENCE: 0.95,

  /**
   * Minimum confidence score (floor).
   */
  MIN_CONFIDENCE: 0.2,
} as const;

/**
 * Constant-Product AMM Configuration
 *
 * Each perp market is a virtual x*y=k pool:
 *   - baseReserve (synthetic tokens, e.g. TSLAI)
 *   - quoteReserve (USD)
 *   - k = baseReserve * quoteReserve (invariant)
 *   - spotPrice = quoteReserve / baseReserve
 *
 * Trades shift reserves along the constant-product curve.
 * Larger trades get worse prices (natural slippage).
 * Locked base liquidity prevents price from reaching zero.
 *
 * No artificial clamps, no dampeners, no per-tick limits.
 * Price is whatever the AMM math says.
 */
export const PERP_MARKET_CONFIG = {
  /**
   * Initial base reserve for each market's virtual AMM pool.
   * Higher = deeper liquidity = less price impact per trade.
   *
   * With INITIAL_BASE_RESERVE=1000 and initialPrice=$450 (TSLAI):
   *   k = 1000 * 450,000 = 450,000,000
   *   $10K buy: price moves ~2.2%
   *   $50K buy: price moves ~11%
   *   $100K buy: price moves ~22%
   *
   * This is deep enough that individual NPC trades ($2-10K) have
   * realistic impact (1-3%) but won't crash the market.
   */
  INITIAL_BASE_RESERVE: 5000,

  // =========================================================================
  // Legacy fields — kept for backward compatibility during migration.
  // Consumers that still reference these will get safe defaults.
  // TODO: remove once all consumers are migrated to AMM functions.
  // =========================================================================
  /** @deprecated Use INITIAL_BASE_RESERVE instead */
  SYNTHETIC_SUPPLY: 10_000,
  /** @deprecated Use INITIAL_BASE_RESERVE instead */
  LIQUIDITY_FACTOR: 100,
  /** @deprecated No longer enforced — AMM has natural slippage */
  MAX_CHANGE_PER_TRADE: 1.0,
  /** @deprecated No longer enforced */
  MAX_CHANGE_PER_TICK: 1.0,
  /** @deprecated No artificial floor — AMM liquidity prevents zero */
  PRICE_FLOOR_RATIO: 0.01,
  /** @deprecated No artificial ceiling */
  PRICE_CEILING_RATIO: 100.0,
  /** @deprecated No position limits */
  MAX_NET_POSITION_RATIO: 1.0,
} as const;

/**
 * Type for the perp market configuration.
 * Uses widened number types to allow overrides in tests.
 */
export type PerpMarketConfig = {
  [K in keyof typeof PERP_MARKET_CONFIG]: (typeof PERP_MARKET_CONFIG)[K] extends number
    ? number
    : (typeof PERP_MARKET_CONFIG)[K];
};

// =============================================================================
// Constant-Product AMM Functions
// =============================================================================

/**
 * Get the initial AMM reserves for a market given its initial price.
 *
 * @param initialPrice - The initial spot price of the asset
 * @param config - Optional config override for testing
 * @returns { baseReserve, quoteReserve, k }
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
 * Calculate the current AMM reserves given initial price and net holdings.
 *
 * Net holdings shift the pool's reserves:
 * - Positive net holdings (net long) = quote has been added, base removed
 * - Negative net holdings (net short) = base has been added, quote removed
 *
 * We derive current reserves from the invariant k and the net flow.
 *
 * @param initialPrice - The initial/reference price
 * @param netHoldings - Net position value in USD (longs - shorts)
 * @param config - Optional config override
 * @returns { baseReserve, quoteReserve, spotPrice }
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

  // Net holdings represent cumulative quote added/removed from pool
  // Positive = buyers added quote (price goes up)
  // Negative = sellers removed quote (price goes down)
  const currentQuote = initQuote + netHoldings;

  // Protect against draining the pool entirely
  const safeQuote = Math.max(currentQuote, 1);
  const currentBase = k / safeQuote;

  return {
    baseReserve: currentBase,
    quoteReserve: safeQuote,
    spotPrice: safeQuote / currentBase,
  };
}

/**
 * Calculate the new spot price from net holdings using the constant-product AMM.
 *
 * This is the primary price function. No clamps, no limits — price is purely
 * determined by the AMM math and locked liquidity.
 *
 * @param initialPrice - The initial/reference price of the asset
 * @param currentPrice - Current price (unused in AMM — kept for API compat)
 * @param netHoldings - Net holdings (longs - shorts) in dollar value
 * @param config - Optional config override for testing
 * @returns The new spot price
 */
export function calculatePriceFromHoldings(
  initialPrice: number,
  _currentPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  const { spotPrice } = getReservesFromHoldings(
    initialPrice,
    netHoldings,
    config
  );
  return spotPrice;
}

/**
 * Calculate the raw price without any limits (same as calculatePriceFromHoldings
 * since we no longer have limits).
 */
export function calculateRawPriceFromHoldings(
  initialPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  const { spotPrice } = getReservesFromHoldings(
    initialPrice,
    netHoldings,
    config
  );
  return spotPrice;
}

/**
 * Calculate the exact swap output and price impact through the AMM.
 *
 * Uses the real Uniswap v2 constant-product swap formula:
 *   Buy (add quote, get base):  baseOut = baseReserve - k / (quoteReserve + quoteIn)
 *   Avg fill price = quoteIn / baseOut
 *
 *   Sell (add base, get quote):  quoteOut = quoteReserve - k / (baseReserve + baseIn)
 *   Avg fill price = quoteOut / baseIn
 *
 * Slippage = |avgFillPrice - spotPrice| / spotPrice
 *
 * @param initialPrice - Initial/reference price
 * @param netHoldingsBefore - Net holdings before this trade
 * @param tradeSize - Size of the trade in USD (positive = buy/long, negative = sell/short)
 * @param config - Optional config override
 * @returns { avgFillPrice, newSpotPrice, slippage, baseAmount }
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
    // BUY: trader adds `tradeSize` USD (quote) to the pool, receives base tokens
    const newQuote = quoteReserve + tradeSize;
    const newBase = k / newQuote;
    const baseOut = baseReserve - newBase;
    const avgFillPrice = baseOut > 0 ? tradeSize / baseOut : spotBefore;
    const newSpotPrice = newQuote / newBase;
    const slippage =
      spotBefore > 0 ? Math.abs(avgFillPrice - spotBefore) / spotBefore : 0;

    return { avgFillPrice, newSpotPrice, slippage, baseAmount: baseOut };
  } else {
    // SELL: trader adds base tokens to the pool, receives USD (quote)
    // First convert USD sell amount to base tokens at current spot
    const absTradeSize = Math.abs(tradeSize);
    const baseIn = spotBefore > 0 ? absTradeSize / spotBefore : 0;
    const newBase = baseReserve + baseIn;
    const newQuote = k / newBase;
    const quoteOut = quoteReserve - newQuote;
    const avgFillPrice = baseIn > 0 ? quoteOut / baseIn : spotBefore;
    const newSpotPrice = newQuote / newBase;
    const slippage =
      spotBefore > 0 ? Math.abs(spotBefore - avgFillPrice) / spotBefore : 0;

    return {
      avgFillPrice,
      newSpotPrice,
      slippage,
      baseAmount: -baseIn,
    };
  }
}

// =============================================================================
// Legacy compat — these do nothing but satisfy existing import signatures
// =============================================================================

/** @deprecated Effective supply concept replaced by AMM reserves */
export function getEffectiveSupply(
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return config.SYNTHETIC_SUPPLY / config.LIQUIDITY_FACTOR;
}

/** @deprecated No per-tick clamping — AMM provides natural bounds */
export function clampPriceForTick(
  _tickStartPrice: number,
  currentPrice: number,
  _initialPrice: number,
  _config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return currentPrice; // pass-through
}

/** @deprecated No position dampening — AMM slippage is the dampener */
export function calculatePositionDampener(
  _currentPrice: number,
  _initialPrice: number,
  _side: 'long' | 'short',
  _config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return 1.0; // no dampening
}
