/**
 * GET /api/tiers/[npcId] - Get user's tier status with a specific NPC
 */

import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { TieredGroupService } from '@babylon/engine';
import type { NextRequest } from 'next/server';

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ npcId: string }> }
  ) => {
    const { npcId } = await context.params;
    const user = await authenticate(request);

    const [status, npcTiers] = await Promise.all([
      TieredGroupService.getUserTierStatus(user.userId, npcId),
      TieredGroupService.getNpcTiers(npcId),
    ]);

    return successResponse({
      status,
      npcTiers: npcTiers.map((t) => ({
        tier: t.tier,
        name: t.chatName,
        memberCount: t.memberCount,
        maxMembers: t.maxMembers,
        isFull: t.isFull,
      })),
    });
  }
);
