import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockPublicRateLimit = mock(async () => ({
  error: null,
  rateLimitInfo: null,
}));
const mockPreviewOpenPosition = mock();

mock.module('@babylon/api', () => ({
  addPublicReadHeaders: mock(() => undefined),
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

mock.module('../_adapters', () => ({
  createPerpMarketService: () => ({
    previewOpenPosition: mockPreviewOpenPosition,
  }),
}));

const { POST } = await import('./route');

describe('POST /api/markets/perps/preview', () => {
  beforeEach(() => {
    mockPublicRateLimit.mockClear();
    mockPreviewOpenPosition.mockReset();
  });

  it('returns the canonical preview payload from the perp service', async () => {
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
        executionPrice: 101.4,
        totalRequired: 20.1,
      }),
    });
  });

  it('rejects invalid preview payloads', async () => {
    const response = await POST(
      new Request('http://localhost/api/markets/perps/preview', {
        method: 'POST',
        body: JSON.stringify({
          ticker: '',
          side: 'long',
          size: -1,
          leverage: 0,
        }),
      }) as NextRequest
    );

    expect(response.status).toBe(400);
    expect(mockPreviewOpenPosition).not.toHaveBeenCalled();
  });
});
