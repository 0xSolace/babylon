/**
 * SQL for POST /api/cron/markets-tick (reads, writes, and orchestrated transactions).
 */

import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  max,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { asSystem } from './db';
import { games } from './tables/games';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { timeframedMarkets } from './tables/timeframed-markets';
import { worldEvents } from './tables/world-events';

export type MarketsTickContinuousGameRow = {
  id: string;
  isRunning: boolean;
  isContinuous: boolean;
  currentDay: number | null;
};

export async function selectMarketsTickContinuousGameRow(): Promise<MarketsTickContinuousGameRow | null> {
  return asSystem(async (c) => {
    const [game] = await c
      .select({
        id: games.id,
        isRunning: games.isRunning,
        isContinuous: games.isContinuous,
        currentDay: games.currentDay,
      })
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);
    return game ?? null;
  }, 'markets-tick-game-state');
}

export type OrphanedTimeframedMarketRow = {
  id: string;
  questionId: string | null;
  endTime: Date;
};

export async function selectOrphanedActiveTimeframedMarketsPastEnd(
  now: Date
): Promise<OrphanedTimeframedMarketRow[]> {
  return asSystem(
    (c) =>
      c
        .select({
          id: timeframedMarkets.id,
          questionId: timeframedMarkets.questionId,
          endTime: timeframedMarkets.endTime,
        })
        .from(timeframedMarkets)
        .where(
          and(
            eq(timeframedMarkets.isActive, true),
            lte(timeframedMarkets.endTime, now)
          )
        ),
    'markets-tick-orphaned-markets'
  );
}

export type LinkedQuestionSliceRow = {
  id: string;
  questionNumber: number;
  status: string;
};

export async function selectLinkedQuestionSliceById(
  questionId: string
): Promise<LinkedQuestionSliceRow | undefined> {
  const [row] = await asSystem(
    (c) =>
      c
        .select({
          id: questions.id,
          questionNumber: questions.questionNumber,
          status: questions.status,
        })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1),
    'markets-tick-orphaned-linked-question'
  );
  return row;
}

export async function selectWinningPredictionPositionUserIdsByMarketId(
  marketId: string
): Promise<{ userId: string }[]> {
  return asSystem(
    (c) =>
      c
        .select({ userId: positions.userId })
        .from(positions)
        .where(
          and(eq(positions.marketId, marketId), eq(positions.outcome, true))
        ),
    'markets-tick-orphaned-winners'
  );
}

export async function updateTimeframedMarketOrphanResolved(
  timeframedMarketId: string,
  resolutionTimestamp: Date
): Promise<void> {
  await asSystem(
    (c) =>
      c
        .update(timeframedMarkets)
        .set({
          isResolved: true,
          isActive: false,
          resolvedAt: resolutionTimestamp,
          updatedAt: resolutionTimestamp,
        })
        .where(eq(timeframedMarkets.id, timeframedMarketId)),
    'markets-tick-orphan-mark-resolved'
  );
}

export type ActiveTimeframedForGroupingRow = {
  id: string;
  questionId: string | null;
  granularTimeframe: string | null;
  startTime: Date;
  endTime: Date;
};

export async function selectActiveMainTimeframedMarketsForGrouping(): Promise<
  ActiveTimeframedForGroupingRow[]
> {
  return asSystem(
    (c) =>
      c
        .select({
          id: timeframedMarkets.id,
          questionId: timeframedMarkets.questionId,
          granularTimeframe: timeframedMarkets.granularTimeframe,
          startTime: timeframedMarkets.startTime,
          endTime: timeframedMarkets.endTime,
        })
        .from(timeframedMarkets)
        .where(
          and(
            eq(timeframedMarkets.isActive, true),
            isNull(timeframedMarkets.parentMarketId)
          )
        ),
    'markets-tick-active-by-timeframe'
  );
}

export type MatureQuestionWithTimeframeRow = {
  id: string;
  questionNumber: number;
  resolutionDate: Date;
  timeframe: string | null;
};

export async function selectMatureActiveQuestionsWithTimeframe(
  now: Date
): Promise<MatureQuestionWithTimeframeRow[]> {
  return asSystem(
    (c) =>
      c
        .select({
          id: questions.id,
          questionNumber: questions.questionNumber,
          resolutionDate: questions.resolutionDate,
          timeframe: timeframedMarkets.timeframe,
        })
        .from(questions)
        .leftJoin(
          timeframedMarkets,
          eq(timeframedMarkets.questionId, questions.id)
        )
        .where(
          and(
            eq(questions.status, 'active'),
            lte(questions.resolutionDate, now)
          )
        ),
    'markets-tick-mature-questions'
  );
}

export async function selectQuestionFullRowByQuestionNumber(
  questionNumber: number
): Promise<typeof questions.$inferSelect | undefined> {
  const [row] = await asSystem(
    (c) =>
      c
        .select()
        .from(questions)
        .where(eq(questions.questionNumber, questionNumber))
        .limit(1),
    'markets-tick-resolve-question'
  );
  return row;
}

