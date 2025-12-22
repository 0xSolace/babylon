/**
 * Bootstrap Script
 *
 * This is the entry point for deploying the permissionless AI game.
 * Provide a wallet with funds and everything else is handled automatically.
 *
 * Usage:
 *   PRIVATE_KEY=0x... CONTRACT_ADDRESS=0x... bun run src/infra/bootstrap.ts
 *
 * Or programmatically:
 *   const game = await bootstrap({ privateKey, contractAddress, ... });
 */

import { logger } from '@babylon/shared';
import type { Address, Hex } from 'viem';
import { keccak256, toBytes, toHex } from 'viem';
import { type AgentState, AIAgent } from '../game/agent.js';
import { GameEnvironment } from '../game/environment.js';
import { AITrainer } from '../game/trainer.js';
import {
  BootstrapConfigSchema,
  SavedGameStateSchema,
} from '../schemas/index.js';
import { IPFSSimulator } from '../storage/ipfs-simulator.js';
import { StateManager } from '../storage/state-manager.js';
import { TEEEnclave } from '../tee/enclave.js';
import { BlockchainClient } from './blockchain-client.js';
import { createIPFSClient, type IPFSClient } from './ipfs-client.js';

export interface BootstrapConfig {
  // Required: wallet that will operate the game
  privateKey: Hex;

  // Required: deployed contract address
  contractAddress: Address;

  // Chain configuration
  chainId?: 'mainnet' | 'sepolia' | 'localhost';
  rpcUrl?: string;

  // IPFS configuration
  ipfsProvider?: 'local' | 'infura' | 'pinata';
  ipfsProjectId?: string;
  ipfsProjectSecret?: string;

  // Game configuration
  gameCodeHash?: Hex;
  instanceId?: string;

  // Training configuration
  trainingBatchSize?: number;
  trainingEpochs?: number;

  // Heartbeat interval (ms)
  heartbeatIntervalMs?: number;

  // Use simulated IPFS (for testing)
  useSimulatedIPFS?: boolean;
}

export interface BootstrappedGame {
  // Clients
  blockchain: BlockchainClient;
  ipfs: IPFSClient | IPFSSimulator;

  // TEE
  enclave: TEEEnclave;
  stateManager: StateManager;

  // Game
  agent: AIAgent;
  environment: GameEnvironment;
  trainer: AITrainer;

  // Control
  start: () => Promise<void>;
  stop: () => Promise<void>;
  runTrainingCycle: () => Promise<void>;

  // Status
  getStatus: () => Promise<GameStatus>;
}

export interface GameStatus {
  operatorAddress: Address;
  contractBalance: string;
  stateVersion: bigint;
  keyVersion: bigint;
  trainingEpoch: bigint;
  isActive: boolean;
  lastHeartbeat: Date;
}

interface SavedGameState {
  agent: AgentState;
  gameStats: ReturnType<GameEnvironment['getStats']>;
  trainingStats: ReturnType<AITrainer['getStats']>;
  version: number;
  timestamp: number;
}

/**
 * Bootstrap the entire permissionless AI game
 */
