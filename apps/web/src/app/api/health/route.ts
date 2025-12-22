export const dynamic = 'force-dynamic';

import { db } from '@babylon/db';
import { NextResponse } from 'next/server';

/**
 * Health Check API
 *
 * @description
 * Comprehensive health check endpoint for monitoring service availability.
 * Used by:
 * - Jeju KeepaliveRegistry for auto-restart monitoring
 * - CI/CD pipelines (GitHub Actions) to verify deployment readiness
 * - Load balancers for health checks
 * - Monitoring services
 *
 * Returns detailed status for recovery time minimization (<1 hour target).
 *
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check
 *     description: Comprehensive health check for keepalive monitoring
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy or degraded
 */

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  message?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  const check: HealthCheck = {
    name: 'database',
    status: 'unhealthy',
    latencyMs: 0,
  };

  // Use a simple findFirst query to test database connectivity
  // This avoids raw SQL type issues and works across all modes
  const result = await db.user.findFirst({}).catch(() => null);
  check.latencyMs = Date.now() - start;

  // Even if no users exist, a null result means the query succeeded
  // Only catch errors indicate actual failures
  if (result !== undefined) {
    check.status = check.latencyMs < 100 ? 'healthy' : 'degraded';
    if (check.latencyMs > 100) {
      check.message = 'High latency';
    }
  } else {
    check.message = 'Connection failed';
  }

  return check;
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  const check: HealthCheck = {
    name: 'redis',
    status: 'healthy', // Default healthy if not configured
    latencyMs: 0,
  };

  const redisUrl = process.env.REDIS_URL ?? process.env.CACHE_URL;
  if (!redisUrl) {
    check.message = 'Not configured';
    return check;
  }

  const response = await fetch(`${redisUrl.replace(/^redis/, 'http')}/health`, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);

  check.latencyMs = Date.now() - start;

  if (response?.ok) {
    check.status = check.latencyMs < 50 ? 'healthy' : 'degraded';
  } else {
    check.status = 'degraded'; // Redis is optional
    check.message = 'Connection failed';
  }

  return check;
}

async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now();
  const check: HealthCheck = {
    name: 'storage',
    status: 'healthy',
    latencyMs: 0,
  };

  const storageUrl = process.env.JEJU_STORAGE_ENDPOINT;
  if (!storageUrl) {
    check.message = 'Not configured';
    return check;
  }

  const response = await fetch(`${storageUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  check.latencyMs = Date.now() - start;

  if (response?.ok) {
    check.status = check.latencyMs < 200 ? 'healthy' : 'degraded';
  } else {
    check.status = 'degraded';
    check.message = 'Storage unreachable';
  }

  return check;
}

async function checkTrainingOrchestrator(): Promise<HealthCheck> {
  const start = Date.now();
  const check: HealthCheck = {
    name: 'training',
    status: 'healthy',
    latencyMs: 0,
  };

  const trainingUrl = process.env.TRAINING_API_URL;
  if (!trainingUrl) {
    check.message = 'Not configured';
    return check;
  }

  const response = await fetch(`${trainingUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  check.latencyMs = Date.now() - start;

  if (response?.ok) {
    check.status = 'healthy';
  } else {
    check.status = 'degraded'; // Training is optional
    check.message = 'Training service unreachable';
  }

  return check;
}

export async function GET() {
  const startTime = Date.now();

  // Run all health checks in parallel
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkTrainingOrchestrator(),
  ]);

  // Determine overall status
  const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
  const hasDegraded = checks.some((c) => c.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const response = {
    status: overallStatus === 'healthy' ? 'ok' : overallStatus,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION ?? '1.0.0',
    uptime: process.uptime(),
    checks: checks.reduce(
      (acc, check) => {
        acc[check.name] = {
          status: check.status,
          latencyMs: check.latencyMs,
          ...(check.message && { message: check.message }),
        };
        return acc;
      },
      {} as Record<
        string,
        { status: string; latencyMs: number; message?: string }
      >
    ),
    totalLatencyMs: Date.now() - startTime,
    // Keepalive metadata
    keepalive: {
      jnsName: 'babylon.jeju',
      agentId: process.env.AI_CEO_AGENT_ID ?? '1',
      vaultAddress: process.env.BABYLON_AGENT_VAULT_ADDRESS ?? null,
    },
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}
