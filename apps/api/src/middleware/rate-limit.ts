import { type CacheClient, getCacheClient } from '@jejunetwork/shared'
import { Elysia } from 'elysia'

/**
 * Rate limit configuration per endpoint type
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  window: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { limit: 100, window: 60_000 }, // 100 req/min
  auth: { limit: 10, window: 60_000 }, // 10 req/min for auth
  heavy: { limit: 20, window: 60_000 }, // 20 req/min for heavy operations
  realtime: { limit: 200, window: 60_000 }, // 200 req/min for realtime
}

// Distributed rate limit cache
let rateLimitCache: CacheClient | null = null

function getRateLimitCache(): CacheClient {
  if (!rateLimitCache) {
    rateLimitCache = getCacheClient('babylon-ratelimit')
  }
  return rateLimitCache
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Check and update rate limit for a key
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const cache = getRateLimitCache()
  const now = Date.now()
  const cacheKey = `ratelimit:${key}`
  const ttlSeconds = Math.ceil(config.window / 1000)

  const cached = await cache.get(cacheKey)
  if (cached) {
    const existing: RateLimitEntry = JSON.parse(cached)
    if (existing.resetAt > now) {
      if (existing.count >= config.limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt }
      }
      existing.count++
      await cache.set(cacheKey, JSON.stringify(existing), ttlSeconds)
      return {
        allowed: true,
        remaining: config.limit - existing.count,
        resetAt: existing.resetAt,
      }
    }
  }

  // New window
  const resetAt = now + config.window
  const entry: RateLimitEntry = { count: 1, resetAt }
  await cache.set(cacheKey, JSON.stringify(entry), ttlSeconds)
  return { allowed: true, remaining: config.limit - 1, resetAt }
}

/**
 * Create rate limit middleware for a specific limit type
 */
export function createRateLimiter(type: keyof typeof RATE_LIMITS = 'default') {
  const config: RateLimitConfig = RATE_LIMITS[type] || RATE_LIMITS.default

  return new Elysia({ name: `rate-limit-${type}` }).onBeforeHandle(
    async ({ set, headers }) => {
      // Use IP address or auth token as rate limit key
      const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'
      const authHeader = headers.authorization
      const auth = authHeader ? authHeader.slice(0, 20) : ''
      const key = `${type}:${ip}:${auth}`

      const result = await checkRateLimit(key, config)

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(config.limit)
      set.headers['X-RateLimit-Remaining'] = String(result.remaining)
      set.headers['X-RateLimit-Reset'] = String(
        Math.ceil(result.resetAt / 1000),
      )

      if (!result.allowed) {
        set.status = 429
        return {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        }
      }
    },
  )
}

/**
 * Default rate limiter
 */
export const rateLimitMiddleware = createRateLimiter('default')

/**
 * Auth-specific rate limiter (stricter)
 */
export const authRateLimiter = createRateLimiter('auth')

/**
 * Heavy operation rate limiter
 */
export const heavyRateLimiter = createRateLimiter('heavy')
