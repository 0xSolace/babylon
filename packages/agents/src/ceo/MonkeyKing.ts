/**
 * MonkeyKing - Babylon AI CEO with full DAO control over treasury,
 * training, model deployment, and game parameters.
 */

import { logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
} from 'viem';

export enum ProposalType {
  TREASURY_SPEND = 0,
  MODEL_DEPLOYMENT = 1,
  TRAINING_JOB = 2,
  GAME_PARAMETER = 3,
  PROTOCOL_UPGRADE = 4,
  INFRASTRUCTURE = 5,
  EMERGENCY = 6,
}

export enum ProposalStatus {
  PENDING = 0,
  APPROVED = 1,
  EXECUTED = 2,
  VETOED = 3,
  EXPIRED = 4,
}

export interface CEODecision {
  type: ProposalType;
  target: Address;
  data: `0x${string}`;
  value: bigint;
  description: string;
  reasoning: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  expectedImpact: {
    metric: string;
    currentValue: number;
    expectedValue: number;
  }[];
}

export interface CEOMetrics {
  treasuryBalance: bigint;
  agentVaultBalance: bigint;
  pendingTrajectories: Record<string, number>;
  activeTrainingJob: boolean;
  lastTrainingTime: Record<string, number>;
  modelBenchmarks: Record<string, number>;
  gameMetrics: {
    dailyActiveUsers: number;
    dailyTransactions: number;
    averageSessionLength: number;
  };
}

export interface MonkeyKingConfig {
  /** Wallet address (TEE-derived) */
  address: Address;
  /** ERC-8004 agent ID */
  agentId: bigint;
  /** BabylonDAO contract address */
  daoAddress: Address;
  /** Treasury contract address */
  treasuryAddress: Address;
  /** Agent vault contract address */
  agentVaultAddress: Address;
  /** Training orchestrator address */
  trainingOrchestratorAddress: Address;
  /** Decision threshold (confidence required to act) */
  decisionThreshold: number;
  /** Minimum balance to maintain in vault */
  minVaultBalance: bigint;
  /** TEE attestation for signing */
  attestation?: `0x${string}`;
}

export class MonkeyKing {
  private config: MonkeyKingConfig;
  private metrics: CEOMetrics | null = null;
  private lastDecisionTime = 0;
  private decisionCooldown = 60_000;

  constructor(config: MonkeyKingConfig) {
    this.config = config;
  }

  async analyzeAndDecide(): Promise<CEODecision[]> {
    if (Date.now() - this.lastDecisionTime < this.decisionCooldown) return [];

    await this.refreshMetrics();
    if (!this.metrics) return [];

    const decisions: CEODecision[] = [];

    const trainingDecision = await this.evaluateTrainingNeed();
    if (trainingDecision) decisions.push(trainingDecision);

    const fundingDecision = await this.evaluateFundingNeed();
    if (fundingDecision) {
      decisions.push(fundingDecision);
    }

    // 3. Check for game parameter optimizations
    const gameDecisions = await this.evaluateGameParameters();
    decisions.push(...gameDecisions);

    this.lastDecisionTime = Date.now();
    return decisions.filter(
      (d) => d.confidence >= this.config.decisionThreshold
    );
  }

  /**
   * Evaluate if training should be triggered
   */
  private async evaluateTrainingNeed(): Promise<CEODecision | null> {
    if (!this.metrics) return null;

    // Don't trigger if job already active
    if (this.metrics.activeTrainingJob) {
      return null;
    }

    // Find archetype with most pending trajectories
    let bestArchetype: string | null = null;
    let maxTrajectories = 0;

    for (const [archetype, count] of Object.entries(
      this.metrics.pendingTrajectories
    )) {
      if (count > maxTrajectories) {
        maxTrajectories = count;
        bestArchetype = archetype;
      }
    }

    // Need at least 10k trajectories
    if (!bestArchetype || maxTrajectories < 10000) {
      return null;
    }

    // Check minimum interval (7 days)
    const lastTime = this.metrics.lastTrainingTime[bestArchetype] || 0;
    const minInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    if (Date.now() - lastTime < minInterval) {
      return null;
    }

    // Calculate confidence based on trajectory count
    const confidence = Math.min(1, maxTrajectories / 50000);

    return {
      type: ProposalType.TRAINING_JOB,
      target: this.config.trainingOrchestratorAddress,
      data: this.encodeTrainingCall(bestArchetype),
      value: 0n,
      description: `Trigger training for ${bestArchetype} with ${maxTrajectories} trajectories`,
      reasoning: `
        Training criteria met for ${bestArchetype}:
        - Trajectories: ${maxTrajectories} (threshold: 10,000)
        - Last training: ${lastTime ? new Date(lastTime).toISOString() : 'never'}
        - Minimum interval passed: ${Date.now() - lastTime > minInterval}

        Expected improvement: Based on trajectory count and historical data,
        expecting 5-15% benchmark improvement.
      `,
      urgency: maxTrajectories > 30000 ? 'high' : 'medium',
      confidence,
      expectedImpact: [
        {
          metric: `${bestArchetype}_benchmark`,
          currentValue: this.metrics.modelBenchmarks[bestArchetype] || 0,
          expectedValue:
            (this.metrics.modelBenchmarks[bestArchetype] || 0) * 1.1,
        },
      ],
    };
  }

