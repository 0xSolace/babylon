/**
 * Redis Module Exports
 *
 * ALL caching routes through Jeju's decentralized cache.
 * This module provides Redis-compatible API using the decentralized cache.
 * NO FALLBACKS - Decentralized cache is required.
 */

export {
  closeRedis,
  getRedis,
  getRedisClient,
  isRedisAvailable,
  type RedisInstance,
  redis,
} from './client'
// Decentralized Redis replacement - export class and types, reset only (getRedis comes from client)
export { Redis, type RedisCompatibleClient, resetRedis } from './redis'
export { type StreamMessage, streamAdd, streamRead } from './streams'
