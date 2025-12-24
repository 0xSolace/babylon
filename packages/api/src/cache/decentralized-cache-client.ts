/**
 * Client for Jeju's decentralized cache service.
 * Uses real Jeju cache API endpoints from /jeju/apps/storage/cache-service
 */

import { logger, toNull } from '@babylon/shared'
import {
  isCacheEntriesResponse,
  isCacheGetResponse,
  isCacheHealthResponse,
  isCacheKeysResponse,
  isCacheSuccessResponse,
  isCacheTtlResponse,
  isJejuCacheStatsResponse,
  toError,
} from '../utils/type-guards'

/** Retry configuration */
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 100

/** Retry a function with exponential backoff for transient failures */
async function withRetry<T>(
  fn: () => Promise<T>,
  _operation: string,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = toError(err)
      const isRetryable =
        lastError.message.includes('fetch failed') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('socket hang up')
      if (!isRetryable || attempt === retries - 1) throw lastError
      const backoff = INITIAL_BACKOFF_MS * 2 ** attempt
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
  throw lastError
}

export interface DecentralizedCacheConfig {
  serviceUrl: string
  defaultTTL: number
  namespace: string
  logging: boolean
}

export interface CacheStats {
  totalKeys: number
  memoryUsed: number
  hitCount: number
  missCount: number
  hitRate: number
}

export class DecentralizedCacheClient {
  private config: DecentralizedCacheConfig
  private initialized = false

