import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import { NextRequest } from 'next/server';
import { cronMockState, registerCronMocks } from './cron-test-mocks';

/**
 * Article Tick Cron Job Tests
 *
 * Tests for the article-tick cron endpoint which handles centralized
 * article generation with rate limiting.
 */

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

describe('Article Tick Cron', () => {
  beforeAll(async () => {
    registerCronMocks();
    const routeModule = await import('@/app/api/cron/article-tick/route');
    GET = routeModule.GET;
    POST = routeModule.POST;
  });

  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    cronMockState.articleGame = null;
    cronMockState.articleCount = 0;
    cronMockState.articleCronAuthResult = true;
    cronMockState.articleCoveredEventIds.clear();
  });

  describe('Authorization', () => {
    test('should reject unauthorized requests when verifyCronAuth returns false', async () => {
      cronMockState.articleCronAuthResult = false;

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized cron request');
      expect(data.success).toBeUndefined();
    });

    test('GET should delegate to POST and return identical response', async () => {
      cronMockState.articleGame = null;

      const getReq = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'GET',
      });
      const postReq = new NextRequest(
        'http://localhost/api/cron/article-tick',
        { method: 'POST' }
      );

      const getRes = await GET(getReq);
      const postRes = await POST(postReq);

      expect(getRes.status).toBe(postRes.status);

      const getBody = await getRes.json();
      const postBody = await postRes.json();

      expect(getBody.success).toBe(postBody.success);
      expect(getBody.skipped).toBe(postBody.skipped);
      expect(getBody.reason).toBe(postBody.reason);

      expect(getBody.success).toBe(true);
      expect(getBody.skipped).toBe(true);
      expect(getBody.reason).toBe('No continuous game found');
    });
  });

  describe('Game State Checks', () => {
    test('should be skipped when no continuous game exists', async () => {
      cronMockState.articleGame = null;

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.skipped).toBe(true);
      expect(data.reason).toBe('No continuous game found');
    });

    test('should be paused when game.isRunning is false', async () => {
      cronMockState.articleGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: false,
        currentDay: 1,
      };

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.skipped).toBe(true);
      expect(data.reason).toBe('Game is paused');
    });
  });

  describe('Rate Limiting', () => {
    test('should skip when rate limit reached', async () => {
      cronMockState.articleGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: true,
        currentDay: 1,
      };
      cronMockState.articleCount = 2;

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.skipped).toBe(true);
      expect(data.reason).toBe('Rate limit reached');
    });

    test('should proceed when under rate limit', async () => {
      cronMockState.articleGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: true,
        currentDay: 1,
      };
      cronMockState.articleCount = 0;

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.skipped).toBe(false);
      expect(data.reason).not.toBe('Rate limit reached');
    });
  });

  describe('Response Structure', () => {
    test('should return rate limit info in response', async () => {
      cronMockState.articleGame = {
        id: 'game-123',
        isContinuous: true,
        isRunning: true,
        currentDay: 1,
      };
      cronMockState.articleCount = 1;

      const req = new NextRequest('http://localhost/api/cron/article-tick', {
        method: 'POST',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.skipped).toBe(false);

      expect(data.rateLimit).toBeDefined();
      expect(data.rateLimit.currentCount).toBe(1);
      expect(data.rateLimit.maxAllowed).toBe(2);
    });
  });
});
