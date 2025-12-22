/**
 * TEE Training Worker
 *
 * Runs inside a Trusted Execution Environment (TEE) to:
 * 1. Decrypt encrypted trajectories
 * 2. Prepare data for training
 * 3. Execute LLM judging
 * 4. Run training iterations
 * 5. Encrypt and publish results
 *
 * Deployment targets:
 * - Phala Network TEE (production)
 * - Local simulation (development)
 *
 * Worker Types:
 * - DATA_PREP: CPU-bound data preparation
 * - JUDGING: GPU-bound LLM judging
 * - TRAINING: GPU-bound RL training
 * - BENCHMARK: CPU/GPU benchmarking
 */

import { logger } from '@babylon/shared';
import type { Address, Hex } from 'viem';
import { keccak256, toBytes } from 'viem';
import type {
  EncryptedTrajectory,
  TrajectoryBatch,
} from '../storage/EncryptedTrajectoryStorage';
import type { TrajectoryStep } from '../training/types';

// ============================================================================
// Types
// ============================================================================

export enum WorkerType {
  DATA_PREP = 'DATA_PREP',
  JUDGING = 'JUDGING',
  TRAINING = 'TRAINING',
  BENCHMARK = 'BENCHMARK',
}

export enum WorkerStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface WorkerConfig {
  /** Worker type */
  type: WorkerType;
  /** Unique worker ID */
  workerId: string;
  /** Code hash for attestation */
  codeHash: Hex;
  /** Chain ID */
  chainId: string;
  /** Training orchestrator address */
  trainingOrchestratorAddress: Address;
  /** Model registry address */
  modelRegistryAddress: Address;
  /** Storage endpoint */
  storageEndpoint: string;
  /** GPU configuration (for JUDGING/TRAINING workers) */
  gpu?: {
    type: 'nvidia' | 'amd';
    memory: number; // GB
    cudaVersion?: string;
  };
}

export interface WorkerAttestation {
  workerId: string;
  workerType: WorkerType;
  codeHash: Hex;
  operatorAddress: Address;
  timestamp: number;
  quote: Hex;
  signature: Hex;
}

export interface DataPrepResult {
  preparedDataCid: string;
  trajectoryCount: number;
  stepCount: number;
  attestation: Hex;
}

export interface JudgingResult {
  scoredDataCid: string;
  trajectoryCount: number;
  averageScore: number;
  scoreDistribution: { min: number; max: number; median: number };
  attestation: Hex;
}

export interface TrainingResult {
  outputModelCid: string;
  finalLoss: number;
  epochs: number;
  attestation: Hex;
}

export interface BenchmarkResult {
  score: number; // Basis points (e.g., 7500 = 75%)
  samples: number;
  metrics: {
    pnlMean: number;
    pnlStdDev: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  attestation: Hex;
}

// ============================================================================
// TEE Training Worker
// ============================================================================

export class TrainingWorker {
  private config: WorkerConfig;
  private status: WorkerStatus = WorkerStatus.IDLE;
  private operatorAddress: Address | null = null;
  private privateKey: Hex | null = null;
  private currentJobId: Hex | null = null;
  private startTime: number = 0;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Initialize the worker
   */
  async initialize(): Promise<WorkerAttestation> {
    this.status = WorkerStatus.INITIALIZING;
    this.startTime = Date.now();

    logger.info('[TrainingWorker] Initializing', {
      type: this.config.type,
      workerId: this.config.workerId,
    });

    // In production TEE, derive keys from hardware
    // For simulation, derive from code hash
    const measurement = keccak256(
      toBytes(`${this.config.codeHash}:${this.config.workerId}:${Date.now()}`)
    );

    // Derive operator address (simplified for simulation)
    this.operatorAddress = `0x${measurement.slice(2, 42)}` as Address;
    this.privateKey = measurement;

    // Generate attestation quote
    const attestation = this.generateAttestation();

    this.status = WorkerStatus.IDLE;

    logger.info('[TrainingWorker] Initialized', {
      operatorAddress: this.operatorAddress,
      type: this.config.type,
    });

    return attestation;
  }

