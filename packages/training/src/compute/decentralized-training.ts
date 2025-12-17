/**
 * @title Decentralized Training Integration
 * @description Integrates Babylon training with Jeju's decentralized training infrastructure
 * @dev Wraps the DWS distributed training client for Babylon-specific workflows
 */

import type { Address, Chain, Hex, PublicClient, WalletClient } from 'viem';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
  parseAbiParameters,
  stringToBytes,
  zeroHash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger';
import type { TrainingJobRequest, TrainingJobResult } from './types';

// ============ Types ============

export interface DecentralizedTrainingConfig {
  /** RPC endpoint */
  rpcUrl: string;
  /** Private key for signing transactions */
  privateKey: Hex;
  /** Chain configuration */
  chain: Chain;
  /** Contract addresses */
  contracts: {
    coordinator: Address;
    rewards: Address;
    performance: Address;
    registry: Address;
  };
  /** IPFS gateway URL */
  ipfsGateway?: string;
  /** HuggingFace token for model uploads */
  hfToken?: string;
  /** Minimum GPU tier for training */
  minGpuTier?: GPUTier;
  /** Reward token address (JEJU token) */
  rewardToken?: Address;
}

export enum PrivacyMode {
  Public = 0,
  Private = 1,
}

export enum GPUTier {
  Unknown = 0,
  Consumer = 1,
  Prosumer = 2,
  Datacenter = 3,
  HighEnd = 4,
}

export enum RunState {
  Uninitialized = 0,
  WaitingForMembers = 1,
  Warmup = 2,
  RoundTrain = 3,
  RoundWitness = 4,
  Cooldown = 5,
  Finished = 6,
  Paused = 7,
}

export interface DecentralizedTrainingJob {
  runId: Hex;
  name: string;
  batchId: string;
  baseModel: string;
  state: RunState;
  epoch: number;
  step: number;
  totalSteps: number;
  clientCount: number;
  privacyMode: PrivacyMode;
  createdAt: Date;
  latestCheckpoint?: {
    modelHash: Hex;
    hfRepo: string;
    ipfsCid?: string;
    step: number;
  };
}

export interface TrainingProgress {
  runId: Hex;
  step: number;
  totalSteps: number;
  epoch: number;
  state: string;
  clientCount: number;
  tokensPerSecond?: number;
  estimatedTimeRemaining?: number;
}

// Contract ABIs (minimal for this integration)
const coordinatorAbi = parseAbi([
  'function createRun(bytes32 runId, (uint64 warmupTime, uint64 cooldownTime, uint64 maxRoundTrainTime, uint64 roundWitnessTime, uint64 epochTime, uint64 globalBatchSizeWarmupTokens, uint32 totalSteps, uint16 initMinClients, uint16 minClients, uint16 witnessNodes, uint16 globalBatchSizeStart, uint16 globalBatchSizeEnd, uint8 verificationPercent, uint8 waitingForMembersExtraTime) config, (bytes32 modelHash, string hfRepo, uint32 maxSeqLen, uint32 coldStartWarmupSteps) model, uint8 privacyMode, bytes32 mpcKeyId) payable',
  'function getRunState(bytes32 runId) view returns (uint8)',
  'function getRun(bytes32 runId) view returns (address creator, uint8 state, uint16 epoch, uint32 step, uint16 clientCount, uint8 privacyMode)',
  'function getStep(bytes32 runId) view returns (uint32)',
  'function getRunConfig(bytes32 runId) view returns ((uint64 warmupTime, uint64 cooldownTime, uint64 maxRoundTrainTime, uint64 roundWitnessTime, uint64 epochTime, uint64 globalBatchSizeWarmupTokens, uint32 totalSteps, uint16 initMinClients, uint16 minClients, uint16 witnessNodes, uint16 globalBatchSizeStart, uint16 globalBatchSizeEnd, uint8 verificationPercent, uint8 waitingForMembersExtraTime))',
  'event RunCreated(bytes32 indexed runId, address indexed creator, string hfRepo, uint8 privacyMode)',
  'event StateTransition(bytes32 indexed runId, uint8 oldState, uint8 newState, uint64 timestamp)',
  'event EpochCompleted(bytes32 indexed runId, uint16 epoch, uint32 stepsCompleted)',
  'event RunFinished(bytes32 indexed runId, uint32 totalSteps)',
]);

const rewardsAbi = parseAbi([
  'function createRewardPool(bytes32 runId, address rewardToken, uint256 amount, uint256 pointsPerEpoch)',
  'function claim(bytes32 runId)',
  'function claimable(bytes32 runId, address participant) view returns (uint256 claimableAmount, uint256 claimablePoints)',
]);

const registryAbi = parseAbi([
  'function getLatestCheckpoint(bytes32 runId) view returns ((bytes32 runId, uint32 step, uint16 epoch, string hfRepo, bytes32 modelHash, string ipfsCid, uint64 timestamp, address submitter, uint256 benchmarkScore, bool verified))',
]);

// ============ Implementation ============

