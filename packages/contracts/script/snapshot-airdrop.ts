#!/usr/bin/env bun
/**
 * Airdrop Snapshot Script
 *
 * Takes a snapshot of all user points and trading activity
 * and registers them for the airdrop in the database.
 *
 * This prepares users for on-chain claiming once the
 * Merkle root is submitted to the Airdrop contract.
 *
 * Usage:
 *   bun run scripts/snapshot-airdrop.ts [--dry-run]
 */

import { ElizaHolderAirdropService } from '@babylon/api';
import { airdropAllocations, db, eq, sql, users } from '@babylon/db';
import { generateSnowflakeId } from '@babylon/shared';
import type { Address } from 'viem';
import {
  AIRDROP_TOKENS,
  ELIZA_HOLDER_BONUS_MULTIPLIER,
  tokensToWei,
} from '../src/config/tokenomics';

const elizaService = new ElizaHolderAirdropService();

interface SnapshotStats {
  totalUsers: number;
  eligibleUsers: number;
  registeredUsers: number;
  totalAllocation: bigint;
  topAllocations: Array<{
    userId: string;
    wallet: string;
    points: number;
    allocation: string;
  }>;
}

async function takeSnapshot(dryRun: boolean): Promise<SnapshotStats> {
  console.log('═'.repeat(60));
  console.log('📸 AIRDROP SNAPSHOT');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);

  // Get all eligible users
  console.log('\n📊 Fetching eligible users...');

  const eligibleUsers = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      earnedPoints: users.earnedPoints,
      bonusPoints: users.bonusPoints,
      referralCount: users.referralCount,
      lifetimePnL: users.lifetimePnL,
      totalDeposited: users.totalDeposited,
    })
    .from(users)
    .where(
      sql`${users.isActor} = false 
          AND ${users.walletAddress} IS NOT NULL 
          AND ${users.reputationPoints} >= 1000`
    );

  const totalUsersResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.isActor, false));

  const totalUsers = totalUsersResult[0]?.count ?? 0;

  console.log(`   Total users: ${totalUsers}`);
  console.log(`   Eligible users: ${eligibleUsers.length}`);

  if (eligibleUsers.length === 0) {
    console.log('\n⚠️  No eligible users found.');
    return {
      totalUsers,
      eligibleUsers: 0,
      registeredUsers: 0,
      totalAllocation: 0n,
      topAllocations: [],
    };
  }

  // Check already registered
  const alreadyRegistered = await db
    .select({ userId: airdropAllocations.userId })
    .from(airdropAllocations);

  const registeredIds = new Set(alreadyRegistered.map((r) => r.userId));
  const newEligible = eligibleUsers.filter((u) => !registeredIds.has(u.id));

  console.log(`   Already registered: ${registeredIds.size}`);
  console.log(`   New to register: ${newEligible.length}`);

  // Calculate total points for proportional allocation
  const totalPoints = eligibleUsers.reduce(
    (sum, u) => sum + u.reputationPoints,
    0
  );

  const airdropPoolWei = tokensToWei(AIRDROP_TOKENS);

  // Calculate and store allocations
  console.log('\n📝 Calculating allocations...');

  let registeredCount = 0;
  let totalAllocation = 0n;
  const topAllocations: SnapshotStats['topAllocations'] = [];

  for (const user of newEligible) {
    if (!user.walletAddress) continue;

    // Calculate proportional allocation based on points
    const pointsWeight = user.reputationPoints / totalPoints;

    // Weight factors
    const baseAllocation = BigInt(
      Math.floor(Number(airdropPoolWei) * pointsWeight * 0.4)
    );

    const tradingVolume = Number(user.totalDeposited ?? 0) * 10;
    const tradingAllocation = BigInt(
      Math.floor(
        Number(airdropPoolWei) *
          Math.min(tradingVolume / 1_000_000_000, 0.1) *
          0.25
      )
    );

    const referralAllocation = BigInt(
      Math.floor(
        Number(airdropPoolWei) *
          Math.min((user.referralCount ?? 0) / 1000, 0.1) *
          0.1
      )
    );

    let allocation = baseAllocation + tradingAllocation + referralAllocation;

    // Cap at 1% of pool
    const maxAllocation = airdropPoolWei / 100n;
    if (allocation > maxAllocation) {
      allocation = maxAllocation;
    }

    // Minimum 0.001% of pool
    const minAllocation = airdropPoolWei / 100000n;
    if (allocation < minAllocation) {
      allocation = minAllocation;
    }

    // Check ELIZA holdings via ElizaHolderAirdropService
    const elizaBalance = await elizaService.getFullElizaBalance(
      user.walletAddress as Address
    );
    const isElizaHolder = elizaBalance > 0n;
    const bonusMultiplier = isElizaHolder ? ELIZA_HOLDER_BONUS_MULTIPLIER : 100;
    const finalAllocation = (allocation * BigInt(bonusMultiplier)) / 100n;

    totalAllocation += finalAllocation;

    // Store top allocations
    if (topAllocations.length < 10) {
      topAllocations.push({
        userId: user.id,
        wallet: user.walletAddress.slice(0, 10) + '...',
        points: user.reputationPoints,
        allocation: (Number(finalAllocation) / 1e18).toFixed(2),
      });
    }

    if (!dryRun) {
      await db.insert(airdropAllocations).values({
        id: await generateSnowflakeId(),
        userId: user.id,
        walletAddress: user.walletAddress,
        totalAllocation: finalAllocation.toString(),
        bonusMultiplier,
        dripsUnlocked: 0,
        totalClaimed: '0',
        isElizaHolder,
        snapshotPoints: user.reputationPoints,
        snapshotVolume: tradingVolume.toString(),
        snapshotPnL: (user.lifetimePnL ?? '0').toString(),
        snapshotReferrals: user.referralCount ?? 0,
        snapshotEcosystemScore:
          (user.invitePoints > 0 ? 1 : 0) +
          (user.earnedPoints > 0 ? 1 : 0) +
          (user.bonusPoints > 0 ? 1 : 0),
        registeredOnChain: false,
      });
    }

    registeredCount++;

    if (registeredCount % 100 === 0) {
      console.log(`   Processed ${registeredCount}/${newEligible.length}`);
    }
  }

  // Sort top allocations
  topAllocations.sort((a, b) => Number(b.allocation) - Number(a.allocation));

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SNAPSHOT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total Users:        ${totalUsers}`);
  console.log(`Eligible Users:     ${eligibleUsers.length}`);
  console.log(`Newly Registered:   ${registeredCount}`);
  console.log(
    `Total Allocated:    ${(Number(totalAllocation) / 1e18).toLocaleString()} BBLN`
  );

  console.log('\n🏆 Top 10 Allocations:');
  for (let i = 0; i < topAllocations.length; i++) {
    const a = topAllocations[i];
    console.log(
      `   ${i + 1}. ${a.wallet} - ${a.points} pts - ${a.allocation} BBLN`
    );
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes made to database');
  } else {
    console.log('\n✅ Snapshot complete - users registered for airdrop');
  }

  return {
    totalUsers,
    eligibleUsers: eligibleUsers.length,
    registeredUsers: registeredCount,
    totalAllocation,
    topAllocations,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const stats = await takeSnapshot(dryRun);

  // Output stats as JSON for scripting
  if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ...stats,
          totalAllocation: stats.totalAllocation.toString(),
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error('Snapshot failed:', error);
  process.exit(1);
});