  /**
   * Generate attestation quote
   */
  private generateAttestation(): WorkerAttestation {
    const timestamp = Date.now();
    const quoteData = `${this.config.workerId}:${this.config.type}:${this.config.codeHash}:${this.operatorAddress}:${timestamp}`;
    const quote = keccak256(toBytes(quoteData));

    // Sign the quote (simplified)
    const signature = keccak256(toBytes(`${quote}:${this.privateKey}`));

    return {
      workerId: this.config.workerId,
      workerType: this.config.type,
      codeHash: this.config.codeHash,
      operatorAddress: this.operatorAddress!,
      timestamp,
      quote,
      signature,
    };
  }

  // --------------------------------------------------------------------------
  // Data Preparation Worker
  // --------------------------------------------------------------------------

  /**
   * Prepare data for training (DATA_PREP worker)
   */
  async prepareData(
    jobId: Hex,
    batch: TrajectoryBatch,
    encryptedTrajectories: EncryptedTrajectory[]
  ): Promise<DataPrepResult> {
    if (this.config.type !== WorkerType.DATA_PREP) {
      throw new Error(`Wrong worker type: ${this.config.type}`);
    }

    this.status = WorkerStatus.PROCESSING;
    this.currentJobId = jobId;

    logger.info('[TrainingWorker] Starting data preparation', {
      jobId,
      trajectoryCount: batch.trajectoryCount,
    });

    // Decrypt all trajectories (uses TEE keys when available)
    const trajectories: TrajectoryStep[][] = [];
    for (const encrypted of encryptedTrajectories) {
      const steps = await this.decryptTrajectory(encrypted.encryptedCid);
      trajectories.push(steps);
    }

    // Prepare data for training
    const preparedData = await this.formatForTraining(
      trajectories,
      batch.archetype
    );

    // Encrypt prepared data
    const preparedDataCid = await this.encryptAndUpload(preparedData);

    // Generate attestation
    const attestation = keccak256(
      toBytes(`prepared:${jobId}:${preparedDataCid}:${trajectories.length}`)
    );

    this.status = WorkerStatus.COMPLETED;
    this.currentJobId = null;

    logger.info('[TrainingWorker] Data preparation complete', {
      jobId,
      cid: preparedDataCid,
      trajectoryCount: trajectories.length,
    });

    return {
      preparedDataCid,
      trajectoryCount: trajectories.length,
      stepCount: trajectories.reduce((sum, t) => sum + t.length, 0),
      attestation,
    };
  }

  // --------------------------------------------------------------------------
  // Judging Worker
  // --------------------------------------------------------------------------

  /**
   * Run LLM judging on trajectories (JUDGING worker)
   */
  async judgeTrajectories(
    jobId: Hex,
    preparedDataCid: string,
    archetype: string
  ): Promise<JudgingResult> {
    if (this.config.type !== WorkerType.JUDGING) {
      throw new Error(`Wrong worker type: ${this.config.type}`);
    }

    this.status = WorkerStatus.PROCESSING;
    this.currentJobId = jobId;

    logger.info('[TrainingWorker] Starting LLM judging', {
      jobId,
      preparedDataCid,
      archetype,
    });

    // Download prepared data and run LLM judging
    const preparedData = await this.downloadAndDecrypt(preparedDataCid);
    const scoredData = await this.runLLMJudging(preparedData, archetype);

    // Calculate score statistics
    const scores = scoredData.map((d) => d.score).sort((a, b) => a - b);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreStats = {
      min: scores[0] ?? 0,
      max: scores[scores.length - 1] ?? 0,
      median: scores[Math.floor(scores.length / 2)] ?? 0,
    };

    // Encrypt, upload, and generate attestation
    const scoredDataCid = await this.encryptAndUpload(scoredData);
    const attestation = keccak256(
      toBytes(`judged:${jobId}:${scoredDataCid}:${scores.length}`)
    );

    this.status = WorkerStatus.COMPLETED;
    this.currentJobId = null;

    logger.info('[TrainingWorker] LLM judging complete', {
      jobId,
      cid: scoredDataCid,
      averageScore,
      scoreStats,
    });

    return {
      scoredDataCid,
      trajectoryCount: scoredData.length,
      averageScore,
      scoreDistribution: scoreStats,
      attestation,
    };
  }

  // --------------------------------------------------------------------------
  // Training Worker
  // --------------------------------------------------------------------------

