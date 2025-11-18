/**
 * NPC Portfolio Strategy
 *
 * Defines sophisticated portfolio allocation strategies for NPCs based on:
 * - Personality traits (aggressive, conservative, balanced)
 * - Market conditions (volatility, sentiment, trends)
 * - Risk tolerance and investment horizons
 * - Modern Portfolio Theory principles
 */

type MarketConditions = {
  volatility: number; // 0-1, market volatility index
  sentiment: number; // -1 to 1, overall market sentiment
  trending: boolean; // Is market trending or ranging
  volume: number; // Relative volume index (0-1)
};

type AssetAllocation = {
  perps: number; // Percentage in perpetuals (0-100)
  predictions: number; // Percentage in predictions (0-100)
  cash: number; // Percentage in cash reserve (0-100)
};

type PositionSizing = {
  maxPositionSize: number; // Max % of portfolio per position
  minPositionSize: number; // Min % of portfolio per position
  maxConcentration: number; // Max % in single asset
  targetPositionCount: number; // Ideal number of positions
};

type RiskParameters = {
  maxDrawdown: number; // Max acceptable portfolio drawdown %
  maxLeverage: number; // Max leverage allowed
  stopLoss: number; // Stop loss % per position
  correlationLimit: number; // Max correlation between positions (0-1)
};

export type StrategyConfig = {
  name: string;
  description: string;
  assetAllocation: AssetAllocation;
  positionSizing: PositionSizing;
  riskParameters: RiskParameters;
  rebalanceThreshold: number; // % deviation before rebalance
  holdingPeriod: 'short' | 'medium' | 'long';
};

export class NPCPortfolioStrategy {
  /**
   * Get strategy configuration based on personality and conditions
   */
  static getStrategy(
    personality: string | null,
    marketConditions?: MarketConditions
  ): StrategyConfig {
    const personalityLower = (personality || '').toLowerCase();

    // Select base strategy from personality
    let baseStrategy: StrategyConfig;

    if (personalityLower.includes('erratic') || personalityLower.includes('disaster profiteer')) {
      baseStrategy = NPCPortfolioStrategy.getAggressiveStrategy();
    } else if (personalityLower.includes('vampire') || personalityLower.includes('yacht')) {
      baseStrategy = NPCPortfolioStrategy.getConservativeStrategy();
    } else if (personalityLower.includes('memecoin') || personalityLower.includes('nft degen')) {
      baseStrategy = NPCPortfolioStrategy.getHighVolatilityStrategy();
    } else {
      baseStrategy = NPCPortfolioStrategy.getBalancedStrategy();
    }

    // Adjust strategy based on market conditions
    if (marketConditions) {
      return NPCPortfolioStrategy.adjustForMarketConditions(baseStrategy, marketConditions);
    }

    return baseStrategy;
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   *
   * Kelly Criterion: f* = (bp - q) / b
   * Where:
   * - f* = optimal fraction of capital to bet
   * - b = odds received (payout ratio)
   * - p = probability of winning
   * - q = probability of losing (1-p)
   */
  static calculateOptimalPositionSize(
    winProbability: number,
    payoutRatio: number,
    strategy: StrategyConfig
  ): number {
    // Kelly Criterion
    const p = Math.max(0.01, Math.min(0.99, winProbability)); // Clamp to (0.01, 0.99)
    const q = 1 - p;
    const b = payoutRatio;

    const kellyFraction = (b * p - q) / b;

    // Apply fractional Kelly for risk management (typically use 25-50% of Kelly)
    const fractionalKelly = kellyFraction * 0.5;

    // Clamp to strategy limits
    const minSize = strategy.positionSizing.minPositionSize / 100;
    const maxSize = strategy.positionSizing.maxPositionSize / 100;

    const optimalSize = Math.max(minSize, Math.min(maxSize, fractionalKelly));

    return optimalSize * 100; // Return as percentage
  }

  /**
   * Determine if rebalancing is needed
   */
  static shouldRebalance(
    currentAllocation: AssetAllocation,
    targetAllocation: AssetAllocation,
    threshold: number
  ): boolean {
    const perpDeviation = Math.abs(currentAllocation.perps - targetAllocation.perps);
    const predDeviation = Math.abs(currentAllocation.predictions - targetAllocation.predictions);
    const cashDeviation = Math.abs(currentAllocation.cash - targetAllocation.cash);

    const maxDeviation = Math.max(perpDeviation, predDeviation, cashDeviation);

    return maxDeviation > threshold;
  }

  /**
   * Generate rebalancing actions to reach target allocation
   */
  static generateRebalancePlan(
    currentAllocation: AssetAllocation,
    targetAllocation: AssetAllocation,
    totalPortfolioValue: number
  ): {
    perpAdjustment: number;
    predictionAdjustment: number;
    cashAdjustment: number;
  } {
    const perpDiff = targetAllocation.perps - currentAllocation.perps;
    const predDiff = targetAllocation.predictions - currentAllocation.predictions;
    const cashDiff = targetAllocation.cash - currentAllocation.cash;

    return {
      perpAdjustment: (perpDiff / 100) * totalPortfolioValue,
      predictionAdjustment: (predDiff / 100) * totalPortfolioValue,
      cashAdjustment: (cashDiff / 100) * totalPortfolioValue,
    };
  }

  /**
   * Get recommended holding period in hours
   */
  static getHoldingPeriodHours(period: 'short' | 'medium' | 'long'): number {
    const periods = {
      short: 24, // 1 day
      medium: 168, // 1 week
      long: 720, // 30 days
    };

    return periods[period];
  }

  /**
   * Evaluate strategy performance metrics
   */
  static evaluateStrategy(
    actualReturns: number[],
    benchmarkReturns: number[],
    riskFreeRate: number = 0.02 // 2% annual
  ): {
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    alpha: number;
    beta: number;
  } {
    // Calculate Sharpe Ratio
    const avgReturn = actualReturns.reduce((a, b) => a + b, 0) / actualReturns.length;
    const variance =
      actualReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / actualReturns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;

    // Calculate Maximum Drawdown
    let peak = actualReturns[0] || 0;
    let maxDrawdown = 0;
    for (const value of actualReturns) {
      if (value > peak) peak = value;
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Calculate Win Rate
    const wins = actualReturns.filter((r) => r > 0).length;
    const winRate = actualReturns.length > 0 ? (wins / actualReturns.length) * 100 : 0;

    // Calculate Alpha and Beta (vs benchmark)
    const benchmarkAvg = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    const covariance =
      actualReturns.reduce((sum, r, i) => {
        return sum + (r - avgReturn) * ((benchmarkReturns[i] || 0) - benchmarkAvg);
      }, 0) / actualReturns.length;
    const benchmarkVariance =
      benchmarkReturns.reduce((sum, r) => {
        return sum + (r - benchmarkAvg) ** 2;
      }, 0) / benchmarkReturns.length;

    const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
    const alpha = avgReturn - (riskFreeRate + beta * (benchmarkAvg - riskFreeRate));

    return {
      sharpeRatio,
      maxDrawdown,
      winRate,
      alpha,
      beta,
    };
  }
}
