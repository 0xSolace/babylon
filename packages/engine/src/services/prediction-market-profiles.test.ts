import { describe, expect, it } from 'bun:test';
import { buildPredictionMarketProfile } from './prediction-market-profiles';

describe('prediction-market-profiles', () => {
  it('builds deterministic profiles for the same market input', () => {
    const input = {
      marketId: 'market-1',
      question: 'Will OpenAGI release a new model this week?',
      endDate: new Date('2026-04-03T23:59:59.000Z'),
      now: new Date('2026-04-01T12:00:00.000Z'),
    };

    expect(buildPredictionMarketProfile(input)).toEqual(
      buildPredictionMarketProfile(input)
    );
  });

  it('assigns different liquidity and behavior across horizons', () => {
    const now = new Date('2026-04-01T12:00:00.000Z');
    const short = buildPredictionMarketProfile({
      marketId: 'market-short',
      question: 'Will OpenAGI announce a partnership tomorrow?',
      endDate: new Date('2026-04-02T23:59:59.000Z'),
      now,
    });
    const long = buildPredictionMarketProfile({
      marketId: 'market-long',
      question: 'Will OpenAGI complete an acquisition next week?',
      endDate: new Date('2026-04-08T23:59:59.000Z'),
      now,
    });

    expect(short.horizonBucket).toBe('short');
    expect(long.horizonBucket).toBe('long');
    expect(short.initialLiquidity).toBeLessThan(long.initialLiquidity);
    expect(short.signalSensitivity).toBeGreaterThan(long.signalSensitivity);
    expect(short.neutralReversionMultiplier).toBeLessThan(
      long.neutralReversionMultiplier
    );
  });

  it('keeps opening prior anchored around 50/50', () => {
    const profile = buildPredictionMarketProfile({
      marketId: 'market-2',
      question: 'Will AINBC publish a correction by Friday?',
      endDate: new Date('2026-04-05T23:59:59.000Z'),
      now: new Date('2026-04-01T12:00:00.000Z'),
    });

    expect(profile.initialYesProbability).toBe(0.5);
  });
});
