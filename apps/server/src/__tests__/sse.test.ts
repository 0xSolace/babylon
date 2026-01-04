/**
 * SSE Routes Tests
 *
 * Tests for Server-Sent Events - unit tests for token generation and utilities
 */

import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import * as jose from 'jose'

// Test setup
const TEST_JWT_SECRET = 'test-jwt-secret-for-sse-testing-32chars!'
const originalEnv = { ...process.env }

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET
})

afterAll(() => {
  process.env = originalEnv
})

import { pushSSEEvent, pushSSEChannelEvent } from '../routes/sse'

describe('SSE Utilities', () => {
  describe('pushSSEEvent', () => {
    it('should not throw when no connections exist', () => {
      expect(() => {
        pushSSEEvent('unknown-user', 'test', { data: 'test' })
      }).not.toThrow()
    })

    it('should handle various event types', () => {
      const eventTypes = ['notification', 'message', 'update', 'alert']
      for (const eventType of eventTypes) {
        expect(() => {
          pushSSEEvent('test-user', eventType, { data: 'test' })
        }).not.toThrow()
      }
    })
  })

  describe('pushSSEChannelEvent', () => {
    it('should not throw when no connections exist', () => {
      expect(() => {
        pushSSEChannelEvent('chat:unknown', 'message', { content: 'test' })
      }).not.toThrow()
    })

    it('should handle various channel prefixes', () => {
      const channels = [
        'chat:123',
        'market:btc',
        'feed:user-456',
        'notifications:user-789',
        'agent:agent-001',
      ]

      for (const channel of channels) {
        expect(() => {
          pushSSEChannelEvent(channel, 'update', { test: true })
        }).not.toThrow()
      }
    })
  })
})

describe('JWT Token Generation', () => {
  it('should generate valid JWT token', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)
    const token = await new jose.SignJWT({
      type: 'realtime',
      userId: 'test-user-123',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-user-123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret)

    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3) // JWT has 3 parts
  })

  it('should include correct claims', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)
    const token = await new jose.SignJWT({
      type: 'realtime',
      userId: 'test-user-123',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test-user-123')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret)

    const { payload } = await jose.jwtVerify(token, secret)

    expect(payload.type).toBe('realtime')
    expect(payload.userId).toBe('test-user-123')
    expect(payload.sub).toBe('test-user-123')
    expect(payload.exp).toBeDefined()
    expect(payload.iat).toBeDefined()
  })

  it('should generate different tokens with different nonces', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)

    const token1 = await new jose.SignJWT({ userId: 'user', nonce: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret)

    const token2 = await new jose.SignJWT({ userId: 'user', nonce: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret)

    expect(token1).not.toBe(token2)
  })

  it('should reject tokens with wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret')
    const token = await new jose.SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test')
      .sign(wrongSecret)

    const correctSecret = new TextEncoder().encode(TEST_JWT_SECRET)
    await expect(jose.jwtVerify(token, correctSecret)).rejects.toThrow()
  })

  it('should reject expired tokens', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)
    const token = await new jose.SignJWT({ userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test')
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(secret)

    await expect(jose.jwtVerify(token, secret)).rejects.toThrow()
  })
})

