/**
 * SQL for `game-tick.ts` (continuous game, questions, bootstrap counts, perp slices,
 * widget cache, world-facts markers, oracle field updates, narrative arc preload).
 *
 * **Why here:** engine tick wiring stays in `packages/engine`; reads/writes run under **`asSystem`**.
 * **`Transaction`** helpers (e.g. prediction resolve follow-up updates) accept the client from **`db.transaction`**.
 */

import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { asSystem, type Transaction } from './db';
import { actorRelationships } from './tables/actor-relationships';
import { arcStates } from './tables/arc-states';
import { games } from './tables/games';
import { markets } from './tables/markets';
import { organizationState } from './tables/organization-state';
import { perpMarketSnapshots } from './tables/perp-market-snapshots';
import { perpPositions } from './tables/perp-positions';
import { pools } from './tables/pools';
import { positions } from './tables/positions';
import { postTags } from './tables/post-tags';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { tags } from './tables/tags';
import {
  type NewTickTokenStatsRow,
  tickTokenStats,
} from './tables/tick-token-stats';
import { timeframedMarkets } from './tables/timeframed-markets';
import { trendingTags } from './tables/trending-tags';
import { widgetCaches } from './tables/widget-caches';
import type { NewWorldFact } from './tables/world-facts';
import { worldFacts } from './tables/world-facts';
import type { JsonValue } from './types';

export type GameTickQuestionRow = typeof questions.$inferSelect;
export type GameTickMarketRow = typeof markets.$inferSelect;

export async function fetchContinuousGameStartedAtSliceAsSystem() {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: games.id, startedAt: games.startedAt })
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);
    return row;
  }, 'game-tick-continuous-slice');
}

export async function touchContinuousGameLastTickAsSystem(params: {
  tickAt: Date;
  currentDay: number;
}): Promise<void> {
  const { tickAt, currentDay } = params;
  return asSystem(async (c) => {
    await c
      .update(games)
      .set({
        lastTickAt: tickAt,
        updatedAt: tickAt,
        currentDay,
      })
      .where(eq(games.isContinuous, true));
  }, 'game-tick-touch-last-tick');
}

export async function listActiveQuestionRowsForGameTickAsSystem() {
  return asSystem(
    async (c) =>
      c.select().from(questions).where(eq(questions.status, 'active')),
    'game-tick-active-questions'
  );
}

export async function listActivePoolIdAndNpcActorLimitAsSystem(limit: number) {
  return asSystem(
    async (c) =>
      c
        .select({ id: pools.id, npcActorId: pools.npcActorId })
        .from(pools)
        .where(eq(pools.isActive, true))
        .limit(limit),
    'game-tick-active-pools'
  );
}

export async function countTrendingTagsAndActorRelationshipsAsSystem() {
  return asSystem(async (c) => {
    const [trendingResult, relationshipResult] = await Promise.all([
      c.select({ count: count() }).from(trendingTags),
      c.select({ count: count() }).from(actorRelationships),
    ]);
    return {
      trendingCount: Number(trendingResult[0]?.count ?? 0),
      relationshipCount: Number(relationshipResult[0]?.count ?? 0),
    };
  }, 'game-tick-bootstrap-counts');
}

export async function countPostsAndTaggedPostsJoinAsSystem() {
  return asSystem(async (c) => {
    const [postCountResult, taggedPostCountResult] = await Promise.all([
      c.select({ count: count() }).from(posts),
      c
        .select({ count: count() })
        .from(posts)
        .innerJoin(postTags, eq(posts.id, postTags.postId)),
    ]);
    return {
      postCount: Number(postCountResult[0]?.count ?? 0),
      taggedPostCount: Number(taggedPostCountResult[0]?.count ?? 0),
    };
  }, 'game-tick-post-tag-counts');
}

export async function fetchTagRowByNameAsSystem(name: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: tags.id,
        name: tags.name,
        displayName: tags.displayName,
        category: tags.category,
      })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);
    return row;
  }, 'game-tick-tag-by-name');
}

export async function insertTagRowReturningSliceAsSystem(values: {
  id: string;
  name: string;
  displayName: string;
  category: string;
  updatedAt: Date;
}) {
  return asSystem(async (c) => {
    const [newTag] = await c.insert(tags).values(values).returning();
    return newTag;
  }, 'game-tick-tag-insert');
}

export async function insertTrendingTagRowAsSystem(values: {
  id: string;
  tagId: string;
  score: number;
  postCount: number;
  rank: number;
  windowStart: Date;
  windowEnd: Date;
  relatedContext: null;
}): Promise<void> {
  return asSystem(async (c) => {
    await c.insert(trendingTags).values(values);
  }, 'game-tick-trending-insert');
}

