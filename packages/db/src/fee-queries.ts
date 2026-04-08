/**
 * Trading fee inserts/reads and referral credit updates for `FeeService`.
 *
 * **Why here:** Fee rows and balance updates are SQL; fee rates and `FeeType` stay in engine.
 */

import { generateSnowflakeId } from '@babylon/shared';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  type SQL,
  sum,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem, type Transaction } from './db';
import { balanceTransactions } from './tables/balance-transactions';
import { tradingFees } from './tables/trading-fees';
import { users } from './tables/user';
import { Decimal } from './types';

type DbLike = DrizzleClient | Transaction;

export async function fetchUserReferredBy(
  userId: string
): Promise<string | null> {
  const [user] = await asSystem(
    async (c) =>
      c
        .select({ referredBy: users.referredBy })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    'fee-service-user-referrer'
  );

  return user?.referredBy ?? null;
}

export async function selectUserReferredBy(
  tx: DbLike,
  userId: string
): Promise<string | null> {
  const [user] = await tx
    .select({ referredBy: users.referredBy })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.referredBy ?? null;
}

export async function insertTradingFeeRow(
  tx: DbLike,
  params: {
    userId: string;
    tradeType: string;
    tradeId: string | null;
    marketId: string | null;
    feeAmount: number;
    platformShare: number;
    referrerShare: number;
    referrerId: string | null;
  }
): Promise<void> {
  const {
    userId,
    tradeType,
    tradeId,
    marketId,
    feeAmount,
    platformShare,
    referrerShare,
    referrerId,
  } = params;

  await tx.insert(tradingFees).values({
    id: await generateSnowflakeId(),
    userId,
    tradeType,
    tradeId,
    marketId,
    feeAmount: new Decimal(feeAmount).toString(),
    platformFee: new Decimal(platformShare).toString(),
    referrerFee: new Decimal(referrerShare).toString(),
    referrerId,
  });
}

export async function incrementUserTotalFeesPaid(
  tx: DbLike,
  userId: string,
  feeAmountDelta: number
): Promise<void> {
  const [currentUser] = await tx
    .select({ totalFeesPaid: users.totalFeesPaid })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const currentTotalFees = currentUser ? Number(currentUser.totalFeesPaid) : 0;

  await tx
    .update(users)
    .set({
      totalFeesPaid: new Decimal(currentTotalFees + feeAmountDelta).toString(),
    })
    .where(eq(users.id, userId));
}

/**
 * Credits referrer balance and appends a balance transaction. Returns `false` if referrer row missing.
 */
export async function creditReferrerReferralFeeInTx(
  tx: DbLike,
  params: {
    referrerId: string;
    feeAmount: number;
    traderId: string;
    balanceTransactionType: string;
    description: string;
  }
): Promise<boolean> {
  const {
    referrerId,
    feeAmount,
    traderId,
    balanceTransactionType,
    description,
  } = params;

  const [referrer] = await tx
    .select({
      virtualBalance: users.virtualBalance,
      totalFeesEarned: users.totalFeesEarned,
    })
    .from(users)
    .where(eq(users.id, referrerId))
    .limit(1);

  if (!referrer) {
    return false;
  }

  const currentBalance = Number(referrer.virtualBalance ?? 0);
  const newBalance = currentBalance + feeAmount;
  const currentFeesEarned = Number(referrer.totalFeesEarned ?? 0);

  await tx
    .update(users)
    .set({
      virtualBalance: new Decimal(newBalance).toString(),
      totalFeesEarned: new Decimal(currentFeesEarned + feeAmount).toString(),
    })
    .where(eq(users.id, referrerId));

  await tx.insert(balanceTransactions).values({
    id: await generateSnowflakeId(),
    userId: referrerId,
    type: balanceTransactionType,
    amount: new Decimal(feeAmount).toString(),
    balanceBefore: new Decimal(currentBalance).toString(),
    balanceAfter: new Decimal(newBalance).toString(),
    relatedId: traderId,
    description,
  });

  return true;
}

export type FeeReferralEarningsRow = {
  totalEarned: number;
  totalReferrals: number;
  topReferrals: Array<{
    userId: string;
    username: string;
    displayName: string;
    profileImageUrl: string | null;
    totalFees: number;
    tradeCount: number;
  }>;
  recentFees: Array<{
    id: string;
    tradeType: string;
    feeAmount: number;
    traderId: string;
    traderUsername: string | null;
    createdAt: Date;
  }>;
};

