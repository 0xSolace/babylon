/**
 * Redis Client - Decentralized Cache Backend
 *
 * ALL caching routes through Jeju's decentralized cache.
 * NO FALLBACKS - Decentralized cache is required.
 *
 * This module provides Redis-compatible API using the decentralized cache.
 */

import { logger } from '@babylon/shared'
import { getRedis as getRedisFromImpl, type Redis } from './redis'

// Type for compatibility with existing code
export type RedisInstance = Redis

// Redis client state
let redisClient: Redis | null = null
let isInitialized = false
const isBuildTime = process.env.BUILD_PHASE === 'phase-production-build'

/**
 * Initialize Redis client (now using decentralized cache)
 */
async function initializeRedis(): Promise<void> {
  if (isBuildTime) {
    logger.debug('[Redis] Skipping initialization during build')
    return
  }

  if (isInitialized && redisClient) {
    return
  }

  logger.info('[Redis] Initializing decentralized Redis replacement')

  redisClient = await getRedisFromImpl()
  isInitialized = true

  logger.info('[Redis] Decentralized cache backend ready')
}

/**
 * Get or initialize Redis client
 */
export async function getRedis(): Promise<Redis> {
  if (!isInitialized || !redisClient) {
    await initializeRedis()
  }

  if (!redisClient) {
    throw new Error('[Redis] Decentralized cache is required but not available')
  }

  return redisClient
}

/**
 * Synchronous getter - throws if not initialized
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('[Redis] Client not initialized. Call getRedis() first.')
  }
  return redisClient
}

/**
 * Check if Redis (decentralized cache) is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getRedis()
    await client.ping()
    return true
  } catch {
    return false
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    isInitialized = false
    logger.info('[Redis] Connection closed')
  }
}

/**
 * Legacy alias for getRedis
 * @deprecated Use getRedis() instead
 */
export const redis = {
  async getInstance(): Promise<Redis> {
    return getRedis()
  },
}