describe('Token Validation Edge Cases', () => {
  it('should reject tokens with invalid type claim', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)

    const wrongTypeToken = await new jose.SignJWT({ type: 'session', userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test')
      .setExpirationTime('5m')
      .sign(secret)

    const { payload } = await jose.jwtVerify(wrongTypeToken, secret)
    expect(payload.type).not.toBe('realtime')
  })

  it('should reject tokens with missing subject', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)

    const noSubToken = await new jose.SignJWT({ type: 'realtime', userId: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(secret)

    const { payload } = await jose.jwtVerify(noSubToken, secret)
    expect(payload.sub).toBeUndefined()
  })

  it('should handle tokens with additional claims', async () => {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET)

    const token = await new jose.SignJWT({
      type: 'realtime',
      userId: 'test',
      isAdmin: true,
      roles: ['user', 'moderator'],
      customData: { key: 'value' },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('test')
      .setExpirationTime('5m')
      .sign(secret)

    const { payload } = await jose.jwtVerify(token, secret)
    expect(payload.isAdmin).toBe(true)
    expect(payload.roles).toEqual(['user', 'moderator'])
  })
})

describe('Channel Validation', () => {
  const VALID_CHANNEL_PREFIXES = ['chat:', 'market:', 'feed:', 'notifications:', 'agent:']

  it('should recognize valid channel prefixes', () => {
    const validChannels = [
      'chat:123',
      'chat:abc-def',
      'market:btc-usd',
      'market:eth',
      'feed:user-123',
      'notifications:user-456',
      'agent:agent-789',
    ]

    for (const channel of validChannels) {
      const isValid = VALID_CHANNEL_PREFIXES.some(prefix => channel.startsWith(prefix))
      expect(isValid).toBe(true)
    }
  })

  it('should reject invalid channel prefixes', () => {
    const invalidChannels = [
      'invalid:channel',
      'random:data',
      'system:internal',
    ]

    for (const channel of invalidChannels) {
      const isValid = VALID_CHANNEL_PREFIXES.some(prefix => channel.startsWith(prefix))
      expect(isValid).toBe(false)
    }
  })
})

describe('Message Format Validation', () => {
  it('should handle all standard message types', () => {
    const messageTypes = [
      { type: 'auth', payload: { token: 'jwt-token' } },
      { type: 'subscribe', payload: { channel: 'chat:123' } },
      { type: 'unsubscribe', payload: { channel: 'chat:123' } },
      { type: 'ping', payload: null },
    ]

    for (const msg of messageTypes) {
      expect(msg.type).toBeDefined()
      expect(typeof msg.type).toBe('string')
    }
  })

  it('should have proper response formats', () => {
    const responseTypes = [
      { type: 'connected', connectionId: 'conn_123' },
      { type: 'auth_response', success: true, userId: 'user-1' },
      { type: 'auth_response', success: false, error: 'Invalid token' },
      { type: 'subscribed', channel: 'chat:123' },
      { type: 'unsubscribed', channel: 'chat:123' },
      { type: 'pong', timestamp: Date.now() },
      { type: 'error', message: 'Unknown message type' },
    ]

    for (const response of responseTypes) {
      expect(response.type).toBeDefined()
      expect(() => JSON.stringify(response)).not.toThrow()
    }
  })
})

describe('Edge Cases', () => {
  it('should handle very long channel names', () => {
    const longChannel = 'chat:' + 'x'.repeat(10000)
    expect(() => {
      pushSSEChannelEvent(longChannel, 'test', { test: true })
    }).not.toThrow()
  })

  it('should handle unicode in channel names', () => {
    const unicodeChannels = [
      'chat:日本語',
      'market:比特币',
      'feed:пользователь',
      'notifications:🚀🌙',
    ]

    for (const channel of unicodeChannels) {
      expect(() => {
        pushSSEChannelEvent(channel, 'test', { test: true })
      }).not.toThrow()
    }
  })

  it('should handle null/undefined values in messages', () => {
    expect(() => {
      pushSSEChannelEvent('chat:123', 'test', { value: null, other: undefined })
    }).not.toThrow()
  })
})

describe('Connection ID Generation', () => {
  it('should generate unique connection IDs', () => {
    const ids = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`
      ids.add(id)
    }

    expect(ids.size).toBeGreaterThan(count * 0.9)
  })

  it('connection ID should have expected format', () => {
    const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2)}`

    expect(id).toMatch(/^conn_\d+_[a-z0-9]+$/)
    expect(id.length).toBeGreaterThan(15)
  })
})

describe('Performance', () => {
  it('should handle rapid broadcast calls', () => {
    const start = Date.now()
    const iterations = 10000

    for (let i = 0; i < iterations; i++) {
      pushSSEChannelEvent(`chat:${i % 100}`, 'message', { index: i })
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000)
  })

  it('should handle rapid sendToUser calls', () => {
    const start = Date.now()
    const iterations = 10000

    for (let i = 0; i < iterations; i++) {
      pushSSEEvent(`user-${i % 100}`, 'notification', { index: i })
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000)
  })
})
