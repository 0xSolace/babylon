/**
 * Waitlist reads/writes for `waitlist-service`.
 */

import { and, asc, count, desc, eq, gt, lt, ne, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { pointsTransactions } from './tables/points-transactions';
import { referrals } from './tables/referrals';
import { users } from './tables/user';

type WlDb = DrizzleClient | Transaction;

export type WaitlistMarkUserRow = {
  id: string;
  waitlistPosition: number | null;
  referralCode: string | null;
  referredBy: string | null;
  reputationPoints: number;
  invitePoints: number;
  earnedPoints: number;
  bonusPoints: number;
  isWaitlistActive: boolean;
};

export async function selectWaitlistUserForMark(
  c: WlDb,
  userId: string
): Promise<WaitlistMarkUserRow | undefined> {
  const [row] = await c
    .select({
      id: users.id,
      waitlistPosition: users.waitlistPosition,
      referralCode: users.referralCode,
      referredBy: users.referredBy,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      earnedPoints: users.earnedPoints,
      bonusPoints: users.bonusPoints,
      isWaitlistActive: users.isWaitlistActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserIdByReferralCode(
  c: WlDb,
  referralCode: string
): Promise<{ id: string } | undefined> {
  const [row] = await c
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);
  return row;
}

export type WaitlistReferrerRow = {
  id: string;
  reputationPoints: number;
  invitePoints: number;
  referralCount: number;
};

export async function selectReferrerByCodeForWaitlist(
  c: WlDb,
  referralCode: string
): Promise<WaitlistReferrerRow | undefined> {
  const [row] = await c
    .select({
      id: users.id,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      referralCount: users.referralCount,
    })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);
  return row;
}

export async function selectMaxWaitlistPosition(
  c: WlDb
): Promise<number | null | undefined> {
  const [row] = await c
    .select({ waitlistPosition: users.waitlistPosition })
    .from(users)
    .where(ne(users.waitlistPosition, 0))
    .orderBy(desc(users.waitlistPosition))
    .limit(1);
  return row?.waitlistPosition;
}

export async function persistWaitlistReferralCompletion(
  c: WlDb,
  args: {
    referralCode: string;
    referredUserId: string;
    referrerId: string;
    newReferralRowId: string;
  }
): Promise<void> {
  const [existing] = await c
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referralCode, args.referralCode),
        eq(referrals.referredUserId, args.referredUserId)
      )
    )
    .limit(1);

  if (existing) {
    await c
      .update(referrals)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(referrals.id, existing.id));
  } else {
    await c.insert(referrals).values({
      id: args.newReferralRowId,
      referrerId: args.referrerId,
      referralCode: args.referralCode,
      referredUserId: args.referredUserId,
      status: 'completed',
      completedAt: new Date(),
    });
  }

  await c
    .update(users)
    .set({ referredBy: args.referrerId })
    .where(eq(users.id, args.referredUserId));
}

export async function finalizeWaitlistUser(
  c: WlDb,
  userId: string,
  args: {
    waitlistPosition: number;
    inviteCode: string;
  }
): Promise<void> {
  await c
    .update(users)
    .set({
      waitlistPosition: args.waitlistPosition,
      waitlistJoinedAt: new Date(),
      isWaitlistActive: true,
      referralCode: args.inviteCode,
    })
    .where(eq(users.id, userId));
}

