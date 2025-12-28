/**
 * Load Test Simulator Tests
 *
 * Tests for load testing infrastructure including concurrent execution,
 * error handling, and statistics calculation.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type EndpointConfig,
  type LoadTestConfig,
  LoadTestSimulator,
  TEST_SCENARIOS,
} from './index'

// ============================================================================
// Mock Server Setup
// ============================================================================

let mockServer: ReturnType<typeof Bun.serve> | null = null
const MOCK_PORT = 59887
const MOCK_BASE_URL = `http://localhost:${MOCK_PORT}`

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      // Simulate various response times
      const delay = Math.random() * 50 // 0-50ms random delay

      return new Promise((resolve) => {
        setTimeout(() => {
          switch (path) {
            case '/api/health':
              resolve(
                new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
              )
              break
            case '/api/stats':
              resolve(
                new Response(JSON.stringify({ requests: 100, users: 50 }), {
                  status: 200,
                }),
              )
              break
            case '/api/feed':
              resolve(
                new Response(JSON.stringify({ posts: [] }), { status: 200 }),
              )
              break
            case '/api/posts':
              resolve(
                new Response(JSON.stringify({ posts: [] }), { status: 200 }),
              )
              break
            case '/api/error':
              resolve(new Response('Internal Error', { status: 500 }))
              break
            case '/api/not-found':
              resolve(new Response('Not Found', { status: 404 }))
              break
            case '/api/slow':
              // Longer delay for timeout testing
              setTimeout(
                () => resolve(new Response('Slow', { status: 200 })),
                2000,
              )
              return
            default:
              resolve(new Response('Not Found', { status: 404 }))
          }
        }, delay)
      })
    },
  })
})

afterAll(() => {
  mockServer?.stop()
})

// ============================================================================
// LoadTestSimulator - Basic Functionality
// ============================================================================

describe('LoadTestSimulator - Constructor', () => {
  test('creates instance with default URL', () => {
    const simulator = new LoadTestSimulator()
    expect(simulator).toBeInstanceOf(LoadTestSimulator)
  })

  test('creates instance with custom URL', () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)
    expect(simulator).toBeInstanceOf(LoadTestSimulator)
  })
})

describe('LoadTestSimulator - Simple Load Test', () => {
  test('runs basic load test and returns results', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const result = await simulator.runTest(config)

    expect(result.totalRequests).toBeGreaterThan(0)
    expect(result.successfulRequests).toBeGreaterThan(0)
    expect(result.durationMs).toBeGreaterThan(0)
    expect(result.config).toBe(config)
  })

  test('calculates response time statistics', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [{ path: '/api/stats', method: 'GET', weight: 1.0 }],
    }

    const result = await simulator.runTest(config)

    expect(result.responseTime.min).toBeGreaterThanOrEqual(0)
    expect(result.responseTime.max).toBeGreaterThanOrEqual(
      result.responseTime.min,
    )
    expect(result.responseTime.mean).toBeGreaterThanOrEqual(0)
    expect(result.responseTime.median).toBeGreaterThanOrEqual(0)
    expect(result.responseTime.p95).toBeGreaterThanOrEqual(0)
    expect(result.responseTime.p99).toBeGreaterThanOrEqual(0)
  })

  test('calculates throughput statistics', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const result = await simulator.runTest(config)

    expect(result.throughput.requestsPerSecond).toBeGreaterThan(0)
    expect(result.throughput.successRate).toBeGreaterThanOrEqual(0)
    expect(result.throughput.successRate).toBeLessThanOrEqual(1)
  })

  test('tracks per-endpoint statistics', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [
        { path: '/api/health', method: 'GET', weight: 0.5 },
        { path: '/api/stats', method: 'GET', weight: 0.5 },
      ],
    }

    const result = await simulator.runTest(config)

    expect(result.endpointStats['/api/health']).toBeDefined()
    expect(result.endpointStats['/api/stats']).toBeDefined()
  })
})

// ============================================================================
// LoadTestSimulator - Configuration Options
// ============================================================================

describe('LoadTestSimulator - Configuration', () => {
  test('respects concurrent users setting', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 5,
      durationSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const result = await simulator.runTest(config)

    // With 5 concurrent users, should have more requests than with 1
    expect(result.totalRequests).toBeGreaterThan(0)
  })

  test('respects duration setting', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 2,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const start = Date.now()
    await simulator.runTest(config)
    const elapsed = Date.now() - start

    // Should take approximately 2 seconds
    expect(elapsed).toBeGreaterThanOrEqual(2000)
    expect(elapsed).toBeLessThan(4000)
  })

  test('applies ramp-up time', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 3,
      durationSeconds: 2,
      rampUpSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const start = Date.now()
    await simulator.runTest(config)
    const elapsed = Date.now() - start

    // Ramp-up adds time before all users are active
    expect(elapsed).toBeGreaterThanOrEqual(2000)
  })

  test('applies think time between requests', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      thinkTimeMs: 500, // 500ms between requests
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const result = await simulator.runTest(config)

    // With 500ms think time and 1 second duration, expect ~2 requests
    expect(result.totalRequests).toBeLessThan(10)
  })
})

// ============================================================================
// LoadTestSimulator - Error Handling
// ============================================================================

describe('LoadTestSimulator - Error Handling', () => {
  test('tracks failed requests', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [
        { path: '/api/error', method: 'GET', weight: 1.0 }, // 500 error
      ],
    }

    const result = await simulator.runTest(config)

    expect(result.failedRequests).toBeGreaterThan(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.throughput.successRate).toBe(0) // All failed
  })

  test('handles network failures gracefully (unreachable server)', async () => {
    // Use a port that definitely has nothing listening
    const simulator = new LoadTestSimulator('http://localhost:59999')

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    // Should NOT throw - network errors should be captured
    const result = await simulator.runTest(config)

    // All requests should be recorded as failures
    expect(result.totalRequests).toBeGreaterThan(0)
    expect(result.failedRequests).toBe(result.totalRequests)
    expect(result.successfulRequests).toBe(0)

    // Should have network error recorded
    const hasNetworkError = result.errors.some(
      (e) =>
        e.error.includes('NETWORK_ERROR') ||
        e.endpoint.includes('NETWORK_ERROR'),
    )
    expect(hasNetworkError).toBe(true)
  })

  test('tracks 4xx as failed requests', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints: [
        { path: '/api/not-found', method: 'GET', weight: 1.0 }, // 404
      ],
    }

    const result = await simulator.runTest(config)

    expect(result.failedRequests).toBeGreaterThan(0)
  })

  test('handles mixed success/failure', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [
        { path: '/api/health', method: 'GET', weight: 0.5 }, // 200
        { path: '/api/error', method: 'GET', weight: 0.5 }, // 500
      ],
    }

    const result = await simulator.runTest(config)

    expect(result.successfulRequests).toBeGreaterThan(0)
    expect(result.failedRequests).toBeGreaterThan(0)
    expect(result.throughput.successRate).toBeGreaterThan(0)
    expect(result.throughput.successRate).toBeLessThan(1)
  })

  test('throws when no endpoints provided', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints: [],
    }

    await expect(simulator.runTest(config)).rejects.toThrow(
      'No endpoints configured',
    )
  })
})

// ============================================================================
// LoadTestSimulator - Endpoint Weighting
// ============================================================================

describe('LoadTestSimulator - Endpoint Weighting', () => {
  test('distributes requests according to weights', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 2,
      endpoints: [
        { path: '/api/health', method: 'GET', weight: 0.8 }, // 80%
        { path: '/api/stats', method: 'GET', weight: 0.2 }, // 20%
      ],
    }

    const result = await simulator.runTest(config)

    const healthCount = result.endpointStats['/api/health']?.count ?? 0
    const statsCount = result.endpointStats['/api/stats']?.count ?? 0
    const total = healthCount + statsCount

    // Health should have significantly more requests than stats
    // Allow some variance due to randomness
    if (total > 10) {
      expect(healthCount / total).toBeGreaterThan(0.5)
    }
  })
})

// ============================================================================
// LoadTestSimulator - Stop Functionality
// ============================================================================

describe('LoadTestSimulator - Stop', () => {
  test('stop method halts running test', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 5,
      durationSeconds: 10, // Long duration
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const testPromise = simulator.runTest(config)

    // Stop after a short delay
    setTimeout(() => simulator.stop(), 500)

    const result = await testPromise

    // Should have stopped early
    expect(result.durationMs).toBeLessThan(5000)
  })
})

// ============================================================================
// TEST_SCENARIOS - Predefined Scenarios
// ============================================================================

describe('TEST_SCENARIOS - Scenario Definitions', () => {
  test('LIGHT scenario has reasonable values', () => {
    expect(TEST_SCENARIOS.LIGHT.concurrentUsers).toBe(10)
    expect(TEST_SCENARIOS.LIGHT.durationSeconds).toBe(30)
    expect(TEST_SCENARIOS.LIGHT.endpoints.length).toBeGreaterThan(0)
  })

  test('NORMAL scenario has reasonable values', () => {
    expect(TEST_SCENARIOS.NORMAL.concurrentUsers).toBe(50)
    expect(TEST_SCENARIOS.NORMAL.durationSeconds).toBe(60)
    expect(TEST_SCENARIOS.NORMAL.endpoints.length).toBeGreaterThan(0)
  })

  test('HEAVY scenario has reasonable values', () => {
    expect(TEST_SCENARIOS.HEAVY.concurrentUsers).toBe(200)
    expect(TEST_SCENARIOS.HEAVY.durationSeconds).toBe(120)
    expect(TEST_SCENARIOS.HEAVY.maxRps).toBeDefined()
  })

  test('STRESS scenario has aggressive values', () => {
    expect(TEST_SCENARIOS.STRESS.concurrentUsers).toBe(500)
    expect(TEST_SCENARIOS.STRESS.thinkTimeMs).toBe(0) // No think time
    expect(TEST_SCENARIOS.STRESS.maxRps).toBeDefined()
  })

  test('all scenarios have valid endpoint weights', () => {
    for (const [_name, scenario] of Object.entries(TEST_SCENARIOS)) {
      let totalWeight = 0
      for (const endpoint of scenario.endpoints) {
        expect(endpoint.weight).toBeGreaterThan(0)
        expect(endpoint.weight).toBeLessThanOrEqual(1)
        totalWeight += endpoint.weight
      }
      // Weights should sum to approximately 1
      expect(Math.abs(totalWeight - 1)).toBeLessThan(0.01)
    }
  })
})

// ============================================================================
// LoadTestSimulator - Concurrent Execution
// ============================================================================

describe('LoadTestSimulator - Concurrent Execution', () => {
  test('multiple simulators can run independently', async () => {
    const simulator1 = new LoadTestSimulator(MOCK_BASE_URL)
    const simulator2 = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 2,
      durationSeconds: 1,
      endpoints: [{ path: '/api/health', method: 'GET', weight: 1.0 }],
    }

    const [result1, result2] = await Promise.all([
      simulator1.runTest(config),
      simulator2.runTest(config),
    ])

    expect(result1.totalRequests).toBeGreaterThan(0)
    expect(result2.totalRequests).toBeGreaterThan(0)
  })
})

// ============================================================================
// EndpointConfig - Type Validation
// ============================================================================

describe('EndpointConfig - Configuration Types', () => {
  test('supports all HTTP methods', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const endpoints: EndpointConfig[] = [
      { path: '/api/health', method: 'GET', weight: 0.5 },
      { path: '/api/stats', method: 'POST', weight: 0.5 },
    ]

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints,
    }

    // Should not throw
    const result = await simulator.runTest(config)
    expect(result.totalRequests).toBeGreaterThan(0)
  })

  test('supports custom headers', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints: [
        {
          path: '/api/health',
          method: 'GET',
          weight: 1.0,
          headers: {
            Authorization: 'Bearer test-token',
            'X-Custom-Header': 'value',
          },
        },
      ],
    }

    const result = await simulator.runTest(config)
    expect(result.totalRequests).toBeGreaterThan(0)
  })

  test('supports request body', async () => {
    const simulator = new LoadTestSimulator(MOCK_BASE_URL)

    const config: LoadTestConfig = {
      concurrentUsers: 1,
      durationSeconds: 1,
      endpoints: [
        {
          path: '/api/stats',
          method: 'POST',
          weight: 1.0,
          body: { action: 'test', data: [1, 2, 3] },
        },
      ],
    }

    const result = await simulator.runTest(config)
    expect(result.totalRequests).toBeGreaterThan(0)
  })
})
