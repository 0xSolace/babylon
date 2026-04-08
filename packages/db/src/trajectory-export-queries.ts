/**
 * Trajectory export / training dataset reads (Hugging Face, GRPO, OpenPipe ART).
 */

import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Trajectory } from './tables/trajectories';
import { trajectories } from './tables/trajectories';

type TrajDb = DrizzleClient | Transaction;

export type TrajectoryExportFilters = {
  startDate?: Date;
  endDate?: Date;
  agentIds?: string[];
  scenarioIds?: string[];
  minReward?: number;
  maxReward?: number;
  includeJudged?: boolean;
};

function trainingDataConditions(
  filters: TrajectoryExportFilters,
  extras: SQL[] = []
) {
  const parts: SQL[] = [eq(trajectories.isTrainingData, true), ...extras];
  if (filters.startDate) {
    parts.push(gte(trajectories.startTime, filters.startDate));
  }
  if (filters.endDate) {
    parts.push(lte(trajectories.startTime, filters.endDate));
  }
  if (filters.agentIds && filters.agentIds.length > 0) {
    parts.push(inArray(trajectories.agentId, filters.agentIds));
  }
  if (filters.scenarioIds && filters.scenarioIds.length > 0) {
    parts.push(inArray(trajectories.scenarioId, filters.scenarioIds));
  }
  if (filters.minReward !== undefined) {
    parts.push(gte(trajectories.totalReward, filters.minReward));
  }
  if (filters.maxReward !== undefined) {
    parts.push(lte(trajectories.totalReward, filters.maxReward));
  }
  if (filters.includeJudged) {
    parts.push(isNotNull(trajectories.aiJudgeReward));
  }
  return parts;
}

export type TrajectoryHuggingFaceExportRow = {
  trajectoryId: string;
  agentId: string;
  episodeId: string | null;
  scenarioId: string | null;
  startTime: Date;
  durationMs: number;
  stepsJson: string;
  metricsJson: string;
  metadataJson: string;
  totalReward: number;
  finalStatus: string;
  finalPnL: number | null;
  aiJudgeReward: number | null;
  aiJudgeReasoning: string | null;
};

export async function selectTrajectoriesForHuggingFaceExport(
  db: TrajDb,
  filters: TrajectoryExportFilters,
  limit: number
): Promise<TrajectoryHuggingFaceExportRow[]> {
  const conds = trainingDataConditions(filters);
  return db
    .select({
      trajectoryId: trajectories.trajectoryId,
      agentId: trajectories.agentId,
      episodeId: trajectories.episodeId,
      scenarioId: trajectories.scenarioId,
      startTime: trajectories.startTime,
      durationMs: trajectories.durationMs,
      stepsJson: trajectories.stepsJson,
      metricsJson: trajectories.metricsJson,
      metadataJson: trajectories.metadataJson,
      totalReward: trajectories.totalReward,
      finalStatus: trajectories.finalStatus,
      finalPnL: trajectories.finalPnL,
      aiJudgeReward: trajectories.aiJudgeReward,
      aiJudgeReasoning: trajectories.aiJudgeReasoning,
    })
    .from(trajectories)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(trajectories.startTime))
    .limit(limit);
}

export async function selectDistinctScenarioIdsForTrajectoryExport(
  db: TrajDb,
  filters: TrajectoryExportFilters
): Promise<Array<{ scenarioId: string | null }>> {
  const conds = trainingDataConditions(filters, [
    isNotNull(trajectories.scenarioId),
  ]);
  return db
    .selectDistinct({ scenarioId: trajectories.scenarioId })
    .from(trajectories)
    .where(conds.length > 0 ? and(...conds) : undefined);
}

export async function selectTrajectoriesByScenarioForGroupedExport(
  db: TrajDb,
  scenarioId: string,
  filters: TrajectoryExportFilters
): Promise<Trajectory[]> {
  const base = trainingDataConditions(filters);
  return db
    .select()
    .from(trajectories)
    .where(and(eq(trajectories.scenarioId, scenarioId), ...base))
    .orderBy(trajectories.startTime);
}

export async function selectTrajectoriesForOpenPipeArt(
  db: TrajDb,
  filters: TrajectoryExportFilters,
  limit: number
): Promise<Trajectory[]> {
  const conds = trainingDataConditions(filters);
  return db
    .select()
    .from(trajectories)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(trajectories.startTime)
    .limit(limit);
}

export async function selectTrajectoriesForGrpoScenario(
  db: TrajDb,
  scenarioId: string,
  filters: TrajectoryExportFilters,
  limit: number
): Promise<Trajectory[]> {
  const base = trainingDataConditions(filters);
  return db
    .select()
    .from(trajectories)
    .where(and(eq(trajectories.scenarioId, scenarioId), ...base))
    .orderBy(trajectories.startTime)
    .limit(limit);
}

export async function executeTrajectoryScenarioCountsForGrpo(
  db: TrajDb
): Promise<unknown> {
  return db.execute(sql`
      SELECT "scenarioId", COUNT(*) as count 
      FROM trajectories 
      WHERE "scenarioId" IS NOT NULL AND "isTrainingData" = true
      GROUP BY "scenarioId"
    `);
}
