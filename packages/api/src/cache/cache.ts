/**
 * Decentralized Cache Layer
 *
 * ALL caching routes through Jeju Compute's decentralized cache.
 * NO FALLBACKS - Decentralized cache is required.
 *
 * This replaces Redis as the caching layer.
 */

import { logger } from '@babylon/shared';

// Types from Jeju cache service (inline to avoid import issues)
interface CacheSetRequest {
  key: string;
  value: string;
  ttl?: number;
  namespace?: string;
}

interface CacheBatchSetRequest {
  entries: Array<{ key: string; value: string; ttl?: number }>;
  namespace?: string;
}

interface CacheBatchGetRequest {
  keys: string[];
  namespace?: string;
}

interface JejuCacheStats {
  totalInstances: number;
  activeInstances: number;
  totalMemoryMb: number;
  usedMemoryMb: number;
  totalKeys: number;
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  serviceUrl: string;
  namespace: string;
  defaultTTL: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface CacheStats {
  totalKeys: number;
  memoryUsedBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

// ============================================================================
// Decentralized Cache Client
// ============================================================================

class CacheClient {
  private config: CacheConfig;
  private initialized = false;

  constructor() {
    const serviceUrl = process.env.JEJU_CACHE_SERVICE_URL;
    if (!serviceUrl) {
      throw new Error(
        '[Cache] JEJU_CACHE_SERVICE_URL is required. ' +
          'Decentralized cache is mandatory - no Redis fallback.'
      );
    }

    this.config = {
      serviceUrl,
      namespace: process.env.CACHE_NAMESPACE ?? 'babylon',
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL ?? '3600', 10),
      maxRetries: parseInt(process.env.CACHE_MAX_RETRIES ?? '3', 10),
      retryDelayMs: parseInt(process.env.CACHE_RETRY_DELAY_MS ?? '100', 10),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const healthy = await this.healthCheck();
    if (!healthy) {
      throw new Error(
        `[Cache] Cache service at ${this.config.serviceUrl} is not healthy. ` +
          'Start Jeju services: cd /path/to/jeju && bun run dev'
      );
    }

    logger.info(
      '[Cache] Connected to Jeju Cache',
      { url: this.config.serviceUrl },
      'Cache'
    );
    this.initialized = true;
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[Cache] Cache not initialized. Call initialize() first.'
      );
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          `[Cache] Retrying ${operation} (${attempt}/${this.config.maxRetries})`,
          { delay, error: errorMessage },
          'Cache'
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.withRetry(fn, operation, attempt + 1);
      }
      throw error;
    }
  }

  private prefixKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.requireInitialized();
    const fullKey = this.prefixKey(key);

    return this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/get?key=${encodeURIComponent(fullKey)}&namespace=${encodeURIComponent(this.config.namespace)}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.status === 404) return null;
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GET failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as {
        value: T | null;
        found: boolean;
      };
      return data.found ? data.value : null;
    }, `GET ${key}`);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.requireInitialized();
    const fullKey = this.prefixKey(key);
    const ttl = ttlSeconds ?? this.config.defaultTTL;

    const body: CacheSetRequest = {
      key: fullKey,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      ttl,
      namespace: this.config.namespace,
    };

    await this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/cache/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`SET failed (${response.status}): ${text}`);
      }
    }, `SET ${key}`);
  }

  async delete(key: string): Promise<boolean> {
    this.requireInitialized();
    const fullKey = this.prefixKey(key);

    return this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/delete?key=${encodeURIComponent(fullKey)}&namespace=${encodeURIComponent(this.config.namespace)}`,
        { method: 'DELETE', signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`DELETE failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { success: boolean };
      return data.success;
    }, `DELETE ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async ttl(key: string): Promise<number> {
    this.requireInitialized();
    const fullKey = this.prefixKey(key);

    return this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/ttl?key=${encodeURIComponent(fullKey)}&namespace=${encodeURIComponent(this.config.namespace)}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`TTL failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { ttl: number };
      return data.ttl;
    }, `TTL ${key}`);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.requireInitialized();
    const fullKey = this.prefixKey(key);

    return this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/cache/expire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: fullKey,
          ttl: ttlSeconds,
          namespace: this.config.namespace,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`EXPIRE failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { success: boolean };
      return data.success;
    }, `EXPIRE ${key}`);
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    this.requireInitialized();
    const fullKeys = keys.map((k) => this.prefixKey(k));

    const body: CacheBatchGetRequest = {
      keys: fullKeys,
      namespace: this.config.namespace,
    };

    return this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/cache/mget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MGET failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as {
        entries: Record<string, T | null>;
      };
      return keys.map((k) => data.entries[this.prefixKey(k)] ?? null);
    }, `MGET ${keys.length} keys`);
  }

  async mset(
    pairs: Record<string, unknown>,
    ttlSeconds?: number
  ): Promise<void> {
    this.requireInitialized();
    const ttl = ttlSeconds ?? this.config.defaultTTL;

    const entries = Object.entries(pairs).map(([k, v]) => ({
      key: this.prefixKey(k),
      value: typeof v === 'string' ? v : JSON.stringify(v),
      ttl,
    }));

    const body: CacheBatchSetRequest = {
      entries,
      namespace: this.config.namespace,
    };

    await this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/cache/mset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MSET failed (${response.status}): ${text}`);
      }
    }, `MSET ${entries.length} keys`);
  }

  // ============================================================================
  // Pattern Operations
  // ============================================================================

  async keys(pattern: string): Promise<string[]> {
    this.requireInitialized();
    const fullPattern = this.prefixKey(pattern);

    return this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/keys?namespace=${encodeURIComponent(this.config.namespace)}&pattern=${encodeURIComponent(fullPattern)}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`KEYS failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as { keys: string[] };
      const prefix = `${this.config.namespace}:`;
      return data.keys.map((k) =>
        k.startsWith(prefix) ? k.slice(prefix.length) : k
      );
    }, `KEYS ${pattern}`);
  }

  async deletePattern(pattern: string): Promise<number> {
    const matchingKeys = await this.keys(pattern);
    const results = await Promise.all(
      matchingKeys.map((key) => this.delete(key))
    );
    return results.filter(Boolean).length;
  }

  async flush(): Promise<void> {
    this.requireInitialized();

    await this.withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/clear?namespace=${encodeURIComponent(this.config.namespace)}`,
        { method: 'DELETE', signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`FLUSH failed (${response.status}): ${text}`);
      }
    }, 'FLUSH');
  }

  // ============================================================================
  // Atomic Operations (emulated)
  // ============================================================================

  async incr(key: string, by = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const newValue = current + by;
    await this.set(key, newValue);
    return newValue;
  }

  async decr(key: string, by = 1): Promise<number> {
    return this.incr(key, -by);
  }

  // ============================================================================
  // Stats
  // ============================================================================

  async getStats(): Promise<CacheStats> {
    this.requireInitialized();

    return this.withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/stats`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`STATS failed (${response.status}): ${text}`);
      }

      const jejuStats = (await response.json()) as { stats: JejuCacheStats };
      return {
        totalKeys: jejuStats.stats.totalKeys,
        memoryUsedBytes: jejuStats.stats.usedMemoryMb * 1024 * 1024,
        hitCount: jejuStats.stats.hits,
        missCount: jejuStats.stats.misses,
        hitRate: jejuStats.stats.hitRate,
      };
    }, 'getStats');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let cacheInstance: CacheClient | null = null;

export function getCache(): CacheClient {
  if (!cacheInstance) {
    cacheInstance = new CacheClient();
  }
  return cacheInstance;
}

export async function initializeCache(): Promise<CacheClient> {
  const cache = getCache();
  await cache.initialize();
  return cache;
}

export function resetCache(): void {
  cacheInstance = null;
}

// ============================================================================
// Convenience Functions (drop-in Redis replacements)
// ============================================================================

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cache = getCache();
  if (!cache.isInitialized()) await cache.initialize();
  return cache.get<T>(key);
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttl?: number
): Promise<void> {
  const cache = getCache();
  if (!cache.isInitialized()) await cache.initialize();
  return cache.set(key, value, ttl);
}

export async function cacheDel(key: string): Promise<boolean> {
  const cache = getCache();
  if (!cache.isInitialized()) await cache.initialize();
  return cache.delete(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const cache = getCache();
  if (!cache.isInitialized()) await cache.initialize();
  return cache.exists(key);
}

export { CacheClient };
