/**
 * Treasury Contract Adapter
 *
 * Provides a decentralized interface for interacting with the BabylonTreasury contract.
 * Supports two modes:
 *
 * 1. PRODUCTION MODE (with Jeju)
 *    - Uses the real BabylonTreasury contract deployed on-chain
 *    - Full security guarantees
 *
 * 2. DEV MODE (standalone Babylon)
 *    - Uses an in-memory mock treasury
 *    - No blockchain required
 *    - Fast iteration for development
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// Types
// ============================================================================

export interface TreasuryState {
  currentStateCID: string;
  currentStateHash: Hex;
  stateVersion: bigint;
  keyVersion: bigint;
  lastHeartbeat: bigint;
  operator: Address;
  operatorActive: boolean;
  balance: bigint;
  dailyWithdrawalLimit: bigint;
  withdrawnToday: bigint;
  trainingEpoch: bigint;
  lastModelHash: Hex;
}

export interface OperatorInfo {
  address: Address;
  attestation: Hex;
  registeredAt: bigint;
  active: boolean;
}

export interface WithdrawalInfo {
  limit: bigint;
  usedToday: bigint;
  remaining: bigint;
}

export interface TreasuryConfig {
  mode: 'production' | 'dev';
  // Production mode settings
  contractAddress?: Address;
  rpcUrl?: string;
  privateKey?: Hex;
  // Dev mode settings
  initialBalance?: bigint;
  dailyLimit?: bigint;
}

export interface TreasuryAdapter {
  // State
  getState(): Promise<TreasuryState>;
  getOperatorInfo(): Promise<OperatorInfo>;
  getWithdrawalInfo(): Promise<WithdrawalInfo>;
  getBalance(): Promise<bigint>;

  // Operator Management
  registerOperator(operator: Address, attestation: Hex): Promise<void>;
  takeoverAsOperator(attestation: Hex): Promise<void>;
  isOperatorActive(): Promise<boolean>;
  isTakeoverAvailable(): Promise<boolean>;

  // State Management
  updateState(cid: string, hash: Hex): Promise<void>;
  heartbeat(): Promise<void>;
  recordTraining(datasetCID: string, modelHash: Hex): Promise<void>;

  // Withdrawals
  withdraw(amount: bigint): Promise<void>;
  deposit(amount: bigint): Promise<void>;

  // Key Rotation
  requestKeyRotation(): Promise<bigint>;
  approveKeyRotation(requestId: bigint): Promise<void>;
}

// ============================================================================
// Dev Mode Mock Treasury
// ============================================================================

class DevModeTreasury implements TreasuryAdapter {
  private state: TreasuryState;
  private keyRotationRequests: Map<
    bigint,
    { approvals: number; executed: boolean }
  > = new Map();
  private nextRotationId = 0n;

  constructor(config: TreasuryConfig) {
    const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
    const zeroHash =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

    this.state = {
      currentStateCID: '',
      currentStateHash: zeroHash,
      stateVersion: 0n,
      keyVersion: 1n,
      lastHeartbeat: BigInt(Math.floor(Date.now() / 1000)),
      operator: zeroAddress,
      operatorActive: false,
      balance: config.initialBalance ?? 100n * 10n ** 18n, // 100 ETH default
      dailyWithdrawalLimit: config.dailyLimit ?? 10n * 10n ** 18n, // 10 ETH default
      withdrawnToday: 0n,
      trainingEpoch: 0n,
      lastModelHash: zeroHash,
    };
  }

  async getState(): Promise<TreasuryState> {
    return { ...this.state, operatorActive: await this.isOperatorActive() };
  }

  async getOperatorInfo(): Promise<OperatorInfo> {
    return {
      address: this.state.operator,
      attestation: '0x' as Hex, // Mock attestation
      registeredAt: this.state.lastHeartbeat,
      active: await this.isOperatorActive(),
    };
  }

  async getWithdrawalInfo(): Promise<WithdrawalInfo> {
    const remaining =
      this.state.dailyWithdrawalLimit > this.state.withdrawnToday
        ? this.state.dailyWithdrawalLimit - this.state.withdrawnToday
        : 0n;
    return {
      limit: this.state.dailyWithdrawalLimit,
      usedToday: this.state.withdrawnToday,
      remaining,
    };
  }

  async getBalance(): Promise<bigint> {
    return this.state.balance;
  }

  async registerOperator(operator: Address, _attestation: Hex): Promise<void> {
    if (
      this.state.operator !== '0x0000000000000000000000000000000000000000' &&
      (await this.isOperatorActive())
    ) {
      throw new Error('Active operator exists');
    }

    this.state.operator = operator;
    this.state.lastHeartbeat = BigInt(Math.floor(Date.now() / 1000));
    this.state.operatorActive = true;
  }

  async takeoverAsOperator(attestation: Hex): Promise<void> {
    if (!(await this.isTakeoverAvailable())) {
      throw new Error('Takeover not available');
    }

    if (attestation.length === 0) {
      throw new Error('Attestation required');
    }

    // In dev mode, just use a mock address
    this.state.operator =
      '0x1234567890123456789012345678901234567890' as Address;
    this.state.lastHeartbeat = BigInt(Math.floor(Date.now() / 1000));
    this.state.operatorActive = true;
  }

  async isOperatorActive(): Promise<boolean> {
    if (this.state.operator === '0x0000000000000000000000000000000000000000') {
      return false;
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeout = 3600n; // 1 hour
    return now - this.state.lastHeartbeat <= timeout;
  }

  async isTakeoverAvailable(): Promise<boolean> {
    if (this.state.operator === '0x0000000000000000000000000000000000000000') {
      return true;
    }
    if (await this.isOperatorActive()) {
      return false;
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeoutPlusCooldown = 3600n + 7200n; // 1 hour + 2 hours
    return now >= this.state.lastHeartbeat + timeoutPlusCooldown;
  }

  async updateState(cid: string, hash: Hex): Promise<void> {
    this.state.currentStateCID = cid;
    this.state.currentStateHash = hash;
    this.state.stateVersion++;
    this.state.lastHeartbeat = BigInt(Math.floor(Date.now() / 1000));
  }

  async heartbeat(): Promise<void> {
    this.state.lastHeartbeat = BigInt(Math.floor(Date.now() / 1000));
  }

  async recordTraining(datasetCID: string, modelHash: Hex): Promise<void> {
    this.state.trainingEpoch++;
    this.state.lastModelHash = modelHash;
    // In dev mode, just log it
    console.log(
      `[DevTreasury] Training recorded: epoch=${this.state.trainingEpoch}, cid=${datasetCID}`
    );
  }

  async withdraw(amount: bigint): Promise<void> {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    if (this.state.balance < amount) {
      throw new Error('Insufficient balance');
    }
    if (this.state.withdrawnToday + amount > this.state.dailyWithdrawalLimit) {
      throw new Error('Exceeds daily limit');
    }

    this.state.withdrawnToday += amount;
    this.state.balance -= amount;
  }

  async deposit(amount: bigint): Promise<void> {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    this.state.balance += amount;
  }

  async requestKeyRotation(): Promise<bigint> {
    const requestId = this.nextRotationId++;
    this.keyRotationRequests.set(requestId, { approvals: 1, executed: false });

    // In dev mode, auto-execute with 1 approval
    this.state.keyVersion++;
    this.keyRotationRequests.get(requestId)!.executed = true;

    return requestId;
  }

  async approveKeyRotation(requestId: bigint): Promise<void> {
    const request = this.keyRotationRequests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }
    if (request.executed) {
      throw new Error('Already executed');
    }

    request.approvals++;
    if (request.approvals >= 2) {
      this.state.keyVersion++;
      request.executed = true;
    }
  }
}

// ============================================================================
// Production Mode Treasury (Real Contract)
// ============================================================================

// BabylonTreasury ABI (minimal for read/write operations)
const TREASURY_ABI = [
  'function getGameState() view returns (bytes32 stateHash, string stateCid, uint256 stateVersion, uint256 keyVersion)',
  'function currentOperator() view returns (address)',
  'function lastHeartbeat() view returns (uint256)',
  'function heartbeatTimeout() view returns (uint256)',
  'function takeoverCooldown() view returns (uint256)',
  'function dailyWithdrawalLimit() view returns (uint256)',
  'function trainingEpoch() view returns (uint256)',
  'function lastModelHash() view returns (bytes32)',
  'function isTakeoverAvailable() view returns (bool)',
  'function registerOperator(address operator, bytes attestation)',
  'function takeoverAsOperator(bytes attestation)',
  'function updateState(string stateCid, bytes32 stateHash)',
  'function heartbeat()',
  'function recordTraining(string datasetCid, bytes32 modelHash)',
  'function withdraw(uint256 amount)',
  'function deposit() payable',
  'function requestKeyRotation() returns (uint256)',
  'function approveKeyRotation(uint256 requestId)',
] as const;

class ProductionTreasury implements TreasuryAdapter {
  private rpcUrl: string;
  private contractAddress: Address;
  private privateKey: Hex | undefined;

  constructor(config: TreasuryConfig) {
    if (!config.contractAddress) {
      throw new Error('Contract address required for production mode');
    }
    if (!config.rpcUrl) {
      throw new Error('RPC URL required for production mode');
    }
    this.contractAddress = config.contractAddress;
    this.rpcUrl = config.rpcUrl;
    this.privateKey = config.privateKey;
  }

  private async readContract<T>(
    functionName: string,
    args: unknown[] = []
  ): Promise<T> {
    const { createPublicClient, http } = await import('viem');
    const client = createPublicClient({ transport: http(this.rpcUrl) });
    return client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName,
      args,
    }) as Promise<T>;
  }

  private async writeContract(
    functionName: string,
    args: unknown[] = [],
    value?: bigint
  ): Promise<Hex> {
    if (!this.privateKey) {
      throw new Error('Private key required for write operations');
    }
    const { createWalletClient, http } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { jejuMainnet } = await import('@babylon/shared');

    const account = privateKeyToAccount(this.privateKey);
    const client = createWalletClient({
      account,
      chain: jejuMainnet,
      transport: http(this.rpcUrl),
    });

    return client.writeContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName,
      args,
      value,
    });
  }

  async getState(): Promise<TreasuryState> {
    const [gameState, operator, lastHb, balance] = await Promise.all([
      this.readContract<[Hex, string, bigint, bigint]>('getGameState'),
      this.readContract<Address>('currentOperator'),
      this.readContract<bigint>('lastHeartbeat'),
      this.getBalance(),
    ]);

    const [limit, epoch, modelHash] = await Promise.all([
      this.readContract<bigint>('dailyWithdrawalLimit'),
      this.readContract<bigint>('trainingEpoch'),
      this.readContract<Hex>('lastModelHash'),
    ]);

    return {
      currentStateCID: gameState[1],
      currentStateHash: gameState[0],
      stateVersion: gameState[2],
      keyVersion: gameState[3],
      lastHeartbeat: lastHb,
      operator,
      operatorActive: await this.isOperatorActive(),
      balance,
      dailyWithdrawalLimit: limit,
      withdrawnToday: 0n, // Would need to track on-chain
      trainingEpoch: epoch,
      lastModelHash: modelHash,
    };
  }

  async getOperatorInfo(): Promise<OperatorInfo> {
    const operator = await this.readContract<Address>('currentOperator');
    const lastHb = await this.readContract<bigint>('lastHeartbeat');
    return {
      address: operator,
      attestation: '0x' as Hex,
      registeredAt: lastHb,
      active: await this.isOperatorActive(),
    };
  }

  async getWithdrawalInfo(): Promise<WithdrawalInfo> {
    const limit = await this.readContract<bigint>('dailyWithdrawalLimit');
    return { limit, usedToday: 0n, remaining: limit };
  }

  async getBalance(): Promise<bigint> {
    const { createPublicClient, http } = await import('viem');
    const client = createPublicClient({ transport: http(this.rpcUrl) });
    return client.getBalance({ address: this.contractAddress });
  }

  async registerOperator(operator: Address, attestation: Hex): Promise<void> {
    await this.writeContract('registerOperator', [operator, attestation]);
  }

  async takeoverAsOperator(attestation: Hex): Promise<void> {
    await this.writeContract('takeoverAsOperator', [attestation]);
  }

  async isOperatorActive(): Promise<boolean> {
    const [operator, lastHb, timeout] = await Promise.all([
      this.readContract<Address>('currentOperator'),
      this.readContract<bigint>('lastHeartbeat'),
      this.readContract<bigint>('heartbeatTimeout'),
    ]);
    if (operator === '0x0000000000000000000000000000000000000000') return false;
    const now = BigInt(Math.floor(Date.now() / 1000));
    return now - lastHb <= timeout;
  }

  async isTakeoverAvailable(): Promise<boolean> {
    return this.readContract<boolean>('isTakeoverAvailable');
  }

  async updateState(cid: string, hash: Hex): Promise<void> {
    await this.writeContract('updateState', [cid, hash]);
  }

  async heartbeat(): Promise<void> {
    await this.writeContract('heartbeat');
  }

  async recordTraining(datasetCID: string, modelHash: Hex): Promise<void> {
    await this.writeContract('recordTraining', [datasetCID, modelHash]);
  }

  async withdraw(amount: bigint): Promise<void> {
    await this.writeContract('withdraw', [amount]);
  }

  async deposit(amount: bigint): Promise<void> {
    await this.writeContract('deposit', [], amount);
  }

  async requestKeyRotation(): Promise<bigint> {
    const hash = await this.writeContract('requestKeyRotation');
    // Would need to parse event logs to get the request ID
    console.log('Key rotation requested, tx:', hash);
    return 0n;
  }

  async approveKeyRotation(requestId: bigint): Promise<void> {
    await this.writeContract('approveKeyRotation', [requestId]);
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createTreasuryAdapter(
  config?: Partial<TreasuryConfig>
): TreasuryAdapter {
  const mode =
    config?.mode ??
    (process.env.NODE_ENV === 'production' ? 'production' : 'dev');

  const fullConfig: TreasuryConfig = {
    mode,
    contractAddress: (process.env.BABYLON_TREASURY_ADDRESS ??
      config?.contractAddress) as Address,
    rpcUrl: process.env.RPC_URL ?? config?.rpcUrl,
    privateKey: process.env.OPERATOR_PRIVATE_KEY as Hex,
    initialBalance: config?.initialBalance,
    dailyLimit: config?.dailyLimit,
    ...config,
  };

  if (mode === 'production') {
    return new ProductionTreasury(fullConfig);
  }

  return new DevModeTreasury(fullConfig);
}

/**
 * Check if we're in dev mode (no Jeju required)
 */
export function isDevMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    !process.env.BABYLON_TREASURY_ADDRESS
  );
}

/**
 * Get the appropriate treasury for the current environment
 */
export function getTreasury(): TreasuryAdapter {
  return createTreasuryAdapter();
}
