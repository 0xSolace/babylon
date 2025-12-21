/**
 * HuggingFace Integration Service
 *
 * Orchestrates the complete HuggingFace integration pipeline.
 * Main entry point for all HuggingFace operations.
 */

import { db } from '@babylon/db';
import { ModelBenchmarkService } from '../benchmark/ModelBenchmarkService';
import { getExportToHuggingFace } from '../dependencies';
import { logger } from '../utils';
import { HuggingFaceDatasetUploader } from './HuggingFaceDatasetUploader';
import { HuggingFaceModelUploader } from './HuggingFaceModelUploader';
import { getHuggingFaceToken } from './shared/HuggingFaceUploadUtil';

export interface WeeklyUploadResult {
  success: boolean;
  datasets: {
    benchmarks: { success: boolean; url?: string; error?: string };
    trajectories: { success: boolean; url?: string; error?: string };
  };
  models: {
    processed: number;
    benchmarked: number;
    uploaded: number;
  };
  errors: string[];
  duration: number;
}

export interface DatasetUploadOptions {
  datasetName?: string;
  trajectoryDatasetName?: string;
  modelNamePrefix?: string;
  dryRun?: boolean;
}

export class HuggingFaceIntegrationService {
  private datasetUploader: HuggingFaceDatasetUploader;
  private modelUploader: HuggingFaceModelUploader;

  constructor() {
    this.datasetUploader = new HuggingFaceDatasetUploader();
    this.modelUploader = new HuggingFaceModelUploader();
  }

