/**
 * Model Benchmark Service (For HuggingFace Integration)
 *
 * Runs benchmark tests on trained RL models for HuggingFace upload decisions.
 * Compares new models against baselines and previous versions.
 *
 * **Purpose:** Evaluate models for HuggingFace upload
 * **Used by:** HuggingFace integration, weekly CRON, CLI scripts
 * **Storage:** benchmark_results table (dedicated table)
 * **Focus:** Public model release, baseline comparison
 *
 * **Note:** For training pipeline benchmarking, see BenchmarkService
 *
 * @see BenchmarkService - For training pipeline evaluation
 */

import { db } from '@babylon/db';
import {
  generateRandomWallet,
  generateSnowflakeId,
  logger,
} from '@babylon/shared';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getAgentRuntimeManager } from '../dependencies';
import { BenchmarkRunner } from './BenchmarkRunner';
import {
  type JsonValue,
  parseSimulationMetrics,
} from './parseSimulationMetrics';
import type { SimulationMetrics, SimulationResult } from './SimulationEngine';

export interface ModelBenchmarkOptions {
  modelId: string;
  benchmarkPaths: string[]; // Paths to benchmark JSON files
  outputDir?: string;
  saveResults?: boolean;
}

export interface ModelBenchmarkResult {
  modelId: string;
  modelVersion: string;
  benchmarkId: string;
  benchmarkPath: string;
  runAt: Date;
  metrics: SimulationMetrics;
  comparisonToBaseline?: {
    pnlDelta: number;
    accuracyDelta: number;
    optimalityDelta: number;
    improved: boolean;
  };
}

export interface ModelComparisonResult {
  newModel: {
    modelId: string;
    version: string;
    avgMetrics: AverageMetrics;
  };
  baseline: {
    modelId: string;
    avgMetrics: AverageMetrics;
  };
  improvement: {
    pnlDelta: number;
    accuracyDelta: number;
    optimalityDelta: number;
    isImprovement: boolean;
  };
  recommendation: 'deploy' | 'keep_training' | 'baseline_better';
}

export interface AverageMetrics {
  totalPnl: number;
  accuracy: number;
  winRate: number;
  optimality: number;
  benchmarkCount: number;
}

export class ModelBenchmarkService {
  /**
   * Benchmark a trained model against standard benchmarks
   */
  static async benchmarkModel(
    options: ModelBenchmarkOptions
  ): Promise<ModelBenchmarkResult[]> {
    logger.info('Starting model benchmark', { modelId: options.modelId });

    // Load model from database
    const model = await db.trainedModel.findFirst({
      where: { modelId: options.modelId },
    });

    if (!model) {
      throw new Error(`Model not found: ${options.modelId}`);
    }

    // Check if model already benchmarked
    const existingBenchmarks = await this.getModelBenchmarks(options.modelId);
    if (existingBenchmarks.length > 0 && !options.saveResults) {
      logger.info('Model already benchmarked', {
        modelId: options.modelId,
        count: existingBenchmarks.length,
      });
      return existingBenchmarks;
    }

    // Create test agent for benchmarking
    const testAgentId = await this.getOrCreateTestAgent();

    const results: ModelBenchmarkResult[] = [];

    // Run each benchmark
    for (const benchmarkPath of options.benchmarkPaths) {
      logger.info('Running benchmark', {
        benchmark: benchmarkPath,
        modelId: options.modelId,
      });

      try {
        // Get agent runtime (will use the RL model if configured)
        const runtime = await getAgentRuntimeManager().getRuntime(testAgentId);

        // Run benchmark
        const simulationResult: SimulationResult =
          await BenchmarkRunner.runSingle({
            benchmarkPath,
            agentRuntime: runtime,
            agentUserId: testAgentId,
            saveTrajectory: false,
            outputDir:
              options.outputDir ||
              path.join(
                process.cwd(),
                'benchmarks',
                'model-results',
                model.version
              ),
            forceModel: model.storagePath, // Use the RL model
          });

        // Create benchmark result
        const benchmarkResult: ModelBenchmarkResult = {
          modelId: options.modelId,
          modelVersion: model.version,
          benchmarkId: simulationResult.benchmarkId || 'unknown',
          benchmarkPath,
          runAt: new Date(),
          metrics: simulationResult.metrics,
        };

        // Compare to baseline if available
        const baseline = await this.getBaselineBenchmark(benchmarkPath);
        if (baseline) {
          benchmarkResult.comparisonToBaseline = {
            pnlDelta: simulationResult.metrics.totalPnl - baseline.totalPnl,
            accuracyDelta:
              simulationResult.metrics.predictionMetrics.accuracy -
              baseline.predictionMetrics.accuracy,
            optimalityDelta:
              simulationResult.metrics.optimalityScore -
              baseline.optimalityScore,
            improved: simulationResult.metrics.totalPnl > baseline.totalPnl,
          };
        }

        results.push(benchmarkResult);

        logger.info('Benchmark completed', {
          benchmark: benchmarkPath,
          pnl: simulationResult.metrics.totalPnl,
          accuracy: simulationResult.metrics.predictionMetrics.accuracy,
        });

        // Save result if requested (to both database and files)
        if (options.saveResults) {
          await this.saveBenchmarkResultToDatabase(benchmarkResult);
          await this.saveBenchmarkResult(benchmarkResult);
        }
      } catch (error) {
        logger.error('Benchmark failed', { benchmark: benchmarkPath, error });
      }
    }

    // Update model with aggregate benchmark score
    if (results.length > 0) {
      const avgOptimality =
        results.reduce((sum, r) => sum + r.metrics.optimalityScore, 0) /
        results.length;
      const avgPnl =
        results.reduce((sum, r) => sum + r.metrics.totalPnl, 0) /
        results.length;

      await db.exec(
        `UPDATE "trained_models" SET
          "benchmarkScore" = $1,
          "avgReward" = $2,
          "lastBenchmarked" = $3,
          "benchmarkCount" = "benchmarkCount" + $4,
          "updatedAt" = $5
        WHERE "modelId" = $6`,
        [
          avgOptimality,
          avgPnl,
          new Date().toISOString(),
          results.length,
          new Date().toISOString(),
          options.modelId,
        ]
      );
    }

    logger.info('Model benchmark complete', {
      modelId: options.modelId,
      benchmarksRun: results.length,
    });

    return results;
  }