export async function bootstrap(
  config: BootstrapConfig
): Promise<BootstrappedGame> {
  // Validate configuration at runtime
  const validatedConfig = BootstrapConfigSchema.parse(config);

  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║       BOOTSTRAPPING PERMISSIONLESS AI GAME               ║');
  logger.info('╚══════════════════════════════════════════════════════════╝\n');

  // =========================================================================
  // Step 1: Initialize blockchain client
  // =========================================================================
  logger.info('[1/6] Connecting to blockchain...');

  const blockchain = new BlockchainClient({
    chainId: validatedConfig.chainId,
    rpcUrl: validatedConfig.rpcUrl,
    contractAddress: validatedConfig.contractAddress,
    privateKey: validatedConfig.privateKey,
  });

  const balance = await blockchain.getBalance();
  logger.info(`  Contract balance: ${balance} wei`);
  logger.info(`  Operator wallet: ${blockchain.getAddress()}`);

  // =========================================================================
  // Step 2: Initialize IPFS client
  // =========================================================================
  logger.info('\n[2/6] Connecting to IPFS...');

  let ipfs: IPFSClient | IPFSSimulator;

  if (validatedConfig.useSimulatedIPFS) {
    logger.info('  Using simulated IPFS');
    ipfs = new IPFSSimulator();
  } else {
    ipfs = createIPFSClient(validatedConfig.ipfsProvider ?? 'local', {
      projectId: validatedConfig.ipfsProjectId,
      projectSecret: validatedConfig.ipfsProjectSecret,
    });

    // Test connection
    try {
      const testResult = await ipfs.upload('test');
      logger.info(`  IPFS connected (test CID: ${testResult.cid})`);
    } catch {
      logger.warn('  Warning: IPFS connection failed, using simulated IPFS');
      ipfs = new IPFSSimulator();
    }
  }

  // =========================================================================
  // Step 3: Boot TEE enclave
  // =========================================================================
  logger.info('\n[3/6] Booting TEE enclave...');

  const codeHash =
    validatedConfig.gameCodeHash ??
    (keccak256(toBytes('babylon-ai-game-v1')) as Hex);

  const enclave = await TEEEnclave.create({
    codeHash,
    instanceId: validatedConfig.instanceId ?? 'primary-game-enclave',
  });

  const attestation = enclave.getAttestation();
  logger.info(`  Enclave address: ${enclave.getOperatorAddress()}`);
  logger.info(`  Code hash: ${attestation.mrEnclave.slice(0, 20)}...`);

  // =========================================================================
  // Step 4: Register operator on-chain (if not already)
  // =========================================================================
  logger.info('\n[4/6] Checking operator registration...');

  const operatorInfo = await blockchain.getOperatorInfo();

  if (operatorInfo.address === enclave.getOperatorAddress()) {
    logger.info('  Operator already registered ✓');
  } else if (!operatorInfo.active) {
    logger.info('  Registering operator on-chain...');
    const attestationHex = toHex(
      new TextEncoder().encode(JSON.stringify(attestation))
    );
    await blockchain.registerOperator(
      enclave.getOperatorAddress(),
      attestationHex
    );
    logger.info('  Operator registered ✓');
  } else {
    throw new Error(
      `Another operator is active: ${operatorInfo.address}. Wait for timeout or manually deactivate.`
    );
  }

  // =========================================================================
  // Step 5: Initialize game components
  // =========================================================================
  logger.info('\n[5/6] Initializing game components...');

  // Create state manager with IPFS simulator (works with both real and simulated)
  const ipfsSimulator =
    ipfs instanceof IPFSSimulator ? ipfs : new IPFSSimulator();
  const stateManager = new StateManager(enclave, ipfsSimulator);

  const agent = new AIAgent({
    inputSize: 5,
    hiddenSize: 8,
    outputSize: 1,
    learningRate: 0.1,
  });

  const environment = new GameEnvironment({
    sequenceLength: 5,
    patternTypes: ['linear', 'quadratic', 'fibonacci'],
    difficulty: 5,
  });

  const trainer = new AITrainer(
    {
      batchSize: validatedConfig.trainingBatchSize ?? 50,
      epochsPerCycle: validatedConfig.trainingEpochs ?? 10,
      targetLoss: 0.01,
    },
    agent,
    environment
  );

  logger.info('  AI Agent initialized ✓');
  logger.info('  Game Environment initialized ✓');
  logger.info('  Trainer initialized ✓');

  // =========================================================================
  // Step 6: Load or create initial state
  // =========================================================================
  logger.info('\n[6/6] Loading game state...');

  const gameState = await blockchain.getGameState();

  if (gameState.cid && gameState.cid.length > 0) {
    logger.info(`  Loading existing state: ${gameState.cid}`);
    const rawState = await stateManager.loadState(gameState.cid);
    const state = SavedGameStateSchema.parse(rawState);
    agent.loadState(state.agent);
    logger.info('  State loaded ✓');
  } else {
    logger.info('  No existing state, creating genesis...');
    const initialState: SavedGameState = {
      agent: agent.serialize(),
      gameStats: environment.getStats(),
      trainingStats: trainer.getStats(),
      version: 1,
      timestamp: Date.now(),
    };

    const checkpoint = await stateManager.saveState(initialState);
    await blockchain.updateState(checkpoint.cid, checkpoint.hash);
    logger.info(`  Genesis state saved: ${checkpoint.cid}`);
  }

  // =========================================================================
  // Control functions
  // =========================================================================

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const start = async () => {
    if (running) return;
    running = true;

    logger.info('\n[Game] Starting heartbeat...');

    // Send initial heartbeat
    await blockchain.heartbeat();

    // Start heartbeat interval
    const interval = validatedConfig.heartbeatIntervalMs ?? 60000; // 1 minute default
    heartbeatTimer = setInterval(async () => {
      await blockchain.heartbeat();
      logger.info(`[Heartbeat] ${new Date().toISOString()}`);
    }, interval);

    logger.info(`[Game] Running (heartbeat every ${interval / 1000}s)`);
  };

  const stop = async () => {
    if (!running) return;
    running = false;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // Save final state
    const finalState: SavedGameState = {
      agent: agent.serialize(),
      gameStats: environment.getStats(),
      trainingStats: trainer.getStats(),
      version: Number(gameState.version) + 1,
      timestamp: Date.now(),
    };

    const checkpoint = await stateManager.saveState(finalState);
    await blockchain.updateState(checkpoint.cid, checkpoint.hash);

    await enclave.shutdown();
    logger.info('[Game] Stopped');
  };

  const runTrainingCycle = async () => {
    logger.info('\n[Training] Starting cycle...');

    const result = trainer.runTrainingCycle();

    // Save training data to IPFS (public)
    const dataset = stateManager.saveTrainingData(
      result.samples,
      result.modelHashBefore,
      result.modelHashAfter
    );

    // Record on-chain
    await blockchain.recordTraining(dataset.cid, result.modelHashAfter);

    // Save updated state
    const newState: SavedGameState = {
      agent: agent.serialize(),
      gameStats: environment.getStats(),
      trainingStats: trainer.getStats(),
      version: Number(gameState.version) + 1,
      timestamp: Date.now(),
    };

    const checkpoint = await stateManager.saveState(newState);
    await blockchain.updateState(checkpoint.cid, checkpoint.hash);

    logger.info(`[Training] Complete. Loss: ${result.finalLoss.toFixed(4)}`);
    logger.info(`[Training] Dataset CID: ${dataset.cid}`);
  };

  const getStatus = async (): Promise<GameStatus> => {
    const state = await blockchain.getGameState();
    const bal = await blockchain.getBalance();
    const epoch = await blockchain.getTrainingEpoch();

    return {
      operatorAddress: enclave.getOperatorAddress(),
      contractBalance: bal.toString(),
      stateVersion: state.version,
      keyVersion: state.keyVersion,
      trainingEpoch: epoch,
      isActive: state.operatorActive,
      lastHeartbeat: new Date(Number(state.lastHeartbeat) * 1000),
    };
  };

  // =========================================================================
  // Return bootstrapped game
  // =========================================================================

  logger.info('\n╔══════════════════════════════════════════════════════════╗');
  logger.info('║              BOOTSTRAP COMPLETE                          ║');
  logger.info('╚══════════════════════════════════════════════════════════╝\n');

  return {
    blockchain,
    ipfs,
    enclave,
    stateManager,
    agent,
    environment,
    trainer,
    start,
    stop,
    runTrainingCycle,
    getStatus,
  };
}

// =========================================================================
// CLI Entry Point
// =========================================================================

if (import.meta.main) {
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const contractAddress = process.env.CONTRACT_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL;
  const chainId = (process.env.CHAIN_ID ?? 'localhost') as
    | 'mainnet'
    | 'sepolia'
    | 'localhost';

  if (!privateKey) {
    logger.error('Error: PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  if (!contractAddress) {
    logger.error('Error: CONTRACT_ADDRESS environment variable required');
    process.exit(1);
  }

  bootstrap({
    privateKey,
    contractAddress,
    chainId,
    rpcUrl,
    ipfsProvider: 'local',
  })
    .then(async (game) => {
      await game.start();

      // Run initial training
      await game.runTrainingCycle();

      // Print status
      const status = await game.getStatus();
      logger.info('\nGame Status:', status);

      // Keep running
      logger.info('\nGame is running. Press Ctrl+C to stop.');

      process.on('SIGINT', async () => {
        logger.info('\nShutting down...');
        await game.stop();
        process.exit(0);
      });
    })
    .catch((e) => {
      logger.error('Bootstrap failed:', e);
      process.exit(1);
    });
}
