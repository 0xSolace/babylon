/**
 * Benchmark History Service
 *
 * Persists benchmark results to the database for historical tracking and analysis.
 */

import { type BenchmarkResult, db, type JsonValue } from '@babylon/db';
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

    const detailedMetrics = JSON.parse(
      JSON.stringify(input.metrics)
    ) as JsonValue;
    const result = await db.benchmarkResult.create({
      data: {
        id,
        modelId: input.modelId,
        benchmarkId: input.benchmarkId,
        benchmarkPath: input.benchmarkPath,
        runAt: new Date(),
        totalPnl: input.metrics.totalPnl,
        predictionAccuracy: input.metrics.predictionMetrics.accuracy,
        perpWinRate: input.metrics.perpMetrics.winRate,
        optimalityScore: input.metrics.optimalityScore,
        detailedMetrics,
        baselinePnlDelta: input.baselineComparison?.pnlDelta ?? null,
        baselineAccuracyDelta: input.baselineComparison?.accuracyDelta ?? null,
        improved: input.baselineComparison?.improved ?? null,
        duration: input.duration,
        createdAt: new Date(),
      },
    });

    logger.info('Saved benchmark result', {
      id: result?.id,
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
    const clauses = [
      query.modelId ? { modelId: query.modelId } : undefined,
      query.benchmarkId ? { benchmarkId: query.benchmarkId } : undefined,
      query.startDate ? { runAt: { gte: query.startDate } } : undefined,
      query.endDate ? { runAt: { lte: query.endDate } } : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return db.benchmarkResult.findMany({
      where: clauses.length > 0 ? { AND: clauses } : undefined,
      orderBy: { runAt: 'desc' },
      take: query.limit ?? 100,
    });
  }

  /**
   * Get the latest result for a model
   */
  static async getLatestResult(
    modelId: string
  ): Promise<BenchmarkResult | null> {
    return db.benchmarkResult.findFirst({
      where: { modelId },
      orderBy: { runAt: 'desc' },
    });
  }

  /**
   * Get trend data for a model
   */
  static async getTrendData(
    modelId: string,
    limit = 20
  ): Promise<BenchmarkTrendData> {
    const results = await db.benchmarkResult.findMany({
      where: { modelId },
      orderBy: { runAt: 'desc' },
      take: limit,
    });

    // Reverse to get chronological order
    const chronological = results.reverse();

    return {
      modelId,
      dates: chronological.map((r) => new Date(String(r.runAt))),
      pnlHistory: chronological.map((r) => Number(r.totalPnl)),
      accuracyHistory: chronological.map((r) => Number(r.predictionAccuracy)),
      optimalityHistory: chronological.map((r) => Number(r.optimalityScore)),
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
      const where =
        benchmarkId !== undefined
          ? { AND: [{ modelId }, { benchmarkId }] }
          : { modelId };

      const results = await db.benchmarkResult.findMany({
        where,
        orderBy: { runAt: 'desc' },
        take: 10,
      });

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
    const rows = await db.benchmarkResult.groupBy({
      by: ['modelId'],
      _count: true,
      _avg: { totalPnl: true, predictionAccuracy: true, optimalityScore: true },
      _max: { totalPnl: true, runAt: true },
    });

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || 0;
      if (typeof value === 'bigint') return Number(value);
      return 0;
    };

    const toDate = (value: unknown): Date => {
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      if (typeof value === 'number') return new Date(value);
      if (typeof value === 'bigint') return new Date(Number(value));
      return new Date(0);
    };

    return rows
      .map((r) => ({
        modelId: String(r.modelId),
        runCount: toNumber(r._count),
        avgPnl: toNumber(r._avg_totalPnl),
        avgAccuracy: toNumber(r._avg_predictionAccuracy),
        avgOptimality: toNumber(r._avg_optimalityScore),
        bestPnl: toNumber(r._max_totalPnl),
        latestRun: toDate(r._max_runAt),
      }))
      .sort((a, b) => b.avgPnl - a.avgPnl);
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
    const modelResult = await db.benchmarkResult.findFirst({
      where: { AND: [{ modelId }, { benchmarkId }] },
      orderBy: { runAt: 'desc' },
    });

    const baselineResult = await db.benchmarkResult.findFirst({
      where: { AND: [{ modelId: baselineModelId }, { benchmarkId }] },
      orderBy: { runAt: 'desc' },
    });

    if (!modelResult || !baselineResult) {
      return null;
    }

    const modelPnl = Number(modelResult.totalPnl);
    const baselinePnl = Number(baselineResult.totalPnl);
    const delta = modelPnl - baselinePnl;

    return {
      improved: delta > 0,
      modelPnl,
      baselinePnl,
      delta,
    };
  }
}
