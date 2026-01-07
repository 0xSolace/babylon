/**
 * Unit Tests: NFT Image Proxy Logic
 *
 * Tests the REAL validation functions from @babylon/shared:
 * - Token ID validation (isValidTokenId)
 * - Image proxy URL generation (getNftImageProxyUrl)
 *
 * Also tests caching and rate limiting logic patterns
 * that would be used by the image proxy endpoint.
 *
 * Run with: bun test unit/nft-image-proxy.test.ts
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { getNftImageProxyUrl, isValidTokenId } from '@babylon/shared';

describe('NFT Image Proxy - Token ID Validation (Real Implementation)', () => {
  describe('isValidTokenId', () => {
    test('should accept token ID 1', () => {
      expect(isValidTokenId(1)).toBe(true);
    });

    test('should accept token ID 100', () => {
      expect(isValidTokenId(100)).toBe(true);
    });

    test('should accept token ID 50', () => {
      expect(isValidTokenId(50)).toBe(true);
    });

    test('should reject token ID 0', () => {
      expect(isValidTokenId(0)).toBe(false);
    });

    test('should reject token ID 101 (default collection size)', () => {
      expect(isValidTokenId(101)).toBe(false);
    });

    test('should reject negative token ID', () => {
      expect(isValidTokenId(-1)).toBe(false);
    });

    test('should accept string token ID', () => {
      expect(isValidTokenId('50')).toBe(true);
    });

    test('should reject non-numeric string', () => {
      expect(isValidTokenId('abc')).toBe(false);
    });

    test('should reject float', () => {
      expect(isValidTokenId(50.5)).toBe(false);
    });

    test('should respect custom collection size', () => {
      expect(isValidTokenId(150, 200)).toBe(true);
      expect(isValidTokenId(201, 200)).toBe(false);
    });
  });
});

describe('NFT Image Proxy - URL Generation (Real Implementation)', () => {
  describe('getNftImageProxyUrl', () => {
    test('should generate correct proxy URL for token 1', () => {
      expect(getNftImageProxyUrl(1)).toBe('/api/nft/image/1');
    });

    test('should generate correct proxy URL for token 50', () => {
      expect(getNftImageProxyUrl(50)).toBe('/api/nft/image/50');
    });

    test('should generate correct proxy URL for token 100', () => {
      expect(getNftImageProxyUrl(100)).toBe('/api/nft/image/100');
    });
  });
});

describe('NFT Image Proxy - Caching Logic Patterns', () => {
  // These test the caching patterns that would be used by the image proxy
  // The actual cache is implemented in the route handler

  interface CacheEntry {
    buffer: ArrayBuffer;
    contentType: string;
    cachedAt: number;
  }

  class ImageCache {
    private cache = new Map<number, CacheEntry>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize = 100, ttlMs = 3600000) {
      this.maxSize = maxSize;
      this.ttlMs = ttlMs;
    }

    get(tokenId: number): CacheEntry | undefined {
      const entry = this.cache.get(tokenId);
      if (!entry) return undefined;
      if (this.isExpired(entry)) {
        this.cache.delete(tokenId);
        return undefined;
      }
      return entry;
    }

    set(tokenId: number, buffer: ArrayBuffer, contentType: string): void {
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }
      this.cache.set(tokenId, {
        buffer,
        contentType,
        cachedAt: Date.now(),
      });
    }

    private isExpired(entry: CacheEntry): boolean {
      return Date.now() - entry.cachedAt > this.ttlMs;
    }

    private evictOldest(): void {
      let oldestKey: number | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.cachedAt < oldestTime) {
          oldestTime = entry.cachedAt;
          oldestKey = key;
        }
      }
      if (oldestKey !== null) {
        this.cache.delete(oldestKey);
      }
    }

    size(): number {
      return this.cache.size;
    }

    clear(): void {
      this.cache.clear();
    }
  }

  test('should return undefined for cache miss', () => {
    const cache = new ImageCache();
    expect(cache.get(1)).toBeUndefined();
  });

  test('should return entry for cache hit', () => {
    const cache = new ImageCache();
    const buffer = new ArrayBuffer(8);
    cache.set(1, buffer, 'image/png');
    const entry = cache.get(1);
    expect(entry).toBeDefined();
    expect(entry?.contentType).toBe('image/png');
  });

  test('should evict oldest entry when max size reached', () => {
    const cache = new ImageCache(3, 3600000);
    cache.set(1, new ArrayBuffer(8), 'image/png');
    cache.set(2, new ArrayBuffer(8), 'image/png');
    cache.set(3, new ArrayBuffer(8), 'image/png');
    expect(cache.size()).toBe(3);

    cache.set(4, new ArrayBuffer(8), 'image/png');
    expect(cache.size()).toBe(3);
    expect(cache.get(1)).toBeUndefined(); // Evicted
    expect(cache.get(4)).toBeDefined(); // Added
  });

  test('should expire entries after TTL', async () => {
    const cache = new ImageCache(100, 50); // 50ms TTL
    cache.set(1, new ArrayBuffer(8), 'image/png');
    expect(cache.get(1)).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cache.get(1)).toBeUndefined(); // Expired
  });
});

describe('NFT Image Proxy - Rate Limiting Patterns', () => {
  // These test the rate limiting patterns that would be used by the image proxy

  class RateLimiter {
    private requests = new Map<string, { count: number; resetAt: number }>();
    private windowMs: number;
    private maxRequests: number;

    constructor(windowMs = 60000, maxRequests = 100) {
      this.windowMs = windowMs;
      this.maxRequests = maxRequests;
    }

    isLimited(key: string): boolean {
      const now = Date.now();
      const entry = this.requests.get(key);

      if (!entry || now > entry.resetAt) {
        this.requests.set(key, {
          count: 1,
          resetAt: now + this.windowMs,
        });
        return false;
      }

      if (entry.count >= this.maxRequests) {
        return true;
      }

      entry.count++;
      return false;
    }

    reset(key: string): void {
      this.requests.delete(key);
    }
  }

  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(60000, 5);
  });

  test('should allow first request', () => {
    expect(limiter.isLimited('ip1')).toBe(false);
  });

  test('should allow requests up to limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited('ip1')).toBe(false);
    }
  });

  test('should block requests over limit', () => {
    for (let i = 0; i < 5; i++) {
      limiter.isLimited('ip1');
    }
    expect(limiter.isLimited('ip1')).toBe(true);
  });

  test('should track different IPs separately', () => {
    for (let i = 0; i < 5; i++) {
      limiter.isLimited('ip1');
    }
    expect(limiter.isLimited('ip1')).toBe(true);
    expect(limiter.isLimited('ip2')).toBe(false);
  });

  test('should reset after window expires', async () => {
    const shortLimiter = new RateLimiter(50, 2); // 50ms window
    shortLimiter.isLimited('ip1');
    shortLimiter.isLimited('ip1');
    expect(shortLimiter.isLimited('ip1')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(shortLimiter.isLimited('ip1')).toBe(false);
  });
});

describe('NFT Image Proxy - Response Headers', () => {
  function getProxyHeaders(
    contentType: string,
    cacheStatus: 'HIT' | 'MISS'
  ): Record<string, string> {
    return {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000',
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
      'X-Cache': cacheStatus,
    };
  }

  test('should include correct content type', () => {
    const headers = getProxyHeaders('image/png', 'HIT');
    expect(headers['Content-Type']).toBe('image/png');
  });

  test('should include cache headers for CDN', () => {
    const headers = getProxyHeaders('image/png', 'HIT');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
    expect(headers['Cache-Control']).toContain('immutable');
  });

  test('should include Vercel CDN headers', () => {
    const headers = getProxyHeaders('image/png', 'HIT');
    expect(headers['Vercel-CDN-Cache-Control']).toBeDefined();
  });

  test('should include X-Cache header', () => {
    expect(getProxyHeaders('image/png', 'HIT')['X-Cache']).toBe('HIT');
    expect(getProxyHeaders('image/png', 'MISS')['X-Cache']).toBe('MISS');
  });
});

describe('NFT Image Proxy - GitHub URL Construction', () => {
  const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';
  const NFT_FOLDER = 'NFT Protomonkeys';

  function buildGitHubApiUrl(tokenId: number): string {
    const filePath = `${NFT_FOLDER}/images/${tokenId}.png`;
    return `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)}`;
  }

  function buildGitHubRawUrl(tokenId: number): string {
    return `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${NFT_FOLDER}/images/${tokenId}.png`;
  }

  test('should build correct GitHub API URL', () => {
    const url = buildGitHubApiUrl(1);
    expect(url).toContain('api.github.com');
    expect(url).toContain(GITHUB_REPO);
    expect(url).toContain('1.png');
  });

  test('should URL encode file path', () => {
    const url = buildGitHubApiUrl(50);
    expect(url).toContain(encodeURIComponent('NFT Protomonkeys/images/50.png'));
  });

  test('should build correct raw GitHub URL', () => {
    const url = buildGitHubRawUrl(100);
    expect(url).toContain('raw.githubusercontent.com');
    expect(url).toContain(GITHUB_REPO);
    expect(url).toContain('100.png');
  });
});
