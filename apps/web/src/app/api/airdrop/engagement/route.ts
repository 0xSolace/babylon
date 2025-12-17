/**
 * Airdrop Engagement Status API
 *
 * Returns the user's daily engagement progress for airdrop qualification.
 *
 * GET /api/airdrop/engagement
 * Returns current day's engagement status
 */

import { EngagementService } from '@babylon/api';
import { getServerSession } from '@babylon/auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/airdrop/engagement
 * Get user's daily engagement status
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const status = await EngagementService.getEngagementStatus(session.user.id);

  return NextResponse.json({
    success: true,
    dateKey: status.dateKey,
    socialTrack: status.socialTrack,
    tradingTrack: status.tradingTrack,
    qualifiedForDrip: status.qualifiedForDrip,
    qualifiedAt: status.qualifiedAt?.toISOString() ?? null,
    dripClaimed: status.dripClaimed,
    dripAmount: status.dripAmount,
    nextResetTime: status.nextResetTime.toISOString(),
    gracePeriodActive: status.gracePeriodActive,
  });
}
