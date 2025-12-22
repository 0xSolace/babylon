/**
 * Configuration Validator
 *
 * Validates RL pipeline configuration before execution using Zod schemas.
 */

import { logger } from '@babylon/shared';
import { type ZodError, z } from 'zod';
import type { BenchmarkConfig } from '../benchmark/BenchmarkDataGenerator';
import {
  BenchmarkConfigSchema,
  type TrainingConfig,
  TrainingConfigSchema,
} from '../schemas';

/**
 * Shared validation result type for configuration validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Convert Zod errors to string array
 */
function zodErrorsToStrings(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Check for warnings based on validated config values
 */
function getTrainingWarnings(config: TrainingConfig): string[] {
  const warnings: string[] = [];

  if (config.batch_size > 64) {
    warnings.push('batch_size > 64 may cause memory issues');
  }

  if (config.learning_rate > 1e-3) {
    warnings.push('learning_rate > 1e-3 may cause training instability');
  }

  if (config.learning_rate < 1e-8) {
    warnings.push(
      'learning_rate < 1e-8 may be too small for effective learning'
    );
  }

  if (config.kl_penalty > 1.0) {
    warnings.push('kl_penalty > 1.0 may be too high');
  }

  return warnings;
}

export { type TrainingConfig };

export class ConfigValidator {
  /**
   * Validate training configuration using Zod
   */
  static validateTrainingConfig(config: TrainingConfig): ValidationResult {
    const result = TrainingConfigSchema.safeParse(config);

    if (!result.success) {
      return {
        valid: false,
        errors: zodErrorsToStrings(result.error),
        warnings: [],
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: getTrainingWarnings(result.data),
    };
  }

  /**
   * Validate benchmark configuration using Zod
   */
  static validateBenchmarkConfig(config: {
    duration_minutes: number;
    tick_interval_seconds: number;
    num_prediction_markets: number;
    num_perpetual_markets: number;
  }): ValidationResult {
    const result = BenchmarkConfigSchema.safeParse(config);
    const warnings: string[] = [];

    if (!result.success) {
      return {
        valid: false,
        errors: zodErrorsToStrings(result.error),
        warnings: [],
      };
    }

    // Add warnings for valid but potentially problematic values
    if (result.data.duration_minutes > 10080) {
      warnings.push(
        'duration_minutes > 10080 (1 week) may take a long time to generate'
      );
    }

    return {
      valid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate full pipeline config
   */
  static validatePipelineConfig(config: {
    benchmark: BenchmarkConfig | null | undefined;
    training: TrainingConfig;
    agents: { test_agent_count: number };
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate benchmark config
    if (config.benchmark) {
      const benchmarkResult = this.validateBenchmarkConfig({
        duration_minutes: config.benchmark.durationMinutes,
        tick_interval_seconds: config.benchmark.tickInterval,
        num_prediction_markets: config.benchmark.numPredictionMarkets,
        num_perpetual_markets: config.benchmark.numPerpetualMarkets,
      });
      errors.push(...benchmarkResult.errors);
      warnings.push(...benchmarkResult.warnings);
    }

    // Validate training config
    if (config.training) {
      const trainingResult = this.validateTrainingConfig(config.training);
      errors.push(...trainingResult.errors);
      warnings.push(...trainingResult.warnings);
    }

    // Validate agent config using Zod
    const agentSchema = z.object({
      test_agent_count: z.number().int().positive(),
    });
    const agentResult = agentSchema.safeParse(config.agents);

    if (!agentResult.success) {
      errors.push(...zodErrorsToStrings(agentResult.error));
    } else if (agentResult.data.test_agent_count > 10) {
      warnings.push('test_agent_count > 10 may be slow');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate and log results
   */
  static validateAndLog(config: {
    benchmark: BenchmarkConfig | null | undefined;
    training: TrainingConfig;
    agents: { test_agent_count: number };
  }): boolean {
    const result = this.validatePipelineConfig(config);

    if (result.warnings.length > 0) {
      logger.warn(
        'Configuration warnings',
        { warnings: result.warnings },
        'ConfigValidator'
      );
      result.warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
    }

    if (result.errors.length > 0) {
      logger.error(
        'Configuration errors',
        { errors: result.errors },
        'ConfigValidator'
      );
      result.errors.forEach((e) => console.error(`  ❌ ${e}`));
      return false;
    }

    logger.info(
      'Configuration validation passed',
      undefined,
      'ConfigValidator'
    );
    return true;
  }
}
