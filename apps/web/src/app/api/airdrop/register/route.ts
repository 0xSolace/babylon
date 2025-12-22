export const dynamic = 'force-dynamic';

/**
 * Airdrop Registration API Endpoint
 *
 * Registers a user for the airdrop by storing their allocation
 * and preparing their Merkle proof for on-chain claiming.
 *
 * POST /api/airdrop/register
 */

import { authenticate, TokenService } from '@babylon/api';
import { airdropAllocations, db, eq, users } from '@babylon/db';
import { generateSnowflakeId } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RegisterResponse {
  success: boolean;
  allocation?: {
    total: string;
    bonusMultiplier: number;
    dailyDrip: string;
  };
  merkleProof?: string[];
  message?: string;
}

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

  // Check if already registered
  const existingResult = await db
    .select()
    .from(airdropAllocations)
    .where(eq(airdropAllocations.userId, userId))
    .limit(1);

  if (existingResult[0]) {
    return NextResponse.json({
      success: false,
      message: 'Already registered for airdrop',
    } satisfies RegisterResponse);
  }

  // Get user's wallet address
  const userResult = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.walletAddress) {
    return NextResponse.json({
      success: false,
      message: 'Please connect a wallet first',
    } satisfies RegisterResponse);
  }

  // Calculate allocation
  const allocation = await TokenService.calculateAirdropAllocation(userId);

  if (!allocation || allocation.finalAllocation === 0n) {
    return NextResponse.json({
      success: false,
      message: 'Not eligible for airdrop. Minimum 1000 points required.',
    } satisfies RegisterResponse);
  }

  // Store allocation
  await db.insert(airdropAllocations).values({
    id: await generateSnowflakeId(),
    userId,
    walletAddress: user.walletAddress,
    totalAllocation: allocation.finalAllocation.toString(),
    bonusMultiplier: allocation.bonusMultiplier,
    dripsUnlocked: 0,
    totalClaimed: '0',
    isElizaHolder: allocation.isElizaHolder,
    snapshotPoints: allocation.pointsBalance,
    snapshotVolume: allocation.tradingVolume.toString(),
    snapshotPnL: allocation.tradingPnL.toString(),
    snapshotReferrals: allocation.referralCount,
    snapshotEcosystemScore: allocation.ecosystemScore,
    registeredOnChain: false,
  });

  return NextResponse.json({
    success: true,
    allocation: {
      total: allocation.finalAllocation.toString(),
      bonusMultiplier: allocation.bonusMultiplier,
      dailyDrip: allocation.dailyDripAmount.toString(),
    },
    message:
      'Successfully registered for airdrop! Start earning drips by visiting daily.',
  } satisfies RegisterResponse);
}