export async function insertTickTokenStatsRowAsSystem(
  row: NewTickTokenStatsRow
): Promise<void> {
  return asSystem(async (c) => {
    await c.insert(tickTokenStats).values(row);
  }, 'game-tick-token-stats-insert');
}

export async function listPerpMarketSnapshotTickerOrgPriceAsSystem() {
  return asSystem(
    async (c) =>
      c
        .select({
          ticker: perpMarketSnapshots.ticker,
          organizationId: perpMarketSnapshots.organizationId,
          currentPrice: perpMarketSnapshots.currentPrice,
        })
        .from(perpMarketSnapshots),
    'game-tick-perp-snapshots'
  );
}

export async function listOrganizationBasePriceByIdsAsSystem(orgIds: string[]) {
  if (orgIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({
          id: organizationState.id,
          basePrice: organizationState.basePrice,
        })
        .from(organizationState)
        .where(inArray(organizationState.id, orgIds)),
    'game-tick-org-base-prices'
  );
}

export async function listOpenPerpPositionSliceForTickersAsSystem(
  tickers: string[]
) {
  if (tickers.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({
          ticker: perpPositions.ticker,
          side: perpPositions.side,
          size: perpPositions.size,
          leverage: perpPositions.leverage,
          userId: perpPositions.userId,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.ticker, tickers),
            isNull(perpPositions.closedAt)
          )
        ),
    'game-tick-perp-open-positions'
  );
}

export async function listRecentlyResolvedQuestionsForValidationAsSystem(params: {
  updatedAfter: Date;
  limit: number;
}) {
  const { updatedAfter, limit } = params;
  return asSystem(
    async (c) =>
      c
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.status, 'resolved'),
            gte(questions.updatedAt, updatedAfter)
          )
        )
        .limit(limit),
    'game-tick-resolved-questions-check'
  );
}

export async function listActivePredictionMarketsForValidationAsSystem(params: {
  asOf: Date;
  limit: number;
}) {
  const { asOf, limit } = params;
  return asSystem(
    async (c) =>
      c
        .select()
        .from(markets)
        .where(and(eq(markets.resolved, false), gte(markets.endDate, asOf)))
        .limit(limit),
    'game-tick-markets-validation'
  );
}

export async function applyOracleCommitUpdatesForQuestionsAsSystem(
  rows: Array<{
    questionId: string;
    sessionId: string;
    commitment: string;
    txHash: string;
    blockNumber: number | null;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date();
  return asSystem(async (c) => {
    for (const success of rows) {
      await c
        .update(questions)
        .set({
          oracleSessionId: success.sessionId,
          oracleCommitment: success.commitment,
          oracleCommitTxHash: success.txHash,
          oracleCommitBlock: success.blockNumber,
          updatedAt: now,
        })
        .where(eq(questions.id, success.questionId));
    }
  }, 'game-tick-oracle-commit-updates');
}

export async function applyOracleRevealUpdatesForQuestionsAsSystem(
  rows: Array<{
    questionId: string;
    txHash: string;
    blockNumber: number | null;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date();
  return asSystem(async (c) => {
    for (const success of rows) {
      await c
        .update(questions)
        .set({
          oracleRevealTxHash: success.txHash,
          oracleRevealBlock: success.blockNumber,
          oraclePublishedAt: now,
          updatedAt: now,
        })
        .where(eq(questions.id, success.questionId));
    }
  }, 'game-tick-oracle-reveal-updates');
}

export async function upsertMarketsWidgetCacheAsSystem(
  data: JsonValue
): Promise<void> {
  const widget = 'markets';
  const now = new Date();
  return asSystem(async (c) => {
    const [existing] = await c
      .select({ widget: widgetCaches.widget })
      .from(widgetCaches)
      .where(eq(widgetCaches.widget, widget))
      .limit(1);

    if (existing) {
      await c
        .update(widgetCaches)
        .set({ data, updatedAt: now })
        .where(eq(widgetCaches.widget, widget));
    } else {
      await c.insert(widgetCaches).values({ widget, data, updatedAt: now });
    }
  }, 'game-tick-widget-markets');
}

export async function fetchLatestAutoGeneratedWorldFactCreatedAtAsSystem() {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ createdAt: worldFacts.createdAt })
      .from(worldFacts)
      .where(eq(worldFacts.source, 'auto-generated'))
      .orderBy(desc(worldFacts.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
  }, 'game-tick-world-fact-latest');
}

export async function insertWorldFactRowAsSystem(
  row: NewWorldFact
): Promise<void> {
  return asSystem(async (c) => {
    await c.insert(worldFacts).values(row);
  }, 'game-tick-world-fact-insert');
}

