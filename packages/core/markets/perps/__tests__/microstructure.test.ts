import { describe, expect, it } from 'bun:test';
import { getSyntheticPerpExecutionPrice } from '../microstructure';
import type { PerpMarketRecord } from '../types';

function createMarket(
  overrides: Partial<PerpMarketRecord> = {}
): PerpMarketRecord {
  return {
    ticker: 'OPENAGI',
    organizationId: 'openagi',
    name: 'OpenAGI',
    currentPrice: 100,
    price24hAgo: 98,
    change24h: 2,
    changePercent24h: 2.04,
    high24h: 103,
    low24h: 96,
    volume24h: 50_000,
    openInterest: 20_000,
    fundingRate: {
      ticker: 'OPENAGI',
      rate: 0.01,
      nextFundingTime: new Date().toISOString(),
      predictedRate: 0.01,
    },
    maxLeverage: 100,
    minOrderSize: 10,
    markPrice: 100.5,
    indexPrice: 100,
    ...overrides,
  };
}

describe('getSyntheticPerpExecutionPrice', () => {
  it('executes buys above sells around the mid price', () => {
    const market = createMarket();
    const buy = getSyntheticPerpExecutionPrice({
      market,
      side: 'buy',
      size: 1_000,
    });
    const sell = getSyntheticPerpExecutionPrice({
      market,
      side: 'sell',
      size: 1_000,
    });

    expect(buy.executionPrice).toBeGreaterThan(buy.midPrice);
    expect(sell.executionPrice).toBeLessThan(sell.midPrice);
    expect(buy.askPrice).toBeGreaterThan(buy.bidPrice);
  });

  it('penalizes large trades more than small trades', () => {
    const market = createMarket();
    const small = getSyntheticPerpExecutionPrice({
      market,
      side: 'buy',
      size: 500,
    });
    const large = getSyntheticPerpExecutionPrice({
      market,
      side: 'buy',
      size: 10_000,
    });

    expect(large.executionPrice).toBeGreaterThan(small.executionPrice);
    expect(large.impactBps).toBeGreaterThan(small.impactBps);
  });

  it('widens slippage for thinner markets', () => {
    const liquid = getSyntheticPerpExecutionPrice({
      market: createMarket({ openInterest: 200_000, volume24h: 500_000 }),
      side: 'buy',
      size: 2_000,
    });
    const thin = getSyntheticPerpExecutionPrice({
      market: createMarket({ openInterest: 500, volume24h: 2_000 }),
      side: 'buy',
      size: 2_000,
    });

    expect(thin.executionPrice - thin.midPrice).toBeGreaterThan(
      liquid.executionPrice - liquid.midPrice
    );
    expect(thin.askDepth).toBeLessThan(liquid.askDepth);
  });

  it('falls back to a safe positive reference price when market inputs are invalid', () => {
    const quote = getSyntheticPerpExecutionPrice({
      market: createMarket({
        currentPrice: Number.NaN,
        markPrice: Number.NaN,
        indexPrice: Number.NEGATIVE_INFINITY,
      }),
      side: 'buy',
      size: 100,
    });

    expect(quote.midPrice).toBe(100);
    expect(Number.isFinite(quote.executionPrice)).toBe(true);
    expect(quote.executionPrice).toBeGreaterThan(0);
  });
});
