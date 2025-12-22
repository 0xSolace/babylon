/**
 * Game Orchestrator
 *
 * The main coordinator that ties together:
 * - TEE Enclave (secure execution)
 * - Smart Contracts (blockchain coordination)
 * - Storage (IPFS for state and training data)
 * - Game Logic (AI agent and environment)
 *
 * This simulates the complete permissionless AI game infrastructure.
 */

import { logger, ValidationError } from '@babylon/shared';
import type { Address, Hex } from 'viem';
import { MockBlockchain } from '../contracts/mock-blockchain.js';
import { type AgentConfig, type AgentState, AIAgent } from '../game/agent.js';
import {
  type GameConfig,
  GameEnvironment,
  type PatternType,
} from '../game/environment.js';
import { AITrainer, type TrainingConfig } from '../game/trainer.js';
import { IPFSSimulator } from '../storage/ipfs-simulator.js';
import { StateManager } from '../storage/state-manager.js';
import { type AttestationQuote, verifyQuote } from '../tee/attestation.js';
import { TEEEnclave } from '../tee/enclave.js';

export interface OrchestratorConfig {
  enclave: {
    codeHash: Hex;
    instanceId: string;
    verbose?: boolean;
  };
  agent: AgentConfig;
  game: GameConfig;
  training: TrainingConfig;
  councilMembers: Address[];
  initialFunding: bigint;
}

export interface OrchestratorGameState {
  agent: AgentState;
  gameStats: {
    totalSessions: number;
    playerWins: number;
    agentWins: number;
  };
  trainingStats: {
    totalCycles: number;
    currentLoss: number;
  };
  version: number;
  timestamp: number;
}

export type OrchestratorPhase =
  | 'uninitialized'
  | 'deploying_contracts'
  | 'booting_enclave'
  | 'registering_operator'
  | 'running'
  | 'training'
  | 'rotating_keys'
  | 'failover'
  | 'shutdown';

/**
 * Main orchestrator for the permissionless AI game
 */
export class GameOrchestrator {
  private config: OrchestratorConfig;
  private phase: OrchestratorPhase = 'uninitialized';

  // Core components
  private blockchain: MockBlockchain;
  private enclave: TEEEnclave | null = null;
  private ipfs: IPFSSimulator;
  private stateManager: StateManager | null = null;

  // Game components
  private agent: AIAgent | null = null;
  private environment: GameEnvironment | null = null;
  private trainer: AITrainer | null = null;

  // State tracking
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.blockchain = new MockBlockchain();
    this.ipfs = new IPFSSimulator();

