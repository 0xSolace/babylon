/**
 * Babylon Training Package
 *
 * A comprehensive training pipeline for RL agents including:
 * - Benchmarking and evaluation
 * - Training automation
 * - HuggingFace integration
 * - Multi-criteria archetype evaluation
 *
 * @packageDocumentation
 */

// Archetypes
export * from './archetypes';
// Re-export all sub-modules
export * from './benchmark';
// Compute integration (Jeju marketplace)
export * from './compute';
export type {
  CreateAgentParams,
  ExportGroupedForGRPOFn,
  ExportToHuggingFaceFn,
  IAgentRuntimeManager,
  IAgentService,
  IAutonomousCoordinator,
  ILLMCaller,
  ToTrainingMessagesFn,
  TrainingMessage,
  TrajectoryForTraining,
  TrajectoryStepForTraining,
} from './dependencies';
// Dependencies configuration
export {
  areAgentDependenciesConfigured,
  areDependenciesConfigured,
  configureTrainingDependencies,
  getAgentRuntimeManager,
  getAgentService,
  getAutonomousCoordinator,
  getExportGroupedForGRPO,
  getExportToHuggingFace,
  getLLMCaller,
  getToTrainingMessages,
} from './dependencies';
// Generation
export * from './generation';
export * from './huggingface';
// Training initialization
export {
  initializeTrainingPackage,
  isTrainingInitialized,
  resetTrainingInitialization,
} from './init-training';
// Metrics (re-export for backwards compatibility, prefer import from './metrics')
export * from './metrics';
export * from './rubrics';
export * from './scoring';
export * from './training';
// Utilities
export * from './utils';

// =============================================================================
// DECENTRALIZED TRAINING INFRASTRUCTURE
// =============================================================================

// Jeju RLAIF Integration
export {
  BabylonJejuAdapter,
  createBabylonJejuAdapter,
  trainWithJejuRLAIF,
} from './compute/jeju-rlaif-adapter';
// MPC Configuration
export * from './mpc';
// Encrypted Storage
export * from './storage';
// TEE Training Workers
export * from './tee';