export async function selectRecentWorldEventsForMarketsTickResolution(
  since: Date
): Promise<(typeof worldEvents.$inferSelect)[]> {
  return asSystem(
    (c) =>
      c
        .select()
        .from(worldEvents)
        .where(gte(worldEvents.timestamp, since))
        .orderBy(desc(worldEvents.timestamp))
        .limit(50),
    'markets-tick-resolution-world-events'
  );
}

export type MarketsTickResolutionProofPostInsert = typeof posts.$inferInsert;

export async function runMarketsTickSaveResolutionProofTransaction(params: {
  proofPost: MarketsTickResolutionProofPostInsert | null;
  questionId: string;
  questionUpdate: {
    resolutionDescription: string;
    resolutionProofUrl: string | null;
    resolutionConfidence: number;
    requiresManualReview: boolean;
    resolutionReviewStatus: string | null;
  };
}): Promise<void> {
  await asSystem(async (tx) => {
    if (params.proofPost) {
      await tx.insert(posts).values(params.proofPost);
    }
    await tx
      .update(questions)
      .set({
        ...params.questionUpdate,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, params.questionId));
  }, 'markets-tick-save-resolution-proof');
}

export async function selectWinningPredictionPositionUserIdsForResolution(
  marketId: string
): Promise<{ userId: string }[]> {
  return asSystem(
    (c) =>
      c
        .select({ userId: positions.userId })
        .from(positions)
        .where(
          and(eq(positions.marketId, marketId), eq(positions.outcome, true))
        ),
    'markets-tick-resolution-winners'
  );
}

export type ActiveMainMarketCacheRow = {
  id: string;
  granularTimeframe: string | null;
  startTime: Date;
  endTime: Date;
};

export async function selectActiveMainTimeframedMarketsForIdempotencyCache(): Promise<
  ActiveMainMarketCacheRow[]
> {
  return asSystem(
    (c) =>
      c
        .select({
          id: timeframedMarkets.id,
          granularTimeframe: timeframedMarkets.granularTimeframe,
          startTime: timeframedMarkets.startTime,
          endTime: timeframedMarkets.endTime,
        })
        .from(timeframedMarkets)
        .where(
          and(
            eq(timeframedMarkets.isActive, true),
            isNull(timeframedMarkets.parentMarketId)
          )
        ),
    'markets-tick-active-markets-cache'
  );
}

export async function selectMaxQuestionNumberForMarketsTick(): Promise<
  number | bigint | string | null | undefined
> {
  const result = await asSystem(
    (c) =>
      c.select({ maxNumber: max(questions.questionNumber) }).from(questions),
    'markets-tick-next-question-number'
  );
  return result[0]?.maxNumber;
}

export type NewQuestionInsert = typeof questions.$inferInsert;
export type NewTimeframedMarketInsert = typeof timeframedMarkets.$inferInsert;

export async function runMarketsTickCreateMainMarketTransaction(
  questionRow: NewQuestionInsert,
  timeframedRow: NewTimeframedMarketInsert,
  ensurePredictionMarket: (tx: DrizzleClient) => Promise<{ id: string }>
): Promise<{ marketId: string }> {
  return asSystem(async (tx) => {
    await tx.insert(questions).values(questionRow);
    const market = await ensurePredictionMarket(tx);
    await tx.insert(timeframedMarkets).values(timeframedRow);
    return { marketId: market.id };
  }, 'markets-tick-create-main-market');
}

export async function runMarketsTickCreateSubMarketTransaction(
  questionRow: NewQuestionInsert,
  timeframedRow: NewTimeframedMarketInsert,
  ensurePredictionMarket: (tx: DrizzleClient) => Promise<{ id: string }>
): Promise<void> {
  await asSystem(async (tx) => {
    await tx.insert(questions).values(questionRow);
    await ensurePredictionMarket(tx);
    await tx.insert(timeframedMarkets).values(timeframedRow);
  }, 'markets-tick-create-sub-market');
}

export async function insertMarketsTickSubMarketAnnouncementPost(params: {
  postId: string;
  questionId: string;
  authorId: string;
  content: string;
  gameId: string;
  dayNumber: number;
}): Promise<number | null> {
  return asSystem(async (c) => {
    const [questionData] = await c
      .select({ questionNumber: questions.questionNumber })
      .from(questions)
      .where(eq(questions.id, params.questionId))
      .limit(1);

    await c.insert(posts).values({
      id: params.postId,
      authorId: params.authorId,
      content: params.content,
      timestamp: new Date(),
      type: 'market_announcement',
      gameId: params.gameId,
      dayNumber: params.dayNumber,
      relatedQuestion: questionData?.questionNumber ?? null,
    });
    return questionData?.questionNumber ?? null;
  }, 'markets-tick-sub-market-announcement-post');
}

export type MarketsTickSubMarketParentRow = {
  id: string;
  questionId: string | null;
  questionText: string | null;
  category: string | null;
  arcState: string;
  affiliatedActorIds: unknown;
  affiliatedOrgIds: unknown;
  rootMarketId: string | null;
  topicKey: string | null;
  topicLabel: string | null;
  topicDate: Date | null;
  endTime: Date;
};

