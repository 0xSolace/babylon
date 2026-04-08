import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as actualShared from '@babylon/shared';

const mockListActiveTimeframedMarketsPage = mock(
  async (_params: { limit: number; offset: number }) => [] as unknown[]
);
const mockUpdateTimeframedMarketArcState = mock(
  async (_params: {
    marketId: string;
    arcState: string;
    arcStateEnteredAt: Date;
    updatedAt: Date;
    traceLabel: string;
  }) => {}
);
const mockUpdateTimeframedMarketEventStats = mock(async () => {});

mock.module('@babylon/db', () => ({
  asc: (column: unknown) => ({ op: 'asc', column }),
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
  listActiveTimeframedMarketsPage: mockListActiveTimeframedMarketsPage,
  updateTimeframedMarketArcState: mockUpdateTimeframedMarketArcState,
  updateTimeframedMarketEventStats: mockUpdateTimeframedMarketEventStats,
}));

const mockLoggerInfo = mock();

mock.module('@babylon/shared', () => ({
  ...actualShared,
  logger: {
    debug: mock(),
    error: mock(),
    info: mockLoggerInfo,
    warn: mock(),
  },
}));

const { TimeframeArcProcessor } = await import(
  '../../../engine/src/services/timeframe-arc-processor'
);

describe('TimeframeArcProcessor', () => {
  beforeEach(() => {
    mockListActiveTimeframedMarketsPage.mockReset();
    mockListActiveTimeframedMarketsPage.mockResolvedValue([]);
    mockUpdateTimeframedMarketArcState.mockClear();
    mockUpdateTimeframedMarketEventStats.mockClear();
    mockLoggerInfo.mockClear();
  });

  test('keeps expired markets active while moving them to the terminal arc state', async () => {
    const now = new Date('2026-03-19T20:50:00.000Z');
    const expiredMarket = {
      id: 'market-1',
      timeframe: 'intraday',
      startTime: new Date('2026-03-19T18:50:00.000Z'),
      endTime: new Date('2026-03-19T19:50:00.000Z'),
      arcState: 'active',
      eventsGenerated: 0,
    };

    mockListActiveTimeframedMarketsPage
      .mockResolvedValueOnce([expiredMarket])
      .mockResolvedValue([]);

    const processor = new TimeframeArcProcessor();
    const result = await processor.processTick(now);

    expect(result.marketsProcessed).toBe(1);
    expect(result.transitionsOccurred).toBe(1);
    expect(mockUpdateTimeframedMarketArcState).toHaveBeenCalledTimes(1);
    expect(mockUpdateTimeframedMarketArcState).toHaveBeenCalledWith({
      marketId: 'market-1',
      arcState: 'resolution',
      arcStateEnteredAt: now,
      updatedAt: now,
      traceLabel: 'timeframe-arc-resolution-pending',
    });

    const updatePayload = mockUpdateTimeframedMarketArcState.mock
      .calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(updatePayload).toBeDefined();
    expect(updatePayload).not.toHaveProperty('isActive');
    expect(updatePayload).not.toHaveProperty('isResolved');
    expect(updatePayload).not.toHaveProperty('resolvedAt');
  });

  test('does not rewrite expired markets already in their terminal arc state', async () => {
    const now = new Date('2026-03-19T20:50:00.000Z');
    const expiredMarket = {
      id: 'market-2',
      timeframe: 'flash',
      startTime: new Date('2026-03-19T20:15:00.000Z'),
      endTime: new Date('2026-03-19T20:30:00.000Z'),
      arcState: 'resolving',
      eventsGenerated: 0,
    };

    mockListActiveTimeframedMarketsPage
      .mockResolvedValueOnce([expiredMarket])
      .mockResolvedValue([]);

    const processor = new TimeframeArcProcessor();
    const result = await processor.processTick(now);

    expect(result.marketsProcessed).toBe(1);
    expect(result.transitionsOccurred).toBe(0);
    expect(mockUpdateTimeframedMarketArcState).not.toHaveBeenCalled();
  });
});