    logger.info('\n[Orchestrator] Initialized with config:');
    logger.info(`  - Council members: ${config.councilMembers.length}`);
    logger.info(`  - Initial funding: ${config.initialFunding} tokens`);
  }

  /**
   * Initialize and start the complete system
   */
  async initialize(): Promise<{
    operatorAddress: Address;
    attestation: AttestationQuote;
  }> {
    logger.info(
      '\n╔══════════════════════════════════════════════════════════╗'
    );
    logger.info(
      '║        INITIALIZING PERMISSIONLESS AI GAME                ║'
    );
    logger.info(
      '╚══════════════════════════════════════════════════════════╝\n'
    );

    // Phase 1: Setup contracts
    this.phase = 'deploying_contracts';
    logger.info('\n[Phase 1] Deploying smart contracts...');

    // Add council members
    for (const member of this.config.councilMembers) {
      this.blockchain.addCouncilMember(member);
    }

    // Treasury is pre-funded in MockBlockchain constructor
    logger.info(
      `  Treasury funded: ${this.blockchain.getTreasuryBalance()} tokens`
    );

    // Phase 2: Boot TEE enclave
    this.phase = 'booting_enclave';
    logger.info('\n[Phase 2] Booting TEE enclave...');

    this.enclave = await TEEEnclave.create(this.config.enclave);
    const attestation = this.enclave.getAttestation();

    // Verify attestation
    const verification = verifyQuote(attestation);
    if (!verification.valid) {
      throw new Error(
        `Attestation verification failed: ${verification.errors.join(', ')}`
      );
    }
    logger.info('  Attestation verified ✓');

    // Phase 3: Register operator on-chain
    this.phase = 'registering_operator';
    logger.info('\n[Phase 3] Registering TEE operator on-chain...');

    const operatorAddress = this.enclave.getOperatorAddress();
    const registrationResult = this.blockchain.registerOperator(
      operatorAddress,
      attestation.cpuSignature
    );

    if (!registrationResult.success) {
      throw new ValidationError(
        `Operator registration failed: ${registrationResult.error}`
      );
    }
    logger.info(`  Operator registered: ${operatorAddress}`);

    // Phase 4: Initialize game components inside enclave
    logger.info('\n[Phase 4] Initializing game components in TEE...');

    this.stateManager = new StateManager(this.enclave, this.ipfs);
    this.agent = new AIAgent(this.config.agent);
    this.environment = new GameEnvironment(this.config.game);
    this.trainer = new AITrainer(
      this.config.training,
      this.agent,
      this.environment
    );

    // Phase 5: Save initial state
    logger.info('\n[Phase 5] Saving initial encrypted state...');

    const initialState = this.buildGameState();
    const checkpoint = await this.stateManager.saveState(initialState);

    // Update on-chain state
    const updateResult = this.blockchain.updateState(
      operatorAddress,
      checkpoint.cid,
      checkpoint.hash
    );
    if (!updateResult.success) {
      throw new Error(`State update failed: ${updateResult.error}`);
    }
    logger.info(`  Initial state saved: ${checkpoint.cid}`);

    // Phase 6: Start heartbeat
    this.phase = 'running';
    this.startHeartbeat();

    logger.info(
      '\n╔══════════════════════════════════════════════════════════╗'
    );
    logger.info(
      '║             SYSTEM INITIALIZATION COMPLETE                ║'
    );
    logger.info(
      '╚══════════════════════════════════════════════════════════╝\n'
    );

    return { operatorAddress, attestation };
  }

  /**
   * Build the complete game state object
   */
  private buildGameState(): OrchestratorGameState {
    return {
      agent: this.agent!.serialize(),
      gameStats: this.environment!.getStats(),
      trainingStats: this.trainer!.getStats(),
      version: this.blockchain.getGameState().stateVersion + 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Start heartbeat to keep operator registered as active
   */
  private startHeartbeat(): void {
    const interval = 5000; // 5 seconds for demo (would be hours in production)

    this.heartbeatInterval = setInterval(() => {
      if (this.phase !== 'running' && this.phase !== 'training') return;
      if (!this.enclave) return;

      // Generate heartbeat (used for TEE-side tracking)
      this.enclave.generateHeartbeat();
      const result = this.blockchain.heartbeat(
        this.enclave.getOperatorAddress()
      );

      if (!result.success) {
        logger.warn(`[Orchestrator] Heartbeat failed: ${result.error}`);
      }
    }, interval);

    logger.info(`[Orchestrator] Heartbeat started (${interval}ms interval)`);
  }

  /**
   * Play a game round
   */
  playRound(
    patternType?: PatternType,
    playerGuess?: number
  ): {
    sequence: number[];
    result: {
      actual: number;
      playerGuess: number;
      agentGuess: number;
      playerCorrect: boolean;
      agentCorrect: boolean;
    };
  } {
    if (this.phase !== 'running') {
      throw new Error(`Cannot play in phase: ${this.phase}`);
    }

    // Start session
    this.environment!.startSession(patternType);
    const sequence = this.environment!.getVisibleSequence();

    // Get agent prediction
    const input = this.environment!.getAgentInput();
    const prediction = this.agent!.predict(input);

    // Denormalize prediction
    const max = Math.max(...sequence, 1);
    const predictionVal = prediction.prediction[0] ?? 0;
    const agentGuess = Math.round(predictionVal * max);

    // Use provided guess or random for demo
    const actualPlayerGuess =
      playerGuess ?? Math.round(Math.random() * max * 2);

    // Submit guesses
    const result = this.environment!.submitGuesses(
      actualPlayerGuess,
      agentGuess
    );

    return { sequence, result };
  }

  /**
   * Run a training cycle (simulates daily training loop)
   */
  async runTrainingCycle(): Promise<{
    cycleNumber: number;
    lossImprovement: number;
    datasetCID: string;
  }> {
    if (this.phase !== 'running') {
      throw new Error(`Cannot train in phase: ${this.phase}`);
    }

    this.phase = 'training';
    logger.info('\n[Orchestrator] === STARTING TRAINING CYCLE ===');

    // Run training
    const cycleResult = this.trainer!.runTrainingCycle();

    // Save training data publicly to IPFS
    const dataset = this.stateManager!.saveTrainingData(
      cycleResult.samples,
      cycleResult.modelHashBefore,
      cycleResult.modelHashAfter
    );

    // Record training on-chain
    const operatorAddress = this.enclave!.getOperatorAddress();
    this.blockchain.recordTraining(
      operatorAddress,
      dataset.cid,
      cycleResult.modelHashAfter
    );

    // Save new encrypted state
    const newState = this.buildGameState();
    const checkpoint = await this.stateManager!.saveState(newState);

    // Update on-chain state
    this.blockchain.updateState(
      operatorAddress,
      checkpoint.cid,
      checkpoint.hash
    );

    this.phase = 'running';

    const lossImprovement = cycleResult.initialLoss - cycleResult.finalLoss;

    logger.info(
      `[Orchestrator] Training complete. Loss improved by ${lossImprovement.toFixed(4)}`
    );

    return {
      cycleNumber: cycleResult.cycleNumber,
      lossImprovement,
      datasetCID: dataset.cid,
    };
  }

  /**
   * Rotate encryption keys (initiated by security council)
   */
  async rotateKeys(councilApprovers: Address[]): Promise<{
    newKeyVersion: number;
    newStateCID: string;
  }> {
    logger.info('\n[Orchestrator] === KEY ROTATION INITIATED ===');

    // First council member requests rotation
    const firstApprover = councilApprovers[0];
    if (!firstApprover) {
      throw new Error('No council approvers provided');
    }
    const requestResult = this.blockchain.requestKeyRotation(firstApprover);
    if (!requestResult.success) {
      throw new Error(`Rotation request failed: ${requestResult.error}`);
    }

    const requestId = requestResult.requestId!;

    // Other council members approve
    for (let i = 1; i < councilApprovers.length; i++) {
      const approver = councilApprovers[i];
      if (!approver) continue;
      const approvalResult = this.blockchain.approveKeyRotation(
        approver,
        requestId
      );
      if (!approvalResult.success) {
        throw new Error(`Approval failed: ${approvalResult.error}`);
      }
      if (approvalResult.executed) {
        logger.info(`[Orchestrator] Key rotation approved and executed`);
        break;
      }
    }

    // TEE performs actual key rotation
    this.phase = 'rotating_keys';
    const checkpoint = await this.stateManager!.rotateKey();

    // Update on-chain
    const operatorAddress = this.enclave!.getOperatorAddress();
    this.blockchain.updateState(
      operatorAddress,
      checkpoint.cid,
      checkpoint.hash
    );

    this.phase = 'running';

    return {
      newKeyVersion: checkpoint.keyVersion,
      newStateCID: checkpoint.cid,
    };
  }

  /**
   * Get comprehensive system status
   */
  getStatus(): {
    phase: OrchestratorPhase;
    blockchain: {
      blockNumber: number;
      treasury: bigint;
      operatorActive: boolean;
    };
    enclave: {
      running: boolean;
      address: Address | null;
      attestationValid: boolean;
    };
    game: {
      totalSessions: number;
      agentWinRate: number;
    };
    training: {
      totalCycles: number;
      currentLoss: number;
    };
    storage: {
      checkpoints: number;
      trainingDatasets: number;
      totalBytes: number;
    };
  } {
    const gameState = this.blockchain.getGameState();
    const enclaveStatus = this.enclave?.getStatus();
    const envStats = this.environment?.getStats();
    const trainerStats = this.trainer?.getStats();
    const storageStats = this.stateManager?.getStats();

    const totalGames = envStats?.totalSessions ?? 0;
    const agentWins = envStats?.agentWins ?? 0;

    return {
      phase: this.phase,
      blockchain: {
        blockNumber: this.blockchain.getBlockNumber(),
        treasury: this.blockchain.getTreasuryBalance(),
        operatorActive: gameState.operatorActive,
      },
      enclave: {
        running: enclaveStatus?.running ?? false,
        address: enclaveStatus?.address ?? null,
        attestationValid: enclaveStatus?.attestationValid ?? false,
      },
      game: {
        totalSessions: totalGames,
        agentWinRate: totalGames > 0 ? agentWins / totalGames : 0,
      },
      training: {
        totalCycles: trainerStats?.totalCycles ?? 0,
        currentLoss: trainerStats?.currentLoss ?? 1,
      },
      storage: {
        checkpoints: storageStats?.checkpoints ?? 0,
        trainingDatasets: storageStats?.trainingDatasets ?? 0,
        totalBytes: storageStats?.totalStorageBytes ?? 0,
      },
    };
  }

  /**
   * Get blockchain events
   */
  getEvents() {
    return this.blockchain.getEvents();
  }

  /**
   * Get IPFS storage objects
   */
  getStorageObjects() {
    return this.ipfs.list();
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    logger.info('\n[Orchestrator] Shutting down...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.enclave) {
      await this.enclave.shutdown();
    }

    this.phase = 'shutdown';
    logger.info('[Orchestrator] Shutdown complete');
  }
}
