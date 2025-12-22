/**
 * Submits training jobs to Jeju compute or executes locally as fallback.
 */

import { logger } from '@babylon/shared';
import { spawn } from 'child_process';
import path from 'path';
import type { Address } from 'viem';
import type {
  ComputeTrainingConfig,
  GPURentalRequest,
  GPURentalResult,
  TrainingJobRequest,
  TrainingJobResult,
} from './types';

const DEFAULT_CONFIG: Required<ComputeTrainingConfig> = {
  mode: 'auto',
  jejuRpcUrl: process.env.JEJU_RPC_URL || 'http://localhost:9545',
  computeMarketplaceAddress: (process.env.COMPUTE_MARKETPLACE_ADDRESS ||
    '0x0') as Address,
  triggerRegistryAddress: (process.env.TRIGGER_REGISTRY_ADDRESS ||
    '0x0') as Address,
  cloudEndpoint: process.env.CLOUD_ENDPOINT || 'https://cloud.jeju.ai',
  privateKey: process.env.PRIVATE_KEY || '',
  preferredGpuType: 'H200',
  maxHourlyRate: BigInt(process.env.MAX_HOURLY_RATE || '1000000000000000'), // 0.001 ETH
  timeoutMinutes: 60,
};

export class ComputeTrainingClient {
  private config: Required<ComputeTrainingConfig>;
  private activeJobs: Map<string, TrainingJobResult> = new Map();

  constructor(config: Partial<ComputeTrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldUseJeju(): boolean {
    if (this.config.mode === 'local') return false;
    if (this.config.mode === 'jeju') return true;

    // Auto-detect based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const hasJeju =
      !!process.env.BABYLON_TREASURY_ADDRESS && !!process.env.RPC_URL;
    return hasJeju && isProduction;
  }

  async submitTrainingJob(request: TrainingJobRequest): Promise<string> {
    const jobId = `train-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result: TrainingJobResult = {
      jobId,
      status: 'pending',
    };
    this.activeJobs.set(jobId, result);

    if (this.shouldUseJeju()) {
      await this.submitToJeju(jobId, request);
    } else {
      await this.executeLocally(jobId, request);
    }

    return jobId;
  }

  private async submitToJeju(
    jobId: string,
    request: TrainingJobRequest
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)!;
    result.status = 'provisioning';

    logger.info('Submitting training job to Jeju compute', {
      jobId,
      batchId: request.batchId,
      baseModel: request.baseModel,
    });

    const rental = await this.rentGPU({
      durationHours: Math.ceil((this.config.timeoutMinutes * 2) / 60),
      gpuType: this.config.preferredGpuType,
      memoryGb: 80,
      containerImage: 'ghcr.io/jeju-ai/babylon-training-gpu:latest',
      startupScript: this.generateStartupScript(request),
    });

    result.gpuType = rental.rentalId;
    result.providerAddress = rental.providerAddress;
    result.costWei = rental.costWei;
    result.status = 'training';

    logger.info('GPU rented, training started', {
      jobId,
      rentalId: rental.rentalId,
      provider: rental.providerAddress,
      sshHost: rental.sshHost,
    });

    this.pollForCompletion(jobId, rental);
  }

  private async rentGPU(request: GPURentalRequest): Promise<GPURentalResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `${this.config.cloudEndpoint}/api/v1/rentals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.privateKey}`,
        },
        body: JSON.stringify({
          durationHours: request.durationHours,
          gpuType: request.gpuType,
          memoryGb: request.memoryGb,
          containerImage: request.containerImage,
          startupScript: request.startupScript,
        }),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`GPU rental failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      rentalId: string;
      providerAddress: string;
      sshHost: string;
      sshPort: number;
      expiresAt: number;
      costWei: string;
    };

