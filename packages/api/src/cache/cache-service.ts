/**
 * Cache Service
 *
 * Decentralized caching layer using Jeju's distributed cache.
 * NO FALLBACKS - Decentralized cache is required.
 *
 * Features:
 * - Automatic TTL management
 * - Cache invalidation patterns
 * - IPFS-backed persistence
 * - Multi-node replication
 */

import { logger } from '@babylon/shared';
import {
  type DecentralizedCacheClient,
  initializeDecentralizedCache,
} from './decentralized-cache-client';

/** Cache options */
export interface CacheOptions {
  ttl?: number;
  namespace?: string;
}

/** Cache key prefixes */
export const CACHE_KEYS = {
  POST: 'post',
  POSTS_LIST: 'posts:list',
  POSTS_BY_ACTOR: 'posts:actor',
  POSTS_FOLLOWING: 'posts:following',
  USER: 'user',
  USER_BALANCE: 'user:balance',
  ACTOR: 'actor',
  ORGANIZATION: 'org',
  MARKET: 'market',
  MARKETS_LIST: 'markets:list',
  TRENDING_TAGS: 'trending:tags',
  WIDGET: 'widget',
} as const;

/** Default TTLs (seconds) */
export const DEFAULT_TTLS = {
  POSTS_LIST: 10,
  POSTS_FOLLOWING: 15,
  POST: 30,
  USER_BALANCE: 30,
  MARKET: 60,
  MARKETS_LIST: 60,
  USER: 300,
  TRENDING_TAGS: 300,
  WIDGET: 300,
  ACTOR: 3600,
  ORGANIZATION: 3600,
  POSTS_BY_ACTOR: 120,
} as const;

let cacheClient: DecentralizedCacheClient | null = null;
let initialized = false;

async function getClient(): Promise<DecentralizedCacheClient> {
  if (!initialized) {
    cacheClient = await initializeDecentralizedCache();
    initialized = true;
  }
  if (!cacheClient) {
    throw new Error('[Cache] Decentralized cache client not available.');
  }
  return cacheClient;
}

function buildKey(key: string, options: CacheOptions = {}): string {
  return options.namespace ? `${options.namespace}:${key}` : key;
}

export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const client = await getClient();
  const fullKey = buildKey(key, options);

  const value = await client.get<string>(fullKey);
  if (value === null) {
    logger.debug('Cache miss', { key: fullKey }, 'CacheService');
    return null;
  }

  logger.debug('Cache hit', { key: fullKey }, 'CacheService');

  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const client = await getClient();
  const fullKey = buildKey(key, options);
  const ttl = options.ttl || 300;

  const serialized = JSON.stringify(value);
  await client.set(fullKey, serialized, ttl);
  logger.debug('Cache set', { key: fullKey, ttl }, 'CacheService');
}

export async function invalidateCache(
  key: string,
  options: CacheOptions = {}
): Promise<void> {
  const client = await getClient();
  const fullKey = buildKey(key, options);

  await client.delete(fullKey);
  logger.debug('Cache invalidated', { key: fullKey }, 'CacheService');
}

export async function invalidateCachePattern(
  pattern: string,
  options: CacheOptions = {}
): Promise<void> {
  const client = await getClient();
  const fullPattern = buildKey(pattern, options);

  const deleted = await client.deletePattern(fullPattern);
  logger.info(
    'Cache pattern invalidated',
    { pattern: fullPattern, count: deleted },
    'CacheService'
  );
}

export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await getCache<T>(key, options);
  if (cached !== null) return cached;

  logger.debug('Fetching data for cache', { key }, 'CacheService');
  const data = await fetchFn();
  await setCache(key, data, options);
  return data;
}

/** Alias for setCache - pre-populate cache with known data */
export const warmCache = setCache;

export async function getCacheStats() {
  const client = await getClient();
  const stats = await client.getStats();

  return {
    totalEntries: stats.totalKeys,
    hitRate: stats.hitRate,
    hits: stats.hitCount,
    misses: stats.missCount,
    memoryUsed: stats.memoryUsed,
  };
}

export async function clearAllCache(): Promise<void> {
  logger.warn('Clearing all cache', undefined, 'CacheService');
  const client = await getClient();
  await client.flush();
}

export async function cacheExists(
  key: string,
  options: CacheOptions = {}
): Promise<boolean> {
  const client = await getClient();
  const fullKey = buildKey(key, options);
  return client.exists(fullKey);
}

export async function cacheTTL(
  key: string,
  options: CacheOptions = {}
): Promise<number> {
  const client = await getClient();
  const fullKey = buildKey(key, options);
  return client.ttl(fullKey);
}

export async function cacheIncr(
  key: string,
  by = 1,
  options: CacheOptions = {}
): Promise<number> {
  const client = await getClient();
  const fullKey = buildKey(key, options);
  return client.incr(fullKey, by);
}

export async function cacheDecr(
  key: string,
  by = 1,
  options: CacheOptions = {}
): Promise<number> {
  const client = await getClient();
  const fullKey = buildKey(key, options);
  return client.decr(fullKey, by);
}

/** Initialize the cache service - call at app startup */
export async function initializeCacheService(): Promise<void> {
  await getClient();
  logger.info('Cache service initialized', undefined, 'CacheService');
}

/** Shutdown the cache service */
export function shutdownCacheService(): void {
  cacheClient = null;
  initialized = false;
  logger.info('Cache service shutdown', undefined, 'CacheService');
}
