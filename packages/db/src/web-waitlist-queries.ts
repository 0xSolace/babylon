/**
 * SQL for `apps/web` GET /api/waitlist/position (referral lists under RLS).
 */

import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { referrals } from './tables/referrals';
import { users } from './tables/user';

type WaitlistDb = DrizzleClient | Transaction;

export type WaitlistCompletedReferralRow = {
  id: string;
  referredUserId: string | null;
  completedAt: Date | null;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  userCreatedAt: Date | null;
};

export async function selectCompletedReferralsWithReferredUserSlice(
  db: WaitlistDb,
  params: { referrerId: string; limit: number }
): Promise<WaitlistCompletedReferralRow[]> {
  return db
    .select({
      id: referrals.id,
      referredUserId: referrals.referredUserId,
      completedAt: referrals.completedAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      userCreatedAt: users.createdAt,
    })
    .from(referrals)
    .leftJoin(users, eq(referrals.referredUserId, users.id))
    .where(
      and(
        eq(referrals.referrerId, params.referrerId),
        eq(referrals.status, 'completed')
      )
    )
    .orderBy(desc(referrals.completedAt))
    .limit(params.limit);
}

export type WaitlistPendingReferredUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  email: string | null;
  farcasterUsername: string | null;
  twitterUsername: string | null;
  createdAt: Date;
};

export async function selectPendingReferredUsersIncompleteProfile(
  db: WaitlistDb,
  params: { referredByUserId: string; limit: number }
): Promise<WaitlistPendingReferredUserRow[]> {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      email: users.email,
      farcasterUsername: users.farcasterUsername,
      twitterUsername: users.twitterUsername,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.referredBy, params.referredByUserId),
        eq(users.profileComplete, false)
      )
    )
    .orderBy(desc(users.createdAt))
    .limit(params.limit);
}
