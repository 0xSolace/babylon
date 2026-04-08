/**
 * Benchmark History Service
 *
 * Persists benchmark results to the database for historical tracking and analysis.
 */

import {
  type BenchmarkResult,
  insertBenchmarkResultReturningFull,
  type JsonValue,
  type NewBenchmarkResult,
  selectBenchmarkModelSummaryGrouped,
  selectBenchmarkResultsByHistoryFilters,
  selectBenchmarkResultsByModelIdRunAtDescLimit,
  selectBenchmarkResultsByModelOptionalBenchmarkLimit,
  selectLatestBenchmarkResultByModelAndBenchmarkId,
  selectLatestBenchmarkResultByModelId,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import { logger } from '../utils/logger';
import { generateSnowflakeId } from '../utils/snowflake';
import type { SimulationMetrics } from './SimulationEngine';

export interface BenchmarkResultInput {
  modelId: string;
  benchmarkId: string;
  benchmarkPath: string;
  metrics: SimulationMetrics;
  duration: number;
  baselineComparison?: {
    pnlDelta: number;
    accuracyDelta: number;
    improved: boolean;
  };
}

export interface BenchmarkHistoryQuery {
  modelId?: string;
  benchmarkId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface BenchmarkTrendData {
  modelId: string;
  dates: Date[];
  pnlHistory: number[];
  accuracyHistory: number[];
  optimalityHistory: number[];
}

/**
 * Service for managing benchmark result history
 */
export class BenchmarkHistoryService {
  /**
   * Save a benchmark result to the database
   */
  static async saveResult(
    input: BenchmarkResultInput
  ): Promise<BenchmarkResult> {
    const id = await generateSnowflakeId();

    const record: NewBenchmarkResult = {
      id,
      modelId: input.modelId,
      benchmarkId: input.benchmarkId,
      benchmarkPath: input.benchmarkPath,
      runAt: new Date(),
      totalPnl: input.metrics.totalPnl,
      predictionAccuracy: input.metrics.predictionMetrics.accuracy,
      perpWinRate: input.metrics.perpMetrics.winRate,
      optimalityScore: input.metrics.optimalityScore,
      detailedMetrics: JSON.parse(JSON.stringify(input.metrics)) as JsonValue,
      baselinePnlDelta: input.baselineComparison?.pnlDelta ?? null,
      baselineAccuracyDelta: input.baselineComparison?.accuracyDelta ?? null,
      improved: input.baselineComparison?.improved ?? null,
      duration: input.duration,
      createdAt: new Date(),
    };

    const result = await insertBenchmarkResultReturningFull(db, record);

    logger.info('Saved benchmark result', {
      id: result.id,
      modelId: input.modelId,
      benchmarkId: input.benchmarkId,
      totalPnl: input.metrics.totalPnl,
    });

    return result;
  }

  /**
   * Get benchmark results by query
   */
  static async getResults(
    query: BenchmarkHistoryQuery
  ): Promise<BenchmarkResult[]> {
    return selectBenchmarkResultsByHistoryFilters(db, query);
  }

  /**
   * Get the latest result for a model
   */
  static async getLatestResult(
    modelId: string
  ): Promise<BenchmarkResult | null> {
    return selectLatestBenchmarkResultByModelId(db, modelId);
  }

  /**
   * Get trend data for a model
   */
  static async getTrendData(
    modelId: string,
    limit = 20
  ): Promise<BenchmarkTrendData> {
    const results = await selectBenchmarkResultsByModelIdRunAtDescLimit(
      db,
      modelId,
      limit
    );

    // Reverse to get chronological order
    const chronological = results.reverse();

    return {
      modelId,
      dates: chronological.map((r) => r.runAt),
      pnlHistory: chronological.map((r) => r.totalPnl),
      accuracyHistory: chronological.map((r) => r.predictionAccuracy),
      optimalityHistory: chronological.map((r) => r.optimalityScore),
    };
  }

  /**
   * Get comparison data for multiple models
   */
  static async getModelComparison(
    modelIds: string[],
    benchmarkId?: string
  ): Promise<Map<string, BenchmarkResult[]>> {
    const comparison = new Map<string, BenchmarkResult[]>();

    for (const modelId of modelIds) {
      const results = await selectBenchmarkResultsByModelOptionalBenchmarkLimit(
        db,
        modelId,
        benchmarkId,
        10
      );

      comparison.set(modelId, results);
    }

    return comparison;
  }

  /**
   * Get summary statistics for all models
   */
  static async getModelSummary(): Promise<
    Array<{
      modelId: string;
      runCount: number;
      avgPnl: number;
      avgAccuracy: number;
      avgOptimality: number;
      bestPnl: number;
      latestRun: Date;
    }>
  > {
    return selectBenchmarkModelSummaryGrouped(db);
  }

  /**
   * Check if a model improved vs baseline
   */
  static async checkImprovement(
    modelId: string,
    baselineModelId: string,
    benchmarkId: string
  ): Promise<{
    improved: boolean;
    modelPnl: number;
    baselinePnl: number;
    delta: number;
  } | null> {
    const modelResult = await selectLatestBenchmarkResultByModelAndBenchmarkId(
      db,
      modelId,
      benchmarkId
    );

    const baselineResult =
      await selectLatestBenchmarkResultByModelAndBenchmarkId(
        db,
        baselineModelId,
        benchmarkId
      );

    if (!modelResult || !baselineResult) {
      return null;
    }

    const delta = modelResult.totalPnl - baselineResult.totalPnl;

    return {
      improved: delta > 0,
      modelPnl: modelResult.totalPnl,
      baselinePnl: baselineResult.totalPnl,
      delta,
    };
  }
}
