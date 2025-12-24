/**
 * Market Impact Service
 *
 * Calculates and applies market impact from trades.
 */

export interface MarketImpact {
  priceImpact: number
  slippage: number
  volumeImpact: number
}

export interface TradeImpactInput {
  ticker: string
  side: 'long' | 'short' | 'buy' | 'sell'
  size: number
  price?: number
}

export interface AggregatedImpact {
  totalPriceImpact: number
  totalSlippage: number
  totalVolume: number
  tradeCount: number
}

export interface MarketImpactService {
  calculateImpact(
    ticker: string,
    side: 'long' | 'short' | 'buy' | 'sell',
    size: number,
  ): Promise<MarketImpact>
  applyImpact(ticker: string, impact: MarketImpact): Promise<void>
}

/**
 * Aggregate multiple trade impacts into a single summary
 */
export function aggregateTradeImpacts(
  impacts: MarketImpact[],
): AggregatedImpact {
  const result: AggregatedImpact = {
    totalPriceImpact: 0,
    totalSlippage: 0,
    totalVolume: 0,
    tradeCount: impacts.length,
  }

  for (const impact of impacts) {
    result.totalPriceImpact += impact.priceImpact
    result.totalSlippage += impact.slippage
    result.totalVolume += impact.volumeImpact
  }

  return result
}

/**
 * Create a market impact service instance.
 */
export function createMarketImpactService(): MarketImpactService {
  return {
    async calculateImpact(
      _ticker: string,
      _side: 'long' | 'short' | 'buy' | 'sell',
      size: number,
    ): Promise<MarketImpact> {
      // Simple linear impact model
      const baseImpact = 0.001 // 0.1% base impact
      const sizeMultiplier = Math.log10(Math.max(size, 1)) / 10

      return {
        priceImpact: baseImpact * sizeMultiplier,
        slippage: baseImpact * sizeMultiplier * 0.5,
        volumeImpact: size,
      }
    },

    async applyImpact(_ticker: string, _impact: MarketImpact): Promise<void> {
      // Impact application is handled by the trading service
    },
  }
}
