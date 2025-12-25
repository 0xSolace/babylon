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
 *
 * For DWS-based distributed training with Atropos/Psyche integration,
 * use DWSTrainingClient which connects to Jeju DWS infrastructure.
 */

export { ComputeTrainingClient, createComputeTrainingClient } from './client'
// Decentralized training integration (Psyche-style)
export type {
  TrainingConfig as DecentralizedTrainingConfig,
  TrainingJob as DecentralizedTrainingJob,
  TrainingProgress as DecentralizedTrainingProgress,
} from './decentralized-training'
export {
  createDecentralizedTrainingClient,
  GPUTier as DecentralizedGPUTier,
  isDecentralizedTrainingAvailable,
  PrivacyMode as DecentralizedPrivacyMode,
  RunState as DecentralizedRunState,
  TrainingClient as DecentralizedTrainingClient,
} from './decentralized-training'
// DWS Training Client (Atropos/Psyche/GRPO integration)
export type {
  DWSClientConfig,
  DWSJobStatus,
  JudgeResult,
  RolloutData,
} from './dws-client'
export {
  createDWSClient,
  DWSTrainingClient,
  getDefaultDWSConfig,
  isDWSAvailable,
} from './dws-client'
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
