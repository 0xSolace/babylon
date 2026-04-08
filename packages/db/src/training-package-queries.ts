/**
 * SQL for `packages/training` (trained_models, batches, benchmarks, trajectories).
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  type BenchmarkResult,
  benchmarkResults,
  type NewBenchmarkResult,
} from './tables/benchmark-results';
import {
  marketOutcomes,
  type NewMarketOutcome,
} from './tables/market-outcomes';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import {
  type NewReactionTrajectory,
  type ReactionTrajectory,
  reactionTrajectories,
} from './tables/reaction-trajectories';
import {
  type NewTrainedModel,
  type TrainedModel,
  trainedModels,
} from './tables/trained-models';
import {
  type NewTrainingBatch,
  type TrainingBatch,
  trainingBatches,
} from './tables/training-batches';
import { type Trajectory, trajectories } from './tables/trajectories';
import { type User, users } from './tables/user';
import { userAgentConfigs } from './tables/user-agent-configs';
import type { JsonValue } from './types';

type TrainingPackageDb = DrizzleClient | Transaction;

export async function selectTrainedModelByVersion(
  db: TrainingPackageDb,
  version: string
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(eq(trainedModels.version, version))
    .limit(1);
  return row;
}

export async function updateTrainedModelDeployedByModelId(
  db: TrainingPackageDb,
  modelId: string,
  data: {
    status: string;
    deployedAt: Date;
    agentsUsing: number;
  }
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      status: data.status,
      deployedAt: data.deployedAt,
      agentsUsing: data.agentsUsing,
    })
    .where(eq(trainedModels.modelId, modelId));
}

export async function listAgentUsersIdDisplayNameForTraining(
  db: TrainingPackageDb
): Promise<{ id: string; displayName: string | null }[]> {
  return db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.isAgent, true));
}

export async function insertTrainedModelRow(
  db: TrainingPackageDb,
  row: NewTrainedModel
): Promise<void> {
  await db.insert(trainedModels).values(row);
}

export async function selectTrainedModelStoragePathByVersion(
  db: TrainingPackageDb,
  version: string
): Promise<{ storagePath: string } | undefined> {
  const [row] = await db
    .select({ storagePath: trainedModels.storagePath })
    .from(trainedModels)
    .where(eq(trainedModels.version, version))
    .limit(1);
  return row;
}

export async function updateTrainedModelArchivedByVersion(
  db: TrainingPackageDb,
  version: string
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      status: 'archived',
      archivedAt: new Date(),
    })
    .where(eq(trainedModels.version, version));
}

export type LlmJudgeWarmTrajectoryRow = {
  trajectoryId: string;
  stepsJson: string;
  aiJudgeReward: number | null;
  aiJudgeReasoning: string | null;
  judgedAt: Date | null;
};

export async function selectTrainingTrajectoriesForLlmJudgeWarm(
  db: TrainingPackageDb,
  limit: number
): Promise<LlmJudgeWarmTrajectoryRow[]> {
  return db
    .select({
      trajectoryId: trajectories.trajectoryId,
      stepsJson: trajectories.stepsJson,
      aiJudgeReward: trajectories.aiJudgeReward,
      aiJudgeReasoning: trajectories.aiJudgeReasoning,
      judgedAt: trajectories.judgedAt,
    })
    .from(trajectories)
    .where(eq(trajectories.isTrainingData, true))
    .limit(limit);
}

export async function selectLatestReadyOrDeployedTrainedModel(
  db: TrainingPackageDb
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(inArray(trainedModels.status, ['ready', 'deployed']))
    .orderBy(desc(trainedModels.createdAt))
    .limit(1);
  return row;
}

export async function selectTrainedModelByModelId(
  db: TrainingPackageDb,
  modelId: string
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(eq(trainedModels.modelId, modelId))
    .limit(1);
  return row;
}

/** HuggingFace upload success: mark deployed without changing `agentsUsing`. */
export async function updateTrainedModelHfDeployedByModelId(
  db: TrainingPackageDb,
  modelId: string
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      status: 'deployed',
      deployedAt: new Date(),
    })
    .where(eq(trainedModels.modelId, modelId));
}

export async function selectBenchmarkResultsByModelIdRunAtDesc(
  db: TrainingPackageDb,
  modelId: string
): Promise<BenchmarkResult[]> {
  return db
    .select()
    .from(benchmarkResults)
    .where(eq(benchmarkResults.modelId, modelId))
    .orderBy(desc(benchmarkResults.runAt));
}

