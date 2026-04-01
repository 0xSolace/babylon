/**
 * Internal Cache Stats API
 *
 * @route GET /api/internal/cache-stats — cache hit/miss metrics per namespace
 * @access Authenticated (any logged-in user)
 *
 * Returns Redis-backed counters that persist across serverless cold starts
 * and aggregate across all Vercel function instances.
 *
 * Auth: Uses standard authenticate() — any logged-in user can read metrics.
 * This endpoint exposes aggregate counts only (no PII, no user-specific data).
 * If admin-only access is needed later, swap authenticate() for an admin guard.
 */

import {
  authenticate,
  getCacheMetricsSnapshot,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await authenticate(request);
  const metrics = await getCacheMetricsSnapshot();
  return successResponse({ metrics });
});
