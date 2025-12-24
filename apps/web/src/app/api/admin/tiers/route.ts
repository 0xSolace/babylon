/**
 * GET /api/admin/tiers - Get global tier analytics (admin only)
 */

import {
  AuthorizationError,
  authenticate,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { asSystem, eq, users } from '@babylon/db';
import { TIER_CONFIG, TieredGroupService } from '@babylon/engine';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Check admin status
  const [userData] = await asSystem(
    async (db) =>
      db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1),
    'check-admin-for-tier-analytics'
  );

  if (
    !userData ||
    (userData.role !== 'admin' && userData.role !== 'moderator')
  ) {
    throw new AuthorizationError('Admin access required');
  }

  const analytics = await TieredGroupService.getGlobalAnalytics();

  return successResponse({
    analytics: {
      ...analytics,
      overallFillRate: Math.round(analytics.overallFillRate * 100),
      tierBreakdown: analytics.tierBreakdown.map((t) => ({
        ...t,
        tierName: TIER_CONFIG[t.tier].name,
        fillRate: Math.round(t.fillRate * 100),
      })),
    },
  });
});