  /**
   * Compare new model against baseline
   */
  static async compareToBaseline(
    modelId: string
  ): Promise<ModelComparisonResult> {
    // Get new model benchmarks
    const newModelBenchmarks = await this.getModelBenchmarks(modelId);

    if (newModelBenchmarks.length === 0) {
      throw new Error(`No benchmarks found for model: ${modelId}`);
    }

    // Calculate new model average metrics
    const newModelMetrics = this.calculateAverageMetrics(
      newModelBenchmarks.map((b) => b.metrics)
    );

    // Get baseline benchmarks (use best baseline model)
    const baselineMetrics = await this.getBaselineAverageMetrics();

    // Calculate improvement
    const pnlDelta = newModelMetrics.totalPnl - baselineMetrics.totalPnl;
    const accuracyDelta = newModelMetrics.accuracy - baselineMetrics.accuracy;
    const optimalityDelta =
      newModelMetrics.optimality - baselineMetrics.optimality;

    // Determine if this is an improvement (weighted score)
    const improvementScore =
      (pnlDelta > 0 ? 1 : 0) * 0.4 +
      (accuracyDelta > 0 ? 1 : 0) * 0.3 +
      (optimalityDelta > 0 ? 1 : 0) * 0.3;

    const isImprovement = improvementScore > 0.5;

    let recommendation: 'deploy' | 'keep_training' | 'baseline_better';
    if (isImprovement && pnlDelta > 0) {
      recommendation = 'deploy';
    } else if (pnlDelta < -100) {
      recommendation = 'baseline_better';
    } else {
      recommendation = 'keep_training';
    }

    return {
      newModel: {
        modelId,
        version: newModelBenchmarks[0]!.modelVersion,
        avgMetrics: newModelMetrics,
      },
      baseline: {
        modelId: 'baseline',
        avgMetrics: baselineMetrics,
      },
      improvement: {
        pnlDelta,
        accuracyDelta,
        optimalityDelta,
        isImprovement,
      },
      recommendation,
    };
  }

  /**
   * Get all unbenchmarked models
   */
  static async getUnbenchmarkedModels(): Promise<string[]> {
    const models = await db.query<{ modelId: string }>(
      `SELECT "modelId" FROM "trained_models"
       WHERE "status" = $1 AND "benchmarkScore" IS NULL`,
      ['ready']
    );

    return models.map((m) => m.modelId);
  }

