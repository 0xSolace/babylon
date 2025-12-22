/**
 * Records training cycles and state updates on-chain for audit and verification.
 */

import { keccak256, logger, stringToHex } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type GetContractReturnType,
  getContract,
  type Hash,
  type Hex,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';

const BABYLON_TREASURY_ABI = [
  {
    type: 'function',
    name: 'recordTraining',
    inputs: [
      { name: 'datasetCID', type: 'string' },
      { name: 'modelHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateState',
    inputs: [
      { name: 'cid', type: 'string' },
      { name: 'hash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'heartbeat',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getGameState',
    inputs: [],
    outputs: [
      { name: 'cid', type: 'string' },
      { name: 'stateHash', type: 'bytes32' },
      { name: 'version', type: 'uint256' },
      { name: 'keyVer', type: 'uint256' },
      { name: 'lastBeat', type: 'uint256' },
      { name: 'operatorActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isOperatorActive',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'operator',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'trainingEpoch',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastModelHash',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;

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

type TreasuryContract = GetContractReturnType<
  typeof BABYLON_TREASURY_ABI,
  { public: PublicClient; wallet: WalletClient }
>;

export class BabylonTreasuryClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: PrivateKeyAccount;
  private contract: TreasuryContract;
  private treasuryAddress: Address;
  private signerAddress: Address;
  private validated = false;

  constructor(config: TreasuryConfig) {
    this.account = privateKeyToAccount(config.privateKey as Hex);
    this.signerAddress = this.account.address;
    this.treasuryAddress = config.treasuryAddress;

    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      transport: http(config.rpcUrl),
    });

    this.contract = getContract({
      address: config.treasuryAddress,
      abi: BABYLON_TREASURY_ABI,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  async validateContract(): Promise<boolean> {
    if (this.validated) return true;

    const code = await this.publicClient.getBytecode({
      address: this.treasuryAddress,
    });
    if (!code || code === '0x' || code === '0x0') {
      logger.error('[Treasury] Contract not deployed at address', {
        address: this.treasuryAddress,
      });
      return false;
    }

    // Verify it responds to our ABI by calling a view function
    try {
      await this.contract.read.trainingEpoch();
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
    const operator = await this.contract.read.operator();
    return (
      (operator as Address).toLowerCase() === this.signerAddress.toLowerCase()
    );
  }

  async isOperatorActive(): Promise<boolean> {
    return this.contract.read.isOperatorActive() as Promise<boolean>;
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

    const modelHash = keccak256(stringToHex(modelCID));

    logger.info('[Treasury] Recording training on-chain', {
      datasetCID,
      modelCID,
      modelHash,
    });

    const txHash = await this.contract.write.recordTraining(
      [datasetCID, modelHash as Hex],
      { account: this.account } as Parameters<
        typeof this.contract.write.recordTraining
      >[1]
    );
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    const epoch = await this.contract.read.trainingEpoch();

    logger.info('[Treasury] Training recorded', {
      epoch: Number(epoch),
      txHash,
    });

    return {
      epoch: Number(epoch as bigint),
      datasetCID,
      modelHash,
      txHash,
      timestamp: Date.now(),
    };
  }

  async updateState(stateCID: string): Promise<string> {
    if (!(await this.validateContract())) return '';

    if (!(await this.isActiveOperator())) {
      logger.warn('[Treasury] Not active operator, skipping state update');
      return '';
    }

    const stateHash = keccak256(stringToHex(stateCID));
    const txHash = await this.contract.write.updateState(
      [stateCID, stateHash as Hex],
      { account: this.account } as Parameters<
        typeof this.contract.write.updateState
      >[1]
    );
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    logger.info('[Treasury] State updated', { stateCID, txHash });
    return txHash;
  }

  async heartbeat(): Promise<string> {
    if (!(await this.validateContract())) return '';
    if (!(await this.isActiveOperator())) return '';

    const txHash = await this.contract.write.heartbeat({
      account: this.account,
    } as Parameters<typeof this.contract.write.heartbeat>[0]);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
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
    const result = await this.contract.read.getGameState();
    const [cid, hash, version, keyVer, lastBeat, active] = result as [
      string,
      Hash,
      bigint,
      bigint,
      bigint,
      boolean,
    ];
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
    const epoch = await this.contract.read.trainingEpoch();
    return Number(epoch as bigint);
  }

  async getLastModelHash(): Promise<string> {
    return this.contract.read.lastModelHash() as Promise<string>;
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