export class DecentralizedTrainingClient {
  private config: DecentralizedTrainingConfig;
  private chain: Chain;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private activeJobs: Map<string, DecentralizedTrainingJob> = new Map();

  constructor(config: DecentralizedTrainingConfig) {
    this.config = config;
    this.chain = config.chain;
    this.account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    }) as PublicClient;

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.rpcUrl),
    }) as WalletClient;
  }

  /**
   * Submit a training job to the decentralized network
   */
  async submitTrainingJob(request: TrainingJobRequest): Promise<Hex> {
    const runId = this.generateRunId(request.batchId);

    logger.info('Submitting decentralized training job', {
      runId,
      batchId: request.batchId,
      baseModel: request.baseModel,
    });

    // Build coordinator config
    const coordinatorConfig = {
      warmupTime: 300n,
      cooldownTime: 60n,
      maxRoundTrainTime: 600n,
      roundWitnessTime: 60n,
      epochTime: 3600n,
      globalBatchSizeWarmupTokens: 1_000_000n,
      totalSteps: request.trainingSteps,
      initMinClients: 6,
      minClients: 4,
      witnessNodes: 4,
      globalBatchSizeStart: request.batchSize,
      globalBatchSizeEnd: request.batchSize * 4,
      verificationPercent: 10,
      waitingForMembersExtraTime: 60,
    };

    // Build model config
    const modelHash = keccak256(stringToBytes(request.baseModel));
    const modelConfig = {
      modelHash,
      hfRepo: request.baseModel,
      maxSeqLen: 2048,
      coldStartWarmupSteps: Math.floor(request.trainingSteps * 0.1),
    };

    // Create the training run
    const hash = await this.walletClient.writeContract({
      address: this.config.contracts.coordinator,
      abi: coordinatorAbi,
      functionName: 'createRun',
      args: [
        runId,
        coordinatorConfig,
        modelConfig,
        PrivacyMode.Public,
        zeroHash,
      ],
      account: this.account,
      chain: this.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    // Track job
    const job: DecentralizedTrainingJob = {
      runId,
      name: `babylon-${request.batchId}`,
      batchId: request.batchId,
      baseModel: request.baseModel,
      state: RunState.WaitingForMembers,
      epoch: 0,
      step: 1,
      totalSteps: request.trainingSteps,
      clientCount: 0,
      privacyMode: PrivacyMode.Public,
      createdAt: new Date(),
    };

    this.activeJobs.set(runId, job);

    logger.info('Decentralized training job created', {
      runId,
      batchId: request.batchId,
    });

    // Start polling for updates
    this.pollJobStatus(runId);

    return runId;
  }

  /**
   * Get job status
   */
  async getJobStatus(runId: Hex): Promise<DecentralizedTrainingJob | null> {
    // Check cache first
    const cached = this.activeJobs.get(runId);
    if (cached) {
      // Refresh from chain
      await this.refreshJobStatus(runId);
      return this.activeJobs.get(runId) || null;
    }

    // Fetch from chain
    const result = await this.publicClient.readContract({
      address: this.config.contracts.coordinator,
      abi: coordinatorAbi,
      functionName: 'getRun',
      args: [runId],
    });

    if (Number(result[1]) === RunState.Uninitialized) {
      return null;
    }

    const configResult = await this.publicClient.readContract({
      address: this.config.contracts.coordinator,
      abi: coordinatorAbi,
      functionName: 'getRunConfig',
      args: [runId],
    });

    const job: DecentralizedTrainingJob = {
      runId,
      name: '',
      batchId: '',
      baseModel: '',
      state: Number(result[1]) as RunState,
      epoch: result[2],
      step: result[3],
      totalSteps: configResult.totalSteps,
      clientCount: result[4],
      privacyMode: Number(result[5]) as PrivacyMode,
      createdAt: new Date(),
    };

    return job;
  }

  /**
   * Get training progress
   */
  async getProgress(runId: Hex): Promise<TrainingProgress | null> {
    const job = await this.getJobStatus(runId);
    if (!job) return null;

    return {
      runId,
      step: job.step,
      totalSteps: job.totalSteps,
      epoch: job.epoch,
      state: RunState[job.state],
      clientCount: job.clientCount,
    };
  }

  /**
   * Wait for job completion
   */
  async waitForJob(
    runId: Hex,
    timeoutMs = 3600000
  ): Promise<TrainingJobResult> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const job = await this.getJobStatus(runId);

      if (job?.state === RunState.Finished) {
        // Get final checkpoint
        let checkpoint;
        try {
          checkpoint = await this.publicClient.readContract({
            address: this.config.contracts.registry,
            abi: registryAbi,
            functionName: 'getLatestCheckpoint',
            args: [runId],
          });
        } catch {
          // No checkpoint available
        }

        return {
          jobId: runId,
          status: 'completed',
          modelCID: checkpoint?.ipfsCid,
          modelHash: checkpoint?.modelHash,
          durationSeconds: Math.floor((Date.now() - start) / 1000),
        };
      }

      if (job?.state === RunState.Paused) {
        return {
          jobId: runId,
          status: 'failed',
          error: 'Training run was paused',
          durationSeconds: Math.floor((Date.now() - start) / 1000),
        };
      }

      await new Promise((r) => setTimeout(r, 30000)); // Check every 30s
    }

    return {
      jobId: runId,
      status: 'failed',
      error: 'Timeout waiting for training completion',
      durationSeconds: Math.floor((Date.now() - start) / 1000),
    };
  }

  /**
   * Claim rewards from a completed training run
   */
  async claimRewards(runId: Hex): Promise<bigint> {
    const claimableResult = await this.publicClient.readContract({
      address: this.config.contracts.rewards,
      abi: rewardsAbi,
      functionName: 'claimable',
      args: [runId, this.account.address],
    });

    const claimableAmount = claimableResult[0];

    if (claimableAmount === 0n) {
      return 0n;
    }

    const hash = await this.walletClient.writeContract({
      address: this.config.contracts.rewards,
      abi: rewardsAbi,
      functionName: 'claim',
      args: [runId],
      account: this.account,
      chain: this.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    logger.info('Claimed training rewards', {
      runId,
      amount: claimableAmount.toString(),
    });

    return claimableAmount;
  }

  /**
   * Get claimable rewards
   */
  async getClaimableRewards(runId: Hex): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.config.contracts.rewards,
      abi: rewardsAbi,
      functionName: 'claimable',
      args: [runId, this.account.address],
    });
    return result[0];
  }

  /**
   * Convert to standard TrainingJobResult format
   */
  jobToResult(job: DecentralizedTrainingJob): TrainingJobResult {
    const statusMap: Record<RunState, TrainingJobResult['status']> = {
      [RunState.Uninitialized]: 'pending',
      [RunState.WaitingForMembers]: 'provisioning',
      [RunState.Warmup]: 'training',
      [RunState.RoundTrain]: 'training',
      [RunState.RoundWitness]: 'training',
      [RunState.Cooldown]: 'training',
      [RunState.Finished]: 'completed',
      [RunState.Paused]: 'failed',
    };

    return {
      jobId: job.runId,
      status: statusMap[job.state],
      modelCID: job.latestCheckpoint?.ipfsCid,
      modelHash: job.latestCheckpoint?.modelHash,
    };
  }

  // ============ Private Methods ============

  private generateRunId(batchId: string): Hex {
    return keccak256(
      encodeAbiParameters(parseAbiParameters('string, address, uint256'), [
        batchId,
        this.account.address,
        BigInt(Date.now()),
      ])
    );
  }

  private async refreshJobStatus(runId: Hex): Promise<void> {
    const job = this.activeJobs.get(runId);
    if (!job) return;

    const result = await this.publicClient.readContract({
      address: this.config.contracts.coordinator,
      abi: coordinatorAbi,
      functionName: 'getRun',
      args: [runId],
    });

    job.state = Number(result[1]) as RunState;
    job.epoch = result[2];
    job.step = result[3];
    job.clientCount = result[4];

    // Update checkpoint if available
    if (job.state === RunState.Finished || job.epoch > 0) {
      try {
        const checkpoint = await this.publicClient.readContract({
          address: this.config.contracts.registry,
          abi: registryAbi,
          functionName: 'getLatestCheckpoint',
          args: [runId],
        });
        job.latestCheckpoint = {
          modelHash: checkpoint.modelHash,
          hfRepo: checkpoint.hfRepo,
          ipfsCid: checkpoint.ipfsCid,
          step: checkpoint.step,
        };
      } catch {
        // Checkpoint not available
      }
    }
  }

  private async pollJobStatus(runId: Hex): Promise<void> {
    const job = this.activeJobs.get(runId);
    if (!job) return;

    const pollInterval = setInterval(async () => {
      await this.refreshJobStatus(runId);

      const updatedJob = this.activeJobs.get(runId);
      if (!updatedJob) {
        clearInterval(pollInterval);
        return;
      }

      // Log progress
      logger.debug('Training progress', {
        runId,
        state: RunState[updatedJob.state],
        step: updatedJob.step,
        totalSteps: updatedJob.totalSteps,
        epoch: updatedJob.epoch,
        clients: updatedJob.clientCount,
      });

      // Stop polling when complete
      if (
        updatedJob.state === RunState.Finished ||
        updatedJob.state === RunState.Paused
      ) {
        clearInterval(pollInterval);
        logger.info('Training job completed', {
          runId,
          state: RunState[updatedJob.state],
          finalStep: updatedJob.step,
        });
      }
    }, 30000); // Poll every 30 seconds
  }

  // ============ Cleanup ============

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.activeJobs.clear();
  }
}

/**
 * Create a decentralized training client
 */
export function createDecentralizedTrainingClient(
  config: DecentralizedTrainingConfig
): DecentralizedTrainingClient {
  return new DecentralizedTrainingClient(config);
}

/**
 * Check if decentralized training is available
 */
export function isDecentralizedTrainingAvailable(): boolean {
  return !!(
    process.env.TRAINING_COORDINATOR_ADDRESS &&
    process.env.RPC_URL &&
    process.env.PRIVATE_KEY
  );
}
