/**
 * Aggregations for GET /api/admin/fees (system RLS `DrizzleClient`).
 */

import { and, count, desc, eq, gte, isNotNull, lte, sum } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { pools } from './tables/pools';
import { tradingFees } from './tables/trading-fees';
import { users } from './tables/user';

function tradingFeeDateWhere(startDate?: Date, endDate?: Date) {
  const conditions = [];
  if (startDate) {
    conditions.push(gte(tradingFees.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(tradingFees.createdAt, endDate));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function selectAdminPoolsTotalFeesCollectedSum(
  db: DrizzleClient
): Promise<number> {
  const poolFeesResult = await db
    .select({
      _sum: sum(pools.totalFeesCollected),
    })
    .from(pools);
  return Number(poolFeesResult[0]?._sum || 0);
}

export type AdminFeesByTypeRow = {
  tradeType: string;
  feeAmountSum: string | null;
  platformFeeSum: string | null;
  referrerFeeSum: string | null;
  _count: number;
};

export async function selectAdminTradingFeesGroupedByType(
  db: DrizzleClient,
  params: { startDate?: Date; endDate?: Date }
): Promise<AdminFeesByTypeRow[]> {
  const whereClause = tradingFeeDateWhere(params.startDate, params.endDate);
  return db
    .select({
      tradeType: tradingFees.tradeType,
      feeAmountSum: sum(tradingFees.feeAmount),
      platformFeeSum: sum(tradingFees.platformFee),
      referrerFeeSum: sum(tradingFees.referrerFee),
      _count: count(),
    })
    .from(tradingFees)
    .where(whereClause)
    .groupBy(tradingFees.tradeType)
    .orderBy(desc(sum(tradingFees.feeAmount)));
}

export type AdminTopFeePayerRow = {
  userId: string;
  feeAmountSum: string | null;
  _count: number;
};

export async function selectAdminTopFeePayers(
  db: DrizzleClient,
  params: { startDate?: Date; endDate?: Date; limit: number }
): Promise<AdminTopFeePayerRow[]> {
  const whereClause = tradingFeeDateWhere(params.startDate, params.endDate);
  return db
    .select({
      userId: tradingFees.userId,
      feeAmountSum: sum(tradingFees.feeAmount),
      _count: count(),
    })
    .from(tradingFees)
    .where(whereClause)
    .groupBy(tradingFees.userId)
    .orderBy(desc(sum(tradingFees.feeAmount)))
    .limit(params.limit);
}

export type AdminTopReferrerRow = {
  referrerId: string | null;
  referrerFeeSum: string | null;
  _count: number;
};

export async function selectAdminTopReferralEarners(
  db: DrizzleClient,
  params: { startDate?: Date; endDate?: Date; limit: number }
): Promise<AdminTopReferrerRow[]> {
  const dateParts = [];
  if (params.startDate) {
    dateParts.push(gte(tradingFees.createdAt, params.startDate));
  }
  if (params.endDate) {
    dateParts.push(lte(tradingFees.createdAt, params.endDate));
  }
  const referralWhereClause = and(
    ...dateParts,
    isNotNull(tradingFees.referrerId)
  );

  return db
    .select({
      referrerId: tradingFees.referrerId,
      referrerFeeSum: sum(tradingFees.referrerFee),
      _count: count(),
    })
    .from(tradingFees)
    .where(referralWhereClause)
    .groupBy(tradingFees.referrerId)
    .orderBy(desc(sum(tradingFees.referrerFee)))
    .limit(params.limit);
}

export type AdminRecentFeeWithUserRow = {
  id: string;
  userId: string;
  tradeType: string;
  tradeId: string | null;
  marketId: string | null;
  feeAmount: string;
  platformFee: string;
  referrerFee: string;
  referrerId: string | null;
  createdAt: Date;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean | null;
};

export async function selectAdminRecentFeesWithUserJoin(
  db: DrizzleClient,
  params: { startDate?: Date; endDate?: Date; limit: number }
): Promise<AdminRecentFeeWithUserRow[]> {
  return db
    .select({
      id: tradingFees.id,
      userId: tradingFees.userId,
      tradeType: tradingFees.tradeType,
      tradeId: tradingFees.tradeId,
      marketId: tradingFees.marketId,
      feeAmount: tradingFees.feeAmount,
      platformFee: tradingFees.platformFee,
      referrerFee: tradingFees.referrerFee,
      referrerId: tradingFees.referrerId,
      createdAt: tradingFees.createdAt,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
    })
    .from(tradingFees)
    .leftJoin(users, eq(tradingFees.userId, users.id))
    .where(
      params.startDate || params.endDate
        ? and(
            params.startDate
              ? gte(tradingFees.createdAt, params.startDate)
              : undefined,
            params.endDate
              ? lte(tradingFees.createdAt, params.endDate)
              : undefined
          )
        : undefined
    )
    .orderBy(desc(tradingFees.createdAt))
    .limit(params.limit);
}

export async function selectAdminFeeTrendFeeRows(
  db: DrizzleClient,
  params: { trendStartDate: Date; endDate?: Date }
) {
  return db.tradingFee.findMany({
    where: {
      createdAt: {
        gte: params.trendStartDate,
        ...(params.endDate ? { lte: params.endDate } : {}),
      },
    },
    select: {
      createdAt: true,
      feeAmount: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}
