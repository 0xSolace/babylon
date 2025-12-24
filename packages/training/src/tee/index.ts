/**
 * TEE Training Module
 *
 * Provides TEE-secured training workers for:
 * - Data preparation
 * - LLM judging
 * - RL training
 * - Model benchmarking
 *
 * Production Requirements:
 * - TEE_MODE must be set to a valid provider (phala, intel-sgx, intel-tdx, amd-sev)
 * - Simulated mode is NOT allowed in production
 * - TEE attestation is required for all sensitive operations
 */

export {
  type BenchmarkResult,
  createTrainingWorker,
  type DataPrepResult,
  type JudgingResult,
  type TrainingResult,
  TrainingWorker,
  type WorkerAttestation,
  type WorkerConfig,
  WorkerStatus,
  WorkerType,
} from './TrainingWorker'
