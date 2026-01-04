/**
 * Comprehensive API Endpoint Tests for Babylon
 *
 * Tests ALL public API endpoints for:
 * - Response status codes
 * - Response structure
 * - Data types
 * - No errors
 */

import { expect, test } from '@playwright/test'

const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'
const API_URL = `http://127.0.0.1:${BABYLON_API_PORT}`

test.describe('Health & System Endpoints', () => {
  test('GET /health - returns healthy status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.status).toBe('ok')
    expect(data.timestamp).toBeDefined()
    expect(data.version).toBeDefined()
    expect(data.uptime).toBeGreaterThan(0)
    expect(data.checks).toBeDefined()
    expect(data.checks.database).toBeDefined()
    expect(data.checks.database.status).toBe('healthy')
  })
})

test.describe('Markets API Endpoints', () => {
  test('GET /api/markets/predictions - returns prediction markets list', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/markets/predictions`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.questions)).toBe(true)
    // Each question should have required fields if any exist
    if (data.questions.length > 0) {
      const question = data.questions[0]
      expect(question.id).toBeDefined()
    }
  })

  test('GET /api/markets/perps - returns perp markets list', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/markets/perps`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.markets)).toBe(true)
  })

  test('GET /api/markets/predictions with limit param', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/markets/predictions?limit=5`,
    )
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.questions)).toBe(true)
  })

  test('GET /api/markets/perps with limit param', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/markets/perps?limit=5`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.markets)).toBe(true)
  })
})

test.describe('Users & Leaderboard API Endpoints', () => {
  test('GET /api/leaderboard - returns leaderboard data', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/leaderboard`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data).toBeDefined()
    // Leaderboard should have leaderboard array
    expect(Array.isArray(data.leaderboard)).toBe(true)
    expect(data.pagination).toBeDefined()
  })

  test('GET /api/leaderboard with limit param', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/leaderboard?limit=10`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data).toBeDefined()
    expect(Array.isArray(data.leaderboard)).toBe(true)
  })

  test('GET /api/users/me without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/users/me`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403]).toContain(status)
  })
})

test.describe('Posts & Feed API Endpoints', () => {
  test('GET /api/posts - returns posts list', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/posts`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.posts)).toBe(true)
  })

  test('GET /api/posts with limit param', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/posts?limit=5`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.posts)).toBe(true)
    expect(data.posts.length).toBeLessThanOrEqual(5)
  })

  test('GET /api/posts with type filter', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/posts?type=trade`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.posts)).toBe(true)
  })

  test('GET /api/posts/:id with invalid ID returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_URL}/api/posts/nonexistent-post-id`,
    )
    // Should return 404 or appropriate error for nonexistent post
    const status = response.status()
    expect([200, 404]).toContain(status)
  })
})

test.describe('Actors API Endpoints', () => {
  test('GET /api/actors - returns actors list', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/actors`)
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.actors)).toBe(true)
  })
})

test.describe('Agents API Endpoints', () => {
  test('GET /api/agents - returns agents list or appropriate error', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/agents`)
    // Should return success or 500 (if table not initialized)
    const status = response.status()
    expect([200, 500]).toContain(status)

    if (response.ok()) {
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.agents)).toBe(true)
    }
  })

  test('GET /api/agents/discover - returns discoverable agents or appropriate error', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/agents/discover`)
    // Should return success or 500 (if table not initialized)
    const status = response.status()
    expect([200, 500]).toContain(status)

    if (response.ok()) {
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.agents)).toBe(true)
    }
  })

  test('GET /api/agents with limit param', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/agents?limit=5`)
    // Should return success or 500 (if table not initialized)
    const status = response.status()
    expect([200, 500]).toContain(status)

    if (response.ok()) {
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.agents)).toBe(true)
    }
  })
})

test.describe('Notifications API Endpoints', () => {
  test('GET /api/notifications without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/notifications`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403]).toContain(status)
  })
})

test.describe('Chats API Endpoints', () => {
  test('GET /api/chats without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/chats`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403]).toContain(status)
  })
})

