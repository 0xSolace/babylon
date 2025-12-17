/**
 * Compute Training Types
 */

import type { Address } from 'viem';

export interface ComputeTrainingConfig {
  mode: 'local' | 'jeju' | 'auto';
  jejuRpcUrl?: string;
  computeMarketplaceAddress?: Address;
  triggerRegistryAddress?: Address;
  cloudEndpoint?: string;
  privateKey?: string;
  preferredGpuType?: 'H200' | 'H100' | 'A100' | 'RTX4090';
  maxHourlyRate?: bigint;
  timeoutMinutes?: number;
}

export interface TrainingJobRequest {
  batchId: string;
  baseModel: string;
  datasetCID: string;
  trainingSteps: number;
  batchSize: number;
  learningRate: number;
  archetype?: string;
  rubricHash?: string;
  callbackUrl?: string;
}

export type TrainingJobStatus =
  | 'pending'
  | 'provisioning'
  | 'training'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface TrainingJobResult {
  jobId: string;
  status: TrainingJobStatus;
  modelCID?: string;
  modelHash?: string;
  metricsJson?: string;
  error?: string;
  gpuType?: string;
  providerAddress?: Address;
  costWei?: bigint;
  durationSeconds?: number;
  checkpointCIDs?: string[];
}

export interface GPURentalRequest {
  durationHours: number;
  gpuType: 'H200' | 'H100' | 'A100' | 'RTX4090';
  memoryGb?: number;
  containerImage?: string;
  startupScript?: string;
}

export interface GPURentalResult {
  rentalId: string;
  providerAddress: Address;
  sshHost: string;
  sshPort: number;
  expiresAt: number;
  costWei: bigint;
}
