import { describe, expect, test } from 'bun:test';
import { groupResolvedMarketOutcomes } from '../../../apps/web/src/lib/services/market-resolution-notifications';

describe('groupResolvedMarketOutcomes', () => {
  test('aggregates direct positions for the same holder and market', () => {
    const outcomes = groupResolvedMarketOutcomes([
      {
        holderId: 'user-1',
        ownerUserId: 'user-1',
        marketId: 'market-1',
        marketName: 'Will ETH break $5k?',
        points: 12.5,
        agentName: null,
      },
      {
        holderId: 'user-1',
        ownerUserId: 'user-1',
        marketId: 'market-1',
        marketName: 'Will ETH break $5k?',
        points: -2.25,
        agentName: null,
      },
    ]);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      ownerUserId: 'user-1',
      holderId: 'user-1',
      marketId: 'market-1',
      points: 10.25,
      outcome: 'win',
      dedupeKey: 'market_resolved:market-1:user-1',
      deepLink: '/markets/predictions/market-1',
    });
  });

  test('zero-point entry is classified as win', () => {
    const outcomes = groupResolvedMarketOutcomes([
      {
        holderId: 'user-1',
        ownerUserId: 'user-1',
        marketId: 'market-3',
        marketName: 'Will SOL hit $500?',
        points: 0,
        agentName: null,
      },
    ]);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      points: 0,
      outcome: 'win',
    });
  });

  test('negative-point entry is classified as loss', () => {
    const outcomes = groupResolvedMarketOutcomes([
      {
        holderId: 'user-2',
        ownerUserId: 'user-2',
        marketId: 'market-4',
        marketName: 'Will DOGE moon?',
        points: -150,
        agentName: null,
      },
    ]);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      points: -150,
      outcome: 'loss',
    });
  });

  test('mixed YES/NO positions for same holder aggregate to net outcome', () => {
    const outcomes = groupResolvedMarketOutcomes([
      {
        holderId: 'agent-5',
        ownerUserId: 'user-1',
        marketId: 'market-5',
        marketName: 'Will BTC hit $100k?',
        points: 500,
        agentName: 'Apex Force',
      },
      {
        holderId: 'agent-5',
        ownerUserId: 'user-1',
        marketId: 'market-5',
        marketName: 'Will BTC hit $100k?',
        points: -300,
        agentName: 'Apex Force',
      },
    ]);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      points: 200,
      outcome: 'win',
      agentName: 'Apex Force',
    });
  });

  test('keeps agent-held outcomes separate and attributes the agent name', () => {
    const outcomes = groupResolvedMarketOutcomes([
      {
        holderId: 'agent-9',
        ownerUserId: 'user-1',
        marketId: 'market-2',
        marketName: 'Will BTC close green?',
        points: -9,
        agentName: 'Ares',
      },
    ]);

    expect(outcomes).toEqual([
      {
        ownerUserId: 'user-1',
        holderId: 'agent-9',
        marketId: 'market-2',
        marketName: 'Will BTC close green?',
        points: -9,
        outcome: 'loss',
        agentName: 'Ares',
        deepLink: '/markets/predictions/market-2',
        dedupeKey: 'market_resolved:market-2:agent-9',
      },
    ]);
  });
});
