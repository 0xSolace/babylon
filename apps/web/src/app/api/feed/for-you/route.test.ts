import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextRequest } from 'next/server';

const mockBuildForYouFeed = mock();
const mockPublicRateLimit = mock();

// getCacheOrFetch passes through to the fetchFn so buildForYouFeed is
// still called and assertable, while avoiding any real Redis connection.
const mockGetCacheOrFetch = mock(
  async <T>(_key: string, fetchFn: () => Promise<T>) => fetchFn()
);

mock.module('@babylon/api', () => ({
  addPublicReadHeaders: (
    response: Response,
    rateLimitInfo: { limit: number }
  ) => {
    response.headers.set('Cache-Control', 'public, max-age=30');
    response.headers.set('X-RateLimit-Limit', String(rateLimitInfo.limit));
  },
  getCacheOrFetch: mockGetCacheOrFetch,
  publicRateLimit: mockPublicRateLimit,
  successResponse: (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    }),
  withErrorHandling: (handler: (request: NextRequest) => Promise<Response>) =>
    handler,
}));

mock.module('./pipeline', () => ({
  buildForYouFeed: mockBuildForYouFeed,
}));

const { GET } = await import('./route');

const makeRequest = (params: Record<string, string> = {}): NextRequest => {
  const searchParams = new URLSearchParams(params);
  return {
    url: 'https://play.babylon.market/api/feed/for-you',
    headers: { get: () => null },
    nextUrl: { searchParams },
  } as unknown as NextRequest;
};

beforeEach(() => {
  mockBuildForYouFeed.mockReset();
  mockPublicRateLimit.mockReset();
  mockGetCacheOrFetch.mockReset();
  mockGetCacheOrFetch.mockImplementation(
    async <T>(_key: string, fetchFn: () => Promise<T>) => fetchFn()
  );
});

describe('GET /api/feed/for-you', () => {
  it('returns a private personalized response for authenticated users', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: { userId: 'user-1' },
      rateLimitInfo: {
        limit: 60,
        remaining: 59,
        resetAt: new Date('2026-03-08T12:00:00.000Z'),
      },
    });
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: [{ storyKey: 'story-1', posts: [] }],
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(mockBuildForYouFeed).toHaveBeenCalledWith('user-1');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(payload.generatedAt).toBe('2026-03-08T11:55:00.000Z');
    expect(payload.stories).toHaveLength(1);
    expect(payload.hasMore).toBe(false);
    expect(payload.total).toBe(1);
  });

  it('paginates correctly with offset and limit params', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: { userId: 'user-1' },
      rateLimitInfo: {
        limit: 60,
        remaining: 59,
        resetAt: new Date('2026-03-08T12:00:00.000Z'),
      },
    });
    // 25-item dataset — page 1 (offset=20, limit=20) should return 5 items
    const allStories = Array.from({ length: 25 }, (_, i) => ({
      storyKey: `story-${i}`,
      posts: [],
    }));
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: allStories,
    });

    const response = await GET(makeRequest({ offset: '20', limit: '20' }));
    const payload = await response.json();

    expect(payload.stories).toHaveLength(5);
    expect(payload.stories[0].storyKey).toBe('story-20');
    expect(payload.hasMore).toBe(false);
    expect(payload.total).toBe(25);
  });

  it('reports hasMore true when more pages exist', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: { userId: 'user-1' },
      rateLimitInfo: { limit: 60, remaining: 59, resetAt: new Date() },
    });
    const allStories = Array.from({ length: 45 }, (_, i) => ({
      storyKey: `story-${i}`,
      posts: [],
    }));
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: allStories,
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(payload.stories).toHaveLength(20);
    expect(payload.hasMore).toBe(true);
    expect(payload.total).toBe(45);
  });

  it('treats non-numeric offset as 0 rather than silently passing NaN', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: { userId: 'user-1' },
      rateLimitInfo: { limit: 60, remaining: 59, resetAt: new Date() },
    });
    const allStories = Array.from({ length: 5 }, (_, i) => ({
      storyKey: `story-${i}`,
      posts: [],
    }));
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: allStories,
    });

    const response = await GET(makeRequest({ offset: 'abc' }));
    const payload = await response.json();

    // Should return page 0 content, not crash or miscompute
    expect(payload.stories).toHaveLength(5);
    expect(payload.stories[0].storyKey).toBe('story-0');
  });

  it('includes anchor post in posts array for isNewMarket stories', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: { userId: 'user-1' },
      rateLimitInfo: {
        limit: 60,
        remaining: 59,
        resetAt: new Date('2026-03-08T12:00:00.000Z'),
      },
    });
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: [
        {
          storyKey: 'market:42',
          isNewMarket: true,
          anchorPostId: 'anchor-post-1',
          posts: [
            {
              id: 'anchor-post-1',
              likeCount: 5,
              commentCount: 3,
              shareCount: 1,
              isLiked: false,
              isShared: false,
            },
          ],
        },
      ],
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    const marketStory = payload.stories[0];
    expect(marketStory.isNewMarket).toBe(true);
    expect(marketStory.anchorPostId).toBe('anchor-post-1');
    expect(marketStory.posts).toHaveLength(1);
    expect(marketStory.posts[0].id).toBe('anchor-post-1');
    expect(marketStory.posts[0].likeCount).toBe(5);
  });

  it('returns a public response for anonymous users', async () => {
    mockPublicRateLimit.mockResolvedValue({
      error: null,
      user: null,
      rateLimitInfo: {
        limit: 100,
        remaining: 99,
        resetAt: new Date('2026-03-08T12:00:00.000Z'),
      },
    });
    mockBuildForYouFeed.mockResolvedValue({
      generatedAt: '2026-03-08T11:55:00.000Z',
      stories: [],
    });

    const response = await GET(makeRequest());

    expect(mockBuildForYouFeed).toHaveBeenCalledWith(null);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  });
});
