/**
 * Cache Module Exports
 *
 * Decentralized cache using Jeju's distributed cache service.
 * NO FALLBACKS - Decentralized cache is required.
 */

// Cache (primary cache layer)
export {
  CacheClient,
  type CacheConfig,
  type CacheStats,
  cacheDel,
  cacheExists,
  cacheGet,
  cacheSet,
  getCache,
  initializeCache,
  resetCache,
} from './cache';

// Legacy aliases removed - use CacheClient, getCache, etc. directly

// Legacy exports (retained for compatibility with existing code)
export * from './cache-service';
export * from './cached-database-service';
export * from './decentralized-cache-client';
