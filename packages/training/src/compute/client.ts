/**
 * Submits training jobs to Jeju compute or executes locally as fallback.
 *
 * GPU Provider Configuration:
 * - GPU_PROVIDER=onchain: Use on-chain GPU marketplace (decentralized)
 * - GPU_PROVIDER=cloud: Use cloud.jeju.ai (centralized, legacy)
 * - GPU_PROVIDER=local: Execute locally (no GPU rental)
 * - GPU_PROVIDER=auto: Auto-detect based on environment
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { logger } from '@babylon/shared'
import type { Address } from 'viem'
import {
  type GPUProvider,
  isAddress,
  isGPUProvider,
  isGPURentalResponse,
  isGPURentalStatusResponse,
} from '../type-guards'
import type {
  ComputeTrainingConfig,
  GPURentalRequest,
  GPURentalResult,
  TrainingJobRequest,
  TrainingJobResult,
} from './types'

/**
 * Get the configured GPU provider
 */
function getGPUProvider(): GPUProvider {
  const provider = process.env.GPU_PROVIDER
  if (isGPUProvider(provider)) {
    return provider
  }
  // Auto-detect: use onchain if Jeju network configured, otherwise local
  if (
    process.env.JEJU_NETWORK === 'mainnet' ||
    process.env.JEJU_NETWORK === 'testnet'
  ) {
    return 'onchain'
  }
  return 'local'
}

// Port configuration via env var
const COMPUTE_PORT = process.env.JEJU_COMPUTE_PORT ?? '5010'

/**
 * Get the compute endpoint based on network and provider
 */
function getComputeEndpoint(): string {
  // Explicit override
  if (process.env.JEJU_COMPUTE_ENDPOINT) {
    return process.env.JEJU_COMPUTE_ENDPOINT
  }

  const provider = getGPUProvider()

  // Cloud provider uses legacy endpoint
  if (provider === 'cloud') {
    return process.env.CLOUD_ENDPOINT || 'https://cloud.jeju.ai'
  }

  // On-chain provider uses network-specific endpoints
  const network = process.env.JEJU_NETWORK
  if (network === 'mainnet') {
    return 'https://compute.jeju.network'
  }
  if (network === 'testnet') {
    return 'https://compute.testnet.jeju.network'
  }

  // Localnet default
  return `http://localhost:${COMPUTE_PORT}`
}

// RPC port configuration via env var
const L2_RPC_PORT = process.env.L2_RPC_PORT ?? '6546'

const DEFAULT_CONFIG: Required<ComputeTrainingConfig> = {
  mode: 'auto',
  jejuRpcUrl:
    process.env.JEJU_RPC_URL ||
    (process.env.JEJU_NETWORK === 'mainnet'
      ? 'https://rpc.jeju.network'
      : process.env.JEJU_NETWORK === 'testnet'
        ? 'https://testnet-rpc.jeju.network'
        : `http://localhost:${L2_RPC_PORT}`),
  computeMarketplaceAddress: (process.env.COMPUTE_MARKETPLACE_ADDRESS ||
    '0x0') as Address,
  triggerRegistryAddress: (process.env.TRIGGER_REGISTRY_ADDRESS ||
    '0x0') as Address,
  cloudEndpoint: getComputeEndpoint(),
  privateKey: process.env.PRIVATE_KEY || '',
  preferredGpuType: 'H200',
  maxHourlyRate: BigInt(process.env.MAX_HOURLY_RATE || '1000000000000000'), // 0.001 ETH
  timeoutMinutes: 60,
}

export class ComputeTrainingClient {
  private config: Required<ComputeTrainingConfig>
  private activeJobs: Map<string, TrainingJobResult> = new Map()

