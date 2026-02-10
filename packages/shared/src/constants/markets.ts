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
 * vAMM (Virtual Automated Market Maker) configuration for perp markets.
 *
 * The effective supply determines price sensitivity:
 * effectiveSupply = SYNTHETIC_SUPPLY / LIQUIDITY_FACTOR
 *
 * With LIQUIDITY_FACTOR = 50 and SYNTHETIC_SUPPLY = 10000:
 * - effectiveSupply = 200
 * - $100 trade → ~0.05% impact
 * - $1000 trade → ~0.5% impact
 * - $5000 trade → ~2.5% impact
 * - $10000 trade → ~5% impact
 *
 * This makes our simulation markets 50x less liquid than real exchanges,
 * creating wild, exciting price movements driven by NPC trading.
 *
 * Combined with cascade/herd behavior, markets can move 20-30% in short periods.
 */
export const PERP_MARKET_CONFIG = {
  /**
   * Base synthetic supply for vAMM calculations.
   * This is the "nominal" supply shown externally.
   */
  SYNTHETIC_SUPPLY: 10_000,

  /**
   * Liquidity factor - controls price volatility.
   *
   * - 1: Normal liquidity (like real exchanges, minimal impact)
   * - 10: 10x less liquid (noticeable impact)
   * - 20: 20x less liquid (conservative simulation)
   * - 50: 50x less liquid (dynamic, exciting markets)
   * - 100: Very volatile (for extreme scenarios)
   *
   * Higher = more volatile = more price impact per trade.
   */
  LIQUIDITY_FACTOR: 50,

  /**
   * Maximum price change per single trade (safety limit).
   * Allows for dramatic swings while preventing flash crashes.
   * 30% max per trade enables wild but controlled movements.
   */
  MAX_CHANGE_PER_TRADE: 0.3, // 30%

  /**
   * Absolute price floor as ratio of initial price.
   * Price can crash to 5% of initial (95% down) but not to zero.
   * This allows near-crash scenarios while keeping markets tradeable.
   */
  PRICE_FLOOR_RATIO: 0.05, // 5% of initial (95% crash possible)

  /**
   * Absolute price ceiling as ratio of initial price.
   * Price can moon to 1000% of initial (10x).
   * Creates room for dramatic pumps.
   */
  PRICE_CEILING_RATIO: 10.0, // 1000% of initial (10x max)
} as const;

/**
 * Bonding Curve Configuration
 *
 * Controls the quadratic bonding curve behavior for more dynamic price discovery.
 * The bonding curve creates natural incentives:
 * - Buying at low prices = cheap entry with high upside
 * - Selling at high prices = take profits before curve steepens
 * - Cascades are amplified at extremes (steeper curve)
 */
