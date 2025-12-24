/**
 * Load Test Simulator
 *
 * Core load testing infrastructure for simulating concurrent users
 * and measuring system performance under various load conditions.
 */

import { logger } from '@babylon/shared'

// Centralized port configuration
const BABYLON_API_PORT = process.env.BABYLON_API_PORT ?? '5009'

export interface EndpointConfig {
  /** API path to test */
  path: string
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Weight for endpoint selection (0-1, should sum to 1) */
  weight: number
  /** Optional request headers */
  headers?: Record<string, string>
  /** Optional request body */
  body?: unknown
}

export interface LoadTestConfig {
  /** Number of concurrent users to simulate */
  concurrentUsers: number
  /** Total test duration in seconds */
  durationSeconds: number
  /** Ramp-up time in seconds (optional) */
  rampUpSeconds?: number
  /** Think time between requests in ms (optional) */
  thinkTimeMs?: number
  /** Maximum requests per second (optional) */
  maxRps?: number
  /** Endpoints to test */
  endpoints: EndpointConfig[]
}

export interface ResponseTimeStats {
  min: number
  max: number
  mean: number
  median: number
  p95: number
  p99: number
}

export interface ThroughputStats {
  requestsPerSecond: number
  successRate: number
}

export interface EndpointStats {
  count: number
  successCount: number
  avgResponseTime: number
  errorCount: number
}

export interface LoadTestError {
  endpoint: string
  error: string
  count: number
}

export interface LoadTestResult {
  config: LoadTestConfig
  startTime: Date
  endTime: Date
  durationMs: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  responseTime: ResponseTimeStats
  throughput: ThroughputStats
  errors: LoadTestError[]
  endpointStats: Record<string, EndpointStats>
}

interface RequestResult {
  endpoint: string
  startTime: number
  endTime: number
  responseTime: number
  statusCode: number
}

export class LoadTestSimulator {
  private baseUrl: string
  private results: RequestResult[] = []
  private isRunning = false
  private startTime: Date = new Date()
  private errorCounts: Map<string, number> = new Map()

  constructor(baseUrl = `http://localhost:${BABYLON_API_PORT}`) {
    this.baseUrl = baseUrl
  }

  /**
   * Run a load test with the given configuration
   */
  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    this.results = []
    this.errorCounts = new Map()
    this.isRunning = true
    this.startTime = new Date()

    logger.info(
      'Starting load test',
      {
        concurrentUsers: config.concurrentUsers,
        duration: `${config.durationSeconds}s`,
        endpoints: config.endpoints.length,
      },
      'LoadTestSimulator',
    )

    const endTime = Date.now() + config.durationSeconds * 1000
    const workers: Promise<void>[] = []

    // Create worker promises for each concurrent user
    for (let i = 0; i < config.concurrentUsers; i++) {
      const worker = this.simulateUser(config, endTime, i)
      workers.push(worker)

      // Ramp-up: stagger worker starts
      if (config.rampUpSeconds && config.rampUpSeconds > 0) {
        const delayMs = (config.rampUpSeconds * 1000) / config.concurrentUsers
        await this.sleep(delayMs)
      }
    }

    // Wait for all workers to complete
    await Promise.all(workers)

    this.isRunning = false
    const testEndTime = new Date()

    // Analyze results
    const result = this.analyzeResults(config, testEndTime)

    logger.info(
      'Load test completed',
      {
        totalRequests: result.totalRequests,
        successRate: `${(result.throughput.successRate * 100).toFixed(2)}%`,
        avgResponseTime: `${result.responseTime.mean.toFixed(2)}ms`,
        p95ResponseTime: `${result.responseTime.p95.toFixed(2)}ms`,
      },
      'LoadTestSimulator',
    )