  constructor(config: Partial<ComputeTrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get current GPU provider for logging/debugging
   */
  getGPUProvider(): GPUProvider {
    return getGPUProvider()
  }

  async submitTrainingJob(request: TrainingJobRequest): Promise<string> {
    const jobId = `train-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const result: TrainingJobResult = {
      jobId,
      status: 'pending',
    }
    this.activeJobs.set(jobId, result)

    // Determine if we should use Jeju or local execution
    let shouldUseJeju = false
    if (this.config.mode === 'local') {
      shouldUseJeju = false
    } else if (this.config.mode === 'jeju') {
      shouldUseJeju = true
    } else {
      // Check GPU provider configuration
      const gpuProvider = getGPUProvider()
      if (gpuProvider === 'local') {
        shouldUseJeju = false
      } else if (gpuProvider === 'onchain' || gpuProvider === 'cloud') {
        shouldUseJeju = true
      } else {
        // Auto-detect based on environment
        const isProduction = process.env.NODE_ENV === 'production'
        const hasJeju =
          !!process.env.JEJU_NETWORK ||
          (!!process.env.BABYLON_TREASURY_ADDRESS && !!process.env.RPC_URL)
        shouldUseJeju = hasJeju && isProduction
      }
    }

    if (shouldUseJeju) {
      await this.submitToJeju(jobId, request)
    } else {
      await this.executeLocally(jobId, request)
    }

    return jobId
  }

  private async submitToJeju(
    jobId: string,
    request: TrainingJobRequest,
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)
    if (!result) {
      throw new Error(`Job ${jobId} not found in active jobs`)
    }
    result.status = 'provisioning'

    logger.info('Submitting training job to Jeju compute', {
      jobId,
      batchId: request.batchId,
      baseModel: request.baseModel,
    })

    const rental = await this.rentGPU({
      durationHours: Math.ceil((this.config.timeoutMinutes * 2) / 60),
      gpuType: this.config.preferredGpuType,
      memoryGb: 80,
      containerImage: 'ghcr.io/jeju-ai/babylon-training-gpu:latest',
      startupScript: this.generateStartupScript(request),
    })

    result.gpuType = rental.rentalId
    result.providerAddress = rental.providerAddress
    result.costWei = rental.costWei
    result.status = 'training'

    logger.info('GPU rented, training started', {
      jobId,
      rentalId: rental.rentalId,
      provider: rental.providerAddress,
      sshHost: rental.sshHost,
    })

    this.pollForCompletion(jobId, rental)
  }

  private async rentGPU(request: GPURentalRequest): Promise<GPURentalResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

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
      },
    ).finally(() => clearTimeout(timeout))

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`GPU rental failed: ${response.status} ${text}`)
    }

    const data: unknown = await response.json()
    if (!isGPURentalResponse(data)) {
      throw new Error('Invalid GPU rental response')
    }

    if (!isAddress(data.providerAddress)) {
      throw new Error('Invalid provider address in GPU rental response')
    }

    return {
      rentalId: data.rentalId,
      providerAddress: data.providerAddress,
      sshHost: data.sshHost,
      sshPort: data.sshPort,
      expiresAt: data.expiresAt,
      costWei: BigInt(data.costWei),
    }
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
`
  }

  private async pollForCompletion(
    jobId: string,
    rental: GPURentalResult,
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)
    if (!result) {
      throw new Error(`Job ${jobId} not found in active jobs`)
    }
    const startTime = Date.now()
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 30000)) // Check every 30s

      const statusResponse = await fetch(
        `${this.config.cloudEndpoint}/api/v1/rentals/${rental.rentalId}/status`,
        {
          headers: { Authorization: `Bearer ${this.config.privateKey}` },
        },
      )

      if (!statusResponse.ok) continue

      const data: unknown = await statusResponse.json()
      if (!isGPURentalStatusResponse(data)) continue

      if (data.status === 'completed') {
        result.status = 'completed'
        result.modelCID = data.modelCID
        result.modelHash = data.modelHash
        result.durationSeconds = Math.floor((Date.now() - startTime) / 1000)
        logger.info('Training completed', { jobId, modelCID: data.modelCID })
        return
      }

      if (data.status === 'failed') {
        result.status = 'failed'
        result.error = data.error ?? 'Unknown error'
        logger.error('Training failed', { jobId, error: result.error })
        return
      }
    }

    result.status = 'failed'
    result.error = 'Timeout'
    logger.error('Training timed out', { jobId })
  }

  private async executeLocally(
    jobId: string,
    request: TrainingJobRequest,
  ): Promise<void> {
    const result = this.activeJobs.get(jobId)
    if (!result) {
      throw new Error(`Job ${jobId} not found in active jobs`)
    }
    result.status = 'training'

    logger.info('Executing training locally', {
      jobId,
      batchId: request.batchId,
      baseModel: request.baseModel,
    })

    const trainingMode = process.env.TRAINING_MODE || 'atropos'
    const useTinker = trainingMode === 'tinker'

    const pythonScript = path.resolve(
      process.cwd(),
      'packages/training/python/src/training',
      useTinker ? 'tinker_trainer.py' : 'atropos_trainer.py',
    )

    const env = {
      ...process.env,
      BATCH_ID: request.batchId,
      BASE_MODEL: request.baseModel,
      TRAINING_STEPS: String(request.trainingSteps),
      BATCH_SIZE: String(request.batchSize),
      LEARNING_RATE: String(request.learningRate),
      ARCHETYPE: request.archetype || '',
    }

    const proc = spawn('python3', [pythonScript], { env, stdio: 'pipe' })

    proc.stdout?.on('data', (data: Buffer) => {
      logger.debug('Training output', { output: data.toString().trim() })
    })

    proc.stderr?.on('data', (data: Buffer) => {
      logger.warn('Training stderr', { output: data.toString().trim() })
    })

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', resolve)
      proc.on('error', () => resolve(1))
    })

    if (exitCode === 0) {
      result.status = 'completed'
      logger.info('Local training completed', { jobId })
    } else {
      result.status = 'failed'
      result.error = `Process exited with code ${exitCode}`
      logger.error('Local training failed', { jobId, exitCode })
    }
  }

  getJobStatus(jobId: string): TrainingJobResult | null {
    return this.activeJobs.get(jobId) || null
  }

  async waitForJob(
    jobId: string,
    timeoutMs = 3600000,
  ): Promise<TrainingJobResult> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const result = this.activeJobs.get(jobId)
      if (
        result &&
        (result.status === 'completed' || result.status === 'failed')
      ) {
        return result
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
    throw new Error(`Job ${jobId} timed out`)
  }
}

export function createComputeTrainingClient(
  config?: Partial<ComputeTrainingConfig>,
): ComputeTrainingClient {
  return new ComputeTrainingClient(config)
}
