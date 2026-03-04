/**
 * Health Check Cron Job API
 *
 * @route GET /api/cron/health-check - System health check
 * @access Cron (CRON_SECRET required)
 *
 * @description
 * Simple health check endpoint that runs every 15 minutes to keep serverless
 * functions warm, verify database connectivity, and log system health metrics.
 * Max execution time: 60s.
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/cron/health-check', {
 *   headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
 * });
 * const { status, database } = await response.json();
 * ```
 */

import { withCronAuth, withErrorHandling } from '@babylon/api';
import { db } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Vercel function configuration
export const maxDuration = 60; // 1 minute max for health check
export const dynamic = 'force-dynamic';

async function handler(_request: NextRequest) {
  const startTime = Date.now();

  // Quick database health check
  await db.$queryRaw`SELECT 1`;

  const duration = Date.now() - startTime;

  logger.info(
    'Health check passed',
    {
      duration,
      timestamp: new Date().toISOString(),
    },
    'HealthCheck'
  );

  return NextResponse.json({
    success: true,
    status: 'healthy',
    database: 'connected',
    duration,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withErrorHandling(withCronAuth('HealthCheck', handler));