    return result
  }

  /**
   * Simulate a single user making requests
   */
  private async simulateUser(
    config: LoadTestConfig,
    endTime: number,
    _userId: number,
  ): Promise<void> {
    let requestCount = 0

    while (Date.now() < endTime && this.isRunning) {
      // Rate limiting
      if (config.maxRps) {
        const expectedRequests = Math.floor(
          ((Date.now() - this.startTime.getTime()) / 1000) * config.maxRps,
        )
        if (requestCount >= expectedRequests / config.concurrentUsers) {
          await this.sleep(10)
          continue
        }
      }

      // Select endpoint based on weights
      const endpoint = this.selectEndpoint(config.endpoints)

      // Make request
      await this.makeRequest(endpoint)
      requestCount++

      // Think time (simulate user reading/processing)
      if (config.thinkTimeMs) {
        await this.sleep(config.thinkTimeMs)
      }
    }
  }

  /**
   * Select an endpoint based on weights
   */
  private selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig {
    if (endpoints.length === 0) {
      throw new Error('No endpoints provided for load testing')
    }

    const rand = Math.random()
    let cumulative = 0

    for (const endpoint of endpoints) {
      cumulative += endpoint.weight
      if (rand <= cumulative) {
        return endpoint
      }
    }

    const lastEndpoint = endpoints[endpoints.length - 1]
    if (!lastEndpoint) {
      throw new Error('No endpoints available')
    }
    return lastEndpoint
  }

  /**
   * Make a request to an endpoint
   */
  private async makeRequest(endpoint: EndpointConfig): Promise<void> {
    const startTime = Date.now()
    const url = `${this.baseUrl}${endpoint.path}`

    const response = await fetch(url, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        ...endpoint.headers,
      },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    })

    const statusCode = response.status
    const success = response.ok

    if (!success) {
      const errorKey = `${endpoint.path}:${response.status}`
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1)
    }

    const responseTime = Date.now() - startTime

    this.results.push({
      endpoint: endpoint.path,
      startTime,
      endTime: Date.now(),
      responseTime,
      statusCode,
    })
  }

  /**
   * Analyze test results
   */
  private analyzeResults(
    config: LoadTestConfig,
    endTime: Date,
  ): LoadTestResult {
    const successfulResults = this.results.filter(
      (r) => r.statusCode >= 200 && r.statusCode < 300,
    )
    const responseTimes = successfulResults
      .map((r) => r.responseTime)
      .sort((a, b) => a - b)
    const durationMs = endTime.getTime() - this.startTime.getTime()

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    const medianIndex = Math.floor(responseTimes.length * 0.5)

    // Aggregate endpoint stats
    const endpointStats: Record<string, EndpointStats> = {}

    for (const result of this.results) {
      if (!endpointStats[result.endpoint]) {
        endpointStats[result.endpoint] = {
          count: 0,
          successCount: 0,
          avgResponseTime: 0,
          errorCount: 0,
        }
      }

      const stats = endpointStats[result.endpoint]
      if (!stats) {
        throw new Error(`Stats not found for endpoint: ${result.endpoint}`)
      }
      stats.count++

      const success = result.statusCode >= 200 && result.statusCode < 300
      if (success) {
        stats.successCount++
        stats.avgResponseTime =
          (stats.avgResponseTime * (stats.successCount - 1) +
            result.responseTime) /
          stats.successCount
      } else {
        stats.errorCount++
      }
    }

    // Aggregate errors
    const errors: LoadTestError[] = Array.from(this.errorCounts.entries()).map(
      ([key, count]) => {
        const parts = key.split(':')
        if (parts.length < 2) {
          throw new Error(`Invalid error key format: ${key}`)
        }
        const [endpoint, ...errorParts] = parts
        if (!endpoint) {
          throw new Error(`Invalid error key format: ${key}`)
        }
        return { endpoint, error: errorParts.join(':'), count }
      },
    )

    return {
      config,
      startTime: this.startTime,
      endTime,
      durationMs,
      totalRequests: this.results.length,
      successfulRequests: successfulResults.length,
      failedRequests: this.results.length - successfulResults.length,
      responseTime: {
        min: responseTimes[0] || 0,
        max: responseTimes[responseTimes.length - 1] || 0,
        mean:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
        median: responseTimes[medianIndex] || 0,
        p95: responseTimes[p95Index] || 0,
        p99: responseTimes[p99Index] || 0,
      },
      throughput: {
        requestsPerSecond: this.results.length / (durationMs / 1000),
        successRate:
          this.results.length > 0
            ? successfulResults.length / this.results.length
            : 0,
      },
      errors,
      endpointStats,
    }
  }

  /**
   * Stop the running test
   */
  stop(): void {
    this.isRunning = false
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Predefined test scenarios
 */
export const TEST_SCENARIOS = {
  /** Light load: 10 concurrent users, 30 second duration */
  LIGHT: {
    concurrentUsers: 10,
    durationSeconds: 30,
    rampUpSeconds: 5,
    thinkTimeMs: 1000,
    endpoints: [
      { path: '/api/stats', method: 'GET' as const, weight: 0.5 },
      { path: '/api/feed', method: 'GET' as const, weight: 0.3 },
      { path: '/api/health', method: 'GET' as const, weight: 0.2 },
    ],
  },

  /** Normal load: 50 concurrent users, 60 second duration */
  NORMAL: {
    concurrentUsers: 50,
    durationSeconds: 60,
    rampUpSeconds: 10,
    thinkTimeMs: 500,
    endpoints: [
      { path: '/api/stats', method: 'GET' as const, weight: 0.3 },
      { path: '/api/feed', method: 'GET' as const, weight: 0.3 },
      { path: '/api/posts', method: 'GET' as const, weight: 0.2 },
      { path: '/api/health', method: 'GET' as const, weight: 0.2 },
    ],
  },

  /** Heavy load: 200 concurrent users, 120 second duration */
  HEAVY: {
    concurrentUsers: 200,
    durationSeconds: 120,
    rampUpSeconds: 20,
    thinkTimeMs: 200,
    maxRps: 500,
    endpoints: [
      { path: '/api/stats', method: 'GET' as const, weight: 0.25 },
      { path: '/api/feed', method: 'GET' as const, weight: 0.25 },
      { path: '/api/posts', method: 'GET' as const, weight: 0.2 },
      { path: '/api/users', method: 'GET' as const, weight: 0.15 },
      { path: '/api/health', method: 'GET' as const, weight: 0.15 },
    ],
  },

  /** Stress test: 500 concurrent users, 60 second duration, no think time */
  STRESS: {
    concurrentUsers: 500,
    durationSeconds: 60,
    rampUpSeconds: 10,
    thinkTimeMs: 0,
    maxRps: 2000,
    endpoints: [
      { path: '/api/stats', method: 'GET' as const, weight: 0.3 },
      { path: '/api/feed', method: 'GET' as const, weight: 0.3 },
      { path: '/api/posts', method: 'GET' as const, weight: 0.2 },
      { path: '/api/health', method: 'GET' as const, weight: 0.2 },
    ],
  },
} as const