export const BONDING_CURVE_CONFIG = {
  /**
   * Exponent for the bonding curve formula.
   * - 1: Linear (same as vAMM)
   * - 2: Quadratic (industry standard, steeper at extremes)
   * - 3: Cubic (very aggressive)
   */
  EXPONENT: 2,

  /**
   * Reserve depth - controls sensitivity to net holdings.
   * Lower = more volatile, higher = more stable.
   * $100,000 means it takes $100k net buy pressure to double the price.
   */
  RESERVE_DEPTH: 100_000,

  /**
   * Whether to use bonding curve (true) or linear vAMM (false)
   */
  USE_BONDING_CURVE: true,
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

/**
 * Type for bonding curve configuration.
 */
export type BondingCurveConfig = {
  [K in keyof typeof BONDING_CURVE_CONFIG]: (typeof BONDING_CURVE_CONFIG)[K] extends number
    ? number
    : (typeof BONDING_CURVE_CONFIG)[K];
};

/**
 * Calculates the effective supply based on liquidity factor.
 * Lower effective supply = more price impact per trade.
 */
export function getEffectiveSupply(
  config: PerpMarketConfig = PERP_MARKET_CONFIG
): number {
  return config.SYNTHETIC_SUPPLY / config.LIQUIDITY_FACTOR;
}

/**
 * Calculates price using a quadratic bonding curve.
 *
 * Formula:
 * price = basePrice * (1 + netHoldings / reserveDepth)^exponent
 *
 * This creates:
 * - Steeper price changes at extremes (more momentum)
 * - Natural buy-low/sell-high incentives
 * - More dramatic cascades during panic/FOMO
 *
 * @param basePrice - The base/initial price of the asset
 * @param netHoldings - Net holdings (longs - shorts) in dollar value
 * @param bondingConfig - Bonding curve configuration
 * @returns The calculated price from the bonding curve
 */
export function calculateBondingCurvePrice(
  basePrice: number,
  netHoldings: number,
  bondingConfig: BondingCurveConfig = BONDING_CURVE_CONFIG
): number {
  const { EXPONENT, RESERVE_DEPTH } = bondingConfig;

  // Normalize net holdings by reserve depth
  // netHoldings of +$100k with RESERVE_DEPTH of $100k = ratio of 1
  const ratio = netHoldings / RESERVE_DEPTH;

  // Calculate base value (1 + ratio)
  // Clamp to prevent going below 0 (which would cause issues with even exponents)
  const base = 1 + ratio;

  // For negative net holdings (sells), we want price to decrease
  // But standard power function with even exponents would increase price for base < 0
  // Use signed power: preserve sign of base while applying exponent to magnitude
  let multiplier: number;
  if (base >= 0) {
    multiplier = Math.pow(base, EXPONENT);
  } else {
    // For negative base (extreme sells beyond reserve depth),
    // use a linear extrapolation to prevent price inversion
    // Price approaches zero asymptotically but never goes negative
    // multiplier = max(0.01, 1 / (1 + |base| * EXPONENT))
    multiplier = 1 / (1 + Math.abs(base) * EXPONENT);
  }

  // Ensure multiplier stays positive (hard floor at 1%)
  const safeMultiplier = Math.max(0.01, multiplier);

  return basePrice * safeMultiplier;
}

/**
 * Calculates the new price based on net holdings.
 * Uses bonding curve if enabled, otherwise falls back to linear vAMM.
 *
 * Formula (bonding curve):
 * - rawPrice = basePrice * (1 + netHoldings / reserveDepth)^exponent
 * - Apply limits (max change per trade, floor, ceiling)
 *
 * Formula (linear vAMM):
 * - effectiveSupply = SYNTHETIC_SUPPLY / LIQUIDITY_FACTOR
 * - baseMarketCap = initialPrice × effectiveSupply
 * - newMarketCap = baseMarketCap + netHoldings
 * - rawPrice = newMarketCap / effectiveSupply
 * - Apply limits (max change per trade, floor, ceiling)
 *
 * @param initialPrice - The initial/reference price of the asset
 * @param currentPrice - The current price before this calculation
 * @param netHoldings - Net holdings (longs - shorts) in dollar value
 * @param config - Optional config override for testing
 * @param bondingConfig - Optional bonding curve config override
 * @returns The new calculated price, clamped to limits
 */
export function calculatePriceFromHoldings(
  initialPrice: number,
  currentPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG,
  bondingConfig: BondingCurveConfig = BONDING_CURVE_CONFIG
): number {
  let rawPrice: number;

  if (bondingConfig.USE_BONDING_CURVE) {
    // Use quadratic bonding curve
    rawPrice = calculateBondingCurvePrice(
      initialPrice,
      netHoldings,
      bondingConfig
    );
  } else {
    // Use linear vAMM
    const effectiveSupply = getEffectiveSupply(config);
    const baseMarketCap = initialPrice * effectiveSupply;
    const newMarketCap = baseMarketCap + netHoldings;
    rawPrice = newMarketCap / effectiveSupply;
  }

  // Apply per-trade change limit
  const maxChange = currentPrice * config.MAX_CHANGE_PER_TRADE;
  const minFromChange = currentPrice - maxChange;
  const maxFromChange = currentPrice + maxChange;

  // Apply absolute limits
  const absoluteMin = initialPrice * config.PRICE_FLOOR_RATIO;
  const absoluteMax = initialPrice * config.PRICE_CEILING_RATIO;

  // Combine limits
  const minPrice = Math.max(absoluteMin, minFromChange);
  const maxPrice = Math.min(absoluteMax, maxFromChange);

  // Clamp and return
  return Math.max(minPrice, Math.min(rawPrice, maxPrice));
}

/**
 * Calculates the raw price without any limits (for testing/debugging).
 * Uses bonding curve if enabled.
 */
export function calculateRawPriceFromHoldings(
  initialPrice: number,
  netHoldings: number,
  config: PerpMarketConfig = PERP_MARKET_CONFIG,
  bondingConfig: BondingCurveConfig = BONDING_CURVE_CONFIG
): number {
  if (bondingConfig.USE_BONDING_CURVE) {
    return calculateBondingCurvePrice(initialPrice, netHoldings, bondingConfig);
  }

  const effectiveSupply = getEffectiveSupply(config);
  const baseMarketCap = initialPrice * effectiveSupply;
  const newMarketCap = baseMarketCap + netHoldings;
  return newMarketCap / effectiveSupply;
}
