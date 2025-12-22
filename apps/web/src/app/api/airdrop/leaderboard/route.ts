export const dynamic = 'force-dynamic';

/**
 * Airdrop Leaderboard API Endpoint
 *
 * Returns the current leaderboard for the 90-day bonus period.
 * Users earn points during the bonus period and receive multiplied bonuses
 * based on their leaderboard position:
 * - Top 1%: 10x multiplier
 * - Top 10%: 5x multiplier
 * - Top 25%: 2x multiplier
 *
 * GET /api/airdrop/leaderboard
 * Query params:
 * - limit: number of entries to return (default: 100, max: 1000)
 */

import { getAirdropBonusService, optionalAuth } from '@babylon/api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  pointsEarned: number;
  estimatedBonus: string;
  estimatedBonusFormatted: string;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  currentUserRank: number | null;
  totalParticipants: number;
  bonusPeriodActive: boolean;
  daysRemaining: number;
  message?: string;
}

interface LeaderboardEntryData {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  pointsEarned: number;
  estimatedBonus: bigint | string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authUser = await optionalAuth(request);
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 1000);

  const bonusService = getAirdropBonusService();
  const leaderboard = await bonusService.getLeaderboard(limit);

  // Get current user's status if logged in
  let currentUserRank: number | null = null;
  let bonusPeriodActive = false;
  let daysRemaining = 0;

  if (authUser?.userId) {
    const userStatus = await bonusService.getUserBonusStatus(authUser.userId);
    if (userStatus) {
      currentUserRank = userStatus.leaderboardPosition;
      bonusPeriodActive = userStatus.bonusPeriodActive;
      daysRemaining = userStatus.daysRemaining;
    }
  }

  const formattedLeaderboard: LeaderboardEntry[] = leaderboard.map(
    (entry: LeaderboardEntryData) => {
      const estimatedBonusNum = Number(entry.estimatedBonus) / 1e18;
      return {
        rank: entry.rank,
        userId: entry.userId,
        username: entry.username,
        displayName: entry.displayName,
        profileImageUrl: entry.profileImageUrl,
        pointsEarned: entry.pointsEarned,
        estimatedBonus: entry.estimatedBonus.toString(),
        estimatedBonusFormatted: `${estimatedBonusNum.toLocaleString()} BBLN`,
        isCurrentUser: authUser?.userId === entry.userId,
      };
    }
  );

  return NextResponse.json({
    success: true,
    leaderboard: formattedLeaderboard,
    currentUserRank,
    totalParticipants: leaderboard.length,
    bonusPeriodActive,
    daysRemaining,
  } satisfies LeaderboardResponse);
}
