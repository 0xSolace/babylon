/**
 * Compute Training Client
 *
 * Integrates Babylon training with Jeju's decentralized compute marketplace.
 * When USE_JEJU is true or running inside Jeju, training jobs are submitted
 * to the compute marketplace which rents GPUs from cloud providers.
 *
 * For fully decentralized training using Psyche-style coordination,
 * use DecentralizedTrainingClient which integrates with Jeju's
 * TrainingCoordinator, TrainingRewards, and NodePerformanceOracle contracts.
 */

export { ComputeTrainingClient, createComputeTrainingClient } from './client';
export type {
  DecentralizedTrainingConfig,
  DecentralizedTrainingJob,
  TrainingProgress,
} from './decentralized-training';
// Decentralized training integration (Psyche-style)
export {
  createDecentralizedTrainingClient,
  DecentralizedTrainingClient,
  GPUTier,
  isDecentralizedTrainingAvailable,
  PrivacyMode,
  RunState,
} from './decentralized-training';
// Jeju RLAIF integration
export type { BabylonRLAIFConfig } from './jeju-rlaif-adapter';
export {
  BabylonJejuAdapter,
  createBabylonJejuAdapter,
  trainWithJejuRLAIF,
} from './jeju-rlaif-adapter';
export type { TrainingRecord, TreasuryConfig } from './treasury-integration';
// Treasury integration for on-chain training audit
export {
  BabylonTreasuryClient,
  getTreasuryClient,
  isTreasuryAvailable,
  recordTrainingOnChain,
  sendHeartbeat,
} from './treasury-integration';
export type {
  ComputeTrainingConfig,
  TrainingJobRequest,
  TrainingJobResult,
  TrainingJobStatus,
} from './types';
