import { describe, expect, it } from 'bun:test';
import {
  buildPerpMarketSnapshot,
  buildPredictionMarketSnapshot,
  MAX_MARKET_QUESTION_LENGTH,
} from './market-context-helpers';

describe('market-context-helpers', () => {
  it('maps perp market records without altering canonical fields', () => {
    const snapshot = buildPerpMarketSnapshot({
      ticker: 'OPENAGI',
      organizationId: 'openagi',
      name: 'OpenAGI',
      currentPrice: 123.45,
      price24hAgo: 120,
      change24h: 3.45,
      changePercent24h: 2.875,
      high24h: 130,
      low24h: 118,
      volume24h: 500000,
      openInterest: 250000,
      fundingRate: {
        ticker: 'OPENAGI',
        rate: 0.01,
        nextFundingTime: new Date().toISOString(),
        predictedRate: 0.01,
      },
      maxLeverage: 100,
      minOrderSize: 10,
      markPrice: 123.5,
      indexPrice: 123.4,
    });

    expect(snapshot).toEqual({
      ticker: 'OPENAGI',
      organizationId: 'openagi',
      name: 'OpenAGI',
      currentPrice: 123.45,
      change24h: 3.45,
      changePercent24h: 2.875,
      high24h: 130,
      low24h: 118,
      volume24h: 500000,
      openInterest: 250000,
    });
  });

  it('uses CPMM pricing semantics for prediction YES/NO probabilities', () => {
    const snapshot = buildPredictionMarketSnapshot(
      {
        id: 'market-1',
        question: 'Will OpenAGI ship AGI before year-end?',
        yesShares: 60,
        noShares: 40,
        liquidity: 20000,
        endDate: new Date('2026-04-05T12:00:00.000Z'),
      },
      new Date('2026-04-01T12:00:00.000Z')
    );

    expect(snapshot.yesPrice).toBe(40);
    expect(snapshot.noPrice).toBe(60);
    expect(snapshot.totalVolume).toBe(20000);
    expect(snapshot.daysUntilResolution).toBe(4);
  });

  it('truncates long prediction questions for token discipline', () => {
    const longQuestion = 'Q'.repeat(MAX_MARKET_QUESTION_LENGTH + 20);
    const snapshot = buildPredictionMarketSnapshot(
      {
        id: 'market-2',
        question: longQuestion,
        yesShares: 50,
        noShares: 50,
        liquidity: 1000,
        endDate: new Date('2026-04-05T12:00:00.000Z'),
      },
      undefined,
      { maxQuestionLength: MAX_MARKET_QUESTION_LENGTH }
    );

    expect(snapshot.text.length).toBe(MAX_MARKET_QUESTION_LENGTH + 3);
    expect(snapshot.text.endsWith('...')).toBe(true);
  });

  it('preserves full question text when no truncation policy is provided', () => {
    const longQuestion = 'Q'.repeat(MAX_MARKET_QUESTION_LENGTH + 20);
    const snapshot = buildPredictionMarketSnapshot({
      id: 'market-3',
      question: longQuestion,
      yesShares: 50,
      noShares: 50,
      liquidity: 1000,
      endDate: new Date('2026-04-05T12:00:00.000Z'),
    });

    expect(snapshot.text).toBe(longQuestion);
  });
});
