/**
 * Babylon Smart Contracts
 *
 * Contract ABIs and deployment addresses for Babylon on Jeju Network.
 * All contracts deploy via Jeju CLI auto-deployment.
 */

import type { Abi, Address } from 'viem';

// ============================================================================
// Contract ABIs (minimal for TypeScript usage)
// ============================================================================

export const BabylonTreasuryABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawal',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi;

export const BanManagerABI = [
  {
    type: 'function',
    name: 'isNetworkBanned',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAppBanned',
    inputs: [
      { name: 'appId', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'banNetwork',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidence', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'banApp',
    inputs: [
      { name: 'appId', type: 'bytes32' },
      { name: 'user', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidence', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbanNetwork',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbanApp',
    inputs: [
      { name: 'appId', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'NetworkBan',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AppBan',
    inputs: [
      { name: 'appId', type: 'bytes32', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const satisfies Abi;

export const ModerationMarketplaceABI = [
  {
    type: 'function',
    name: 'reportUser',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidence', type: 'bytes32' },
    ],
    outputs: [{ name: 'caseId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'stakeOnOutcome',
    inputs: [
      { name: 'caseId', type: 'uint256' },
      { name: 'forBan', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'resolveCase',
    inputs: [{ name: 'caseId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [{ name: 'caseId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getCase',
    inputs: [{ name: 'caseId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'target', type: 'address' },
          { name: 'reporter', type: 'address' },
          { name: 'reason', type: 'string' },
          { name: 'evidence', type: 'bytes32' },
          { name: 'stakeForBan', type: 'uint256' },
          { name: 'stakeAgainstBan', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'banned', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'resolvedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CaseCreated',
    inputs: [
      { name: 'caseId', type: 'uint256', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'reporter', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CaseResolved',
    inputs: [
      { name: 'caseId', type: 'uint256', indexed: true },
      { name: 'banned', type: 'bool', indexed: false },
    ],
  },
] as const satisfies Abi;

export const X402FacilitatorABI = [
  {
    type: 'function',
    name: 'settlePayment',
    inputs: [
      { name: 'paymentId', type: 'bytes32' },
      { name: 'payer', type: 'address' },
      { name: 'payee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPayment',
    inputs: [{ name: 'paymentId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'payer', type: 'address' },
          { name: 'payee', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'settled', type: 'bool' },
          { name: 'settledAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PaymentSettled',
    inputs: [
      { name: 'paymentId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'payee', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi;

// ============================================================================
// DAO Contract ABIs
// ============================================================================

export const BabylonDAOABI = [
  {
    type: 'function',
    name: 'createProposal',
    inputs: [
      { name: 'proposalType', type: 'uint8' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'reasoning', type: 'string' },
      { name: 'attestation', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createAndExecute',
    inputs: [
      { name: 'proposalType', type: 'uint8' },
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'reasoning', type: 'string' },
      { name: 'attestation', type: 'bytes32' },
    ],
    outputs: [
      { name: '', type: 'bytes32' },
      { name: '', type: 'bool' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeProposal',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getProposal',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'proposalId', type: 'bytes32' },
          { name: 'proposalType', type: 'uint8' },
          { name: 'target', type: 'address' },
          { name: 'data', type: 'bytes' },
          { name: 'value', type: 'uint256' },
          { name: 'description', type: 'string' },
          { name: 'reasoning', type: 'string' },
          { name: 'attestation', type: 'bytes32' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'executeAfter', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'vetoable', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'aiCEO',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canExecute',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposalId', type: 'bytes32', indexed: true },
      { name: 'proposalType', type: 'uint8', indexed: false },
      { name: 'target', type: 'address', indexed: true },
      { name: 'description', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalExecuted',
    inputs: [
      { name: 'proposalId', type: 'bytes32', indexed: true },
      { name: 'success', type: 'bool', indexed: false },
    ],
  },
] as const satisfies Abi;

export const BabylonAgentVaultABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'spend',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'uint8' },
      { name: 'reason', type: 'string' },
      { name: 'jobId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reserve',
    inputs: [
      { name: 'jobId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAvailableBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStats',
    inputs: [],
    outputs: [
      { name: '_balance', type: 'uint256' },
      { name: '_reserved', type: 'uint256' },
      { name: '_available', type: 'uint256' },
      { name: '_totalDeposits', type: 'uint256' },
      { name: '_totalSpent', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Spent',
    inputs: [
      { name: 'spender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'category', type: 'uint8', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'jobId', type: 'bytes32', indexed: false },
    ],
  },
] as const satisfies Abi;

export const TrainingOrchestratorABI = [
  {
    type: 'function',
    name: 'createJob',
    inputs: [
      { name: 'archetype', type: 'string' },
      { name: 'datasetCid', type: 'bytes32' },
      { name: 'trajectoryCount', type: 'uint256' },
      { name: 'baseModelCid', type: 'bytes32' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'estimatedCost', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordTrajectories',
    inputs: [
      { name: 'archetype', type: 'string' },
      { name: 'count', type: 'uint256' },
      { name: 'batchCid', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canStartTraining',
    inputs: [{ name: 'archetype', type: 'string' }],
    outputs: [
      { name: 'canStart', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getJob',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'jobId', type: 'bytes32' },
          { name: 'archetype', type: 'string' },
          { name: 'datasetCid', type: 'bytes32' },
          { name: 'trajectoryCount', type: 'uint256' },
          { name: 'baseModelCid', type: 'bytes32' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'benchmarkScore', type: 'uint256' },
          { name: 'outputModelCid', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeJob',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStats',
    inputs: [],
    outputs: [
      { name: '_totalJobs', type: 'uint256' },
      { name: '_completedJobs', type: 'uint256' },
      { name: '_totalCost', type: 'uint256' },
      { name: '_hasActiveJob', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TrainingJobCreated',
    inputs: [
      { name: 'jobId', type: 'bytes32', indexed: true },
      { name: 'archetype', type: 'string', indexed: false },
      { name: 'trajectoryCount', type: 'uint256', indexed: false },
      { name: 'submitter', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'TrainingJobCompleted',
    inputs: [
      { name: 'jobId', type: 'bytes32', indexed: true },
      { name: 'outputModelCid', type: 'bytes32', indexed: false },
      { name: 'benchmarkScore', type: 'uint256', indexed: false },
      { name: 'improvement', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TrajectoriesRecorded',
    inputs: [
      { name: 'archetype', type: 'string', indexed: false },
      { name: 'count', type: 'uint256', indexed: false },
      { name: 'total', type: 'uint256', indexed: false },
    ],
  },
] as const satisfies Abi;

export const PaymasterABI = [
  {
    type: 'function',
    name: 'validatePaymasterUserOp',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'userOpHash', type: 'bytes32' },
      { name: 'maxCost', type: 'uint256' },
    ],
    outputs: [
      { name: 'context', type: 'bytes' },
      { name: 'validationData', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'postOp',
    inputs: [
      { name: 'mode', type: 'uint8' },
      { name: 'context', type: 'bytes' },
      { name: 'actualGasCost', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getDeposit',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const satisfies Abi;

// ============================================================================
// Contract Addresses
// ============================================================================

export interface ContractAddresses {
  // Network info
  network: string;
  chainId: number;
  // DAO Infrastructure
  dao: Address;
  agentVault: Address;
  treasury: Address;
  trainingOrchestrator: Address;
  // Legacy/Other
  banManager: Address;
  moderationMarketplace: Address;
  x402Facilitator: Address;
  paymaster: Address;
  entryPoint: Address;
  // Additional registries used by services
  identityRegistry: Address;
  reputationSystem: Address;
  diamond: Address;
  serverRegistry: Address;
  modelRegistry: Address;
  jobRegistry: Address;
  gameOracle: Address;
}

// Addresses are loaded from environment or Jeju deployment registry
function getAddresses(): ContractAddresses {
  const ZERO = '0x0000000000000000000000000000000000000000' as Address;
  const chainIdEnv = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  const chainId = chainIdEnv ? Number.parseInt(chainIdEnv, 10) : 31337;
  const network =
    chainId === 31337
      ? 'localnet'
      : chainId === 84532
        ? 'base-sepolia'
        : chainId === 8453
          ? 'base'
          : 'unknown';
  return {
    // Network info
    network,
    chainId,
    // DAO Infrastructure
    dao: (process.env.BABYLON_DAO_ADDRESS ?? ZERO) as Address,
    agentVault: (process.env.BABYLON_AGENT_VAULT_ADDRESS ?? ZERO) as Address,
    treasury: (process.env.BABYLON_TREASURY_ADDRESS ?? ZERO) as Address,
    trainingOrchestrator: (process.env.TRAINING_ORCHESTRATOR_ADDRESS ??
      ZERO) as Address,
    // Legacy/Other
    banManager: (process.env.BAN_MANAGER_ADDRESS ?? ZERO) as Address,
    moderationMarketplace: (process.env.MODERATION_MARKETPLACE_ADDRESS ??
      ZERO) as Address,
    x402Facilitator: (process.env.X402_FACILITATOR_ADDRESS ?? ZERO) as Address,
    paymaster: (process.env.BABYLON_PAYMASTER_ADDRESS ?? ZERO) as Address,
    entryPoint: (process.env.ENTRY_POINT_ADDRESS ??
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789') as Address,
    // Registries
    identityRegistry: (process.env.IDENTITY_REGISTRY_ADDRESS ??
      ZERO) as Address,
    reputationSystem: (process.env.REPUTATION_SYSTEM_ADDRESS ??
      ZERO) as Address,
    diamond: (process.env.BABYLON_DIAMOND_ADDRESS ?? ZERO) as Address,
    serverRegistry: (process.env.SERVER_REGISTRY_ADDRESS ?? ZERO) as Address,
    modelRegistry: (process.env.MODEL_REGISTRY_ADDRESS ?? ZERO) as Address,
    jobRegistry: (process.env.JOB_REGISTRY_ADDRESS ?? ZERO) as Address,
    gameOracle: (process.env.GAME_ORACLE_ADDRESS ?? ZERO) as Address,
  };
}

export const ADDRESSES = getAddresses();

// ============================================================================
// Helper Functions
// ============================================================================

type AddressKeys = Exclude<keyof ContractAddresses, 'network' | 'chainId'>;

export function isContractDeployed(name: AddressKeys): boolean {
  const addr = ADDRESSES[name];
  return addr !== '0x0000000000000000000000000000000000000000';
}

export function requireContractDeployed(name: AddressKeys): Address {
  const addr = ADDRESSES[name];
  if (addr === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      `Contract ${name} not deployed. Run Jeju CLI to deploy contracts.`
    );
  }
  return addr;
}

// ============================================================================
// Chain Configuration
// ============================================================================

export const JEJU_CHAIN_ID = parseInt(process.env.CHAIN_ID ?? '420691', 10);
export const JEJU_RPC_URL = process.env.RPC_URL ?? 'http://localhost:8545';

// ============================================================================
// App ID for Babylon (used in BanManager)
// ============================================================================

export const BABYLON_APP_ID =
  '0x6261627966666f6e00000000000000000000000000000000000000000000000000' as `0x${string}`; // "babylon" padded to bytes32

// ============================================================================
// Helper Functions
// ============================================================================

export function getContractAddresses(): ContractAddresses {
  return ADDRESSES;
}

export function getRpcUrl(): string {
  return JEJU_RPC_URL;
}

// ============================================================================
// Registry Types and Client (for decentralized orchestrator)
// ============================================================================

export interface RegistryAddresses {
  serverRegistry: Address;
  modelRegistry: Address;
  jobRegistry: Address;
}

export enum ServerStatus {
  Inactive = 0,
  Active = 1,
  Stale = 2,
  Terminated = 3,
  RUNNING = 1, // Alias for Active
}

export interface ServerInstance {
  id: `0x${string}`;
  instanceId: string;
  operator: Address;
  endpoint: string;
  status: ServerStatus;
  lastHeartbeat: bigint;
  registeredAt: bigint;
  attestation: `0x${string}`;
  checkpointCid: string | null;
  tickCount: number;
}

/**
 * Babylon Registry Client
 *
 * Manages on-chain server registration and heartbeats.
 * Part of the decentralized game server infrastructure.
 */
export interface BabylonRegistryClientConfig {
  addresses: RegistryAddresses;
  publicClient: import('viem').PublicClient;
  walletClient?: import('viem').WalletClient;
  chain?: import('viem').Chain;
}

export class BabylonRegistryClient {
  private publicClient: import('viem').PublicClient;
  private walletClient: import('viem').WalletClient | null = null;
  private addresses: RegistryAddresses;

  // Sub-clients for different registries
  readonly server: ServerRegistryClient;
  readonly model: ModelRegistryClient;
  readonly job: JobRegistryClient;

  constructor(config: BabylonRegistryClientConfig) {
    this.publicClient = config.publicClient;
    this.addresses = config.addresses;
    this.walletClient = config.walletClient ?? null;

    // Initialize sub-clients
    this.server = new ServerRegistryClient(
      config.addresses.serverRegistry,
      this.walletClient
    );
    this.model = new ModelRegistryClient(
      config.addresses.modelRegistry,
      this.walletClient
    );
    this.job = new JobRegistryClient(
      config.addresses.jobRegistry,
      this.walletClient
    );
  }

  async getServerInstance(
    serverId: `0x${string}`
  ): Promise<ServerInstance | null> {
    // In production, this would read from the ServerRegistry contract
    // For now, return null to indicate no registered server
    console.log('[Registry] getServerInstance called for:', serverId);
    return null;
  }

  async getActiveServers(): Promise<ServerInstance[]> {
    // In production, this would enumerate active servers from the registry
    return [];
  }

  async registerServer(
    endpoint: string,
    _attestation: `0x${string}`
  ): Promise<{ serverId: `0x${string}`; txHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new Error('[Registry] Wallet client required for registration');
    }
    // In production, this would call ServerRegistry.register()
    const serverId =
      `0x${Buffer.from(endpoint).toString('hex').padEnd(64, '0')}` as `0x${string}`;
    return { serverId, txHash: '0x0' as `0x${string}` };
  }

  async sendHeartbeat(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[Registry] Wallet client required for heartbeat');
    }
    // In production, this would call ServerRegistry.heartbeat()
    console.log('[Registry] Heartbeat for:', serverId);
    return '0x0' as `0x${string}`;
  }

  async claimStaleServer(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[Registry] Wallet client required for claiming');
    }
    // In production, this would call ServerRegistry.claimStale()
    console.log('[Registry] Claiming stale server:', serverId);
    return '0x0' as `0x${string}`;
  }

  async terminateServer(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[Registry] Wallet client required for termination');
    }
    // In production, this would call ServerRegistry.terminate()
    console.log('[Registry] Terminating server:', serverId);
    return '0x0' as `0x${string}`;
  }

  getAddresses(): RegistryAddresses {
    return this.addresses;
  }

  getPublicClient(): import('viem').PublicClient {
    return this.publicClient;
  }
}

// ============================================================================
// Sub-Registry Clients
// ============================================================================

class ServerRegistryClient {
  private contractAddress: Address;
  private walletClient: import('viem').WalletClient | null;

  constructor(
    address: Address,
    walletClient: import('viem').WalletClient | null
  ) {
    this.contractAddress = address;
    this.walletClient = walletClient;
  }

  getAddress(): Address {
    return this.contractAddress;
  }

  async getServerInstance(
    serverId: `0x${string}`
  ): Promise<ServerInstance | null> {
    console.log('[ServerRegistry] getServerInstance:', serverId);
    return null;
  }

  async getActiveInstance(): Promise<ServerInstance | null> {
    return null;
  }

  async getActiveServers(): Promise<ServerInstance[]> {
    return [];
  }

  async isActiveStale(): Promise<boolean> {
    return false;
  }

  async register(
    endpoint: string,
    _attestation: `0x${string}`
  ): Promise<{ serverId: `0x${string}`; txHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new Error('[ServerRegistry] Wallet required');
    }
    const serverId =
      `0x${Buffer.from(endpoint).toString('hex').padEnd(64, '0')}` as `0x${string}`;
    return { serverId, txHash: '0x0' as `0x${string}` };
  }

  async registerInstance(config: {
    endpoint: string;
    attestationHash?: `0x${string}`;
    stake?: bigint;
  }): Promise<{ instanceId: string; txHash: `0x${string}` }> {
    const result = await this.register(
      config.endpoint,
      config.attestationHash ?? '0x0'
    );
    return { instanceId: result.serverId, txHash: result.txHash };
  }

  async heartbeat(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[ServerRegistry] Wallet required');
    }
    console.log('[ServerRegistry] Heartbeat:', serverId);
    return '0x0' as `0x${string}`;
  }

  async claimStale(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[ServerRegistry] Wallet required');
    }
    console.log('[ServerRegistry] Claim stale:', serverId);
    return '0x0' as `0x${string}`;
  }

  async claimStaleInstance(config: {
    attestationHash?: `0x${string}`;
    endpoint?: string;
    stake?: bigint;
  }): Promise<{ instanceId: string; txHash: `0x${string}` }> {
    console.log('[ServerRegistry] Claim stale instance:', config);
    return { instanceId: '0x0', txHash: '0x0' as `0x${string}` };
  }

  async terminate(serverId: `0x${string}`): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[ServerRegistry] Wallet required');
    }
    console.log('[ServerRegistry] Terminate:', serverId);
    return '0x0' as `0x${string}`;
  }

  async shutdown(): Promise<void> {
    console.log('[ServerRegistry] Shutdown');
  }

  async startInstance(_instanceId: string): Promise<void> {
    console.log('[ServerRegistry] Start instance');
  }

  async checkpoint(cid: string, stateHash: string): Promise<`0x${string}`> {
    console.log('[ServerRegistry] Checkpoint:', { cid, stateHash });
    return '0x0' as `0x${string}`;
  }

  async getLatestCheckpoint(): Promise<{
    cid: string;
    stateHash: string;
  } | null> {
    return null;
  }

  async updateCheckpoint(
    serverId: `0x${string}`,
    checkpointCid: string,
    tickCount: number
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('[ServerRegistry] Wallet required');
    }
    console.log('[ServerRegistry] Update checkpoint:', {
      serverId,
      checkpointCid,
      tickCount,
    });
    return '0x0' as `0x${string}`;
  }
}

class ModelRegistryClient {
  private contractAddress: Address;
  private walletClient: import('viem').WalletClient | null;

  constructor(
    address: Address,
    walletClient: import('viem').WalletClient | null
  ) {
    this.contractAddress = address;
    this.walletClient = walletClient;
  }

  getAddress(): Address {
    return this.contractAddress;
  }

  hasWallet(): boolean {
    return this.walletClient !== null;
  }
}

class JobRegistryClient {
  private contractAddress: Address;
  private walletClient: import('viem').WalletClient | null;

  constructor(
    address: Address,
    walletClient: import('viem').WalletClient | null
  ) {
    this.contractAddress = address;
    this.walletClient = walletClient;
  }

  getAddress(): Address {
    return this.contractAddress;
  }

  hasWallet(): boolean {
    return this.walletClient !== null;
  }
}