export async function fetchFeeReferralEarnings(params: {
  referrerUserId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<FeeReferralEarningsRow> {
  const { referrerUserId, startDate, endDate, limit = 10 } = params;

  const conditions = [eq(tradingFees.referrerId, referrerUserId)];
  if (startDate) {
    conditions.push(gte(tradingFees.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(tradingFees.createdAt, endDate));
  }
  const whereClause = and(...conditions);

  return asSystem(async (c) => {
    const [totalResult] = await c
      .select({
        totalReferrerFee: sum(tradingFees.referrerFee),
      })
      .from(tradingFees)
      .where(whereClause);

    const totalEarned = Number(totalResult?.totalReferrerFee || 0);

    const uniqueTraders = await c
      .selectDistinct({ userId: tradingFees.userId })
      .from(tradingFees)
      .where(whereClause);

    const topReferralsData = await c
      .select({
        userId: tradingFees.userId,
        totalReferrerFee: sum(tradingFees.referrerFee),
        tradeCount: count(),
      })
      .from(tradingFees)
      .where(whereClause)
      .groupBy(tradingFees.userId)
      .orderBy(desc(sum(tradingFees.referrerFee)))
      .limit(limit);

    const recentFees = await c
      .select({
        id: tradingFees.id,
        tradeType: tradingFees.tradeType,
        referrerFee: tradingFees.referrerFee,
        userId: tradingFees.userId,
        createdAt: tradingFees.createdAt,
      })
      .from(tradingFees)
      .where(whereClause)
      .orderBy(desc(tradingFees.createdAt))
      .limit(limit);

    const traderIds = [
      ...new Set([
        ...topReferralsData.map((item) => item.userId),
        ...recentFees.map((fee) => fee.userId),
      ]),
    ];

    const traderRows =
      traderIds.length > 0
        ? await c
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              profileImageUrl: users.profileImageUrl,
            })
            .from(users)
            .where(inArray(users.id, traderIds))
        : [];

    const byId = new Map(traderRows.map((u) => [u.id, u]));

    const topReferrals = topReferralsData.map((item) => {
      const user = byId.get(item.userId);
      return {
        userId: item.userId,
        username: user?.username || 'Unknown',
        displayName: user?.displayName || 'Unknown User',
        profileImageUrl: user?.profileImageUrl || null,
        totalFees: Number(item.totalReferrerFee || 0),
        tradeCount: item.tradeCount,
      };
    });

    const recentFeesWithUsers = recentFees.map((fee) => {
      const trader = byId.get(fee.userId);
      return {
        id: fee.id,
        tradeType: fee.tradeType,
        feeAmount: Number(fee.referrerFee),
        traderId: fee.userId,
        traderUsername: trader?.username ?? null,
        createdAt: fee.createdAt,
      };
    });

    return {
      totalEarned,
      totalReferrals: uniqueTraders.length,
      topReferrals,
      recentFees: recentFeesWithUsers,
    };
  }, 'fee-service-referral-earnings');
}

export type FeePlatformStatsRow = {
  totalFeesCollected: number;
  totalReferrerFees: number;
  totalPlatformFees: number;
  totalTrades: number;
};

export async function fetchFeePlatformStats(params: {
  startDate?: Date;
  endDate?: Date;
}): Promise<FeePlatformStatsRow> {
  const { startDate, endDate } = params;

  const conditions: SQL<unknown>[] = [];
  if (startDate) {
    conditions.push(gte(tradingFees.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(tradingFees.createdAt, endDate));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [result] = await asSystem(
    async (c) =>
      c
        .select({
          totalFeeAmount: sum(tradingFees.feeAmount),
          totalPlatformFee: sum(tradingFees.platformFee),
          totalReferrerFee: sum(tradingFees.referrerFee),
          count: count(),
        })
        .from(tradingFees)
        .where(whereClause),
    'fee-service-platform-stats'
  );

  return {
    totalFeesCollected: Number(result?.totalFeeAmount || 0),
    totalReferrerFees: Number(result?.totalReferrerFee || 0),
    totalPlatformFees: Number(result?.totalPlatformFee || 0),
    totalTrades: result?.count || 0,
  };
}