  /**
   * Execute complete weekly upload pipeline
   */
  async executeWeeklyUpload(
    options: DatasetUploadOptions = {}
  ): Promise<WeeklyUploadResult> {
    const startTime = Date.now();
    logger.info(
      'Starting weekly upload pipeline',
      options,
      'HuggingFaceIntegration'
    );

    const result: WeeklyUploadResult = {
      success: false,
      datasets: {
        benchmarks: { success: false },
        trajectories: { success: false },
      },
      models: {
        processed: 0,
        benchmarked: 0,
        uploaded: 0,
      },
      errors: [],
      duration: 0,
    };

    // Step 1: Upload benchmark dataset
    if (!options.dryRun) {
      logger.info(
        'Step 1: Uploading benchmark dataset',
        undefined,
        'HuggingFaceIntegration'
      );
      const benchmarkResult = await this.datasetUploader.uploadDataset({
        datasetName:
          options.datasetName ||
          process.env.HF_DATASET_NAME ||
          'babylonlabs/agent-benchmarks',
        description:
          'Weekly benchmark results for Babylon autonomous trading agents',
      });

      result.datasets.benchmarks = {
        success: benchmarkResult.success,
        url: benchmarkResult.datasetUrl,
      };
    } else {
      logger.info(
        'DRY RUN: Skipping benchmark dataset upload',
        undefined,
        'HuggingFaceIntegration'
      );
      result.datasets.benchmarks.success = true;
    }

    // Step 2: Upload trajectory dataset
    if (!options.dryRun) {
      logger.info(
        'Step 2: Uploading trajectory dataset',
        undefined,
        'HuggingFaceIntegration'
      );
      const exportToHuggingFace = getExportToHuggingFace();
      const trajectoryResult = await exportToHuggingFace({
        datasetName:
          options.trajectoryDatasetName ||
          process.env.HF_TRAJECTORY_DATASET_NAME ||
          'babylonlabs/agent-trajectories',
        format: 'jsonl',
      });

      result.datasets.trajectories = {
        success: trajectoryResult.success,
        url: trajectoryResult.url,
      };
    } else {
      logger.info(
        'DRY RUN: Skipping trajectory dataset upload',
        undefined,
        'HuggingFaceIntegration'
      );
      result.datasets.trajectories.success = true;
    }

    // Step 3: Process models
    const unbenchmarkedModels =
      await ModelBenchmarkService.getUnbenchmarkedModels();
    result.models.processed = unbenchmarkedModels.length;

    logger.info(
      `Step 3: Found ${unbenchmarkedModels.length} unbenchmarked models`,
      undefined,
      'HuggingFaceIntegration'
    );

    if (unbenchmarkedModels.length > 0) {
      const standardBenchmarks =
        await ModelBenchmarkService.getStandardBenchmarkPaths();

      if (standardBenchmarks.length === 0) {
        throw new Error(
          'No standard benchmarks available for model evaluation'
        );
      }

      for (const modelId of unbenchmarkedModels) {
        // Benchmark model - errors propagate for individual models (batch processing)
        // but we continue processing other models
        try {
          logger.info(
            `Benchmarking model: ${modelId}`,
            undefined,
            'HuggingFaceIntegration'
          );
          await ModelBenchmarkService.benchmarkModel({
            modelId,
            benchmarkPaths: standardBenchmarks,
            saveResults: true,
          });
          result.models.benchmarked++;

          // Compare to baseline
          const comparison =
            await ModelBenchmarkService.compareToBaseline(modelId);

          // Upload if improved
          if (comparison.recommendation === 'deploy' && !options.dryRun) {
            logger.info(
              `Model ${modelId} improved, uploading`,
              undefined,
              'HuggingFaceIntegration'
            );

            const model = await db.trainedModel.findUnique({
              where: { modelId },
            });

            if (model) {
              const modelName = options.modelNamePrefix
                ? `${options.modelNamePrefix}-${model.version}`
                : process.env.HF_MODEL_NAME
                  ? `${process.env.HF_MODEL_NAME}-${model.version}`
                  : `babylonlabs/babylon-agent-${model.version}`;

              const uploadResult = await this.modelUploader.uploadModel({
                modelId,
                modelName,
                description: `Babylon autonomous trading agent - v${model.version}`,
                includeWeights: true,
              });

              if (uploadResult.success) {
                result.models.uploaded++;

                // Update model with HuggingFace repo
                await db.trainedModel.update({
                  where: { modelId },
                  data: {
                    huggingFaceRepo: modelName,
                    deployedAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
              }
            }
          } else {
            logger.info(
              `Model ${modelId} not ready for deployment: ${comparison.recommendation}`,
              undefined,
              'HuggingFaceIntegration'
            );
          }
        } catch (error) {
          // Log but continue processing other models (batch processing pattern)
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Failed to process model ${modelId}`,
            { error },
            'HuggingFaceIntegration'
          );
          result.errors.push(`Model ${modelId}: ${errorMsg}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    logger.info(
      'Weekly upload pipeline complete',
      {
        success: result.success,
        benchmarkDataset: result.datasets.benchmarks.success,
        trajectoryDataset: result.datasets.trajectories.success,
        modelsProcessed: result.models.processed,
        modelsBenchmarked: result.models.benchmarked,
        modelsUploaded: result.models.uploaded,
        errors: result.errors.length,
        duration: result.duration,
      },
      'HuggingFaceIntegration'
    );

    return result;
  }

  /**
   * Check if new data is available for upload
   */
  async hasNewDataToUpload(): Promise<{
    hasNewBenchmarks: boolean;
    hasNewTrajectories: boolean;
    hasUnbenchmarkedModels: boolean;
    details: {
      newBenchmarksSince?: Date;
      newTrajectoriesCount: number;
      unbenchmarkedModels: number;
    };
  }> {
    // Get last upload time from database (we could track this)
    const lastUploadModel = await db.trainedModel.findFirst({
      where: {
        AND: [
          { huggingFaceRepo: { not: null } },
          { deployedAt: { not: null } },
        ],
      },
      orderBy: { deployedAt: 'desc' },
    });

    const lastUploadTime = lastUploadModel?.deployedAt ?? new Date(0);

    // Check for new benchmarks (from benchmark_results table)
    const newBenchmarksCount = await db.benchmarkResult.count({
      where: { createdAt: { gte: lastUploadTime } },
    });

    // Check for new trajectories
    const newTrajectoriesCount = await db.trajectory.count({
      where: { createdAt: { gte: lastUploadTime } },
    });

    // Check for unbenchmarked models
    const unbenchmarkedModels =
      await ModelBenchmarkService.getUnbenchmarkedModels();

    return {
      hasNewBenchmarks: newBenchmarksCount > 0,
      hasNewTrajectories: newTrajectoriesCount > 0,
      hasUnbenchmarkedModels: unbenchmarkedModels.length > 0,
      details: {
        newBenchmarksSince: lastUploadTime,
        newTrajectoriesCount,
        unbenchmarkedModels: unbenchmarkedModels.length,
      },
    };
  }

  /**
   * Validate system is ready for HuggingFace operations
   */
  async validateSystemReadiness(): Promise<{
    ready: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check HuggingFace token
    if (!getHuggingFaceToken()) {
      issues.push(
        'HUGGING_FACE_TOKEN or HF_TOKEN environment variable not set'
      );
    }

    // Check database connection with a simple query
    try {
      await db.trainedModel.count();
    } catch {
      issues.push('Cannot connect to database');
    }

    // Check BenchmarkResult table exists
    try {
      await db.benchmarkResult.count();
    } catch {
      issues.push(
        'BenchmarkResult table does not exist. Run migrations (bun run db:migrate).'
      );
    }

    // Check for standard benchmarks
    const standardBenchmarks =
      await ModelBenchmarkService.getStandardBenchmarkPaths();
    if (standardBenchmarks.length === 0) {
      warnings.push(
        'No standard benchmarks found. Run: babylon train generate'
      );
    }

    // Check for benchmark data
    const benchmarkCount = await db.benchmarkResult.count();
    if (benchmarkCount === 0) {
      warnings.push(
        'No benchmark results in database. Run some benchmarks first.'
      );
    }

    // Check for trajectory data
    const trajectoryTrainingCount = await db.trajectory.count({
      where: { isTrainingData: true },
    });
    if (trajectoryTrainingCount === 0) {
      warnings.push(
        'No training trajectories in database. Generate with agents or test data.'
      );
    }

    // Check for trained models
    const modelCount = await db.trainedModel.count();
    if (modelCount === 0) {
      warnings.push('No trained models in database.');
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Get integration statistics
   */
  async getStatistics(): Promise<{
    benchmarks: { total: number; lastUpload?: Date };
    trajectories: { total: number; training: number };
    models: { total: number; benchmarked: number; deployed: number };
    huggingface: { datasetsPublished: number; modelsPublished: number };
  }> {
    const benchmarkCount = await db.benchmarkResult.count();

    const lastBenchmark = await db.benchmarkResult.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const trajectoryTotal = await db.trajectory.count();
    const trajectoryTraining = await db.trajectory.count({
      where: { isTrainingData: true },
    });

    const modelTotal = await db.trainedModel.count();
    const modelBenchmarked = await db.trainedModel.count({
      where: { benchmarkScore: { not: null } },
    });
    const modelDeployed = await db.trainedModel.count({
      where: { huggingFaceRepo: { not: null } },
    });

    const deployedModels = await db.trainedModel.findMany({
      where: { huggingFaceRepo: { not: null } },
    });
    const uniqueRepos = new Set<string>();
    for (const model of deployedModels) {
      if (model.huggingFaceRepo) uniqueRepos.add(model.huggingFaceRepo);
    }

    return {
      benchmarks: {
        total: benchmarkCount,
        lastUpload: lastBenchmark?.createdAt,
      },
      trajectories: {
        total: trajectoryTotal,
        training: trajectoryTraining,
      },
      models: {
        total: modelTotal,
        benchmarked: modelBenchmarked,
        deployed: modelDeployed,
      },
      huggingface: {
        datasetsPublished: 2, // benchmarks + trajectories (hardcoded for now)
        modelsPublished: uniqueRepos.size,
      },
    };
  }
}

export const huggingFaceIntegration = new HuggingFaceIntegrationService();