export async function graduateWaitlistUser(
  c: WlDb,
  userId: string
): Promise<void> {
  await c
    .update(users)
    .set({
      isWaitlistActive: false,
      waitlistGraduatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export type WaitlistPositionUserRow = {
  waitlistPosition: number | null;
  waitlistJoinedAt: Date | null;
  isWaitlistActive: boolean;
  referralCode: string | null;
  reputationPoints: number;
  invitePoints: number;
  earnedPoints: number;
  bonusPoints: number;
  referralCount: number;
};

export async function fetchWaitlistPositionAggregate(
  c: WlDb,
  userId: string
): Promise<{
  user: WaitlistPositionUserRow;
  usersAhead: number;
  totalCount: number;
} | null> {
  const userResult = await c
    .select({
      waitlistPosition: users.waitlistPosition,
      waitlistJoinedAt: users.waitlistJoinedAt,
      isWaitlistActive: users.isWaitlistActive,
      referralCode: users.referralCode,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      earnedPoints: users.earnedPoints,
      bonusPoints: users.bonusPoints,
      referralCount: users.referralCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userRow = userResult[0];
  if (!userRow || !userRow.isWaitlistActive) {
    return null;
  }

  const userJoinedAt = userRow.waitlistJoinedAt || new Date();

  const [usersAheadResult] = await c
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.isWaitlistActive, true),
        or(
          gt(users.invitePoints, userRow.invitePoints),
          and(
            eq(users.invitePoints, userRow.invitePoints),
            lt(users.waitlistJoinedAt, userJoinedAt)
          )
        )
      )
    );

  const [totalResult] = await c
    .select({ count: count() })
    .from(users)
    .where(
      and(ne(users.waitlistPosition, 0), eq(users.isWaitlistActive, true))
    );

  return {
    user: userRow,
    usersAhead: usersAheadResult?.count ?? 0,
    totalCount: totalResult?.count ?? 0,
  };
}

export async function tryInsertWaitlistWalletBonus(
  c: WlDb,
  args: {
    userId: string;
    walletAddress: string;
    pointsTransactionId: string;
    bonusAmount: number;
  }
): Promise<boolean> {
  const userResult = await c
    .select({
      pointsAwardedForWallet: users.pointsAwardedForWallet,
      reputationPoints: users.reputationPoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);

  const userRow = userResult[0];
  if (!userRow || userRow.pointsAwardedForWallet) {
    return false;
  }

  const newBonusPoints = userRow.bonusPoints + args.bonusAmount;
  const newReputationPoints = userRow.reputationPoints + args.bonusAmount;

  await c
    .update(users)
    .set({
      walletAddress: args.walletAddress,
      pointsAwardedForWallet: true,
      bonusPoints: newBonusPoints,
      reputationPoints: newReputationPoints,
    })
    .where(eq(users.id, args.userId));

  await c.insert(pointsTransactions).values({
    id: args.pointsTransactionId,
    userId: args.userId,
    amount: args.bonusAmount,
    pointsBefore: userRow.reputationPoints,
    pointsAfter: newReputationPoints,
    reason: 'wallet_connect',
    metadata: JSON.stringify({ walletAddress: args.walletAddress }),
  });

  return true;
}

export async function tryInsertWaitlistEmailBonus(
  c: WlDb,
  args: {
    userId: string;
    normalizedEmail: string;
    pointsTransactionId: string;
    bonusAmount: number;
  }
): Promise<boolean> {
  const userResult = await c
    .select({
      isWaitlistActive: users.isWaitlistActive,
      pointsAwardedForEmail: users.pointsAwardedForEmail,
      reputationPoints: users.reputationPoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);

  const userRow = userResult[0];
  if (!userRow || !userRow.isWaitlistActive || userRow.pointsAwardedForEmail) {
    return false;
  }

  const newBonusPoints = userRow.bonusPoints + args.bonusAmount;
  const newReputationPoints = userRow.reputationPoints + args.bonusAmount;

  await c
    .update(users)
    .set({
      email: args.normalizedEmail,
      pointsAwardedForEmail: true,
      bonusPoints: newBonusPoints,
      reputationPoints: newReputationPoints,
    })
    .where(eq(users.id, args.userId));

  await c.insert(pointsTransactions).values({
    id: args.pointsTransactionId,
    userId: args.userId,
    amount: args.bonusAmount,
    pointsBefore: userRow.reputationPoints,
    pointsAfter: newReputationPoints,
    reason: 'email_submit',
  });

  return true;
}

export async function countActiveWaitlistUsers(c: WlDb): Promise<number> {
  const [result] = await c
    .select({ count: count() })
    .from(users)
    .where(
      and(ne(users.waitlistPosition, 0), eq(users.isWaitlistActive, true))
    );
  return result?.count ?? 0;
}

export type TopWaitlistUserRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  invitePoints: number;
  reputationPoints: number;
  referralCount: number;
  waitlistJoinedAt: Date | null;
};

export async function listTopWaitlistUsers(
  c: WlDb,
  args: {
    limit: number;
    offset: number;
    pointsType: 'total' | 'invite';
  }
): Promise<TopWaitlistUserRow[]> {
  const orderByColumns =
    args.pointsType === 'total'
      ? [
          desc(users.reputationPoints),
          desc(users.invitePoints),
          asc(users.waitlistJoinedAt),
        ]
      : [
          desc(users.invitePoints),
          desc(users.reputationPoints),
          asc(users.waitlistJoinedAt),
        ];

  return c
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      invitePoints: users.invitePoints,
      reputationPoints: users.reputationPoints,
      referralCount: users.referralCount,
      waitlistJoinedAt: users.waitlistJoinedAt,
    })
    .from(users)
    .where(and(eq(users.isWaitlistActive, true), ne(users.username, '')))
    .orderBy(...orderByColumns)
    .offset(args.offset)
    .limit(args.limit);
}