  constructor(config: DecentralizedCacheConfig) {
    if (!config.serviceUrl) {
      throw new Error('[Cache] serviceUrl required')
    }
    this.config = {
      ...config,
      defaultTTL: config.defaultTTL || 3600,
      namespace: config.namespace || 'babylon',
      logging: config.logging ?? false,
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    if (!(await this.healthCheck())) {
      throw new Error('[Cache] Service unavailable')
    }
    this.initialized = true
  }

  async healthCheck(): Promise<boolean> {
    return withRetry(
      async () => {
        const response = await fetch(`${this.config.serviceUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return false
        const data: unknown = await response.json()
        if (!isCacheHealthResponse(data)) return false
        return data.status === 'healthy'
      },
      'healthCheck',
      2, // Fewer retries for health check
    ).catch(() => false)
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.ensureInitialized()
    return withRetry(async () => {
      const response = await fetch(
        `${this.config.serviceUrl}/cache/get?key=${encodeURIComponent(key)}&namespace=${encodeURIComponent(this.config.namespace)}`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (!response.ok)
        throw new Error(`[Cache] GET failed: ${response.status}`)
      const data: unknown = await response.json()
      if (!isCacheGetResponse<T>(data)) {
        throw new Error('[Cache] Invalid GET response')
      }
      if (this.config.logging)
        logger.debug(`[Cache] ${data.found ? 'HIT' : 'MISS'}: ${key}`)
      return data.found ? data.value : null
    }, 'get')
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.ensureInitialized()
    return withRetry(async () => {
      const response = await fetch(`${this.config.serviceUrl}/cache/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          ttl: ttlSeconds ?? this.config.defaultTTL,
          namespace: this.config.namespace,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok)
        throw new Error(`[Cache] SET failed: ${response.status}`)
    }, 'set')
  }

  async delete(key: string): Promise<boolean> {
    this.ensureInitialized()
    const response = await fetch(
      `${this.config.serviceUrl}/cache/delete?key=${encodeURIComponent(key)}&namespace=${encodeURIComponent(this.config.namespace)}`,
      { method: 'DELETE', signal: AbortSignal.timeout(5000) },
    )
    if (!response.ok)
      throw new Error(`[Cache] DELETE failed: ${response.status}`)
    const data: unknown = await response.json()
    if (!isCacheSuccessResponse(data)) {
      throw new Error('[Cache] Invalid DELETE response')
    }
    return data.success
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  async ttl(key: string): Promise<number> {
    this.ensureInitialized()
    const response = await fetch(
      `${this.config.serviceUrl}/cache/ttl?key=${encodeURIComponent(key)}&namespace=${encodeURIComponent(this.config.namespace)}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!response.ok) throw new Error(`[Cache] TTL failed: ${response.status}`)
    const data: unknown = await response.json()
    if (!isCacheTtlResponse(data)) {
      throw new Error('[Cache] Invalid TTL response')
    }
    return data.ttl
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.ensureInitialized()
    const response = await fetch(`${this.config.serviceUrl}/cache/expire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        ttl: ttlSeconds,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const data: unknown = await response.json()
    return isCacheSuccessResponse(data) && data.success
  }

  async incr(key: string, by = 1): Promise<number> {
    const current = await this.get<string>(key)
    const value = (parseInt(current ?? '0', 10) || 0) + by
    await this.set(key, value.toString())
    return value
  }

  async decr(key: string, by = 1): Promise<number> {
    return this.incr(key, -by)
  }

  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    this.ensureInitialized()
    const response = await fetch(`${this.config.serviceUrl}/cache/mget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, namespace: this.config.namespace }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return Promise.all(keys.map((k) => this.get<T>(k)))
    const data: unknown = await response.json()
    if (!isCacheEntriesResponse<T>(data)) {
      return Promise.all(keys.map((k) => this.get<T>(k)))
    }
    return keys.map((k) => toNull(data.entries[k]))
  }

  async mset(
    pairs: Record<string, unknown>,
    ttlSeconds?: number,
  ): Promise<void> {
    this.ensureInitialized()
    const ttl = ttlSeconds ?? this.config.defaultTTL
    const entries = Object.entries(pairs).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      ttl,
    }))
    const response = await fetch(`${this.config.serviceUrl}/cache/mset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, namespace: this.config.namespace }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      await Promise.all(
        Object.entries(pairs).map(([k, v]) => this.set(k, v, ttl)),
      )
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    this.ensureInitialized()
    let url = `${this.config.serviceUrl}/cache/keys?namespace=${encodeURIComponent(this.config.namespace)}`
    if (pattern) url += `&pattern=${encodeURIComponent(pattern)}`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`[Cache] KEYS failed: ${response.status}`)
    const data: unknown = await response.json()
    if (!isCacheKeysResponse(data)) {
      throw new Error('[Cache] Invalid KEYS response')
    }
    return data.keys
  }

  async deletePattern(pattern: string): Promise<number> {
    const matchingKeys = await this.keys(pattern)
    if (matchingKeys.length === 0) return 0
    const results = await Promise.all(
      matchingKeys.map((key) => this.delete(key)),
    )
    return results.filter(Boolean).length
  }

  async flush(): Promise<void> {
    this.ensureInitialized()
    const response = await fetch(
      `${this.config.serviceUrl}/cache/clear?namespace=${encodeURIComponent(this.config.namespace)}`,
      { method: 'DELETE', signal: AbortSignal.timeout(30000) },
    )
    if (!response.ok)
      throw new Error(`[Cache] FLUSH failed: ${response.status}`)
  }

  async getStats(): Promise<CacheStats> {
    this.ensureInitialized()
    const response = await fetch(`${this.config.serviceUrl}/stats`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok)
      throw new Error(`[Cache] STATS failed: ${response.status}`)
    const data: unknown = await response.json()
    if (!isJejuCacheStatsResponse(data)) {
      throw new Error('[Cache] Invalid STATS response')
    }
    const { stats } = data
    return {
      totalKeys: stats.totalKeys,
      memoryUsed: stats.usedMemoryMb * 1024 * 1024,
      hitCount: stats.hits,
      missCount: stats.misses,
      hitRate: stats.hitRate,
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('[Cache] Not initialized')
  }
}

let cacheClient: DecentralizedCacheClient | null = null

export function getDecentralizedCacheClient(): DecentralizedCacheClient {
  if (cacheClient) return cacheClient
  const serviceUrl = process.env.JEJU_CACHE_SERVICE_URL
  if (!serviceUrl) throw new Error('[Cache] JEJU_CACHE_SERVICE_URL not set')
  cacheClient = new DecentralizedCacheClient({
    serviceUrl,
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL ?? '3600', 10),
    namespace: process.env.CACHE_NAMESPACE ?? 'babylon',
    logging: process.env.CACHE_LOGGING === 'true',
  })
  return cacheClient
}

export async function initializeDecentralizedCache(): Promise<DecentralizedCacheClient> {
  const client = getDecentralizedCacheClient()
  await client.initialize()
  return client
}

export function resetDecentralizedCacheClient(): void {
  cacheClient = null
}

export function isDecentralizedCacheAvailable(): boolean {
  return !!process.env.JEJU_CACHE_SERVICE_URL
}

/**
 * Check if the cache service is actually reachable
 */
export async function isCacheServiceReachable(): Promise<boolean> {
  const url = process.env.JEJU_CACHE_SERVICE_URL
  if (!url) return false
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Try to initialize cache, return null if unavailable
 */
export async function tryInitializeCache(): Promise<DecentralizedCacheClient | null> {
  const reachable = await isCacheServiceReachable()
  if (!reachable) return null
  const client = getDecentralizedCacheClient()
  await client.initialize()
  return client
}
