/**
 * Tests for API fetch URL rewriting
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  resetGlobalFetch,
  rewriteApiUrl,
  setupGlobalFetch,
} from '../api-fetch';

// Mock window.location for testing
const mockWindow = {
  location: {
    origin: 'https://babylon.market',
    protocol: 'https:',
    host: 'babylon.market',
    hostname: 'babylon.market',
  },
};

describe('rewriteApiUrl', () => {
  beforeEach(() => {
    // @ts-expect-error - mocking window
    global.window = mockWindow;
    // Clear any environment variables
    process.env.NEXT_PUBLIC_API_BASE_URL = '';
  });

  afterEach(() => {
    // @ts-expect-error - cleaning up mock
    delete global.window;
    resetGlobalFetch();
  });

  it('should not rewrite non-API URLs', () => {
    expect(rewriteApiUrl('/some/path')).toBe('/some/path');
    expect(rewriteApiUrl('https://example.com/api/data')).toBe(
      'https://example.com/api/data'
    );
  });

  it('should rewrite /api/ URLs', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market';
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts'
    );
  });

  it('should rewrite /a2a URLs', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market';
    expect(rewriteApiUrl('/a2a/endpoint')).toBe(
      'https://api.babylon.market/a2a/endpoint'
    );
  });

  it('should rewrite /mcp URLs', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market';
    expect(rewriteApiUrl('/mcp')).toBe('https://api.babylon.market/mcp');
  });

  it('should not double /api prefix when base URL ends with /api', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market/api';
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts'
    );
  });

  it('should not rewrite when base URL is same origin', () => {
    // When API base is same as current origin, don't rewrite
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://babylon.market';
    expect(rewriteApiUrl('/api/posts')).toBe('/api/posts');
  });

  it('should handle server-side (no window)', () => {
    // @ts-expect-error - testing no window
    delete global.window;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market';
    expect(rewriteApiUrl('/api/posts')).toBe(
      'https://api.babylon.market/api/posts'
    );
  });
});

describe('setupGlobalFetch', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    // @ts-expect-error - mocking window
    global.window = {
      ...mockWindow,
      fetch: originalFetch,
    };
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.babylon.market';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    // @ts-expect-error - cleaning up mock
    delete global.window;
    resetGlobalFetch();
  });

  it('should not patch fetch when window is undefined', () => {
    // @ts-expect-error - testing no window
    delete global.window;
    setupGlobalFetch();
    // Should not throw
    expect(true).toBe(true);
  });

  it('should only patch once', () => {
    // @ts-expect-error - adding fetch to mock window
    global.window.fetch = mock(() => Promise.resolve(new Response()));

    setupGlobalFetch();
    const firstFetch = (global.window as typeof window).fetch;

    setupGlobalFetch();
    const secondFetch = (global.window as typeof window).fetch;

    expect(firstFetch).toBe(secondFetch);
  });
});