export async function insertBenchmarkResultReturningFull(
  db: TrainingPackageDb,
  row: NewBenchmarkResult
): Promise<BenchmarkResult> {
  const [result] = await db.insert(benchmarkResults).values(row).returning();
  if (!result) {
    throw new Error('Failed to save benchmark result');
  }
  return result;
}

export async function selectBenchmarkResultsByHistoryFilters(
  db: TrainingPackageDb,
  filters: {
    modelId?: string;
    benchmarkId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<BenchmarkResult[]> {
  const conditions = [];
  if (filters.modelId) {
    conditions.push(eq(benchmarkResults.modelId, filters.modelId));
  }
  if (filters.benchmarkId) {
    conditions.push(eq(benchmarkResults.benchmarkId, filters.benchmarkId));
  }
  if (filters.startDate) {
    conditions.push(gte(benchmarkResults.runAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(benchmarkResults.runAt, filters.endDate));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select()
    .from(benchmarkResults)
    .where(whereClause)
    .orderBy(desc(benchmarkResults.runAt))
    .limit(filters.limit ?? 100);
}

export async function selectLatestBenchmarkResultByModelId(
  db: TrainingPackageDb,
  modelId: string
): Promise<BenchmarkResult | null> {
  const [row] = await db
    .select()
    .from(benchmarkResults)
    .where(eq(benchmarkResults.modelId, modelId))
    .orderBy(desc(benchmarkResults.runAt))
    .limit(1);
  return row ?? null;
}

export async function selectBenchmarkResultsByModelIdRunAtDescLimit(
  db: TrainingPackageDb,
  modelId: string,
  limit: number
): Promise<BenchmarkResult[]> {
  return db
    .select()
    .from(benchmarkResults)
    .where(eq(benchmarkResults.modelId, modelId))
    .orderBy(desc(benchmarkResults.runAt))
    .limit(limit);
}

export async function selectBenchmarkResultsByModelOptionalBenchmarkLimit(
  db: TrainingPackageDb,
  modelId: string,
  benchmarkId: string | undefined,
  limit: number
): Promise<BenchmarkResult[]> {
  const conditions = [eq(benchmarkResults.modelId, modelId)];
  if (benchmarkId) {
    conditions.push(eq(benchmarkResults.benchmarkId, benchmarkId));
  }
  return db
    .select()
    .from(benchmarkResults)
    .where(and(...conditions))
    .orderBy(desc(benchmarkResults.runAt))
    .limit(limit);
}

export type BenchmarkModelSummaryRow = {
  modelId: string;
  runCount: number;
  avgPnl: number;
  avgAccuracy: number;
  avgOptimality: number;
  bestPnl: number;
  latestRun: Date;
};

export async function selectBenchmarkModelSummaryGrouped(
  db: TrainingPackageDb
): Promise<BenchmarkModelSummaryRow[]> {
  return db
    .select({
      modelId: benchmarkResults.modelId,
      runCount: sql<number>`count(*)::int`,
      avgPnl: sql<number>`avg(${benchmarkResults.totalPnl})`,
      avgAccuracy: sql<number>`avg(${benchmarkResults.predictionAccuracy})`,
      avgOptimality: sql<number>`avg(${benchmarkResults.optimalityScore})`,
      bestPnl: sql<number>`max(${benchmarkResults.totalPnl})`,
      latestRun: sql<Date>`max(${benchmarkResults.runAt})`,
    })
    .from(benchmarkResults)
    .groupBy(benchmarkResults.modelId)
    .orderBy(desc(sql`avg(${benchmarkResults.totalPnl})`));
}

export async function selectLatestBenchmarkResultByModelAndBenchmarkId(
  db: TrainingPackageDb,
  modelId: string,
  benchmarkId: string
): Promise<BenchmarkResult | undefined> {
  const [row] = await db
    .select()
    .from(benchmarkResults)
    .where(
      and(
        eq(benchmarkResults.modelId, modelId),
        eq(benchmarkResults.benchmarkId, benchmarkId)
      )
    )
    .orderBy(desc(benchmarkResults.runAt))
    .limit(1);
  return row;
}

export async function updateTrainedModelBenchmarkAggregatesByModelId(
  db: TrainingPackageDb,
  modelId: string,
  params: {
    benchmarkScore: number;
    avgReward: number;
    benchmarkCountDelta: number;
  }
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      benchmarkScore: params.benchmarkScore,
      avgReward: params.avgReward,
      lastBenchmarked: new Date(),
      benchmarkCount: sql`${trainedModels.benchmarkCount} + ${params.benchmarkCountDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(trainedModels.modelId, modelId));
}

export async function selectReadyTrainedModelIdsWithNullBenchmarkScore(
  db: TrainingPackageDb
): Promise<string[]> {
  const rows = await db
    .select({ modelId: trainedModels.modelId })
    .from(trainedModels)
    .where(
      and(
        eq(trainedModels.status, 'ready'),
        isNull(trainedModels.benchmarkScore)
      )
    );
  return rows.map((r) => r.modelId);
}

export async function updateUserAgentConfigArchetypeTrainingFlagsByUserId(
  db: TrainingPackageDb,
  userId: string,
  params: {
    autonomousTrading: boolean;
    autonomousPosting: boolean;
    autonomousCommenting: boolean;
    autonomousDMs: boolean;
    autonomousGroupChats: boolean;
    maxActionsPerTick: number;
    a2aEnabled: boolean;
  }
): Promise<void> {
  await db
    .update(userAgentConfigs)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(eq(userAgentConfigs.userId, userId));
}

export async function selectTrajectoryRowByTrajectoryId(
  db: TrainingPackageDb,
  trajectoryId: string
): Promise<Trajectory | undefined> {
  const [row] = await db
    .select()
    .from(trajectories)
    .where(eq(trajectories.trajectoryId, trajectoryId))
    .limit(1);
  return row;
}

export async function selectBestTrainedModelByBenchmarkScoreExcludingModelId(
  db: TrainingPackageDb,
  excludeModelId: string
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(
      and(
        not(eq(trainedModels.modelId, excludeModelId)),
        inArray(trainedModels.status, ['ready', 'deployed']),
        isNotNull(trainedModels.benchmarkScore)
      )
    )
    .orderBy(desc(trainedModels.benchmarkScore))
    .limit(1);
  return row;
}

export async function updateTrainedModelPipelineBenchmarkEvalByModelId(
  db: TrainingPackageDb,
  modelId: string,
  params: {
    benchmarkScore: number;
    accuracy: number;
    evalMetrics: JsonValue;
  }
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      benchmarkScore: params.benchmarkScore,
      accuracy: params.accuracy,
      evalMetrics: params.evalMetrics,
    })
    .where(eq(trainedModels.modelId, modelId));
}

const BENCHMARK_TEST_AGENT_USERNAMES = [
  'trader-aggressive',
  'test-agent',
  'benchmark-agent',
] as const;

export async function selectAgentUserPreferringBenchmarkUsernames(
  db: TrainingPackageDb
): Promise<User | undefined> {
  const [preferred] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.isAgent, true),
        inArray(users.username, [...BENCHMARK_TEST_AGENT_USERNAMES])
      )
    )
    .limit(1);
  if (preferred) {
    return preferred;
  }
  const [anyAgent] = await db
    .select()
    .from(users)
    .where(eq(users.isAgent, true))
    .limit(1);
  return anyAgent;
}

export async function selectTopTrainedModelsWithBenchmarkScoreDescLimit(
  db: TrainingPackageDb,
  limit: number
): Promise<TrainedModel[]> {
  return db
    .select()
    .from(trainedModels)
    .where(isNotNull(trainedModels.benchmarkScore))
    .orderBy(desc(trainedModels.benchmarkScore))
    .limit(limit);
}

export async function updateTrainingBatchByBatchId(
  db: TrainingPackageDb,
  batchId: string,
  patch: Partial<{
    status: string;
    startedAt: Date;
    completedAt: Date;
    trainingLoss: number;
    error: string;
  }>
): Promise<void> {
  await db
    .update(trainingBatches)
    .set(patch)
    .where(eq(trainingBatches.batchId, batchId));
}

export async function selectTrainingBatchByBatchId(
  db: TrainingPackageDb,
  batchId: string
): Promise<TrainingBatch | undefined> {
  const [row] = await db
    .select()
    .from(trainingBatches)
    .where(eq(trainingBatches.batchId, batchId))
    .limit(1);
  return row;
}

export async function selectStuckTrainingBatchIds(
  db: TrainingPackageDb,
  startedBefore: Date
): Promise<string[]> {
  const rows = await db
    .select({ batchId: trainingBatches.batchId })
    .from(trainingBatches)
    .where(
      and(
        eq(trainingBatches.status, 'training'),
        lt(trainingBatches.startedAt, startedBefore)
      )
    );
  return rows.map((r) => r.batchId);
}

export async function selectDistinctMarketOutcomeWindowIds(
  db: TrainingPackageDb
): Promise<{ windowId: string }[]> {
  return db
    .selectDistinct({ windowId: marketOutcomes.windowId })
    .from(marketOutcomes);
}

export type RewardBackpropTrajectoryRow = {
  id: string;
  trajectoryId: string;
  stepsJson: string;
  totalReward: number;
};

export async function selectTrainingTrajectoriesForRewardBackpropWindow(
  db: TrainingPackageDb,
  windowId: string
): Promise<RewardBackpropTrajectoryRow[]> {
  return db
    .select({
      id: trajectories.id,
      trajectoryId: trajectories.trajectoryId,
      stepsJson: trajectories.stepsJson,
      totalReward: trajectories.totalReward,
    })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.windowId, windowId),
        eq(trajectories.isTrainingData, true)
      )
    );
}

export async function updateTrajectoryStepsJsonAndTotalReward(
  db: TrainingPackageDb,
  trajectoryRowId: string,
  stepsJson: string,
  totalReward: number
): Promise<void> {
  await db
    .update(trajectories)
    .set({
      stepsJson,
      totalReward,
    })
    .where(eq(trajectories.id, trajectoryRowId));
}

// --- MarketOutcomesTracker ---

export type PerpPositionOutcomeSliceRow = {
  ticker: string | null;
  entryPrice: number;
  currentPrice: number;
  closedAt: Date | null;
};

export async function selectPerpPositionSlicesOpenedBetween(
  db: TrainingPackageDb,
  windowStart: Date,
  windowEnd: Date
): Promise<PerpPositionOutcomeSliceRow[]> {
  return db
    .select({
      ticker: perpPositions.ticker,
      entryPrice: perpPositions.entryPrice,
      currentPrice: perpPositions.currentPrice,
      closedAt: perpPositions.closedAt,
    })
    .from(perpPositions)
    .where(
      and(
        gte(perpPositions.openedAt, windowStart),
        lte(perpPositions.openedAt, windowEnd)
      )
    );
}

export async function insertMarketOutcomeRow(
  db: TrainingPackageDb,
  row: NewMarketOutcome
): Promise<void> {
  await db.insert(marketOutcomes).values(row);
}

export type ResolvedMarketOutcomeSliceRow = {
  id: string;
  question: string | null;
  resolution: boolean | null;
  yesShares: string;
  noShares: string;
};

export async function selectResolvedMarketsSliceUpdatedBetween(
  db: TrainingPackageDb,
  windowStart: Date,
  windowEnd: Date
): Promise<ResolvedMarketOutcomeSliceRow[]> {
  return db
    .select({
      id: markets.id,
      question: markets.question,
      resolution: markets.resolution,
      yesShares: markets.yesShares,
      noShares: markets.noShares,
    })
    .from(markets)
    .where(
      and(
        eq(markets.resolved, true),
        gte(markets.updatedAt, windowStart),
        lte(markets.updatedAt, windowEnd)
      )
    );
}

export async function marketOutcomeExistsForWindowId(
  db: TrainingPackageDb,
  windowId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: marketOutcomes.id })
    .from(marketOutcomes)
    .where(eq(marketOutcomes.windowId, windowId))
    .limit(1);
  return row !== undefined;
}

export async function selectMarketOutcomesRowsByWindowId(
  db: TrainingPackageDb,
  windowId: string
): Promise<(typeof marketOutcomes.$inferSelect)[]> {
  return db
    .select()
    .from(marketOutcomes)
    .where(eq(marketOutcomes.windowId, windowId));
}

// --- ReactionTrajectoryService ---

export async function insertReactionTrajectoryRow(
  db: TrainingPackageDb,
  row: NewReactionTrajectory
): Promise<void> {
  await db.insert(reactionTrajectories).values(row);
}

export async function updateReactionTrajectoryOutcomeById(
  db: TrainingPackageDb,
  trajectoryRowId: string,
  params: {
    outcomeRecordedAt: Date;
    outcomeLikes: number;
    outcomeComments: number;
    outcomeReposts: number;
    outcomePriceMovement: string | null;
    outcomeProfitLoss: string | null;
    outcomeOtherNpcs: number;
    outcomeHumans: number;
    reward: string;
  }
): Promise<void> {
  await db
    .update(reactionTrajectories)
    .set(params)
    .where(eq(reactionTrajectories.id, trajectoryRowId));
}

export async function selectPendingReactionOutcomeMeasurements(
  db: TrainingPackageDb,
  oldestInclusive: Date,
  newestInclusive: Date,
  limit: number
): Promise<{ id: string; postId: string | null }[]> {
  return db
    .select({
      id: reactionTrajectories.id,
      postId: reactionTrajectories.postId,
    })
    .from(reactionTrajectories)
    .where(
      and(
        gte(reactionTrajectories.createdAt, oldestInclusive),
        lte(reactionTrajectories.createdAt, newestInclusive),
        isNull(reactionTrajectories.outcomeRecordedAt)
      )
    )
    .limit(limit);
}

export async function selectReactionTrajectoriesTrainingReady(
  db: TrainingPackageDb,
  limit: number
): Promise<ReactionTrajectory[]> {
  return db
    .select()
    .from(reactionTrajectories)
    .where(
      and(
        eq(reactionTrajectories.usedInTraining, false),
        gte(reactionTrajectories.outcomeRecordedAt, new Date(0))
      )
    )
    .limit(limit);
}

export async function updateReactionTrajectoriesUsedInTrainingByIds(
  db: TrainingPackageDb,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(reactionTrajectories)
    .set({ usedInTraining: true })
    .where(inArray(reactionTrajectories.id, ids));
}

// --- ArchetypeScoring / RulerScoring ---

export type TrajectoryJudgeContextRow = {
  trajectoryId: string;
  agentId: string;
  archetype: string | null;
  stepsJson: string;
  scenarioId: string | null;
  finalPnL: number | null;
  episodeLength: number;
  totalReward: number;
};

const trajectoryJudgeContextSelect = {
  trajectoryId: trajectories.trajectoryId,
  agentId: trajectories.agentId,
  archetype: trajectories.archetype,
  stepsJson: trajectories.stepsJson,
  scenarioId: trajectories.scenarioId,
  finalPnL: trajectories.finalPnL,
  episodeLength: trajectories.episodeLength,
  totalReward: trajectories.totalReward,
} as const;

export async function selectTrajectoryJudgeContextByTrajectoryId(
  db: TrainingPackageDb,
  trajectoryId: string
): Promise<TrajectoryJudgeContextRow | undefined> {
  const [row] = await db
    .select(trajectoryJudgeContextSelect)
    .from(trajectories)
    .where(eq(trajectories.trajectoryId, trajectoryId))
    .limit(1);
  return row;
}

export async function selectTrajectoryJudgeContextsByTrajectoryIds(
  db: TrainingPackageDb,
  trajectoryIds: string[]
): Promise<TrajectoryJudgeContextRow[]> {
  if (trajectoryIds.length === 0) return [];
  return db
    .select(trajectoryJudgeContextSelect)
    .from(trajectories)
    .where(inArray(trajectories.trajectoryId, trajectoryIds));
}

export async function updateTrajectoryAiJudgeResultByTrajectoryId(
  db: TrainingPackageDb,
  trajectoryId: string,
  params: {
    aiJudgeReward: number;
    aiJudgeReasoning: string;
    judgedAt: Date;
    isTrainingData?: boolean;
  }
): Promise<void> {
  await db
    .update(trajectories)
    .set({
      aiJudgeReward: params.aiJudgeReward,
      aiJudgeReasoning: params.aiJudgeReasoning,
      judgedAt: params.judgedAt,
      ...(params.isTrainingData !== undefined
        ? { isTrainingData: params.isTrainingData }
        : {}),
    })
    .where(eq(trajectories.trajectoryId, trajectoryId));
}

export async function selectUnscoredTrainingTrajectoryIdsLimit(
  db: TrainingPackageDb,
  limit: number
): Promise<{ trajectoryId: string }[]> {
  return db
    .select({ trajectoryId: trajectories.trajectoryId })
    .from(trajectories)
    .where(
      and(
        isNull(trajectories.aiJudgeReward),
        eq(trajectories.isTrainingData, true),
        not(eq(trajectories.stepsJson, 'null')),
        not(eq(trajectories.stepsJson, '[]'))
      )
    )
    .limit(limit);
}

export async function selectTrajectoryJudgeContextsByIdsPendingScore(
  db: TrainingPackageDb,
  trajectoryIds: string[]
): Promise<TrajectoryJudgeContextRow[]> {
  if (trajectoryIds.length === 0) return [];
  return db
    .select(trajectoryJudgeContextSelect)
    .from(trajectories)
    .where(
      and(
        inArray(trajectories.trajectoryId, trajectoryIds),
        isNull(trajectories.aiJudgeReward)
      )
    );
}

export async function selectUnscoredTrainingTrajectoryContextsOrderStartAsc(
  db: TrainingPackageDb
): Promise<TrajectoryJudgeContextRow[]> {
  return db
    .select(trajectoryJudgeContextSelect)
    .from(trajectories)
    .where(
      and(
        isNull(trajectories.aiJudgeReward),
        eq(trajectories.isTrainingData, true),
        not(eq(trajectories.stepsJson, 'null')),
        not(eq(trajectories.stepsJson, '[]'))
      )
    )
    .orderBy(asc(trajectories.startTime));
}

export async function selectTrajectoryIdsUnscoredInWindowForRuler(
  db: TrainingPackageDb,
  windowId: string
): Promise<{ trajectoryId: string }[]> {
  return db
    .select({ trajectoryId: trajectories.trajectoryId })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.windowId, windowId),
        eq(trajectories.isTrainingData, true),
        isNull(trajectories.aiJudgeReward),
        not(eq(trajectories.stepsJson, 'null')),
        not(eq(trajectories.stepsJson, '[]'))
      )
    );
}

export type TrajectoryAiJudgeResultSliceRow = {
  trajectoryId: string;
  aiJudgeReward: number | null;
  aiJudgeReasoning: string | null;
  judgedAt: Date | null;
};

export async function selectTrajectoryAiJudgeResultByTrajectoryId(
  db: TrainingPackageDb,
  trajectoryId: string
): Promise<TrajectoryAiJudgeResultSliceRow | undefined> {
  const [row] = await db
    .select({
      trajectoryId: trajectories.trajectoryId,
      aiJudgeReward: trajectories.aiJudgeReward,
      aiJudgeReasoning: trajectories.aiJudgeReasoning,
      judgedAt: trajectories.judgedAt,
    })
    .from(trajectories)
    .where(eq(trajectories.trajectoryId, trajectoryId))
    .limit(1);
  return row;
}

// --- ModelSelectionService ---

export async function countTrainingBundlesForModelSelection(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false),
        isNotNull(trajectories.aiJudgeReward),
        not(eq(trajectories.stepsJson, 'null')),
        not(eq(trajectories.stepsJson, '[]'))
      )
    );
  return row?.count ?? 0;
}

export async function countTrainedModelsWithStatuses(
  db: TrainingPackageDb,
  statuses: string[]
): Promise<number> {
  if (statuses.length === 0) return 0;
  const [row] = await db
    .select({ count: count() })
    .from(trainedModels)
    .where(inArray(trainedModels.status, statuses));
  return row?.count ?? 0;
}

export async function selectBestReadyDeployedTrainedModelByBenchmarkScore(
  db: TrainingPackageDb
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(
      and(
        inArray(trainedModels.status, ['ready', 'deployed']),
        isNotNull(trainedModels.benchmarkScore)
      )
    )
    .orderBy(desc(trainedModels.benchmarkScore))
    .limit(1);
  return row;
}

export async function selectTrainingTrajectoriesForModelSelection(
  db: TrainingPackageDb,
  limit?: number | null
): Promise<Trajectory[]> {
  const q = db
    .select()
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false),
        isNotNull(trajectories.aiJudgeReward),
        not(eq(trajectories.stepsJson, 'null')),
        not(eq(trajectories.stepsJson, '[]'))
      )
    )
    .orderBy(desc(trajectories.createdAt));
  if (limit != null && limit > 0) {
    return q.limit(limit);
  }
  return q;
}

// --- HuggingFaceIntegrationService ---

export async function updateTrainedModelHuggingFaceRepoByModelId(
  db: TrainingPackageDb,
  modelId: string,
  huggingFaceRepo: string
): Promise<void> {
  await db
    .update(trainedModels)
    .set({ huggingFaceRepo })
    .where(eq(trainedModels.modelId, modelId));
}

export async function selectLatestDeployedAtWithHuggingFaceRepo(
  db: TrainingPackageDb
): Promise<Date | undefined> {
  const [row] = await db
    .select({ deployedAt: trainedModels.deployedAt })
    .from(trainedModels)
    .where(isNotNull(trainedModels.huggingFaceRepo))
    .orderBy(desc(trainedModels.deployedAt))
    .limit(1);
  return row?.deployedAt ?? undefined;
}

export async function countBenchmarkResultsSinceCreatedAt(
  db: TrainingPackageDb,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(benchmarkResults)
    .where(gte(benchmarkResults.createdAt, since));
  return row?.count ?? 0;
}

export async function countTrajectoriesSinceCreatedAt(
  db: TrainingPackageDb,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trajectories)
    .where(gte(trajectories.createdAt, since));
  return row?.count ?? 0;
}

export async function countBenchmarkResultsTotal(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db.select({ count: count() }).from(benchmarkResults);
  return row?.count ?? 0;
}

export async function selectLatestBenchmarkResultCreatedAt(
  db: TrainingPackageDb
): Promise<Date | undefined> {
  const [row] = await db
    .select({ createdAt: benchmarkResults.createdAt })
    .from(benchmarkResults)
    .orderBy(desc(benchmarkResults.createdAt))
    .limit(1);
  return row?.createdAt ?? undefined;
}

export async function countTrajectoriesTotal(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db.select({ count: count() }).from(trajectories);
  return row?.count ?? 0;
}

export async function countTrajectoriesIsTrainingData(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trajectories)
    .where(eq(trajectories.isTrainingData, true));
  return row?.count ?? 0;
}

export async function countTrainedModelsTotal(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db.select({ count: count() }).from(trainedModels);
  return row?.count ?? 0;
}

export async function countTrainedModelsWithBenchmarkScore(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trainedModels)
    .where(isNotNull(trainedModels.benchmarkScore));
  return row?.count ?? 0;
}

export async function countTrainedModelsWithHuggingFaceRepo(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trainedModels)
    .where(isNotNull(trainedModels.huggingFaceRepo));
  return row?.count ?? 0;
}

export async function selectDistinctHuggingFaceReposFromTrainedModels(
  db: TrainingPackageDb
): Promise<string[]> {
  const rows = await db
    .selectDistinctOn([trainedModels.huggingFaceRepo], {
      huggingFaceRepo: trainedModels.huggingFaceRepo,
    })
    .from(trainedModels)
    .where(isNotNull(trainedModels.huggingFaceRepo));
  return rows
    .map((r) => r.huggingFaceRepo)
    .filter((r): r is string => r != null);
}

export async function countUsersTotal(db: TrainingPackageDb): Promise<number> {
  const [row] = await db.select({ count: count() }).from(users);
  return row?.count ?? 0;
}

// --- AutomationPipeline ---

export async function countScoredTrainingBundlesReady(
  db: TrainingPackageDb
): Promise<number> {
  return countTrainingBundlesForModelSelection(db);
}

export async function countUnusedUnscoredTrainingTrajectories(
  db: TrainingPackageDb
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false),
        isNull(trajectories.aiJudgeReward)
      )
    );
  return row?.count ?? 0;
}

export async function selectScenarioGroupCountsUnusedTraining(
  db: TrainingPackageDb
): Promise<{ scenarioId: string | null; count: number }[]> {
  return db
    .select({
      scenarioId: trajectories.scenarioId,
      count: count(),
    })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false),
        isNotNull(trajectories.scenarioId)
      )
    )
    .groupBy(trajectories.scenarioId);
}

export async function selectTrajectoriesUnusedTrainingSampleDescCreated(
  db: TrainingPackageDb,
  sampleLimit: number
): Promise<Trajectory[]> {
  return db
    .select()
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false)
      )
    )
    .orderBy(desc(trajectories.createdAt))
    .limit(sampleLimit);
}

export async function selectDistinctWindowIdsUnscoredTrainingRecent(
  db: TrainingPackageDb,
  limit: number
): Promise<{ windowId: string | null }[]> {
  return db
    .selectDistinct({ windowId: trajectories.windowId })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false),
        isNull(trajectories.aiJudgeReward),
        isNotNull(trajectories.windowId)
      )
    )
    .orderBy(desc(trajectories.createdAt))
    .limit(limit);
}

export async function insertTrainingBatchReturningFull(
  db: TrainingPackageDb,
  row: NewTrainingBatch
): Promise<TrainingBatch> {
  const [created] = await db.insert(trainingBatches).values(row).returning();
  if (!created) {
    throw new Error('insertTrainingBatchReturningFull: expected row');
  }
  return created;
}

export async function updateTrainingBatchFailedSpawnByBatchId(
  db: TrainingPackageDb,
  batchId: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(trainingBatches)
    .set({
      status: 'failed',
      error: errorMessage,
    })
    .where(eq(trainingBatches.batchId, batchId));
}

export async function selectLatestTrainedModelByCreatedAtDesc(
  db: TrainingPackageDb
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .orderBy(desc(trainedModels.createdAt))
    .limit(1);
  return row;
}

export async function selectTrajectoryIdsUnusedTrainingOrderCreated(
  db: TrainingPackageDb,
  limit?: number
): Promise<{ trajectoryId: string }[]> {
  const q = db
    .select({ trajectoryId: trajectories.trajectoryId })
    .from(trajectories)
    .where(
      and(
        eq(trajectories.isTrainingData, true),
        eq(trajectories.usedInTraining, false)
      )
    )
    .orderBy(trajectories.createdAt);
  if (limit != null && limit > 0) {
    return q.limit(limit);
  }
  return q;
}

export async function selectCompletedTrainingBatchSince(
  db: TrainingPackageDb,
  since: Date
): Promise<TrainingBatch | undefined> {
  const [row] = await db
    .select()
    .from(trainingBatches)
    .where(
      and(
        eq(trainingBatches.status, 'completed'),
        gte(trainingBatches.completedAt, since)
      )
    )
    .orderBy(desc(trainingBatches.completedAt))
    .limit(1);
  return row;
}

/** `trainingBatch` column may store batch row `id` or external `batchId` depending on writer. */
export async function selectTrainedModelDeployedByTrainingBatchRef(
  db: TrainingPackageDb,
  trainingBatchRef: string
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(
      and(
        eq(trainedModels.trainingBatch, trainingBatchRef),
        eq(trainedModels.status, 'deployed')
      )
    )
    .limit(1);
  return row;
}

export async function selectTrainedModelReadyByTrainingBatchInternalId(
  db: TrainingPackageDb,
  trainingBatchInternalId: string
): Promise<TrainedModel | undefined> {
  const [row] = await db
    .select()
    .from(trainedModels)
    .where(
      and(
        eq(trainedModels.trainingBatch, trainingBatchInternalId),
        eq(trainedModels.status, 'ready')
      )
    )
    .limit(1);
  return row;
}

export async function updateTrajectoriesUsedInTrainingByTrajectoryIds(
  db: TrainingPackageDb,
  trajectoryIds: string[],
  trainedInBatchInternalId: string
): Promise<void> {
  if (trajectoryIds.length === 0) return;
  await db
    .update(trajectories)
    .set({
      usedInTraining: true,
      trainedInBatch: trainedInBatchInternalId,
    })
    .where(inArray(trajectories.trajectoryId, trajectoryIds));
}

export async function updateTrainedModelStatusDeployedByModelId(
  db: TrainingPackageDb,
  modelId: string
): Promise<void> {
  await db
    .update(trainedModels)
    .set({
      status: 'deployed',
      deployedAt: new Date(),
    })
    .where(eq(trainedModels.modelId, modelId));
}

export async function selectLastCompletedTrainingBatch(
  db: TrainingPackageDb
): Promise<TrainingBatch | undefined> {
  const [row] = await db
    .select()
    .from(trainingBatches)
    .where(eq(trainingBatches.status, 'completed'))
    .orderBy(desc(trainingBatches.completedAt))
    .limit(1);
  return row;
}

export async function countTrajectoriesSinceStartTime(
  db: TrainingPackageDb,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trajectories)
    .where(gte(trajectories.startTime, since));
  return row?.count ?? 0;
}

export async function countTrainedModelsByStatus(
  db: TrainingPackageDb,
  status: string
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trainedModels)
    .where(eq(trainedModels.status, status));
  return row?.count ?? 0;
}

export async function countTrainingBatchesByStatus(
  db: TrainingPackageDb,
  status: string
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trainingBatches)
    .where(eq(trainingBatches.status, status));
  return row?.count ?? 0;
}
