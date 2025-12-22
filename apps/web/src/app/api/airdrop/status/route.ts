/**
 * Airdrop Status API Endpoint
 *
 * Returns comprehensive airdrop status for the current user including:
 * - Base allocation from points snapshot
 * - Daily drip progress (10% initial + 2% daily for 45 days = 100%)
 * - 90-day bonus period status
 * - Leaderboard position and multiplier
 *
 * GET /api/airdrop/status
 */

import {
  authenticate,
  EngagementService,
  getAirdropBonusService,
  TokenService,
} from '@babylon/api';
import { airdropAllocations, db, eq } from '@babylon/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Airdrop vesting constants
const INITIAL_CLAIM_PERCENT = 10;
const DAILY_DRIP_PERCENT = 2;
const TOTAL_DRIP_DAYS = 45; // + initial = 46 claims for 100%
const DRIP_COOLDOWN_HOURS = 20;

interface AirdropStatusResponse {
  success: boolean;
  registered: boolean;
  allocation?: {
    total: string;
    totalFormatted: string;
    bonusMultiplier: number;
    isElizaHolder: boolean;
  };
  drip?: {
    dripsUnlocked: number;
    totalDrips: number;
    percentUnlocked: number;
    canDripNow: boolean;
    isInitialClaimed: boolean;
    nextDripTime: string | null;
    nextDripAmount: string;
    nextDripAmountFormatted: string;
    cooldownHours: number;
  };
  claim?: {
    totalClaimed: string;
    totalClaimedFormatted: string;
    claimable: string;
    claimableFormatted: string;
    registeredOnChain: boolean;
  };
  bonus?: {
    bonusPeriodActive: boolean;
    daysRemaining: number;
    pointsAtLaunch: number;
    pointsEarnedDuringBonus: number;
    leaderboardPosition: number;
    totalParticipants: number;
    leaderboardMultiplier: string;
    estimatedBonus: string;
    estimatedBonusFormatted: string;
  };
  action?: {
    required: boolean;
    type: 'initial_claim' | 'daily_drip' | 'wait' | 'complete';
    message: string;
    ctaText?: string;
  };
  engagement?: {
    dateKey: string;
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
    qualifiedForDrip: boolean;
    nextResetTime: string;
    gracePeriodActive: boolean;
  };
  message?: string;
}

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

  // Get allocation from database
  const allocationResult = await db
    .select()
    .from(airdropAllocations)
    .where(eq(airdropAllocations.userId, userId))
    .limit(1);

  const allocation = allocationResult[0];

  if (!allocation) {
    // Check if user is eligible but not yet registered
    const eligibility = await TokenService.calculateAirdropAllocation(userId);

    if (eligibility && eligibility.finalAllocation > 0n) {
      return NextResponse.json({
        success: true,
        registered: false,
        message: 'Eligible for airdrop. Register on-chain to claim.',
        allocation: {
          total: eligibility.finalAllocation.toString(),
          totalFormatted: TokenService.formatTokens(
            eligibility.finalAllocation
          ),
          bonusMultiplier: eligibility.bonusMultiplier,
          isElizaHolder: eligibility.isElizaHolder,
        },
      } satisfies AirdropStatusResponse);
    }

    return NextResponse.json({
      success: true,
      registered: false,
      message: 'Not eligible for airdrop',
    } satisfies AirdropStatusResponse);
  }

  const totalAllocation = BigInt(allocation.totalAllocation);
  const totalClaimed = BigInt(allocation.totalClaimed);
  const dripsUnlocked = allocation.dripsUnlocked;
  const totalDrips = TOTAL_DRIP_DAYS + 1; // 46 claims total (1 initial + 45 daily)
  const isInitialClaimed = dripsUnlocked >= 1;

  // Calculate percent unlocked: 10% for initial + 2% per subsequent drip
  let percentUnlocked = 0;
  if (dripsUnlocked >= 1) {
    percentUnlocked = INITIAL_CLAIM_PERCENT; // 10%
    percentUnlocked += (dripsUnlocked - 1) * DAILY_DRIP_PERCENT; // 2% per day after
  }

  // Calculate total unlocked amount
  const totalUnlocked = (totalAllocation * BigInt(percentUnlocked)) / 100n;
  const claimable =
    totalUnlocked > totalClaimed ? totalUnlocked - totalClaimed : 0n;

  // Determine next drip amount (10% for initial, 2% for subsequent)
  const nextDripPercent = !isInitialClaimed
    ? INITIAL_CLAIM_PERCENT
    : DAILY_DRIP_PERCENT;
  const nextDripAmount = (totalAllocation * BigInt(nextDripPercent)) / 100n;

  // Check if can drip now (20 hour cooldown)
  const now = Date.now();
  const lastDripTime = allocation.lastDripTime?.getTime() ?? 0;
  const cooldownMs = DRIP_COOLDOWN_HOURS * 60 * 60 * 1000;
  const canDripNow =
    dripsUnlocked < totalDrips &&
    (lastDripTime === 0 || now >= lastDripTime + cooldownMs);

  // Calculate next drip time
  let nextDripTime: string | null = null;
  if (dripsUnlocked < totalDrips) {
    if (allocation.lastDripTime) {
      nextDripTime = new Date(
        allocation.lastDripTime.getTime() + cooldownMs
      ).toISOString();
    } else {
      nextDripTime = new Date().toISOString();
    }
  }

  // Determine action required
  let action: AirdropStatusResponse['action'];
  if (dripsUnlocked >= totalDrips) {
    action = {
      required: false,
      type: 'complete',
      message: '🎉 Congratulations! Your airdrop is fully unlocked.',
    };
  } else if (canDripNow) {
    if (!isInitialClaimed) {
      action = {
        required: true,
        type: 'initial_claim',
        message: `🚀 Claim your first 10% airdrop! ${TokenService.formatTokens(nextDripAmount)} BBLN ready.`,
        ctaText: 'Claim Initial 10%',
      };
    } else {
      action = {
        required: true,
        type: 'daily_drip',
        message: `💧 Your daily 2% drip is ready! ${TokenService.formatTokens(nextDripAmount)} BBLN available.`,
        ctaText: 'Claim Daily 2%',
      };
    }
  } else {
    if (!allocation.lastDripTime) {
      throw new Error('lastDripTime is required when canDripNow is false');
    }
    const timeUntilNextDrip =
      new Date(allocation.lastDripTime.getTime() + cooldownMs).getTime() - now;
    const hoursRemaining = Math.ceil(timeUntilNextDrip / (60 * 60 * 1000));
    action = {
      required: false,
      type: 'wait',
      message: `⏳ Next drip available in ${hoursRemaining} hours. Come back soon!`,
    };
  }

  // Get bonus period status
  const bonusService = getAirdropBonusService();
  const bonusStatus = await bonusService.getUserBonusStatus(userId);

  // Get engagement status for drip qualification
  const engagementStatus = await EngagementService.getEngagementStatus(userId);

  // Update action if engagement is required
  if (!action) {
    throw new Error('Action should be set before engagement check');
  }
  if (action.type === 'daily_drip' && !engagementStatus.qualifiedForDrip) {
    const socialNeeded =
      engagementStatus.socialTrack.required -
      engagementStatus.socialTrack.actionsComplete;
    action = {
      required: true,
      type: 'daily_drip',
      message: `Complete daily engagement to unlock: ${socialNeeded} more social action${socialNeeded !== 1 ? 's' : ''} or make any trade`,
      ctaText: 'Complete Engagement',
    };
  }

  return NextResponse.json({
    success: true,
    registered: true,
    allocation: {
      total: totalAllocation.toString(),
      totalFormatted: TokenService.formatTokens(totalAllocation),
      bonusMultiplier: allocation.bonusMultiplier,
      isElizaHolder: allocation.isElizaHolder,
    },
    drip: {
      dripsUnlocked,
      totalDrips,
      percentUnlocked,
      canDripNow,
      isInitialClaimed,
      nextDripTime,
      nextDripAmount: nextDripAmount.toString(),
      nextDripAmountFormatted: TokenService.formatTokens(nextDripAmount),
      cooldownHours: DRIP_COOLDOWN_HOURS,
    },
    claim: {
      totalClaimed: totalClaimed.toString(),
      totalClaimedFormatted: TokenService.formatTokens(totalClaimed),
      claimable: claimable.toString(),
      claimableFormatted: TokenService.formatTokens(claimable),
      registeredOnChain: allocation.registeredOnChain,
    },
    bonus: bonusStatus
      ? {
          bonusPeriodActive: bonusStatus.bonusPeriodActive,
          daysRemaining: bonusStatus.daysRemaining,
          pointsAtLaunch: bonusStatus.pointsAtLaunch,
          pointsEarnedDuringBonus: bonusStatus.pointsEarnedDuringBonus,
          leaderboardPosition: bonusStatus.leaderboardPosition,
          totalParticipants: bonusStatus.totalParticipants,
          leaderboardMultiplier: bonusStatus.leaderboardMultiplier.toString(),
          estimatedBonus: bonusStatus.estimatedBonus.toString(),
          estimatedBonusFormatted: TokenService.formatTokens(
            bonusStatus.estimatedBonus
          ),
        }
      : undefined,
    engagement: {
      dateKey: engagementStatus.dateKey,
      socialTrack: engagementStatus.socialTrack,
      tradingTrack: engagementStatus.tradingTrack,
      qualifiedForDrip: engagementStatus.qualifiedForDrip,
      nextResetTime: engagementStatus.nextResetTime.toISOString(),
      gracePeriodActive: engagementStatus.gracePeriodActive,
    },
    action,
  } satisfies AirdropStatusResponse);
}
