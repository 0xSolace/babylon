/**
 * Training Module Types
 *
 * Type definitions for the training pipeline and automation.
 * Re-exports Zod-inferred types from schemas for consistency.
 */

import type { BenchmarkConfig as BenchmarkConfigInput } from '../benchmark/BenchmarkDataGenerator';
import type {
  AutomationConfig as ZodAutomationConfig,
  TrainingConfig as ZodTrainingConfig,
  TrainingStats as ZodTrainingStats,
  TrainingTriggerOptions as ZodTrainingTriggerOptions,
} from '../schemas';

// Re-export core types from schemas
export type {
  Action,
  EnvironmentState,
  LLMCall,
  ProviderAccess,
  RulerScoreResponse,
  TrajectoryData,
  TrajectoryScoreResponse,
  TrajectoryStep,
} from '../schemas';
// Re-export validation functions
// Re-export schemas for validation
export {
  ActionSchema,
  AutomationConfigSchema,
  EnvironmentStateSchema,
  LLMCallSchema,
  ProviderAccessSchema,
  parseTrajectoryIds,
  parseTrajectorySteps,
  RulerScoreResponseSchema,
  safeParseJson,
  TrainingConfigSchema,
  TrajectoryDataSchema,
  TrajectoryScoreResponseSchema,
  TrajectoryStepSchema,
} from '../schemas';

/**
 * Automation pipeline configuration
 */
export type AutomationConfig = ZodAutomationConfig;

/**
 * Training configuration
 */
export type TrainingConfig = ZodTrainingConfig;

/**
 * Training trigger options
 */
export type TrainingTriggerOptions = ZodTrainingTriggerOptions;

/**
 * Training readiness result
 */
export interface TrainingReadinessResult {
  ready: boolean;
  reason: string;
  stats: ZodTrainingStats;
}

/**
 * Training trigger result
 */
export interface TrainingTriggerResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Training monitoring status
 */
export interface TrainingMonitoringStatus {
  status: string;
  progress?: number;
  eta?: number;
  error?: string;
}

/**
 * Automation status for dashboard
 */
export interface AutomationStatus {
  dataCollection: {
    last24h: number;
    last7d: number;
    ratePerHour: number;
  };
  training: {
    currentJob: string | null;
    lastCompleted: Date | null;
    nextScheduled: Date | null;
  };
  models: {
    latest: string | null;
    deployed: number;
    training: number;
  };
  health: {
    database: boolean;
    storage: boolean;
    atropos: boolean;
  };
}

/**
 * Pipeline configuration (combines benchmark, training, and agent configs)
 */
export interface PipelineConfig {
  benchmark: BenchmarkConfigInput | null | undefined;
  training: TrainingConfig;
  agents: { test_agent_count: number };
}
