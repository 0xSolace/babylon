/**
 * Records training cycles and state updates on-chain for audit and verification.
 */

import {
  Contract,
  type ContractTransactionResponse,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  Wallet,
} from 'ethers';
import type { Address } from 'viem';
import { logger } from '../utils/logger';

const BABYLON_TREASURY_ABI = [
  'function recordTraining(string datasetCID, bytes32 modelHash) external',
  'function updateState(string cid, bytes32 hash) external',
  'function heartbeat() external',
  'function getGameState() view returns (string cid, bytes32 stateHash, uint256 version, uint256 keyVer, uint256 lastBeat, bool operatorActive)',
  'function isOperatorActive() view returns (bool)',
  'function operator() view returns (address)',
  'function trainingEpoch() view returns (uint256)',
  'function lastModelHash() view returns (bytes32)',
];

interface TreasuryContract {
  recordTraining(
    datasetCID: string,
    modelHash: string
  ): Promise<ContractTransactionResponse>;
  updateState(cid: string, hash: string): Promise<ContractTransactionResponse>;
  heartbeat(): Promise<ContractTransactionResponse>;
  getGameState(): Promise<[string, string, bigint, bigint, bigint, boolean]>;
  isOperatorActive(): Promise<boolean>;
  operator(): Promise<string>;
  trainingEpoch(): Promise<bigint>;
  lastModelHash(): Promise<string>;
}

export interface TreasuryConfig {
  rpcUrl: string;
  treasuryAddress: Address;
  privateKey: string;
}

export interface TrainingRecord {
  epoch: number;
  datasetCID: string;
  modelHash: string;
  txHash: string;
  timestamp: number;
}

export class BabylonTreasuryClient {
  private provider: JsonRpcProvider;
  private signer: Wallet;
  private treasury: TreasuryContract;
  private treasuryAddress: Address;
  private validated = false;

  constructor(config: TreasuryConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.signer = new Wallet(config.privateKey, this.provider);
    this.treasuryAddress = config.treasuryAddress;
    this.treasury = new Contract(
      config.treasuryAddress,
      BABYLON_TREASURY_ABI,
      this.signer
    ) as unknown as TreasuryContract;
  }

  async validateContract(): Promise<boolean> {
    if (this.validated) return true;

    const code = await this.provider.getCode(this.treasuryAddress);
    if (code === '0x' || code === '0x0') {
      logger.error('[Treasury] Contract not deployed at address', {
        address: this.treasuryAddress,
      });
      return false;
    }

    // Verify it responds to our ABI by calling a view function
    try {
      await this.treasury.trainingEpoch();
      this.validated = true;
      logger.info('[Treasury] Contract validated', {
        address: this.treasuryAddress,
      });
      return true;
    } catch (err) {
      logger.error('[Treasury] Contract does not match expected ABI', {
        address: this.treasuryAddress,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  async isActiveOperator(): Promise<boolean> {
    const operator = await this.treasury.operator();
    const signerAddress = await this.signer.getAddress();
    return operator.toLowerCase() === signerAddress.toLowerCase();
  }

  async isOperatorActive(): Promise<boolean> {
    return this.treasury.isOperatorActive();
  }

  async recordTraining(
    datasetCID: string,
    modelCID: string
  ): Promise<TrainingRecord> {
    if (!(await this.validateContract())) {
      return {
        epoch: 0,
        datasetCID,
        modelHash: '',
        txHash: '',
        timestamp: Date.now(),
      };
    }

    if (!(await this.isActiveOperator())) {
      logger.warn(
        '[Treasury] Not active operator, skipping on-chain recording'
      );
      return {
        epoch: 0,
        datasetCID,
        modelHash: '',
        txHash: '',
        timestamp: Date.now(),
      };
    }

    const modelHash = keccak256(toUtf8Bytes(modelCID));

    logger.info('[Treasury] Recording training on-chain', {
      datasetCID,
      modelCID,
      modelHash,
    });

    const tx = await this.treasury.recordTraining(datasetCID, modelHash);
    await tx.wait();

    const epoch = await this.treasury.trainingEpoch();

    logger.info('[Treasury] Training recorded', {
      epoch: Number(epoch),
      txHash: tx.hash,
    });

    return {
      epoch: Number(epoch),
      datasetCID,
      modelHash,
      txHash: tx.hash,
      timestamp: Date.now(),
    };
  }

  async updateState(stateCID: string): Promise<string> {
    if (!(await this.validateContract())) return '';

    if (!(await this.isActiveOperator())) {
      logger.warn('[Treasury] Not active operator, skipping state update');
      return '';
    }

    const stateHash = keccak256(toUtf8Bytes(stateCID));
    const tx = await this.treasury.updateState(stateCID, stateHash);
    await tx.wait();

    logger.info('[Treasury] State updated', { stateCID, txHash: tx.hash });
    return tx.hash;
  }

  async heartbeat(): Promise<string> {
    if (!(await this.validateContract())) return '';
    if (!(await this.isActiveOperator())) return '';

    const tx = await this.treasury.heartbeat();
    await tx.wait();
    return tx.hash;
  }

  async getGameState(): Promise<{
    stateCID: string;
    stateHash: string;
    version: number;
    keyVersion: number;
    lastHeartbeat: number;
    operatorActive: boolean;
  } | null> {
    if (!(await this.validateContract())) return null;
    const [cid, hash, version, keyVer, lastBeat, active] =
      await this.treasury.getGameState();
    return {
      stateCID: cid,
      stateHash: hash,
      version: Number(version),
      keyVersion: Number(keyVer),
      lastHeartbeat: Number(lastBeat),
      operatorActive: active,
    };
  }

  async getTrainingEpoch(): Promise<number> {
    const epoch = await this.treasury.trainingEpoch();
    return Number(epoch);
  }

  async getLastModelHash(): Promise<string> {
    return this.treasury.lastModelHash();
  }
}

let treasuryClient: BabylonTreasuryClient | null = null;

export function isTreasuryAvailable(): boolean {
  return !!(
    process.env.BABYLON_TREASURY_ADDRESS &&
    process.env.PRIVATE_KEY &&
    (process.env.RPC_URL || process.env.JEJU_RPC_URL)
  );
}

export function getTreasuryClient(): BabylonTreasuryClient | null {
  if (!isTreasuryAvailable()) {
    return null;
  }

  if (!treasuryClient) {
    treasuryClient = new BabylonTreasuryClient({
      rpcUrl:
        process.env.JEJU_RPC_URL ??
        process.env.RPC_URL ??
        'http://localhost:9545',
      treasuryAddress: process.env.BABYLON_TREASURY_ADDRESS as Address,
      privateKey: process.env.PRIVATE_KEY ?? '',
    });
  }

  return treasuryClient;
}

export async function recordTrainingOnChain(
  datasetCID: string,
  modelCID: string
): Promise<TrainingRecord | null> {
  const client = getTreasuryClient();
  if (!client) {
    logger.debug(
      '[Treasury] Treasury not configured, skipping on-chain recording'
    );
    return null;
  }

  return client.recordTraining(datasetCID, modelCID);
}

export async function sendHeartbeat(): Promise<boolean> {
  const client = getTreasuryClient();
  if (!client) {
    return false;
  }

  const txHash = await client.heartbeat();
  return !!txHash;
}
