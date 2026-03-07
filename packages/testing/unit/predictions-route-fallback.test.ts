import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockPublicRateLimit = mock();
const mockListMarkets = mock();
const mockListUserPositions = mock();
const mockLogger = {
  error: mock(),
  info: mock(),
};

mock.module('@babylon/api', () => ({
  addPublicReadHeaders: () => {},
  publicRateLimit: mockPublicRateLimit,
  successResponse: (data: unknown) => data,
  withErrorHandling: (handler: (request: Request) => Promise<unknown>) => handler,
}));

mock.module('@babylon/core/markets/prediction', () => ({
  PredictionDbAdapter: class PredictionDbAdapter {},
  PredictionMarketService: class PredictionMarketService {
    listMarkets = mockListMarkets;
    listUserPositions = mockListUserPositions;
  },
  PredictionPricing: {
    getCurrentPrice: () => 0.5,
    calculateSellWithFees: () => ({
      netProceeds: 10,
      totalCost: 10,
    }),
  },
}));

mock.module('@babylon/engine', () => ({
  FEE_CONFIG: {
    TRADING_FEE_RATE: 0.02,
    PLATFORM_SHARE: 0.5,
    REFERRER_SHARE: 0.5,
    MIN_FEE_AMOUNT: 0,
  },
  WalletService: {
    debit: mock(),
    credit: mock(),
    recordPnL: mock(),
    getBalance: mock(),
  },
}));

mock.module('@babylon/shared', () => ({
  logger: mockLogger,
  MarketQuerySchema: {
    merge: () => ({
      partial: () => ({
        safeParse: (value: Record<string, unknown>) => ({
          success: true,
          data: value,
        }),
      }),
    }),
  },
}));

mock.module('zod', () => ({
  z: {
    string: () => ({
      optional: () => ({}),
    }),
    object: () => ({}),
  },
}));

const { GET } = await import(
  '../../../apps/web/src/app/api/markets/predictions/route'
);

describe('GET /api/markets/predictions', () => {
  beforeEach(() => {
    mockPublicRateLimit.mockReset();
    mockListMarkets.mockReset();
    mockListUserPositions.mockReset();
    mockLogger.error.mockReset();
    mockLogger.info.mockReset();

    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: {
        userId: 'user-1',
        dbUserId: 'db-user-1',
        privyId: 'did:privy:user-1',
      },
      rateLimitInfo: null,
    });

    mockListMarkets.mockResolvedValue([
      {
        id: 'market-1',
        question: 'Will BTC go up?',
        yesShares: 100,
        noShares: 100,
        status: 'active',
        resolved: false,
        resolution: null,
        endDate: new Date('2026-03-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);
  });

  it('returns markets even when user position enrichment fails', async () => {
    mockListUserPositions.mockRejectedValue(new Error('permission denied'));

    const result = await GET({
      url: 'https://example.com/api/markets/predictions?userId=user-1',
    } as Request);

    expect(result).toMatchObject({
      success: true,
      count: 1,
    });
    expect(result.questions[0]?.userPositions).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
