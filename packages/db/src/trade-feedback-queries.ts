/**
 * DB reads for trade feedback / reputation metrics (keeps Drizzle out of @babylon/engine).
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { positions } from './tables/positions';
import { questions } from './tables/questions';
import { users } from './tables/user';

export interface TradeFeedbackMetricsPositionSlice {
  id: string;
  userId: string;
  questionId: number;
  outcome: boolean | null;
  amount: string;
  pnl: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  questionResolutionDate: Date | null;
}

export interface TradeFeedbackMetricsUserSlice {
  virtualBalance: string | null;
  totalDeposited: string | null;
}

export interface TradeFeedbackMetricsContext {
  position: TradeFeedbackMetricsPositionSlice;
  userBalance: TradeFeedbackMetricsUserSlice;
}

export async function fetchTradeFeedbackMetricsContext(
  positionId: string
): Promise<TradeFeedbackMetricsContext | null> {
  const positionResult = await db
    .select({
      id: positions.id,
      userId: positions.userId,
      questionId: positions.questionId,
      outcome: positions.outcome,
      amount: positions.amount,
      pnl: positions.pnl,
      createdAt: positions.createdAt,
      resolvedAt: positions.resolvedAt,
      questionResolutionDate: questions.resolutionDate,
    })
    .from(positions)
    .leftJoin(questions, eq(positions.questionId, questions.questionNumber))
    .where(eq(positions.id, positionId))
    .limit(1);

  const row = positionResult[0];
  if (!row || row.questionId == null) {
    return null;
  }

  const userResult = await db
    .select({
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  const userBalance = userResult[0];
  if (!userBalance) {
    return null;
  }

  return {
    position: {
      id: row.id,
      userId: row.userId,
      questionId: row.questionId,
      outcome: row.outcome,
      amount: row.amount,
      pnl: row.pnl,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      questionResolutionDate: row.questionResolutionDate,
    },
    userBalance,
  };
}
