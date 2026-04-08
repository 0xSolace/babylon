/**
 * SQL for POST /api/users/signup (transaction + welcome bonus + referral rows).
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  balanceTransactions,
  type NewBalanceTransaction,
} from './tables/balance-transactions';
import { type NewReferral, referrals } from './tables/referrals';
import { type NewUser, type User, users } from './tables/user';

type SignupDb = DrizzleClient | Transaction;

export async function selectUserReferredByById(
  db: SignupDb,
  userId: string
): Promise<{ referredBy: string | null } | undefined> {
  const [row] = await db
    .select({ referredBy: users.referredBy })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectWebSignupUserIdByReferralCode(
  db: SignupDb,
  referralCode: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);
  return row;
}

export async function selectUserFullById(
  db: SignupDb,
  userId: string
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserByIdReturningFull(
  db: SignupDb,
  userId: string,
  patch: Partial<NewUser>
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning();
  return row;
}

export async function insertWebSignupUserReturningFull(
  db: SignupDb,
  values: NewUser
): Promise<User | undefined> {
  const [row] = await db.insert(users).values(values).returning();
  return row;
}

export async function selectReferralIdByCodeAndReferredUserId(
  db: SignupDb,
  referralCode: string,
  referredUserId: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referralCode, referralCode),
        eq(referrals.referredUserId, referredUserId)
      )
    )
    .limit(1);
  return row;
}

export async function updateReferralStatusPendingById(
  db: SignupDb,
  referralId: string
): Promise<void> {
  await db
    .update(referrals)
    .set({ status: 'pending' })
    .where(eq(referrals.id, referralId));
}

export async function insertReferralSignupRowReturningId(
  db: SignupDb,
  row: NewReferral
): Promise<{ id: string } | undefined> {
  const [created] = await db
    .insert(referrals)
    .values(row)
    .returning({ id: referrals.id });
  return created;
}

export async function selectWelcomeBonusBalanceTransactionExists(
  db: SignupDb,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: balanceTransactions.id })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.userId, userId),
        eq(balanceTransactions.description, 'Welcome bonus - initial signup')
      )
    )
    .limit(1);
  return row !== undefined;
}

export async function incrementUserVirtualBalanceWelcomeBonus(
  db: SignupDb,
  userId: string,
  welcomeBonus: number
): Promise<{ virtualBalance: string } | undefined> {
  const [updated] = await db
    .update(users)
    .set({
      virtualBalance: sql`(${users.virtualBalance})::numeric + ${welcomeBonus}`,
      totalDeposited: sql`(${users.totalDeposited})::numeric + ${welcomeBonus}`,
    })
    .where(eq(users.id, userId))
    .returning({ virtualBalance: users.virtualBalance });
  return updated;
}

export async function insertWebSignupBalanceTransactionRow(
  db: SignupDb,
  row: NewBalanceTransaction
): Promise<void> {
  await db.insert(balanceTransactions).values(row);
}

export async function updateReferralCompletedBySignupId(
  db: SignupDb,
  referralId: string,
  completedAt: Date
): Promise<void> {
  await db
    .update(referrals)
    .set({
      status: 'completed',
      completedAt,
    })
    .where(eq(referrals.id, referralId));
}

export async function updateReferralRejectedBySignupId(
  db: SignupDb,
  referralId: string
): Promise<void> {
  await db
    .update(referrals)
    .set({ status: 'rejected' })
    .where(eq(referrals.id, referralId));
}
