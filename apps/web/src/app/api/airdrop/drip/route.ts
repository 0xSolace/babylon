/**
 * Airdrop Drip API Endpoint
 *
 * Claims daily airdrop drip based on engagement qualification.
 * Vesting schedule: 10% initial + 2% daily for 45 days = 100%
 *
 * Qualification tracks (complete either one):
 * - Social Track: 2 of 3 actions (like, comment, non-spam post)
 * - Trading Track: Any trade (prediction market or perpetual)
 *
 * Timing:
 * - UTC daily reset with 4-hour grace period
 * - Actions in last 20 hours count toward current day
 *
 * POST /api/airdrop/drip - Claim drip (if qualified)
 * GET /api/airdrop/drip - Get current status
 */

import { authenticate, EngagementService, TokenService } from '@babylon/api';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Airdrop vesting constants
const TOTAL_DRIP_DAYS = 45; // + initial = 46 claims for 100%

interface DripResponse {
  success: boolean;
  canDrip: boolean;
  dripDay: number;
  amount: string;
  amountFormatted: string;
  isInitialClaim: boolean;
  nextDripTime: string | null;
  percentUnlocked: number;
  message: string;
  // New engagement-based fields
  engagement?: {
    socialTrack: {
      liked: boolean;
      commented: boolean;
      posted: boolean;
      actionsComplete: number;
      required: number;
      complete: boolean;
    };
    tradingTrack: {
      traded: boolean;
      complete: boolean;
    };
    qualified: boolean;
  };
}

/**
 * POST /api/airdrop/drip
 * Claim drip if user has completed engagement requirements
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser;
  try {
    authUser = await authenticate(request);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const userId = authUser.userId;

  // Check engagement qualification first
  const { canClaim, reason, engagement } =
    await EngagementService.canClaimDrip(userId);

  if (!canClaim || !engagement) {
    // Get engagement status for response
    const engagementStatus =
      await EngagementService.getEngagementStatus(userId);

    // Get airdrop allocation status
    const airdropStatus = await TokenService.getAirdropStatus(userId);
    const dripsUnlocked = airdropStatus?.dripsUnlocked ?? 0;

    return NextResponse.json({
      success: true,
      canDrip: false,
      dripDay: dripsUnlocked,
      amount: '0',
      amountFormatted: '0 BBLN',
      isInitialClaim: false,
      nextDripTime: engagementStatus.nextResetTime.toISOString(),
      percentUnlocked: dripsUnlocked >= 1 ? 10 + (dripsUnlocked - 1) * 2 : 0,
      message: reason,
      engagement: {
        socialTrack: engagementStatus.socialTrack,
        tradingTrack: engagementStatus.tradingTrack,
        qualified: engagementStatus.qualifiedForDrip,
      },
    } satisfies DripResponse);
  }

  // User is qualified - record the drip
  // Determine which track completed the qualification
  const action: 'post' | 'trade' = engagement.tradingTrackComplete
    ? 'trade'
    : 'post';

  const result = await TokenService.recordDripAction(userId, action);

  if (!result.canDrip) {
    const nextDripTime = result.nextDripTime?.toISOString() ?? null;
    const hoursRemaining = result.nextDripTime
      ? Math.ceil(
          (result.nextDripTime.getTime() - Date.now()) / (60 * 60 * 1000)
        )
      : 0;

    // Get engagement status
    const engagementStatus =
      await EngagementService.getEngagementStatus(userId);

    return NextResponse.json({
      success: true,
      canDrip: false,
      dripDay: result.dripDay,
      amount: '0',
      amountFormatted: '0 BBLN',
      isInitialClaim: false,
      nextDripTime,
      percentUnlocked: result.dripDay >= 1 ? 10 + (result.dripDay - 1) * 2 : 0,
      message:
        result.dripDay > TOTAL_DRIP_DAYS
          ? '🎉 All drips already unlocked! Your full airdrop is available.'
          : `⏳ Come back in ${hoursRemaining} hours for your next drip!`,
      engagement: {
        socialTrack: engagementStatus.socialTrack,
        tradingTrack: engagementStatus.tradingTrack,
        qualified: engagementStatus.qualifiedForDrip,
      },
    } satisfies DripResponse);
  }

  // Mark the drip as claimed in engagement tracking
  await EngagementService.markDripClaimed(userId, result.amount);

  const amountFormatted = `${(Number(result.amount) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })} BBLN`;
  const percentUnlocked =
    result.dripDay >= 1 ? 10 + (result.dripDay - 1) * 2 : 0;

  logger.info(
    `User ${userId} claimed drip day ${result.dripDay}`,
    {
      userId,
      dripDay: result.dripDay,
      action,
      isInitialClaim: result.isInitialClaim,
    },
    'AirdropDripAPI'
  );

  // Get updated engagement status
  const engagementStatus = await EngagementService.getEngagementStatus(userId);

  return NextResponse.json({
    success: true,
    canDrip: true,
    dripDay: result.dripDay,
    amount: result.amount.toString(),
    amountFormatted,
    isInitialClaim: result.isInitialClaim,
    nextDripTime: result.nextDripTime?.toISOString() ?? null,
    percentUnlocked,
    message: result.isInitialClaim
      ? `🚀 Welcome! You've claimed your initial 10% airdrop! ${amountFormatted} unlocked.`
      : `💧 Day ${result.dripDay} drip claimed! ${amountFormatted} unlocked. You're ${percentUnlocked}% vested!`,
    engagement: {
      socialTrack: engagementStatus.socialTrack,
      tradingTrack: engagementStatus.tradingTrack,
      qualified: engagementStatus.qualifiedForDrip,
    },
  } satisfies DripResponse);
}

/**
 * GET /api/airdrop/drip
 * Returns user's current drip status and engagement progress
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let authUser;
  try {
    authUser = await authenticate(request);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const userId = authUser.userId;

  // Get airdrop allocation status
  const status = await TokenService.getAirdropStatus(userId);

  if (!status) {
    return NextResponse.json({
      success: true,
      registered: false,
      message: 'Not registered for airdrop',
    });
  }

  // Get engagement status
  const engagementStatus = await EngagementService.getEngagementStatus(userId);

  return NextResponse.json({
    success: true,
    registered: true,
    totalAllocation: status.totalAllocation.toString(),
    dripsUnlocked: status.dripsUnlocked,
    totalDrips: status.totalDrips,
    totalClaimed: status.totalClaimed.toString(),
    claimable: status.claimable.toString(),
    nextDripTime: status.nextDripTime?.toISOString() ?? null,
    percentUnlocked: status.percentUnlocked,
    canDripNow: status.canDripNow && engagementStatus.qualifiedForDrip,
    isInitialClaimed: status.isInitialClaimed,
    // Engagement details
    engagement: {
      dateKey: engagementStatus.dateKey,
      socialTrack: engagementStatus.socialTrack,
      tradingTrack: engagementStatus.tradingTrack,
      qualified: engagementStatus.qualifiedForDrip,
      nextResetTime: engagementStatus.nextResetTime.toISOString(),
      gracePeriodActive: engagementStatus.gracePeriodActive,
    },
  });
}
