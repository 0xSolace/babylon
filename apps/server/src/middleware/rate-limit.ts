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

/**
 * In-memory rate limit store
 * TODO: Replace with Redis-backed store for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Check and update rate limit for a key
 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt < now) {
    const resetAt = now + config.window
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }

  if (existing.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count++
  return {
    allowed: true,
    remaining: config.limit - existing.count,
    resetAt: existing.resetAt,
  }
}

/**
 * Create rate limit middleware for a specific limit type
 */
export function createRateLimiter(type: keyof typeof RATE_LIMITS = 'default') {
  const config: RateLimitConfig = RATE_LIMITS[type] || RATE_LIMITS.default

  return new Elysia({ name: `rate-limit-${type}` }).onBeforeHandle(
    ({ set, headers }) => {
      // Use IP address or auth token as rate limit key
      const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'
      const authHeader = headers.authorization
      const auth = authHeader ? authHeader.slice(0, 20) : ''
      const key = `${type}:${ip}:${auth}`

      const result = checkRateLimit(key, config)

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