export async function runMarketsTickSubMarketsOrchestration(params: {
  maxSubMarkets: number;
  maxPerTick: number;
  deadlineMs: number;
  nowMs: () => number;
  getConstrainedSubMarketDuration: (
    parentEndTime: Date,
    nowMs: number
  ) => number | null;
  onDeadlineReached?: () => void;
  onSubMarketCapAfterLock?: (args: {
    initialCount: number;
    refreshedCount: number;
  }) => void;
  onEachParent: (
    parent: MarketsTickSubMarketParentRow,
    durationMs: number
  ) => Promise<boolean>;
}): Promise<{
  gapFillingSkippedDueToMax: boolean;
  createdCount: number;
  skippedDueToInsufficientTime: number;
  activeSubMarketCount: number;
  subMarketsNeeded: number;
  createCount: number;
}> {
  const {
    maxSubMarkets,
    maxPerTick,
    deadlineMs,
    nowMs,
    getConstrainedSubMarketDuration,
    onDeadlineReached,
    onSubMarketCapAfterLock,
    onEachParent,
  } = params;

  let gapFillingSkippedDueToMax = false;
  let createdCount = 0;
  let skippedDueToInsufficientTime = 0;
  let activeSubMarketCount = 0;
  let subMarketsNeeded = 0;
  let createCount = 0;

  await asSystem(async (tx) => {
    const [subMarketCountResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(timeframedMarkets)
      .where(
        and(
          eq(timeframedMarkets.isActive, true),
          isNotNull(timeframedMarkets.parentMarketId)
        )
      );

    activeSubMarketCount = subMarketCountResult?.count ?? 0;
    subMarketsNeeded = Math.max(0, maxSubMarkets - activeSubMarketCount);

    if (activeSubMarketCount >= maxSubMarkets) {
      gapFillingSkippedDueToMax = true;
      return;
    }

    if (subMarketsNeeded <= 0 || nowMs() >= deadlineMs) {
      return;
    }

    createCount = Math.min(subMarketsNeeded, maxPerTick);

    const parentMarkets = await tx
      .select({
        id: timeframedMarkets.id,
        questionId: timeframedMarkets.questionId,
        questionText: questions.text,
        category: timeframedMarkets.category,
        arcState: timeframedMarkets.arcState,
        affiliatedActorIds: timeframedMarkets.affiliatedActorIds,
        affiliatedOrgIds: timeframedMarkets.affiliatedOrgIds,
        rootMarketId: timeframedMarkets.rootMarketId,
        topicKey: timeframedMarkets.topicKey,
        topicLabel: timeframedMarkets.topicLabel,
        topicDate: timeframedMarkets.topicDate,
        endTime: timeframedMarkets.endTime,
      })
      .from(timeframedMarkets)
      .leftJoin(questions, eq(questions.id, timeframedMarkets.questionId))
      .where(
        and(
          eq(timeframedMarkets.isActive, true),
          isNull(timeframedMarkets.parentMarketId)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(createCount)
      .for('update', { of: [timeframedMarkets], skipLocked: true });

    const [refreshedCountResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(timeframedMarkets)
      .where(
        and(
          eq(timeframedMarkets.isActive, true),
          isNotNull(timeframedMarkets.parentMarketId)
        )
      );

    const refreshedSubMarketCount = refreshedCountResult?.count ?? 0;
    if (refreshedSubMarketCount >= maxSubMarkets) {
      gapFillingSkippedDueToMax = true;
      onSubMarketCapAfterLock?.({
        initialCount: activeSubMarketCount,
        refreshedCount: refreshedSubMarketCount,
      });
      return;
    }

    for (const parentMarket of parentMarkets) {
      if (nowMs() >= deadlineMs) {
        onDeadlineReached?.();
        break;
      }

      const t = nowMs();
      const duration = getConstrainedSubMarketDuration(parentMarket.endTime, t);

      if (duration === null) {
        skippedDueToInsufficientTime++;
        continue;
      }

      const row: MarketsTickSubMarketParentRow = {
        id: parentMarket.id,
        questionId: parentMarket.questionId,
        questionText: parentMarket.questionText,
        category: parentMarket.category,
        arcState: parentMarket.arcState,
        affiliatedActorIds: parentMarket.affiliatedActorIds,
        affiliatedOrgIds: parentMarket.affiliatedOrgIds,
        rootMarketId: parentMarket.rootMarketId,
        topicKey: parentMarket.topicKey,
        topicLabel: parentMarket.topicLabel,
        topicDate: parentMarket.topicDate,
        endTime: parentMarket.endTime,
      };

      const created = await onEachParent(row, duration);
      if (created) {
        createdCount++;
      }
    }
  }, 'markets-tick-sub-markets');

  return {
    gapFillingSkippedDueToMax,
    createdCount,
    skippedDueToInsufficientTime,
    activeSubMarketCount,
    subMarketsNeeded,
    createCount,
  };
}
