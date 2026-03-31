import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockPublicRateLimit = mock(async () => ({
  error: null,
  rateLimitInfo: null,
}));
const mockAuthenticate = mock(async () => ({ userId: 'user-1' }));
const mockAuthenticateOnchainPerpUser = mock(async () => ({
  userId: 'user-1',
  dbUserId: 'db-user-1',
  walletAddress: '0xabc',
}));
const mockPreviewOpenPosition = mock();
const mockGetOpenPositionByUserAndTicker = mock(async () => null);
const mockPrepareOpenOrder = mock();
const mockIsOnchainPerpModeEnabled = mock(() => false);

mock.module('@babylon/api', () => ({
  addPublicReadHeaders: mock(() => undefined),
  authenticate: mockAuthenticate,
  publicRateLimit: mockPublicRateLimit,
  successResponse: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  withErrorHandling:
    (handler: (request: NextRequest) => Promise<Response>) =>
    async (request: NextRequest) =>
      await handler(request),
}));

mock.module('@babylon/core/markets/perps', () => ({
  PerpDbAdapter: class PerpDbAdapter {
    getOpenPositionByUserAndTicker = mockGetOpenPositionByUserAndTicker;
  },
}));

mock.module('@babylon/shared', () => ({
  PerpOpenPositionSchema: {
    parse: (value: Record<string, unknown>) => value,
  },
}));

mock.module('../_adapters', () => ({
  createPerpMarketService: () => ({
    previewOpenPosition: mockPreviewOpenPosition,
  }),
}));

mock.module('../_onchain', () => ({
  authenticateOnchainPerpUser: mockAuthenticateOnchainPerpUser,
  getOnchainPerpService: () => ({
    prepareOpenOrder: mockPrepareOpenOrder,
  }),
  isOnchainPerpModeEnabled: mockIsOnchainPerpModeEnabled,
  resolvePerpUserWallet: mock(async () => ({
    walletAddress: '0xabc',
  })),
}));

const { POST } = await import('./route');

describe('POST /api/markets/perps/preview', () => {
  beforeEach(() => {
    mockPublicRateLimit.mockClear();
    mockAuthenticate.mockClear();
    mockAuthenticate.mockResolvedValue({ userId: 'user-1' });
    mockAuthenticateOnchainPerpUser.mockClear();
    mockAuthenticateOnchainPerpUser.mockResolvedValue({
      userId: 'user-1',
      dbUserId: 'db-user-1',
      walletAddress: '0xabc',
    });
    mockPreviewOpenPosition.mockReset();
    mockGetOpenPositionByUserAndTicker.mockReset();
    mockPrepareOpenOrder.mockReset();
    mockIsOnchainPerpModeEnabled.mockReset();
    mockIsOnchainPerpModeEnabled.mockReturnValue(false);
  });

  it('returns the canonical offchain preview payload from the perp service', async () => {
    mockPreviewOpenPosition.mockResolvedValue({
      ticker: 'ABC',
      side: 'long',
      size: 100,
      leverage: 5,
      currentPrice: 100,
      quotedPrice: 101,
      executionPrice: 101.4,
      quoteImpactPrice: 0.4,
      quoteImpactBps: 40,
      totalSlippageBps: 140,
      bidPrice: 99,
      askPrice: 101,
      spreadBps: 200,
      bidDepth: 1000,
      askDepth: 1000,
      liquidityRegime: 'balanced',
      marginRequired: 20,
      estimatedFee: 0.1,
      totalRequired: 20.1,
      liquidationPrice: 81.12,
      liquidationDistancePercent: 18.88,
    });

    const response = await POST(
      new Request('http://localhost/api/markets/perps/preview', {
        method: 'POST',
        body: JSON.stringify({
          ticker: 'abc',
          side: 'long',
          size: 100,
          leverage: 5,
        }),
      }) as NextRequest
    );

    expect(response.status).toBe(200);
    expect(mockPreviewOpenPosition).toHaveBeenCalledWith({
      ticker: 'abc',
      side: 'long',
      size: 100,
      leverage: 5,
    });
    expect(await response.json()).toEqual({
      preview: expect.objectContaining({
        settlementMode: 'offchain',
        executionPrice: 101.4,
        totalRequired: 20.1,
      }),
    });
  });

  it('rejects canonical preview for rebalance flows', async () => {
    mockGetOpenPositionByUserAndTicker.mockResolvedValue({
      id: 'position-1',
    } as never);

    const response = await POST(
      new Request('http://localhost/api/markets/perps/preview', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({
          ticker: 'abc',
          side: 'long',
          size: 100,
          leverage: 5,
        }),
      }) as NextRequest
    );

    expect(response.status).toBe(409);
    expect(mockPreviewOpenPosition).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error:
        'Canonical preview is unavailable for rebalance orders on this endpoint.',
      code: 'PERP_PREVIEW_REBALANCE_UNSUPPORTED',
    });
  });

  it('branches to the onchain preview path when onchain mode is enabled', async () => {
    mockIsOnchainPerpModeEnabled.mockReturnValue(true);
    mockPrepareOpenOrder.mockResolvedValue({
      sizeUsd: 100,
      indexPrice: 10_000_000_000n,
      estimatedExecutionPrice: 10_120_000_000n,
      estimatedFee: 100_000_000_000_000_000n,
      collateralRequired: 2_100_000_000_000_000_000n,
    });

    const response = await POST(
      new Request('http://localhost/api/markets/perps/preview', {
        method: 'POST',
        body: JSON.stringify({
          ticker: 'abc',
          side: 'long',
          size: 100,
          leverage: 5,
        }),
      }) as NextRequest
    );

    expect(response.status).toBe(200);
    expect(mockPrepareOpenOrder).toHaveBeenCalled();
    expect(await response.json()).toEqual({
      preview: expect.objectContaining({
        settlementMode: 'onchain',
        executionPrice: 101.2,
        currentPrice: 100,
        totalRequired: 2.1,
      }),
    });
  });
});