  /**
   * Evaluate if vault needs funding
   */
  private async evaluateFundingNeed(): Promise<CEODecision | null> {
    if (!this.metrics) return null;

    const vaultBalance = this.metrics.agentVaultBalance;
    const minBalance = this.config.minVaultBalance;

    if (vaultBalance >= minBalance * 2n) {
      return null; // Plenty of funds
    }

    // Need to fund vault from treasury
    const treasuryBalance = this.metrics.treasuryBalance;
    const fundAmount = minBalance * 5n; // Fund 5x minimum

    if (treasuryBalance < fundAmount) {
      // Treasury low - emit warning but don't act
      console.warn(
        '[MonkeyKing] Treasury balance low:',
        treasuryBalance.toString()
      );
      return null;
    }

    const urgency = vaultBalance < minBalance ? 'critical' : 'medium';
    const confidence = vaultBalance < minBalance ? 1 : 0.8;

    return {
      type: ProposalType.TREASURY_SPEND,
      target: this.config.treasuryAddress,
      data: this.encodeFundVaultCall(fundAmount),
      value: 0n,
      description: `Fund agent vault with ${fundAmount} wei from treasury`,
      reasoning: `
        Vault balance critically low:
        - Current: ${vaultBalance.toString()} wei
        - Minimum: ${minBalance.toString()} wei
        - Treasury: ${treasuryBalance.toString()} wei

        Funding vault to ensure uninterrupted operations for training,
        inference, and keepalive services.
      `,
      urgency,
      confidence,
      expectedImpact: [
        {
          metric: 'vault_balance',
          currentValue: Number(vaultBalance),
          expectedValue: Number(vaultBalance + fundAmount),
        },
      ],
    };
  }

  private async evaluateGameParameters(): Promise<CEODecision[]> {
    // Future: analyze metrics and propose game parameter adjustments
    return [];
  }

  private encodeTrainingCall(archetype: string): `0x${string}` {
    const abi = parseAbi([
      'function createJob(string archetype, bytes32 datasetCid, uint256 reward) external returns (uint256)',
    ]);
    const datasetCid =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    return encodeFunctionData({
      abi,
      functionName: 'createJob',
      args: [archetype, datasetCid, 0n],
    });
  }

  private encodeFundVaultCall(amount: bigint): `0x${string}` {
    // BabylonTreasury.distributeETH(address[] recipients, uint256[] amounts)
    const abi = parseAbi([
      'function distributeETH(address[] recipients, uint256[] amounts) external',
    ]);

    return encodeFunctionData({
      abi,
      functionName: 'distributeETH',
      args: [[this.config.agentVaultAddress], [amount]],
    });
  }

  // --------------------------------------------------------------------------
  // Metrics - Real contract reads
  // --------------------------------------------------------------------------