    return {
      rentalId: data.rentalId,
      providerAddress: data.providerAddress as Address,
      sshHost: data.sshHost,
      sshPort: data.sshPort,
      expiresAt: data.expiresAt,
      costWei: BigInt(data.costWei),
    };
  }

  private generateStartupScript(request: TrainingJobRequest): string {
    return `#!/bin/bash
set -e

# Download training data
ipfs get ${request.datasetCID} -o /app/data

# Run training
python3 /app/train.py \\
  --model ${request.baseModel} \\
  --data /app/data \\
  --steps ${request.trainingSteps} \\
  --batch-size ${request.batchSize} \\
  --lr ${request.learningRate} \\
  ${request.archetype ? `--archetype ${request.archetype}` : ''} \\
  --output /app/output

# Upload model to IPFS
MODEL_CID=$(ipfs add -r -Q /app/output)
echo "MODEL_CID=$MODEL_CID" > /app/result.txt

# Notify callback
${request.callbackUrl ? `curl -X POST "${request.callbackUrl}" -d "jobId=${request.batchId}&modelCID=$MODEL_CID"` : ''}
`;
  }

  private async pollForCompletion(
    jobId: string,
    rental: GPURentalResult
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)!;
    const startTime = Date.now();
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 30000)); // Check every 30s

      const statusResponse = await fetch(
        `${this.config.cloudEndpoint}/api/v1/rentals/${rental.rentalId}/status`,
        {
          headers: { Authorization: `Bearer ${this.config.privateKey}` },
        }
      );

      if (!statusResponse.ok) continue;

      const status = (await statusResponse.json()) as {
        status: string;
        modelCID?: string;
        modelHash?: string;
        error?: string;
      };

      if (status.status === 'completed') {
        result.status = 'completed';
        result.modelCID = status.modelCID;
        result.modelHash = status.modelHash;
        result.durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        logger.info('Training completed', { jobId, modelCID: status.modelCID });
        return;
      }

      if (status.status === 'failed') {
        result.status = 'failed';
        result.error = status.error || 'Unknown error';
        logger.error('Training failed', { jobId, error: result.error });
        return;
      }
    }

    result.status = 'failed';
    result.error = 'Timeout';
    logger.error('Training timed out', { jobId });
  }

  private async executeLocally(
    jobId: string,
    request: TrainingJobRequest
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)!;
    result.status = 'training';

    logger.info('Executing training locally', {
      jobId,
      batchId: request.batchId,
      baseModel: request.baseModel,
    });

    const trainingMode = process.env.TRAINING_MODE || 'atropos';
    const useTinker = trainingMode === 'tinker';

    const pythonScript = path.resolve(
      process.cwd(),
      'packages/training/python/src/training',
      useTinker ? 'tinker_trainer.py' : 'atropos_trainer.py'
    );

    const env = {
      ...process.env,
      BATCH_ID: request.batchId,
      BASE_MODEL: request.baseModel,
      TRAINING_STEPS: String(request.trainingSteps),
      BATCH_SIZE: String(request.batchSize),
      LEARNING_RATE: String(request.learningRate),
      ARCHETYPE: request.archetype || '',
    };

    const proc = spawn('python3', [pythonScript], { env, stdio: 'pipe' });

    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug('Training output', { output: data.toString().trim() });
    });

    proc.stderr?.on('data', (data: Buffer) => {
      logger.warn('Training stderr', { output: data.toString().trim() });
    });

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', resolve);
      proc.on('error', () => resolve(1));
    });

    if (exitCode === 0) {
      result.status = 'completed';
      logger.info('Local training completed', { jobId });
    } else {
      result.status = 'failed';
      result.error = `Process exited with code ${exitCode}`;
      logger.error('Local training failed', { jobId, exitCode });
    }
  }

  getJobStatus(jobId: string): TrainingJobResult | null {
    return this.activeJobs.get(jobId) || null;
  }

  async waitForJob(
    jobId: string,
    timeoutMs = 3600000
  ): Promise<TrainingJobResult> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = this.activeJobs.get(jobId);
      if (
        result &&
        (result.status === 'completed' || result.status === 'failed')
      ) {
        return result;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`Job ${jobId} timed out`);
  }
}

export function createComputeTrainingClient(
  config?: Partial<ComputeTrainingConfig>
): ComputeTrainingClient {
  return new ComputeTrainingClient(config);
}
