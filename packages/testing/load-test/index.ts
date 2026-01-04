/**
 * Load Testing Utilities for Babylon
 */

export * from './a2a-load-test-scenarios'

export interface EndpointConfig {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  weight: number
  headers?: Record<string, string>
  body?: unknown
}

export interface LoadTestConfig {
  concurrentUsers: number
  durationSeconds: number
  rampUpSeconds?: number
  thinkTimeMs?: number
  maxRps?: number
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
  responseTime: number
  statusCode: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class LoadTestSimulator {
  private baseUrl: string
  private results: RequestResult[] = []
  private isRunning = false
  private startTime = new Date()
  private errorCounts = new Map<string, number>()

  constructor(
    baseUrl = `http://localhost:${process.env.BABYLON_API_PORT ?? '5009'}`,
  ) {
    this.baseUrl = baseUrl
  }

  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    this.results = []
    this.errorCounts.clear()
    this.isRunning = true
    this.startTime = new Date()

    console.log(
      `[Load Test] ${config.concurrentUsers} users, ${config.durationSeconds}s`,
    )

    const deadline = Date.now() + config.durationSeconds * 1000
    const workers: Promise<void>[] = []
    const rampDelay = config.rampUpSeconds
      ? (config.rampUpSeconds * 1000) / config.concurrentUsers
      : 0

    for (let i = 0; i < config.concurrentUsers; i++) {
      workers.push(this.simulateUser(config, deadline))
      if (rampDelay) await sleep(rampDelay)
    }

    await Promise.all(workers)
    this.isRunning = false

    const result = this.analyzeResults(config, new Date())
    console.log(
      `[Load Test] Done: ${result.totalRequests} reqs, ${(result.throughput.successRate * 100).toFixed(1)}% success, ${result.responseTime.p95.toFixed(0)}ms p95`,
    )
    return result
  }

  private async simulateUser(
    config: LoadTestConfig,
    deadline: number,
  ): Promise<void> {
    let requestCount = 0
    while (Date.now() < deadline && this.isRunning) {
      if (config.maxRps) {
        const elapsed = (Date.now() - this.startTime.getTime()) / 1000
        const expected = Math.floor(
          (elapsed * config.maxRps) / config.concurrentUsers,
        )
        if (requestCount >= expected) {
          await sleep(10)
          continue
        }
      }

      await this.makeRequest(this.selectEndpoint(config.endpoints))
      requestCount++

      if (config.thinkTimeMs) await sleep(config.thinkTimeMs)
    }
  }

  private selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig {
    if (endpoints.length === 0) throw new Error('No endpoints configured')
    const rand = Math.random()
    let cumulative = 0
    for (const ep of endpoints) {
      cumulative += ep.weight
      if (rand <= cumulative) return ep
    }
    const last = endpoints[endpoints.length - 1]
    if (!last) throw new Error('No endpoints configured')
    return last
  }

  private async makeRequest(endpoint: EndpointConfig): Promise<void> {
    const start = Date.now()
    let statusCode: number

    const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json', ...endpoint.headers },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    }).catch(() => {
      const key = `${endpoint.path}:NETWORK_ERROR`
      this.errorCounts.set(key, (this.errorCounts.get(key) ?? 0) + 1)
      return null
    })

    if (response === null) {
      statusCode = 0
    } else {
      statusCode = response.status
      if (!response.ok) {
        const key = `${endpoint.path}:${response.status}`
        this.errorCounts.set(key, (this.errorCounts.get(key) ?? 0) + 1)
      }
    }

    this.results.push({
      endpoint: endpoint.path,
      responseTime: Date.now() - start,
      statusCode,
    })
  }

  private analyzeResults(
    config: LoadTestConfig,
    endTime: Date,
  ): LoadTestResult {
    const successful = this.results.filter(
      (r) => r.statusCode >= 200 && r.statusCode < 300,
    )
    const times = successful.map((r) => r.responseTime).sort((a, b) => a - b)
    const durationMs = endTime.getTime() - this.startTime.getTime()

    const percentile = (arr: number[], p: number) =>
      arr[Math.floor(arr.length * p)] ?? 0
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

    const endpointStats: Record<string, EndpointStats> = {}
    for (const r of this.results) {
      if (!endpointStats[r.endpoint]) {
        endpointStats[r.endpoint] = {
          count: 0,
          successCount: 0,
          avgResponseTime: 0,
          errorCount: 0,
        }
      }
      const stats = endpointStats[r.endpoint]
      if (!stats) {
        throw new Error(`Expected stats for endpoint ${r.endpoint}`)
      }
      stats.count++
      const ok = r.statusCode >= 200 && r.statusCode < 300
      if (ok) {
        stats.avgResponseTime =
          (stats.avgResponseTime * stats.successCount + r.responseTime) /
          (stats.successCount + 1)
        stats.successCount++
      } else {
        stats.errorCount++
      }
    }

    const errors: LoadTestError[] = [...this.errorCounts.entries()].map(
      ([key, count]) => {
        const [endpoint, ...rest] = key.split(':')
        return { endpoint: endpoint ?? key, error: rest.join(':'), count }
      },
    )

    return {
      config,
      startTime: this.startTime,
      endTime,
      durationMs,
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: this.results.length - successful.length,
      responseTime: {
        min: times[0] ?? 0,
        max: times[times.length - 1] ?? 0,
        mean: times.length ? sum(times) / times.length : 0,
        median: percentile(times, 0.5),
        p95: percentile(times, 0.95),
        p99: percentile(times, 0.99),
      },
      throughput: {
        requestsPerSecond: this.results.length / (durationMs / 1000),
        successRate: this.results.length
          ? successful.length / this.results.length
          : 0,
      },
      errors,
      endpointStats,
    }
  }

  stop(): void {
    this.isRunning = false
  }
}

export const TEST_SCENARIOS = {
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
