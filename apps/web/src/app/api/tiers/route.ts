/**
 * GET /api/tiers - Get user's tier status across all NPCs
 */

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { TieredGroupService } from '@babylon/engine';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  const tiers = await TieredGroupService.getUserAllTiers(user.userId);

  return successResponse({
    tiers,
    totalGroups: tiers.length,
    tierBreakdown: {
      tier1: tiers.filter((t) => t.tier === 1).length,
      tier2: tiers.filter((t) => t.tier === 2).length,
      tier3: tiers.filter((t) => t.tier === 3).length,
    },
  });
});