  /**
   * Run RL training (TRAINING worker)
   */
  async train(
    jobId: Hex,
    scoredDataCid: string,
    baseModelCid: string,
    config: {
      epochs: number;
      batchSize: number;
      learningRate: number;
      temperature: number;
    }
  ): Promise<TrainingResult> {
    if (this.config.type !== WorkerType.TRAINING) {
      throw new Error(`Wrong worker type: ${this.config.type}`);
    }

    this.status = WorkerStatus.PROCESSING;
    this.currentJobId = jobId;

    logger.info('[TrainingWorker] Starting training', {
      jobId,
      scoredDataCid,
      baseModelCid,
      epochs: config.epochs,
    });

    // Download scored data and base model
    const scoredData = await this.downloadAndDecrypt(scoredDataCid);
    const baseModel = await this.downloadModel(baseModelCid);

    // Run training
    const { trainedModel, finalLoss } = await this.runTraining(
      baseModel,
      scoredData,
      config
    );

    // Encrypt and upload trained model
    const outputModelCid = await this.encryptAndUpload(trainedModel);

    // Generate attestation
    const attestation = keccak256(
      toBytes(`trained:${jobId}:${outputModelCid}:${config.epochs}`)
    );

    this.status = WorkerStatus.COMPLETED;
    this.currentJobId = null;

    logger.info('[TrainingWorker] Training complete', {
      jobId,
      cid: outputModelCid,
      finalLoss,
      epochs: config.epochs,
    });

    return {
      outputModelCid,
      finalLoss,
      epochs: config.epochs,
      attestation,
    };
  }

  // --------------------------------------------------------------------------
  // Benchmark Worker
  // --------------------------------------------------------------------------

  /**
   * Run benchmark simulations (BENCHMARK worker)
   */
  async benchmark(
    jobId: Hex,
    modelCid: string,
    archetype: string,
    samples: number
  ): Promise<BenchmarkResult> {
    if (this.config.type !== WorkerType.BENCHMARK) {
      throw new Error(`Wrong worker type: ${this.config.type}`);
    }

    this.status = WorkerStatus.PROCESSING;
    this.currentJobId = jobId;

    logger.info('[TrainingWorker] Starting benchmark', {
      jobId,
      modelCid,
      archetype,
      samples,
    });

    // Download model
    const model = await this.downloadModel(modelCid);

    // Run simulations
    const results = await this.runSimulations(model, archetype, samples);

    // Calculate metrics
    const metrics = this.calculateMetrics(results);

    // Calculate overall score (basis points)
    const score = Math.round(
      (metrics.winRate * 0.3 +
        Math.min(1, metrics.sharpeRatio / 2) * 0.3 +
        (1 - Math.min(1, metrics.maxDrawdown)) * 0.2 +
        Math.min(1, metrics.pnlMean / 1000) * 0.2) *
        10000
    );

    // Generate attestation
    const attestation = keccak256(
      toBytes(`benchmark:${jobId}:${modelCid}:${score}:${samples}`)
    );

    this.status = WorkerStatus.COMPLETED;
    this.currentJobId = null;

    logger.info('[TrainingWorker] Benchmark complete', {
      jobId,
      score,
      samples,
      metrics,
    });

    return {
      score,
      samples,
      metrics,
      attestation,
    };
  }

  // --------------------------------------------------------------------------
  // Internal Operations
  // --------------------------------------------------------------------------