export async function listActivePoolsForMarketsWidgetAsSystem() {
  return asSystem(
    async (c) =>
      c
        .select({
          id: pools.id,
          name: pools.name,
          npcActorId: pools.npcActorId,
          totalDeposits: pools.totalDeposits,
          totalValue: pools.totalValue,
        })
        .from(pools)
        .where(eq(pools.isActive, true))
        .orderBy(desc(pools.totalValue)),
    'game-tick-widget-pools'
  );
}

export async function listActiveUnresolvedMarketsForMarketsWidgetAsSystem(
  asOf: Date
) {
  return asSystem(
    async (c) =>
      c
        .select({
          id: markets.id,
          question: markets.question,
          yesShares: markets.yesShares,
          noShares: markets.noShares,
          createdAt: markets.createdAt,
        })
        .from(markets)
        .where(and(eq(markets.resolved, false), gte(markets.endDate, asOf))),
    'game-tick-widget-markets-slice'
  );
}

export async function listArcStateIdByQuestionIdsAsSystem(
  questionIds: string[]
) {
  if (questionIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({ id: arcStates.id, questionId: arcStates.questionId })
        .from(arcStates)
        .where(inArray(arcStates.questionId, questionIds)),
    'game-tick-arc-states-batch'
  );
}

export async function batchUpdatePerpSnapshotCurrentPriceByTickerAsSystem(
  updates: Array<{ ticker: string; newPrice: number }>
): Promise<void> {
  if (updates.length === 0) return;
  const now = new Date();
  return asSystem(async (c) => {
    for (const u of updates) {
      await c
        .update(perpMarketSnapshots)
        .set({
          currentPrice: u.newPrice,
          updatedAt: now,
        })
        .where(eq(perpMarketSnapshots.ticker, u.ticker));
    }
  }, 'game-tick-volatility-snapshot-updates');
}

export async function fetchQuestionRowByQuestionNumberAsSystem(
  questionNumber: number
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(questions)
      .where(eq(questions.questionNumber, questionNumber))
      .limit(1);
    return row;
  }, 'game-tick-question-by-number');
}

export async function fetchMarketRowByIdAsSystem(marketId: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);
    return row;
  }, 'game-tick-market-by-id');
}

export async function fetchMarketRowByQuestionTextAsSystem(
  questionText: string
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(markets)
      .where(eq(markets.question, questionText))
      .limit(1);
    return row;
  }, 'game-tick-market-by-question');
}

export async function updateMarketOnChainResolutionFieldsAsSystem(params: {
  marketId: string;
  onChainResolved: boolean;
  onChainResolutionTxHash: string;
  updatedAt: Date;
}): Promise<void> {
  const { marketId, onChainResolved, onChainResolutionTxHash, updatedAt } =
    params;
  return asSystem(async (c) => {
    await c
      .update(markets)
      .set({
        onChainResolved,
        onChainResolutionTxHash,
        updatedAt,
      })
      .where(eq(markets.id, marketId));
  }, 'game-tick-market-onchain-resolve');
}

export async function countPredictionPositionsForMarketInTx(
  tx: Transaction,
  marketId: string
): Promise<number> {
  const countResult = await tx
    .select({ count: sql<string>`count(*)` })
    .from(positions)
    .where(eq(positions.marketId, marketId));
  return Number(countResult[0]?.count ?? 0);
}

export async function markQuestionResolvedAfterPayoutInTx(
  tx: Transaction,
  params: {
    questionId: string;
    resolvedOutcome: boolean;
    resolutionTimestamp: Date;
    resolutionReviewedBy: string;
  }
): Promise<void> {
  const {
    questionId,
    resolvedOutcome,
    resolutionTimestamp,
    resolutionReviewedBy,
  } = params;
  await tx
    .update(questions)
    .set({
      status: 'resolved',
      resolvedOutcome,
      resolutionReviewedAt: resolutionTimestamp,
      resolutionReviewedBy,
      updatedAt: resolutionTimestamp,
    })
    .where(eq(questions.id, questionId));
}

export async function markTimeframedMarketResolvedForQuestionInTx(
  tx: Transaction,
  params: { questionId: string; resolutionTimestamp: Date }
): Promise<void> {
  const { questionId, resolutionTimestamp } = params;
  await tx
    .update(timeframedMarkets)
    .set({
      isResolved: true,
      isActive: false,
      resolvedAt: resolutionTimestamp,
      updatedAt: resolutionTimestamp,
    })
    .where(eq(timeframedMarkets.questionId, questionId));
}
