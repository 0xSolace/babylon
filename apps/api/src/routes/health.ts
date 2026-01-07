import { getDB } from '@babylon/db'
import { Elysia, t } from 'elysia'

/**
 * Health check response schema
 */
const HealthCheckSchema = t.Object({
  status: t.Union([
    t.Literal('ok'),
    t.Literal('degraded'),
    t.Literal('unhealthy'),
  ]),
  timestamp: t.String(),
  env: t.Optional(t.String()),
  version: t.String(),
  uptime: t.Number(),
  checks: t.Record(
    t.String(),
    t.Object({
      status: t.String(),
      latencyMs: t.Number(),
      message: t.Optional(t.String()),
    }),
  ),
  totalLatencyMs: t.Number(),
  keepalive: t.Object({
    jnsName: t.String(),
    agentId: t.String(),
    vaultAddress: t.Nullable(t.String()),
  }),
})

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs: number
  message?: string
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  const check: HealthCheck = {
    name: 'database',
    status: 'unhealthy',
    latencyMs: 0,
  }

  try {
    const db = getDB()
    const healthy = await db.isHealthy()
    check.latencyMs = Date.now() - start

    if (healthy) {
      check.status = check.latencyMs < 100 ? 'healthy' : 'degraded'
      if (check.latencyMs > 100) {
        check.message = 'High latency'
      }
    } else {
      check.message = 'Connection failed'
    }
  } catch {
    check.latencyMs = Date.now() - start
    check.message = 'Connection failed'
  }

  return check
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now()
  const check: HealthCheck = {
    name: 'redis',
    status: 'healthy',
    latencyMs: 0,
  }

  // Use DWS cache endpoint (same as what CacheClient uses)
  const dwsEndpoint = process.env.JEJU_DWS_ENDPOINT ?? 'http://localhost:4030'
  const cacheUrl = `${dwsEndpoint}/cache`

  const response = await fetch(`${cacheUrl}/health`, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null)

  check.latencyMs = Date.now() - start

  if (response?.ok) {
    check.status = check.latencyMs < 50 ? 'healthy' : 'degraded'
  } else {
    check.status = 'degraded'
    check.message = 'Connection failed'
  }

  return check
}

async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now()
  const check: HealthCheck = {
    name: 'storage',
    status: 'healthy',
    latencyMs: 0,
  }

  const storageUrl = process.env.JEJU_STORAGE_ENDPOINT
  if (!storageUrl) {
    check.message = 'Not configured'
    return check
  }

  const response = await fetch(`${storageUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)

  check.latencyMs = Date.now() - start

  if (response?.ok) {
    check.status = check.latencyMs < 200 ? 'healthy' : 'degraded'
  } else {
    check.status = 'degraded'
    check.message = 'Storage unreachable'
  }

  return check
}

/**
 * Health check routes
 * Migrated from: apps/web/app/api/health/route.ts
 */
export const healthRoutes = new Elysia({ prefix: '/health' }).get(
  '/',
  async ({ set }) => {
    const startTime = Date.now()

    const checks = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkStorage(),
    ])

    const hasUnhealthy = checks.some((c) => c.status === 'unhealthy')
    const hasDegraded = checks.some((c) => c.status === 'degraded')

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (hasUnhealthy) {
      overallStatus = 'unhealthy'
    } else if (hasDegraded) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    if (overallStatus === 'unhealthy') {
      set.status = 503
    }

    return {
      status: overallStatus === 'healthy' ? 'ok' : overallStatus,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      version: process.env.APP_VERSION ?? '1.0.0',
      uptime: process.uptime(),
      checks: Object.fromEntries(
        checks.map((check) => [
          check.name,
          {
            status: check.status,
            latencyMs: check.latencyMs,
            ...(check.message && { message: check.message }),
          },
        ]),
      ),
      totalLatencyMs: Date.now() - startTime,
      keepalive: {
        jnsName: 'babylon.jeju',
        agentId: process.env.AI_CEO_AGENT_ID ?? '1',
        vaultAddress: process.env.BABYLON_AGENT_VAULT_ADDRESS ?? null,
      },
    }
  },
  {
    response: HealthCheckSchema,
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Comprehensive health check for keepalive monitoring',
    },
  },
)