  private async decryptTrajectory(cid: string): Promise<TrajectoryStep[]> {
    logger.debug('[TrainingWorker] Decrypting trajectory', { cid });

    const response = await fetch(
      `${this.config.storageEndpoint}/download/${cid}`,
      {
        headers: {
          'X-TEE-Attestation': this.operatorAddress ?? '',
          'X-Decrypt': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to decrypt trajectory ${cid}: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<TrajectoryStep[]>;
  }

  private async formatForTraining(
    trajectories: TrajectoryStep[][],
    archetype: string
  ): Promise<object> {
    // Format trajectories for GRPO training
    return {
      archetype,
      trajectoryCount: trajectories.length,
      data: trajectories.map((t) => ({
        steps: t.length,
        actions: t.map((s) => s.action?.actionType ?? 'unknown'),
        rewards: t.map((s) => s.reward ?? 0),
      })),
    };
  }

  private async runLLMJudging(
    preparedData: object,
    archetype: string
  ): Promise<{ score: number; trajectory: object }[]> {
    logger.debug('[TrainingWorker] Running LLM judging', { archetype });

    const response = await fetch(
      `${this.config.storageEndpoint}/judging/score`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preparedData, archetype }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `LLM judging service failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<{ score: number; trajectory: object }[]>;
  }

  private async downloadModel(cid: string): Promise<object> {
    logger.debug('[TrainingWorker] Downloading model', { cid });

    // Fetch from storage endpoint (IPFS gateway or DWS storage)
    const response = await fetch(
      `${this.config.storageEndpoint}/download/${cid}`
    );
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`);
    }
    return response.json() as Promise<object>;
  }

  private async runTraining(
    baseModel: object,
    scoredData: object[],
    config: { epochs: number; batchSize: number; learningRate: number }
  ): Promise<{ trainedModel: object; finalLoss: number }> {
    logger.info('[TrainingWorker] Running training', {
      samples: scoredData.length,
      epochs: config.epochs,
      batchSize: config.batchSize,
      learningRate: config.learningRate,
    });

    // Call Python training service
    const trainingResponse = await fetch(
      `${this.config.storageEndpoint}/training/run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseModel,
          scoredData,
          config,
        }),
      }
    );

    if (!trainingResponse.ok) {
      throw new Error(
        `Training service failed: ${trainingResponse.status} ${trainingResponse.statusText}`
      );
    }

    return trainingResponse.json() as Promise<{
      trainedModel: object;
      finalLoss: number;
    }>;
  }

  private async runSimulations(
    model: object,
    archetype: string,
    samples: number
  ): Promise<{ pnl: number; trades: number }[]> {
    logger.debug('[TrainingWorker] Running simulations', {
      archetype,
      samples,
    });

    // Call simulation service
    const response = await fetch(
      `${this.config.storageEndpoint}/simulation/run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, archetype, samples }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Simulation service failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<{ pnl: number; trades: number }[]>;
  }

  private calculateMetrics(
    results: { pnl: number; trades: number }[]
  ): BenchmarkResult['metrics'] {
    const pnls = results.map((r) => r.pnl);
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance =
      pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);

    const wins = pnls.filter((p) => p > 0).length;
    const winRate = wins / pnls.length;

    const sharpeRatio = stdDev > 0 ? mean / stdDev : 0;

    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    for (const pnl of pnls) {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      pnlMean: mean,
      pnlStdDev: stdDev,
      winRate,
      sharpeRatio,
      maxDrawdown,
    };
  }

  private async encryptAndUpload(data: object): Promise<string> {
    const jsonData = JSON.stringify(data);

    // Upload to storage endpoint
    const response = await fetch(`${this.config.storageEndpoint}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: jsonData,
        encrypt: true, // Request encryption if TEE keys available
        attestation: this.operatorAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Storage upload failed: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as { cid: string };
    return result.cid;
  }

  private async downloadAndDecrypt(cid: string): Promise<object[]> {
    logger.debug('[TrainingWorker] Downloading and decrypting', { cid });

    const response = await fetch(
      `${this.config.storageEndpoint}/download/${cid}`,
      {
        headers: {
          'X-Attestation': this.operatorAddress ?? '',
        },
      }
    );

    if (!response.ok) {
      logger.warn('[TrainingWorker] Download failed, returning empty data');
      return [];
    }

    return response.json() as Promise<object[]>;
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  getStatus(): {
    type: WorkerType;
    status: WorkerStatus;
    operatorAddress: Address | null;
    currentJobId: Hex | null;
    uptime: number;
  } {
    return {
      type: this.config.type,
      status: this.status,
      operatorAddress: this.operatorAddress,
      currentJobId: this.currentJobId,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  getConfig(): WorkerConfig {
    return this.config;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a training worker
 */
export function createTrainingWorker(
  type: WorkerType,
  config?: Partial<WorkerConfig>
): TrainingWorker {
  const defaultConfig: WorkerConfig = {
    type,
    workerId: `${type.toLowerCase()}-${Date.now()}`,
    codeHash: (process.env.WORKER_CODE_HASH ??
      '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex,
    chainId: process.env.CHAIN_ID ?? '420691',
    trainingOrchestratorAddress: (process.env.TRAINING_ORCHESTRATOR_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    modelRegistryAddress: (process.env.MODEL_REGISTRY_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    storageEndpoint:
      process.env.JEJU_STORAGE_ENDPOINT ?? 'http://localhost:4400',
    ...config,
  };

  return new TrainingWorker(defaultConfig);
}
