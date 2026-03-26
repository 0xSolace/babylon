import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockDbSelect = mock();
const mockGetCacheOrFetch = mock(
  async <T>(_key: string, fetchFn: () => Promise<T>) => fetchFn()
);
const mockPublicRateLimit = mock();

const makeChain = (data: unknown[]) => {
  const chain: Record<string, unknown> = {};
  const noop = () => chain;
  chain.from = noop;
  chain.leftJoin = noop;
  chain.where = noop;
  chain.orderBy = noop;
  chain.limit = noop;
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(data).then(resolve, reject);
  chain.catch = (reject: (reason: unknown) => unknown) =>
    Promise.resolve(data).catch(reject);
  chain.finally = (cb: () => void) => Promise.resolve(data).finally(cb);
  return chain;
};

mock.module('@babylon/api', () => ({
  getCacheOrFetch: mockGetCacheOrFetch,
  publicRateLimit: mockPublicRateLimit,
  successResponse: (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }),
  withErrorHandling: (handler: (request: NextRequest) => Promise<Response>) =>
    handler,
}));

mock.module('@babylon/db', () => ({
  and: (...args: unknown[]) => args,
  arcStates: {
    questionId: 'arcStates.questionId',
    currentState: 'arcStates.currentState',
  },
  db: { select: mockDbSelect },
  desc: (value: unknown) => value,
  eq: (left: unknown, right: unknown) => [left, right],
  gte: (left: unknown, right: unknown) => [left, right],
  lt: (left: unknown, right: unknown) => [left, right],
  markets: {
    id: 'markets.id',
    question: 'markets.question',
    yesShares: 'markets.yesShares',
    noShares: 'markets.noShares',
    createdAt: 'markets.createdAt',
  },
  questions: {
    id: 'questions.id',
    questionNumber: 'questions.questionNumber',
    text: 'questions.text',
    resolutionDate: 'questions.resolutionDate',
    createdAt: 'questions.createdAt',
    status: 'questions.status',
  },
  sql: (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
    _sql: true,
  }),
}));

mock.module('@babylon/shared', () => ({
  toISO: (value: Date | string) => new Date(value).toISOString(),
}));

const { GET } = await import('./route');

describe('GET /api/feed/new-markets', () => {
  beforeEach(() => {
    mockDbSelect.mockReset();
    mockGetCacheOrFetch.mockReset();
    mockPublicRateLimit.mockReset();

    mockDbSelect.mockImplementation((_) => makeChain([]));
    mockGetCacheOrFetch.mockImplementation(
      async <T>(_key: string, fetchFn: () => Promise<T>) => fetchFn()
    );
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      rateLimitInfo: null,
    });
  });

  it('dedupes duplicate question rows produced by the market text join', async () => {
    const createdAt = new Date('2026-03-26T10:00:00.000Z');
    const resolutionDate = new Date('2026-04-01T10:00:00.000Z');

    mockDbSelect.mockImplementation(() =>
      makeChain([
        {
          questionNumber: 42,
          text: 'Will Bitcoin hit 100k?',
          resolutionDate,
          createdAt,
          arcState: 'active',
          marketId: 'market-newer',
          yesShares: '12',
          noShares: '8',
        },
        {
          questionNumber: 42,
          text: 'Will Bitcoin hit 100k?',
          resolutionDate,
          createdAt,
          arcState: 'active',
          marketId: 'market-older',
          yesShares: '2',
          noShares: '1',
        },
      ])
    );

    const response = await GET({} as NextRequest);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.markets).toHaveLength(1);
    expect(payload.markets[0]).toMatchObject({
      questionNumber: 42,
      marketId: 'market-newer',
      yesShares: 12,
      noShares: 8,
    });
  });
});
