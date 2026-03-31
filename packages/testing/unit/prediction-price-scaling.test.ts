import { describe, expect, it } from 'bun:test';
import { PredictionPricing } from '@babylon/core/markets/prediction';

describe('Prediction market price scaling', () => {
  it('CPMM avgPrice can exceed 1.0 for large trades', () => {
    // Market with 5000/5000 liquidity (10k initial)
    const result = PredictionPricing.calculateBuy(5000, 5000, 'yes', 2000);

    // avgPrice = usdAmount / sharesBought
    // For a $2000 buy on a 50/50 market, cost-per-share > 1
    expect(result.avgPrice).toBeGreaterThan(1.0);
    expect(result.sharesBought).toBeGreaterThan(0);
    expect(result.sharesBought).toBeLessThan(2000);
  });

  it('avgPrice should NOT be multiplied by 100 for storage', () => {
    const result = PredictionPricing.calculateBuy(5000, 5000, 'yes', 1000);

    // The raw avgPrice is the correct value for entryPrice storage
    // Multiplying by 100 would create values like 140 for a $1.40 cost-per-share
    const correctEntryPrice = result.avgPrice;
    const wrongEntryPrice = result.avgPrice * 100;

    // Correct entry price should be in a reasonable range (0.x to ~2.x)
    expect(correctEntryPrice).toBeLessThan(5);
    expect(correctEntryPrice).toBeGreaterThan(0);

    // Wrong entry price would be 100x too large
    expect(wrongEntryPrice).toBeGreaterThan(50);
  });

  it('market prices (yesPrice/noPrice) ARE 0-1 probabilities', () => {
    const result = PredictionPricing.calculateBuy(5000, 5000, 'yes', 1000);

    // newYesPrice and newNoPrice should sum to ~1.0
    expect(result.newYesPrice + result.newNoPrice).toBeCloseTo(1.0, 5);
    expect(result.newYesPrice).toBeGreaterThan(0);
    expect(result.newYesPrice).toBeLessThan(1);
    expect(result.newNoPrice).toBeGreaterThan(0);
    expect(result.newNoPrice).toBeLessThan(1);
  });

  it('small trades have avgPrice close to 1.0 (cost per share)', () => {
    const result = PredictionPricing.calculateBuy(5000, 5000, 'yes', 10);

    // avgPrice is cost-per-share, NOT probability. On a balanced market
    // you pay ~$1 per share, so avgPrice ≈ 1.0
    expect(result.avgPrice).toBeCloseTo(1.0, 0);
  });

  it('large trades have avgPrice much higher than market price', () => {
    const result = PredictionPricing.calculateBuy(5000, 5000, 'yes', 4000);

    // Large trade moves the price significantly: avgPrice >> initial 0.5
    expect(result.avgPrice).toBeGreaterThan(1.5);
  });

  it('calculateExpectedPayout uses raw avgPrice correctly', () => {
    const shares = 100;
    const avgPrice = 0.6;

    const payout = PredictionPricing.calculateExpectedPayout(shares, avgPrice);
    // payout = shares * (1 + avgPrice) = 100 * 1.6 = 160
    expect(payout).toBe(160);
  });
});
