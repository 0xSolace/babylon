/**
 * SQL for GET/POST /api/admin/markets/[marketId] (detail + resolve / extend / void).
 */

import { desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { type Market, markets } from './tables/markets';
import { positions } from './tables/positions';
import { questions } from './tables/questions';
import { timeframedMarkets } from './tables/timeframed-markets';

type AdminMarketDb = DrizzleClient | Transaction;

export type AdminMarketPositionSlice = {
  id: string;
  userId: string;
  side: boolean;
  shares: string;
  avgPrice: string;
  amount: string;
  status: string;
  createdAt: Date;
};

export async function selectMarketRowByIdForAdmin(
  db: AdminMarketDb,
  marketId: string
): Promise<Market | undefined> {
  const [row] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);
  return row;
}

export async function fetchAdminMarketDetailBundle(
  db: AdminMarketDb,
  marketId: string,
  positionLimit = 100
): Promise<{
  market: Market | null;
  marketPositions: AdminMarketPositionSlice[];
}> {
  const m = await selectMarketRowByIdForAdmin(db, marketId);
  if (!m) {
    return { market: null, marketPositions: [] };
  }
  const marketPositions = await selectPositionSlicesForAdminMarket(
    db,
    marketId,
    positionLimit
  );
  return { market: m, marketPositions };
}

async function selectPositionSlicesForAdminMarket(
  db: AdminMarketDb,
  marketId: string,
  limit: number
): Promise<AdminMarketPositionSlice[]> {
  return db
    .select({
      id: positions.id,
      userId: positions.userId,
      side: positions.side,
      shares: positions.shares,
      avgPrice: positions.avgPrice,
      amount: positions.amount,
      status: positions.status,
      createdAt: positions.createdAt,
    })
    .from(positions)
    .where(eq(positions.marketId, marketId))
    .orderBy(desc(positions.createdAt))
    .limit(limit);
}

export async function updateMarketEndDateForAdmin(
  db: AdminMarketDb,
  marketId: string,
  endDate: Date,
  updatedAt: Date
): Promise<void> {
  await db
    .update(markets)
    .set({
      endDate,
      updatedAt,
    })
    .where(eq(markets.id, marketId));
}

export async function markQuestionResolvedForAdminMarket(
  db: AdminMarketDb,
  params: {
    questionId: string;
    resolvedOutcome: boolean;
    adminUserId: string;
    resolvedAt: Date;
  }
): Promise<void> {
  const { questionId, resolvedOutcome, adminUserId, resolvedAt } = params;
  await db
    .update(questions)
    .set({
      status: 'resolved',
      resolvedOutcome,
      resolutionReviewedAt: resolvedAt,
      resolutionReviewedBy: adminUserId,
      updatedAt: resolvedAt,
    })
    .where(eq(questions.id, questionId));
}

export async function markQuestionCancelledForAdminMarket(
  db: AdminMarketDb,
  params: { questionId: string; cancelledAt: Date }
): Promise<void> {
  const { questionId, cancelledAt } = params;
  await db
    .update(questions)
    .set({
      status: 'cancelled',
      updatedAt: cancelledAt,
    })
    .where(eq(questions.id, questionId));
}

export async function deactivateTimeframedMarketsForQuestion(
  db: AdminMarketDb,
  params: { questionId: string; resolvedAt: Date; updatedAt: Date }
): Promise<void> {
  const { questionId, resolvedAt, updatedAt } = params;
  await db
    .update(timeframedMarkets)
    .set({
      isActive: false,
      isResolved: true,
      resolvedAt,
      updatedAt,
    })
    .where(eq(timeframedMarkets.questionId, questionId));
}
