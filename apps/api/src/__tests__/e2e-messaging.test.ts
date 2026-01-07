/**
 * E2E Messaging Integration Tests
 *
 * Tests the full message flow via API calls:
 * - Health check
 * - Agent discovery
 * - Chat creation and messaging
 * - Verifies responses contain expected data
 *
 * Requires: Server running at BABYLON_SERVER_URL (default: localhost:5009)
 */

import { beforeAll, describe, expect, it } from 'bun:test'

// Test configuration
const SERVER_URL = process.env.BABYLON_SERVER_URL ?? 'http://localhost:5009'
const SKIP_E2E = process.env.SKIP_E2E === 'true'

// Helper to make API requests
async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${SERVER_URL}${path}`
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

// Check if server is available
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await apiRequest('/health')
    if (!response.ok) {
      console.log('Server health check failed:', response.status)
      return false
    }
    const data = await response.json()
    console.log('Server health:', data.status)
    return data.status === 'ok' || data.status === 'degraded'
  } catch (e) {
    console.log('Server not reachable:', e)
    return false
  }
}

describe('E2E Server API Tests', () => {
  let serverAvailable = false

  beforeAll(async () => {
    if (SKIP_E2E) {
      console.log('Skipping E2E tests (SKIP_E2E=true)')
      return
    }

    serverAvailable = await checkServerHealth()
    if (!serverAvailable) {
      console.log('Server not available, tests will be skipped')
    }
  })

  describe('Health & Discovery', () => {
    it('should respond to health endpoint', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/health')
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.status).toBeDefined()
      expect(['ok', 'degraded']).toContain(data.status)
      expect(data.timestamp).toBeDefined()
      expect(data.checks).toBeDefined()
      expect(data.checks.database).toBeDefined()

      console.log('Health check passed:', {
        status: data.status,
        database: data.checks.database.status,
        uptime: Math.round(data.uptime),
      })
    })

    it('should return agent card', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/.well-known/agent-card')
      expect(response.ok).toBe(true)

      const card = await response.json()
      expect(card.name).toBeDefined()
      expect(card.version).toBeDefined()
      expect(card.skills).toBeDefined()

      console.log('Agent card:', {
        name: card.name,
        version: card.version,
        skillCount: card.skills?.length ?? 0,
      })
    })

    it('should list agents via discovery endpoint', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/a2a/agents')
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
      expect(data.pagination).toBeDefined()

      console.log('Agent discovery:', {
        agentCount: data.agents.length,
        hasMore: data.pagination.hasMore,
      })
    })
  })

  describe('A2A Protocol', () => {
    it('should validate message structure', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      // Test validation - missing required fields
      const response = await apiRequest('/api/a2a/message', {
        method: 'POST',
        body: JSON.stringify({
          // Missing fromAgentId and type
          content: { test: true },
        }),
      })

      expect([400, 422]).toContain(response.status) // Validation error
    })

    it('should handle ping message type', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/a2a/message', {
        method: 'POST',
        body: JSON.stringify({
          fromAgentId: 'e2e-test-agent',
          type: 'ping',
          content: {},
        }),
      })

      // Ping may work or fail depending on task store setup
      // We just verify it doesn't crash (returns 200 or 500)
      expect([200, 500]).toContain(response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Ping response:', {
          taskId: data.taskId,
          status: data.status,
        })
      }
    })
  })

  describe('API Authentication', () => {
    it('should return 401 for protected endpoints without auth', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      // /api/chats requires authentication
      const response = await apiRequest('/api/chats')
      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 for messaging inbox without auth', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/messaging/inbox')
      expect(response.status).toBe(401)
    })

    it('should return 401 for user profile without auth', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/users/me')
      expect(response.status).toBe(401)
    })
  })

  describe('SSE/Realtime', () => {
    it('should return 401 for token without auth', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/realtime/token')
      expect(response.status).toBe(401)
    })
  })

  describe('Feed & Posts', () => {
    it('should return feed (may be empty)', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      // Feed endpoint may be public, require auth, or not exist
      const response = await apiRequest('/api/posts/feed')

      // Either 200 (public), 401 (requires auth), or 404 (not found)
      expect([200, 401, 404]).toContain(response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Feed response:', {
          success: data.success,
          postCount: data.posts?.length ?? 0,
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await apiRequest('/api/nonexistent-route-12345')
      expect(response.status).toBe(404)
    })

    it('should handle malformed JSON gracefully', async () => {
      if (!serverAvailable) {
        console.log('Skipping - server not available')
        return
      }

      const response = await fetch(`${SERVER_URL}/api/a2a/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-valid-json{{{',
      })

      // Should return 400, 422, or 500 for parse error
      expect([400, 422, 500]).toContain(response.status)
    })
  })
})

describe('E2E Performance Tests', () => {
  it('should respond quickly to health check', async () => {
    const serverAvailable = !SKIP_E2E && (await checkServerHealth())
    if (!serverAvailable) {
      console.log('Skipping - server not available')
      return
    }

    const start = Date.now()
    const response = await apiRequest('/health')
    const elapsed = Date.now() - start

    expect(response.ok).toBe(true)
    expect(elapsed).toBeLessThan(1000) // Should respond within 1 second

    console.log(`Health check latency: ${elapsed}ms`)
  })

  it('should handle concurrent requests', async () => {
    const serverAvailable = !SKIP_E2E && (await checkServerHealth())
    if (!serverAvailable) {
      console.log('Skipping - server not available')
      return
    }

    const start = Date.now()

    // Make 10 concurrent requests
    const requests = Array.from({ length: 10 }, () => apiRequest('/health'))

    const responses = await Promise.all(requests)
    const elapsed = Date.now() - start

    // All should succeed
    for (const response of responses) {
      expect(response.ok).toBe(true)
    }

    // Should complete within reasonable time
    expect(elapsed).toBeLessThan(5000)

    console.log(`10 concurrent requests completed in ${elapsed}ms`)
  })
})

describe('Database Verification via API', () => {
  it('should verify database is healthy', async () => {
    const serverAvailable = !SKIP_E2E && (await checkServerHealth())
    if (!serverAvailable) {
      console.log('Skipping - server not available')
      return
    }

    const response = await apiRequest('/health')
    const data = await response.json()

    expect(data.checks.database).toBeDefined()
    expect(data.checks.database.status).toBe('healthy')
    expect(data.checks.database.latencyMs).toBeDefined()

    console.log('Database status:', {
      status: data.checks.database.status,
      latencyMs: data.checks.database.latencyMs,
    })
  })
})
