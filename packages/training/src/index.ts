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
export * from './archetypes'
// Sub-modules
export * from './benchmark'
export type {
  BabylonRLAIFConfig,
  ComputeTrainingConfig,
  TrainingConfig as PsycheTrainingConfig,
  TrainingJob,
  TrainingJobRequest,
  TrainingJobResult,
  TrainingJobStatus,
  TrainingProgress,
  TrainingRecord,
  TreasuryConfig,
} from './compute'
// Compute integration (Jeju marketplace)
// Note: TrainingConfig is also exported from ./training, so we use explicit exports
// and rename compute's TrainingConfig to avoid conflict
export {
  areBabylonRubricsRegistered,
  BabylonJejuAdapter,
  BabylonTreasuryClient,
  ComputeTrainingClient,
  createBabylonJejuAdapter,
  createComputeTrainingClient,
  createTrainingClient,
  GPUTier,
  getBabylonRubricId,
  getTreasuryClient,
  isTrainingAvailable,
  isTreasuryAvailable,
  PrivacyMode,
  RunState,
  recordTrainingOnChain,
  registerBabylonRubrics,
  sendHeartbeat,
  TrainingClient,
  trainWithJejuRLAIF,
} from './compute'
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
} from './dependencies'
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
} from './dependencies'
// Generation
export * from './generation'
export * from './huggingface'
// Training initialization
export {
  initializeTrainingPackage,
  isTrainingInitialized,
  resetTrainingInitialization,
} from './init-training'
// Metrics
export * from './metrics'
export * from './rubrics'
export * from './scoring'
export * from './training'
// Utilities
export * from './utils'

// =============================================================================
// DECENTRALIZED TRAINING INFRASTRUCTURE
// =============================================================================

// Note: Jeju RLAIF exports (BabylonJejuAdapter, createBabylonJejuAdapter, trainWithJejuRLAIF)
// are already included in ./compute exports above
// MPC Configuration
export * from './mpc'
// Encrypted Storage
export * from './storage'
// TEE Training Workers
export * from './tee'
