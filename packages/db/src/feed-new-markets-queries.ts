/**
 * SQL for GET /api/feed/new-markets (recently opened prediction questions + market slice).
 */

import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { arcStates } from './tables/arc-states';
import { markets } from './tables/markets';
import { questions } from './tables/questions';

type FeedNewMarketsDb = DrizzleClient | Transaction;

const NEW_MARKET_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NewMarketsFeedQueryRow = {
  questionNumber: number;
  text: string;
  resolutionDate: Date;
  createdAt: Date;
  arcState: string | null;
  marketId: string | null;
  yesShares: string | null;
  noShares: string | null;
};

export async function selectNewMarketsFeedRows(
  db: FeedNewMarketsDb,
  options: { now?: Date; limit?: number } = {}
): Promise<NewMarketsFeedQueryRow[]> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 5;
  const cutoff = new Date(now.getTime() - NEW_MARKET_WINDOW_MS);

  return db
    .select({
      questionNumber: questions.questionNumber,
      text: questions.text,
      resolutionDate: questions.resolutionDate,
      createdAt: questions.createdAt,
      arcState: arcStates.currentState,
      marketId: markets.id,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(questions)
    .leftJoin(arcStates, eq(arcStates.questionId, questions.id))
    .leftJoin(
      markets,
      sql`lower(trim(${markets.question})) = lower(trim(${questions.text}))`
    )
    .where(
      and(
        eq(questions.status, 'active'),
        gte(questions.createdAt, cutoff),
        lt(
          questions.resolutionDate,
          new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        )
      )
    )
    .orderBy(desc(questions.createdAt))
    .limit(limit);
}
