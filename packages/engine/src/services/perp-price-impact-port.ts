import {
  isOpenPerpPositionStateValid,
  PerpDbAdapter,
  type PriceImpactPort,
} from '@babylon/core/markets/perps';
import {
  fetchPerpBasePriceForTicker,
  fetchPerpPriceImpactReadContext,
} from '@babylon/db';
import {
  calculatePriceFromHoldings,
  logger,
  PERP_MARKET_CONFIG,
} from '@babylon/shared';
import { PriceUpdateService } from './price-update-service';

/**
 * Apply perp price impact for a ticker and return the resulting market price.
 *
 * This mirrors the real-time impact logic used by the web API and is shared
 * across A2A, MCP, agents, and engine trade execution paths.
 */
export async function applyPerpUserTradePriceImpact(
  ticker: string
): Promise<number | undefined> {
  try {
    const normalizedTicker = ticker.toUpperCase();

    const read = await fetchPerpPriceImpactReadContext(normalizedTicker);

    const snap = read.snapshot;
    const { state, openPositions } = read;

    if (!snap) {
      logger.warn(
        'PerpMarketSnapshot not found for price impact',
        { ticker: normalizedTicker },
        'PerpPriceImpact'
      );
      return undefined;
    }

    if (!state) {
      logger.warn(
        'OrganizationState not found for price impact',
        { ticker: normalizedTicker, organizationId: snap.organizationId },
        'PerpPriceImpact'
      );
      return undefined;
    }

    const initialPrice = Number(state.basePrice ?? snap.currentPrice ?? 100);
    const currentPrice = Number(
      snap.currentPrice ?? state.currentPrice ?? initialPrice
    );

    let netHoldings = 0;
    let invalidPositions = 0;
    for (const pos of openPositions) {
      if (!isOpenPerpPositionStateValid(pos)) {
        invalidPositions++;
        continue;
      }

      const size = Number(pos.size);
      netHoldings += pos.side === 'long' ? size : -size;
    }

    if (invalidPositions > 0) {
      logger.warn(
        'Ignoring invalid open perp positions during price impact calculation',
        {
          ticker: normalizedTicker,
          invalidPositions,
        },
        'PerpPriceImpact'
      );
    }

    const newPrice = calculatePriceFromHoldings(
      initialPrice,
      currentPrice,
      netHoldings,
      PERP_MARKET_CONFIG
    );

    if (Math.abs(newPrice - currentPrice) < 0.001) {
      return currentPrice;
    }

    await PriceUpdateService.applyUpdates([
      {
        organizationId: snap.organizationId,
        newPrice,
        source: 'user_trade',
        reason: 'User trade price impact',
        metadata: { ticker: normalizedTicker },
      },
    ]);

    const perpDb = new PerpDbAdapter();
    const markets = await perpDb.listMarkets();
    const market = markets.find(
      (m) => m.ticker.toUpperCase() === normalizedTicker
    );

    return market?.currentPrice ?? newPrice;
  } catch (error) {
    logger.error(
      'Failed to apply user trade price impact',
      {
        ticker: ticker.toUpperCase(),
        error: error instanceof Error ? error.message : String(error),
      },
      'PerpPriceImpact'
    );
    return undefined;
  }
}

/**
 * Read base price for symmetric clamping in delta-based avg-fill logic.
 */
export async function getPerpBasePrice(
  ticker: string
): Promise<number | undefined> {
  return fetchPerpBasePriceForTicker(ticker.toUpperCase());
}

/**
 * Shared adapter factory for PerpMarketService price impact protection.
 */
export function createPerpPriceImpactPort(): PriceImpactPort {
  return {
    applyAndGetPrice: applyPerpUserTradePriceImpact,
    getBasePrice: getPerpBasePrice,
  };
}
