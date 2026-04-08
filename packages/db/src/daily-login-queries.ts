/**
 * Daily login streak reads and claim transaction writes for `daily-login-service`.
 */

import { eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { users } from './tables/user';

type DailyLoginDb = DrizzleClient | Transaction;

export type DailyLoginStreakSnapshotRow = {
  dailyLoginStreak: number;
  lastDailyLogin: Date | null;
  longestStreak: number;
  totalDailyLogins: number;
};

export async function selectDailyLoginStreakSnapshot(
  db: DailyLoginDb,
  userId: string
): Promise<DailyLoginStreakSnapshotRow | undefined> {
  const [row] = await db
    .select({
      dailyLoginStreak: users.dailyLoginStreak,
      lastDailyLogin: users.lastDailyLogin,
      longestStreak: users.longestStreak,
      totalDailyLogins: users.totalDailyLogins,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type DailyLoginClaimUserRow = {
  dailyLoginStreak: number;
  lastDailyLogin: Date | null;
  longestStreak: number;
  totalDailyLogins: number;
  virtualBalance: string;
};

export async function selectUserForDailyLoginClaimForUpdate(
  tx: Transaction,
  userId: string
): Promise<DailyLoginClaimUserRow | undefined> {
  const [row] = await tx
    .select({
      dailyLoginStreak: users.dailyLoginStreak,
      lastDailyLogin: users.lastDailyLogin,
      longestStreak: users.longestStreak,
      totalDailyLogins: users.totalDailyLogins,
      virtualBalance: users.virtualBalance,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for('update');
  return row;
}

export async function updateUserAfterDailyLoginClaim(
  tx: Transaction,
  userId: string,
  args: {
    newStreak: number;
    now: Date;
    newLongestStreak: number;
    nextTotalDailyLogins: number;
    totalAwarded: number;
  }
): Promise<void> {
  await tx
    .update(users)
    .set({
      dailyLoginStreak: args.newStreak,
      lastDailyLogin: args.now,
      longestStreak: args.newLongestStreak,
      totalDailyLogins: args.nextTotalDailyLogins,
      virtualBalance: sql`${users.virtualBalance} + ${args.totalAwarded}`,
      bonusPoints: sql`${users.bonusPoints} + ${args.totalAwarded}`,
      reputationPoints: sql`${users.reputationPoints} + ${args.totalAwarded}`,
      updatedAt: args.now,
    })
    .where(eq(users.id, userId));
}

export async function insertDailyLoginBalanceTransaction(
  tx: Transaction,
  row: {
    id: string;
    userId: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    description: string;
  }
): Promise<void> {
  await tx.insert(balanceTransactions).values({
    id: row.id,
    userId: row.userId,
    type: 'deposit',
    amount: row.amount,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    description: row.description,
  });
}
