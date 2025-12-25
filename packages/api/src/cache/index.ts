/**
 * Cache Module Exports
 *
 * Decentralized cache using Jeju's distributed cache service.
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
} from './cache'

// Legacy aliases removed - use CacheClient, getCache, etc. directly

// Legacy exports removed - cache-service, cached-database-service, and decentralized-cache-client
// were all deleted. Use CacheClient and getCache from ./cache instead.
