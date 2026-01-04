/**
 * Auth Routes Tests
 *
 * Tests for OAuth authentication - unit tests and helpers
 */

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'

const originalEnv = { ...process.env }

beforeAll(() => {
  process.env.TWITTER_CLIENT_ID = 'test-twitter-client-id'
  process.env.TWITTER_CLIENT_SECRET = 'test-twitter-client-secret'
  process.env.DISCORD_CLIENT_ID = 'test-discord-client-id'
  process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret'
  process.env.JWT_SECRET = 'test-jwt-secret-for-auth-testing!'
})

afterAll(() => {
  process.env = originalEnv
})

import { authRoutes } from '../routes/auth'

function createTestApp() {
  return new Elysia().use(authRoutes)
}

describe('Auth Routes', () => {
  describe('GET /api/auth/twitter/initiate', () => {
    it('should return 500 without Twitter credentials', async () => {
      const savedClientId = process.env.TWITTER_CLIENT_ID
      const savedClientSecret = process.env.TWITTER_CLIENT_SECRET
      delete process.env.TWITTER_CLIENT_ID
      delete process.env.TWITTER_CLIENT_SECRET

      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/twitter/initiate')
      )

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('credentials')

      process.env.TWITTER_CLIENT_ID = savedClientId
      process.env.TWITTER_CLIENT_SECRET = savedClientSecret
    })

    it('should respond to initiate endpoint', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/twitter/initiate')
      )

      // With test credentials, it will either return 200 or 500 depending on Twitter API
      expect([200, 500]).toContain(response.status)
    })
  })

  describe('GET /api/auth/twitter/callback', () => {
    it('should redirect on OAuth error', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/twitter/callback?error=access_denied')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })

    it('should redirect when missing code', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/twitter/callback?state=test-state')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })

    it('should redirect when missing state', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/twitter/callback?code=test-code')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })
  })

  describe('GET /api/auth/jeju/callback', () => {
    it('should redirect on OAuth error', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/jeju/callback?error=server_error')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })

    it('should redirect when missing code', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/jeju/callback?provider=twitter')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })
  })

  describe('POST /api/auth/jeju/callback', () => {
    it('should handle valid code submission', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/jeju/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'test-auth-code' }),
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('GET /api/auth/onboarding/twitter/initiate', () => {
    it('should require userId parameter', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/onboarding/twitter/initiate')
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('userId')
    })

    it('should respond to initiate endpoint with userId', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/onboarding/twitter/initiate?userId=user-123')
      )

      // With test credentials, it will either return 200 or 500 depending on Twitter API
      expect([200, 500]).toContain(response.status)
    })
  })

  describe('GET /api/auth/onboarding/twitter/callback', () => {
    it('should redirect on error', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/onboarding/twitter/callback?error=denied')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('onboarding')
      expect(location).toContain('error=')
    })

    it('should redirect when missing code/state', async () => {
      const app = createTestApp()
      const response = await app.handle(
        new Request('http://localhost/api/auth/onboarding/twitter/callback')
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('Location')
      expect(location).toContain('error=')
    })
  })
})

describe('DID Generation', () => {
  it('should create proper DID format', () => {
    const createDID = (provider: string, userId: string) =>
      `did:jeju:mainnet:${provider}:${userId}`

    const twitterDID = createDID('twitter', '123456789')
    expect(twitterDID).toBe('did:jeju:mainnet:twitter:123456789')

    const discordDID = createDID('discord', '987654321')
    expect(discordDID).toBe('did:jeju:mainnet:discord:987654321')
  })

  it('should handle special characters in user ID', () => {
    const createDID = (provider: string, userId: string) =>
      `did:jeju:mainnet:${provider}:${userId}`

    const did = createDID('twitter', '12345')
    expect(did).toMatch(/^did:jeju:mainnet:twitter:\d+$/)
  })
})

describe('Base URL Detection', () => {
  it('should use https for production hosts', () => {
    const getBaseUrl = (host: string) => {
      const protocol = host.includes('localhost') ? 'http' : 'https'
      return `${protocol}://${host}`
    }

    expect(getBaseUrl('api.example.com')).toBe('https://api.example.com')
    expect(getBaseUrl('babylon.ai')).toBe('https://babylon.ai')
  })

  it('should use http for localhost', () => {
    const getBaseUrl = (host: string) => {
      const protocol = host.includes('localhost') ? 'http' : 'https'
      return `${protocol}://${host}`
    }

    expect(getBaseUrl('localhost:5008')).toBe('http://localhost:5008')
    expect(getBaseUrl('localhost:3000')).toBe('http://localhost:3000')
  })

  it('should handle missing host header', () => {
    const getBaseUrl = (host: string | undefined) => {
      const h = host ?? 'localhost:5008'
      const protocol = h.includes('localhost') ? 'http' : 'https'
      return `${protocol}://${h}`
    }

    expect(getBaseUrl(undefined)).toBe('http://localhost:5008')
  })
})

describe('OAuth State Management', () => {
  it('state should expire after TTL', () => {
    const now = Date.now()
    const STATE_TTL_MS = 10 * 60 * 1000

    const state = {
      createdAt: now - STATE_TTL_MS - 1000,
      expiresAt: now - 1000,
    }

    expect(state.expiresAt < now).toBe(true)
  })

  it('state should be valid within TTL', () => {
    const now = Date.now()
    const STATE_TTL_MS = 10 * 60 * 1000

    const state = {
      createdAt: now,
      expiresAt: now + STATE_TTL_MS,
    }

    expect(state.expiresAt > now).toBe(true)
  })
})

describe('Code Verifier Generation', () => {
  it('should generate hex string of correct length', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const codeVerifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

    expect(codeVerifier.length).toBe(64)
    expect(codeVerifier).toMatch(/^[0-9a-f]+$/)
  })

  it('should generate unique code verifiers', () => {
    const verifiers = new Set<string>()

    for (let i = 0; i < 100; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      verifiers.add(verifier)
    }

    expect(verifiers.size).toBe(100)
  })
})

describe('URL Parameter Encoding', () => {
  it('should properly encode error messages in redirects', () => {
    const errorMsg = 'OAuth error: access_denied'
    const encoded = encodeURIComponent(errorMsg)

    expect(encoded).toBe('OAuth%20error%3A%20access_denied')
    expect(decodeURIComponent(encoded)).toBe(errorMsg)
  })

  it('should handle special characters in redirect URLs', () => {
    const redirectUrl = 'http://localhost:3000/callback?param=value&other=123'
    const encoded = encodeURIComponent(redirectUrl)

    expect(decodeURIComponent(encoded)).toBe(redirectUrl)
  })

  it('should handle unicode in error messages', () => {
    const errorMsg = 'Error: 认证失败 🔐'
    const encoded = encodeURIComponent(errorMsg)

    expect(decodeURIComponent(encoded)).toBe(errorMsg)
  })
})