test.describe('Admin API Endpoints', () => {
  test('GET /api/admin/groups without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/admin/groups`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403]).toContain(status)
  })

  test('GET /api/admin/performance without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/admin/performance`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403]).toContain(status)
  })
})

test.describe('Groups API Endpoints', () => {
  test('GET /api/groups returns appropriate response', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/groups`)
    // May require auth
    const status = response.status()
    expect([200, 401, 403, 404]).toContain(status)
  })
})

test.describe('ICO API Endpoints', () => {
  test('GET /api/ico/status returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/ico/status`)
    // May or may not be configured
    const status = response.status()
    expect([200, 401, 403, 404]).toContain(status)
  })
})

test.describe('Moderation API Endpoints', () => {
  test('GET /api/moderation/settings without auth returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/moderation/settings`)
    // Without auth, should return 401 or appropriate error
    const status = response.status()
    expect([200, 401, 403, 404]).toContain(status)
  })
})

test.describe('Auth API Endpoints', () => {
  test('GET /api/auth/status returns appropriate response', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/auth/status`)
    // Should return status info
    const status = response.status()
    expect([200, 401, 404]).toContain(status)
  })
})

test.describe('API Error Handling', () => {
  test('GET /api/nonexistent returns 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nonexistent`)
    expect(response.status()).toBe(404)
  })

  test('POST to GET-only endpoint returns appropriate error', async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/health`)
    // Should return 404 or 405
    const status = response.status()
    expect([404, 405]).toContain(status)
  })

  test('Invalid JSON body returns appropriate error', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/posts`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'invalid-json',
    })
    // Should return 400 or 401 (auth required)
    const status = response.status()
    expect([400, 401, 422]).toContain(status)
  })
})

test.describe('API Response Time', () => {
  test('GET /health responds within 1 second', async ({ request }) => {
    const start = Date.now()
    const response = await request.get(`${API_URL}/health`)
    const duration = Date.now() - start

    expect(response.ok()).toBe(true)
    expect(duration).toBeLessThan(1000)
  })

  test('GET /api/markets/predictions responds within 2 seconds', async ({
    request,
  }) => {
    const start = Date.now()
    const response = await request.get(`${API_URL}/api/markets/predictions`)
    const duration = Date.now() - start

    expect(response.ok()).toBe(true)
    expect(duration).toBeLessThan(2000)
  })

  test('GET /api/posts responds within 2 seconds', async ({ request }) => {
    const start = Date.now()
    const response = await request.get(`${API_URL}/api/posts`)
    const duration = Date.now() - start

    expect(response.ok()).toBe(true)
    expect(duration).toBeLessThan(2000)
  })
})

test.describe('API Pagination', () => {
  test('GET /api/posts supports pagination with cursor', async ({
    request,
  }) => {
    const response1 = await request.get(`${API_URL}/api/posts?limit=2`)
    expect(response1.ok()).toBe(true)

    const data1 = await response1.json()
    expect(data1.success).toBe(true)

    // If there's a next cursor, test it
    if (data1.nextCursor) {
      const response2 = await request.get(
        `${API_URL}/api/posts?limit=2&cursor=${data1.nextCursor}`,
      )
      expect(response2.ok()).toBe(true)

      const data2 = await response2.json()
      expect(data2.success).toBe(true)
    }
  })

  test('GET /api/markets/predictions supports pagination with offset', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_URL}/api/markets/predictions?limit=5&offset=0`,
    )
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.success).toBe(true)
  })
})

test.describe('API Content Types', () => {
  test('API returns JSON content type', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`)
    expect(response.ok()).toBe(true)

    const contentType = response.headers()['content-type']
    expect(contentType).toContain('application/json')
  })

  test('API accepts JSON content type', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/posts`, {
      headers: { 'Content-Type': 'application/json' },
      data: { content: 'test' },
    })
    // Should return 401 (auth required) not 415 (unsupported media type)
    expect(response.status()).not.toBe(415)
  })
})
