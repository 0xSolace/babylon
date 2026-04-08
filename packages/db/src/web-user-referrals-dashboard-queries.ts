/**
 * Referrals dashboard queries for GET /api/users/[userId]/referrals.
 */

import { and, count, desc, eq, gte, inArray, sum } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { referrals } from './tables/referrals';
import { tradingFees } from './tables/trading-fees';
import { users } from './tables/user';

type ReferralsDashboardDb = DrizzleClient | Transaction;

export type ReferralDashboardSelfUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  referralCode: string | null;
  referralCount: number;
  reputationPoints: number;
  totalPoints: string;
  totalFeesEarned: string;
  pointsAwardedForProfile: boolean;
  pointsAwardedForFarcaster: boolean;
  pointsAwardedForTwitter: boolean;
  pointsAwardedForWallet: boolean;
  farcasterUsername: string | null;
  twitterUsername: string | null;
  walletAddress: string | null;
  onChainRegistered: boolean;
};

export async function selectUserReferralDashboardSelfById(
  db: ReferralsDashboardDb,
  userId: string
): Promise<ReferralDashboardSelfUserRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      profileImageUrl: users.profileImageUrl,
      referralCode: users.referralCode,
      referralCount: users.referralCount,
      reputationPoints: users.reputationPoints,
      totalPoints: users.totalPoints,
      totalFeesEarned: users.totalFeesEarned,
      pointsAwardedForProfile: users.pointsAwardedForProfile,
      pointsAwardedForFarcaster: users.pointsAwardedForFarcaster,
      pointsAwardedForTwitter: users.pointsAwardedForTwitter,
      pointsAwardedForWallet: users.pointsAwardedForWallet,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
      walletAddress: users.walletAddress,
      onChainRegistered: users.onChainRegistered,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type CompletedReferralRow = {
  id: string;
  referredUserId: string | null;
  completedAt: Date | null;
};

export async function selectCompletedReferralsByReferrerIdOrderCompletedDesc(
  db: ReferralsDashboardDb,
  referrerId: string
): Promise<CompletedReferralRow[]> {
  return db
    .select({
      id: referrals.id,
      referredUserId: referrals.referredUserId,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.status, 'completed')
      )
    )
    .orderBy(desc(referrals.completedAt));
}

export type ReferredUserCompletedSliceRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  reputationPoints: number;
  profileComplete: boolean;
};

export async function selectReferredUsersCompletedSliceByIds(
  db: ReferralsDashboardDb,
  userIds: string[]
): Promise<ReferredUserCompletedSliceRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
      reputationPoints: users.reputationPoints,
      profileComplete: users.profileComplete,
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export type PendingReferredUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  reputationPoints: number;
  profileComplete: boolean;
  email: string | null;
  farcasterUsername: string | null;
  twitterUsername: string | null;
};

export async function selectPendingReferredUsersIncompleteByReferrerId(
  db: ReferralsDashboardDb,
  referrerId: string
): Promise<PendingReferredUserRow[]> {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
      reputationPoints: users.reputationPoints,
      profileComplete: users.profileComplete,
      email: users.email,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
    })
    .from(users)
    .where(
      and(eq(users.referredBy, referrerId), eq(users.profileComplete, false))
    )
    .orderBy(desc(users.createdAt));
}

export async function sumTradingFeesReferrerFeeByReferrerId(
  db: ReferralsDashboardDb,
  referrerId: string
): Promise<number> {
  const [row] = await db
    .select({
      total: sum(tradingFees.referrerFee),
    })
    .from(tradingFees)
    .where(eq(tradingFees.referrerId, referrerId));
  return Number(row?.total ?? 0);
}

export async function countCompletedReferralsForReferrerSince(
  db: ReferralsDashboardDb,
  referrerId: string,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({
      count: count(),
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.status, 'completed'),
        gte(referrals.completedAt, since)
      )
    );
  return Number(row?.count ?? 0);
}