  async refreshMetrics(): Promise<void> {
    const rpcUrl = process.env.RPC_URL ?? 'http://localhost:8545';

    const client = createPublicClient({
      transport: http(rpcUrl),
    });

    // Treasury and vault balance ABIs
    const balanceAbi = parseAbi([
      'function getBalance() view returns (uint256)',
    ]);

    // Training orchestrator ABIs
    const trainingAbi = parseAbi([
      'function getActiveJob() view returns (uint256 jobId, string archetype, bool active)',
      'function getTrajectoryCount(string archetype) view returns (uint256)',
      'function getLastTrainingTime(string archetype) view returns (uint256)',
      'function getBenchmarkScore(string archetype) view returns (uint256)',
    ]);

    const archetypes = ['perps-trader', 'trader', 'social-butterfly'];

    // Fetch balances in parallel
    const [treasuryBalance, agentVaultBalance] = await Promise.all([
      client
        .readContract({
          address: this.config.treasuryAddress,
          abi: balanceAbi,
          functionName: 'getBalance',
        })
        .catch((err) => {
          logger.warn('[MonkeyKing] Failed to read treasury balance', { err });
          return 0n;
        }),
      client
        .readContract({
          address: this.config.agentVaultAddress,
          abi: balanceAbi,
          functionName: 'getBalance',
        })
        .catch((err) => {
          logger.warn('[MonkeyKing] Failed to read vault balance', { err });
          return 0n;
        }),
    ]);

    // Fetch training state
    const [activeJob] = await Promise.all([
      client
        .readContract({
          address: this.config.trainingOrchestratorAddress,
          abi: trainingAbi,
          functionName: 'getActiveJob',
        })
        .catch(() => [0n, '', false] as const),
    ]);

    // Fetch per-archetype metrics
    const pendingTrajectories: Record<string, number> = {};
    const lastTrainingTime: Record<string, number> = {};
    const modelBenchmarks: Record<string, number> = {};

    await Promise.all(
      archetypes.map(async (archetype) => {
        const [count, lastTime, benchmark] = await Promise.all([
          client
            .readContract({
              address: this.config.trainingOrchestratorAddress,
              abi: trainingAbi,
              functionName: 'getTrajectoryCount',
              args: [archetype],
            })
            .catch(() => 0n),
          client
            .readContract({
              address: this.config.trainingOrchestratorAddress,
              abi: trainingAbi,
              functionName: 'getLastTrainingTime',
              args: [archetype],
            })
            .catch(() => 0n),
          client
            .readContract({
              address: this.config.trainingOrchestratorAddress,
              abi: trainingAbi,
              functionName: 'getBenchmarkScore',
              args: [archetype],
            })
            .catch(() => 0n),
        ]);

        pendingTrajectories[archetype] = Number(count);
        lastTrainingTime[archetype] = Number(lastTime) * 1000; // Convert to ms
        modelBenchmarks[archetype] = Number(benchmark);
      })
    );

    this.metrics = {
      treasuryBalance: treasuryBalance as bigint,
      agentVaultBalance: agentVaultBalance as bigint,
      pendingTrajectories,
      activeTrainingJob: Boolean(activeJob[2]),
      lastTrainingTime,
      modelBenchmarks,
      // Game metrics would come from analytics service
      gameMetrics: {
        dailyActiveUsers: 0, // Populated by game analytics
        dailyTransactions: 0,
        averageSessionLength: 0,
      },
    };

    logger.debug('[MonkeyKing] Metrics refreshed', {
      treasuryBalance: treasuryBalance?.toString(),
      vaultBalance: agentVaultBalance?.toString(),
      activeJob: activeJob?.[2],
    });
  }

  getMetrics(): CEOMetrics | null {
    return this.metrics;
  }

  getConfig(): MonkeyKingConfig {
    return this.config;
  }

  // --------------------------------------------------------------------------
  // Agent Identity
  // --------------------------------------------------------------------------

  getAgentId(): bigint {
    return this.config.agentId;
  }

  getAddress(): Address {
    return this.config.address;
  }

  /**
   * Get agent profile for ERC-8004 registration
   */
  getAgentProfile(): {
    name: string;
    description: string;
    capabilities: string[];
    version: string;
  } {
    return {
      name: 'MonkeyKing',
      description:
        'Babylon AI CEO - Autonomous governance agent with full control over protocol operations including treasury, training, and game parameters.',
      capabilities: [
        'treasury_management',
        'training_orchestration',
        'model_deployment',
        'game_parameter_optimization',
        'protocol_upgrade_proposal',
      ],
      version: '1.0.0',
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create MonkeyKing instance from environment
 */
export function createMonkeyKing(
  overrides?: Partial<MonkeyKingConfig>
): MonkeyKing {
  const config: MonkeyKingConfig = {
    address: (process.env.AI_CEO_ADDRESS ?? '0x0') as Address,
    agentId: BigInt(process.env.AI_CEO_AGENT_ID ?? '1'),
    daoAddress: (process.env.BABYLON_DAO_ADDRESS ?? '0x0') as Address,
    treasuryAddress: (process.env.BABYLON_TREASURY_ADDRESS ?? '0x0') as Address,
    agentVaultAddress: (process.env.BABYLON_AGENT_VAULT_ADDRESS ??
      '0x0') as Address,
    trainingOrchestratorAddress: (process.env.TRAINING_ORCHESTRATOR_ADDRESS ??
      '0x0') as Address,
    decisionThreshold: parseFloat(
      process.env.AI_CEO_DECISION_THRESHOLD ?? '0.7'
    ),
    minVaultBalance: BigInt(
      process.env.AI_CEO_MIN_VAULT_BALANCE ?? '100000000000000000'
    ), // 0.1 ETH
    ...overrides,
  };

  return new MonkeyKing(config);
}
