/**
 * Compute Training Client
 *
 * Integrates Babylon training with Jeju's decentralized compute marketplace.
 * When USE_JEJU is true or running inside Jeju, training jobs are submitted
 * to the compute marketplace which rents GPUs from cloud providers.
 *
 * For training using Psyche-style coordination,
 * use TrainingClient which integrates with Jeju's
 * TrainingCoordinator, TrainingRewards, and NodePerformanceOracle contracts.
 */

export { ComputeTrainingClient, createComputeTrainingClient } from './client'
// Jeju RLAIF integration
export type { BabylonRLAIFConfig } from './jeju-rlaif-adapter'
export {
  areBabylonRubricsRegistered,
  BabylonJejuAdapter,
  createBabylonJejuAdapter,
  getBabylonRubricId,
  registerBabylonRubrics,
  trainWithJejuRLAIF,
} from './jeju-rlaif-adapter'
export type {
  TrainingConfig,
  TrainingJob,
  TrainingProgress,
} from './training'
// Training integration (Psyche-style)
export {
  createTrainingClient,
  GPUTier,
  isTrainingAvailable,
  PrivacyMode,
  RunState,
  TrainingClient,
} from './training'
export type { TrainingRecord, TreasuryConfig } from './treasury-integration'
// Treasury integration for on-chain training audit
export {
  BabylonTreasuryClient,
  getTreasuryClient,
  isTreasuryAvailable,
  recordTrainingOnChain,
  sendHeartbeat,
} from './treasury-integration'
export type {
  ComputeTrainingConfig,
  TrainingJobRequest,
  TrainingJobResult,
  TrainingJobStatus,
} from './types'