  /**
   * Get model benchmark results
   */
  private static async getModelBenchmarks(
    modelId: string
  ): Promise<ModelBenchmarkResult[]> {
    // For now, read from files
    // In production, you'd store these in a database table

    const benchmarksDir = path.join(
      process.cwd(),
      'benchmarks',
      'model-results'
    );
    const results: ModelBenchmarkResult[] = [];

    const model = await db.trainedModel.findFirst({ where: { modelId } });

    if (!model) return results;

    const modelDir = path.join(benchmarksDir, model.version);
    const files = await fs.readdir(modelDir).catch(() => []);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(modelDir, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        if (data.modelId === modelId) {
          results.push(data);
        }
      }
    }

    return results;
  }

  /**
   * Save benchmark result to database
   */
  private static async saveBenchmarkResultToDatabase(
    result: ModelBenchmarkResult
  ): Promise<void> {
    await db.benchmarkResult.create({
      data: {
        id: await generateSnowflakeId(),
        modelId: result.modelId,
        benchmarkId: result.benchmarkId,
        benchmarkPath: result.benchmarkPath,
        runAt: result.runAt,
        totalPnl: result.metrics.totalPnl,
        predictionAccuracy: result.metrics.predictionMetrics.accuracy,
        perpWinRate: result.metrics.perpMetrics.winRate,
        optimalityScore: result.metrics.optimalityScore,
        detailedMetrics: JSON.parse(JSON.stringify(result.metrics)),
        baselinePnlDelta: result.comparisonToBaseline?.pnlDelta ?? null,
        baselineAccuracyDelta:
          result.comparisonToBaseline?.accuracyDelta ?? null,
        improved: result.comparisonToBaseline?.improved ?? null,
        duration: result.metrics.timing.totalDuration,
      },
    });

    logger.info('Benchmark result saved to database', {
      modelId: result.modelId,
      benchmarkId: result.benchmarkId,
    });
  }

  /**
   * Save benchmark result to file
   */
  private static async saveBenchmarkResult(
    result: ModelBenchmarkResult
  ): Promise<void> {
    const outputDir = path.join(
      process.cwd(),
      'benchmarks',
      'model-results',
      result.modelVersion
    );
    await fs.mkdir(outputDir, { recursive: true });

    const filename = `benchmark-${result.benchmarkId}-${Date.now()}.json`;
    const filePath = path.join(outputDir, filename);

    await fs.writeFile(filePath, JSON.stringify(result, null, 2));

    logger.info('Benchmark result saved to file', { filePath });
  }

  /**
   * Get benchmark results from database
   */
  static async getBenchmarkResultsFromDatabase(
    modelId: string
  ): Promise<ModelBenchmarkResult[]> {
    const results = await db.query<{
      modelId: string;
      benchmarkId: string;
      benchmarkPath: string;
      runAt: Date;
      detailedMetrics: JsonValue;
      baselinePnlDelta: number | null;
      baselineAccuracyDelta: number | null;
      improved: boolean | null;
    }>(
      `SELECT "modelId", "benchmarkId", "benchmarkPath", "runAt",
              "detailedMetrics", "baselinePnlDelta", "baselineAccuracyDelta", "improved"
       FROM "benchmark_results"
       WHERE "modelId" = $1
       ORDER BY "runAt" DESC`,
      [modelId]
    );

    return results.map((r) => ({
      modelId: r.modelId,
      modelVersion: '', // Not stored in results table
      benchmarkId: r.benchmarkId,
      benchmarkPath: r.benchmarkPath,
      runAt: r.runAt,
      metrics: parseSimulationMetrics(r.detailedMetrics),
      comparisonToBaseline:
        r.baselinePnlDelta !== null
          ? {
              pnlDelta: r.baselinePnlDelta,
              accuracyDelta: r.baselineAccuracyDelta ?? 0,
              optimalityDelta: 0, // Not stored separately
              improved: r.improved || false,
            }
          : undefined,
    }));
  }

  /**
   * Get baseline benchmark for comparison
   */
  private static async getBaselineBenchmark(
    benchmarkPath: string
  ): Promise<SimulationMetrics | null> {
    // Look for baseline result for this benchmark
    const baselinesDir = path.join(process.cwd(), 'benchmarks', 'baselines');
    const files = await fs.readdir(baselinesDir).catch(() => []);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(baselinesDir, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        if (
          data.benchmark?.path === benchmarkPath ||
          data.benchmark === benchmarkPath
        ) {
          return data.metrics;
        }
      }
    }

    return null;
  }

  /**
   * Calculate average metrics across multiple benchmark results
   */
  private static calculateAverageMetrics(
    metricsArray: SimulationMetrics[]
  ): AverageMetrics {
    if (metricsArray.length === 0) {
      return {
        totalPnl: 0,
        accuracy: 0,
        winRate: 0,
        optimality: 0,
        benchmarkCount: 0,
      };
    }

    const totals = metricsArray.reduce(
      (acc, metrics) => ({
        pnl: acc.pnl + metrics.totalPnl,
        accuracy: acc.accuracy + metrics.predictionMetrics.accuracy,
        winRate: acc.winRate + metrics.perpMetrics.winRate,
        optimality: acc.optimality + metrics.optimalityScore,
      }),
      { pnl: 0, accuracy: 0, winRate: 0, optimality: 0 }
    );

    const count = metricsArray.length;

    return {
      totalPnl: totals.pnl / count,
      accuracy: totals.accuracy / count,
      winRate: totals.winRate / count,
      optimality: totals.optimality / count,
      benchmarkCount: count,
    };
  }

  /**
   * Get baseline average metrics
   */
  private static async getBaselineAverageMetrics(): Promise<AverageMetrics> {
    const baselinesDir = path.join(process.cwd(), 'benchmarks', 'baselines');
    const metricsArray: SimulationMetrics[] = [];

    const files = await fs.readdir(baselinesDir).catch(() => []);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(baselinesDir, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        if (data.metrics) {
          metricsArray.push(data.metrics);
        }
      }
    }

    return this.calculateAverageMetrics(metricsArray);
  }

  /**
   * Get or create test agent for benchmarking
   */
  private static async getOrCreateTestAgent(): Promise<string> {
    const testAgentUsername = 'model-benchmark-agent';

    const agent = await db.user.findFirst({
      where: { username: testAgentUsername },
    });

    if (agent) {
      return agent.id;
    }

    // Create new test agent
    const agentId = await generateSnowflakeId();
    const newAgent = await db.user.create({
      data: {
        id: agentId,
        oauth3Id: `did:jeju:testnet:model-benchmark-${agentId}`,
        username: testAgentUsername,
        displayName: 'Model Benchmark Agent',
        walletAddress: generateRandomWallet().address,
        isAgent: true,
        virtualBalance: '10000',
        reputationPoints: 1000,
        isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create agent config in separate table
    if (newAgent) {
      await db.userAgentConfig.create({
        data: {
          id: await generateSnowflakeId(),
          userId: agentId,
          autonomousTrading: true,
          autonomousPosting: false,
          autonomousCommenting: false,
          systemPrompt:
            'You are a test agent for benchmarking model performance.',
          modelTier: 'pro',
          pointsBalance: 10000,
          updatedAt: new Date(),
        },
      });
    }

    if (!newAgent) {
      throw new Error('Failed to create model benchmark test agent');
    }

    logger.info('Created model benchmark test agent', { agentId: newAgent.id });

    return newAgent.id;
  }

  /**
   * Get standard benchmark paths for model evaluation
   */
  static async getStandardBenchmarkPaths(): Promise<string[]> {
    const benchmarksDir = path.join(process.cwd(), 'benchmarks');
    const standardBenchmarks: string[] = [];

    // First, look in benchmarks/standard/ directory
    const standardDir = path.join(benchmarksDir, 'standard');
    const standardDirExists = await fs
      .access(standardDir)
      .then(() => true)
      .catch(() => false);

    if (standardDirExists) {
      const standardFiles = await fs.readdir(standardDir);
      for (const file of standardFiles) {
        if (file.startsWith('standard-') && file.endsWith('.json')) {
          standardBenchmarks.push(path.join(standardDir, file));
        }
      }
    }

    // If standard benchmarks found, use those
    if (standardBenchmarks.length > 0) {
      logger.info(
        `Using ${standardBenchmarks.length} standard benchmarks from benchmarks/standard/`
      );
      return standardBenchmarks;
    }

    // Fallback: Look for week-long benchmarks in main directory
    const files = await fs.readdir(benchmarksDir);
    for (const file of files) {
      if (file.startsWith('benchmark-week-') && file.endsWith('.json')) {
        standardBenchmarks.push(path.join(benchmarksDir, file));
      }
    }

    // If still nothing, use any benchmark files
    if (standardBenchmarks.length === 0) {
      for (const file of files) {
        if (
          file.startsWith('benchmark-') &&
          file.endsWith('.json') &&
          !file.includes('comparison')
        ) {
          const filePath = path.join(benchmarksDir, file);
          standardBenchmarks.push(filePath);
        }
      }
    }

    if (standardBenchmarks.length === 0) {
      logger.warn(
        'No standard benchmarks found. Generate with: babylon train generate'
      );
    }

    return standardBenchmarks;
  }
}
