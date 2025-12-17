/**
 * ICO Automation Service
 *
 * Orchestrates the BBLN token ICO with time-based automation:
 * - Presale phase management (whitelist → public → ended)
 * - TGE (Token Generation Event) execution
 * - Liquidity pool creation via Jeju XLP AMM
 * - Airdrop snapshot and distribution
 * - NPC treasury funding
 *
 * @packageDocumentation
 */

import { logger } from '@babylon/shared';
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type PublicClient,
  parseEther,
  parseUnits,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface ICOConfig {
  // Network
  chainId: number;
  rpcUrl: string;

  // Deployment keys (configurable for multisig later)
  deployerPrivateKey: `0x${string}`;
  treasuryAddress: Address;

  // Token Configuration
  tokenAddress: Address;
  presaleAddress: Address;
  lpLockerAddress: Address;
  xlpV2FactoryAddress: Address;
  wethAddress: Address;

  // Presale Parameters
  presale: {
    tokensForSale: bigint;
    softCapEth: bigint;
    hardCapEth: bigint;
    minBidEth: bigint;
    maxBidEth: bigint;
    presalePrice: bigint; // wei per token
    lpFundingBps: number; // % of raised ETH to LP (e.g., 2000 = 20%)
    lpLockDuration: number; // seconds (e.g., 180 days)
    buyerLockDuration: number; // seconds before buyers can claim
    presaleDuration: number; // seconds
  };

  // ELIZA Token Configuration
  elizaToken: {
    mainnet: Address;
    base: Address;
    bsc: Address;
  };
  elizaMinBalance: bigint;
  elizaBonusBps: number; // e.g., 5000 = 50% bonus

  // Timeline (Unix timestamps, 0 = start immediately in dev)
  timeline: {
    presaleStart: number;
    tgeTimestamp: number;
  };

  // Feature Flags
  devMode: boolean;
  autoStartPresale: boolean;
}

export interface ICOPhase {
  name:
    | 'NOT_STARTED'
    | 'PRESALE_ACTIVE'
    | 'PRESALE_ENDED'
    | 'TGE_COMPLETE'
    | 'FAILED';
  timestamp: number;
  details: string;
}

export interface PresaleStats {
  totalRaised: bigint;
  totalParticipants: number;
  tokensAllocated: bigint;
  progress: number; // 0-10000 bps
  timeRemaining: number;
  isActive: boolean;
  isFinalized: boolean;
  isFailed: boolean;
}

export interface TGEResult {
  success: boolean;
  lpPairAddress: Address;
  lpTokensLocked: bigint;
  tokensDistributed: bigint;
  ethToTreasury: bigint;
  ethToLiquidity: bigint;
  txHash: `0x${string}`;
}

export interface ContributorInfo {
  address: Address;
  ethAmount: bigint;
  tokenAllocation: bigint;
  claimedTokens: bigint;
  claimable: bigint;
  isRefunded: boolean;
  elizaBonus: bigint;
}

// =============================================================================
// CONTRACT ABIs
// =============================================================================

const ICO_PRESALE_ABI = [
  {
    name: 'startPresale',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'contribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'finalize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'refund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'raised', type: 'uint256' },
      { name: 'participants', type: 'uint256' },
      { name: 'progress', type: 'uint256' },
      { name: 'timeRemaining', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isFinalized', type: 'bool' },
      { name: 'isFailed', type: 'bool' },
    ],
  },
  {
    name: 'getContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'contributor', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAllocation', type: 'uint256' },
      { name: 'claimedTokens', type: 'uint256' },
      { name: 'claimable', type: 'uint256' },
      { name: 'isRefunded', type: 'bool' },
    ],
  },
  {
    name: 'presaleStart',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'presaleEnd',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalRaised',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalParticipants',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'finalized',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'failed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'lpPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'buyerClaimStart',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const ELIZA_TOKEN_ADDRESSES = {
  mainnet: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
  base: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
  bsc: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
};

const DEFAULT_PRESALE_CONFIG = {
  tokensForSale: parseUnits('100000000', 18), // 100M BBLN (10% of supply)
  softCapEth: parseEther('500'), // 500 ETH soft cap
  hardCapEth: parseEther('5000'), // 5000 ETH hard cap
  minBidEth: parseEther('0.1'), // 0.1 ETH min
  maxBidEth: parseEther('100'), // 100 ETH max per wallet
  presalePrice: parseEther('0.00005'), // 0.00005 ETH per token = $0.18 at $3600/ETH
  lpFundingBps: 2000, // 20% of raised ETH goes to LP
  lpLockDuration: 180 * 24 * 60 * 60, // 180 days
  buyerLockDuration: 0, // Instant claim at TGE
  presaleDuration: 7 * 24 * 60 * 60, // 7 days
};

// =============================================================================
// ICO AUTOMATION SERVICE
// =============================================================================

export class ICOAutomationService {
  private config: ICOConfig;
  private chain: Chain;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

  constructor(config: Partial<ICOConfig> = {}) {
    const chainId = config.chainId ?? parseInt(process.env.CHAIN_ID ?? '1');
    this.chain = chainId === 1 ? mainnet : sepolia;

    this.config = {
      chainId,
      rpcUrl:
        config.rpcUrl ?? process.env.ETH_RPC_URL ?? 'http://localhost:8545',
      deployerPrivateKey:
        config.deployerPrivateKey ??
        (process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`) ??
        '0x0',
      treasuryAddress:
        config.treasuryAddress ??
        (process.env.TREASURY_ADDRESS as Address) ??
        '0x0000000000000000000000000000000000000000',
      tokenAddress:
        config.tokenAddress ??
        (process.env.BBLN_TOKEN_ADDRESS as Address) ??
        '0x0000000000000000000000000000000000000000',
      presaleAddress:
        config.presaleAddress ??
        (process.env.BBLN_PRESALE_ADDRESS as Address) ??
        '0x0000000000000000000000000000000000000000',
      lpLockerAddress:
        config.lpLockerAddress ??
        (process.env.LP_LOCKER_ADDRESS as Address) ??
        '0x0000000000000000000000000000000000000000',
      xlpV2FactoryAddress:
        config.xlpV2FactoryAddress ??
        (process.env.XLP_V2_FACTORY_ADDRESS as Address) ??
        '0x0000000000000000000000000000000000000000',
      wethAddress:
        config.wethAddress ??
        (process.env.WETH_ADDRESS as Address) ??
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Mainnet WETH
      presale: {
        ...DEFAULT_PRESALE_CONFIG,
        ...config.presale,
      },
      elizaToken: config.elizaToken ?? ELIZA_TOKEN_ADDRESSES,
      elizaMinBalance: config.elizaMinBalance ?? parseUnits('1000', 18), // 1000 ELIZA
      elizaBonusBps: config.elizaBonusBps ?? 5000, // 50% bonus
      timeline: {
        presaleStart: config.timeline?.presaleStart ?? 0,
        tgeTimestamp: config.timeline?.tgeTimestamp ?? 0,
      },
      devMode: config.devMode ?? process.env.NODE_ENV !== 'production',
      autoStartPresale: config.autoStartPresale ?? false,
    };

    this.account = privateKeyToAccount(this.config.deployerPrivateKey);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    }) as PublicClient;

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    }) as WalletClient;
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info(
      'Initializing ICO Automation Service',
      {
        chainId: this.config.chainId,
        devMode: this.config.devMode,
        tokenAddress: this.config.tokenAddress,
        presaleAddress: this.config.presaleAddress,
      },
      'ICOAutomation'
    );

    // Validate configuration
    await this.validateConfiguration();

    // Schedule automated tasks if timeline is set
    if (this.config.timeline.presaleStart > 0) {
      this.schedulePresaleStart();
    }

    if (this.config.timeline.tgeTimestamp > 0) {
      this.scheduleTGE();
    }

    // Auto-start presale in dev mode if configured
    if (this.config.devMode && this.config.autoStartPresale) {
      logger.info(
        'Dev mode: Auto-starting presale',
        undefined,
        'ICOAutomation'
      );
      await this.startPresale();
    }

    this.initialized = true;
    logger.info(
      'ICO Automation Service initialized',
      undefined,
      'ICOAutomation'
    );
  }

  private async validateConfiguration(): Promise<void> {
    // Check deployer has balance
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });

    if (balance < parseEther('0.1')) {
      logger.warn(
        'Deployer has low ETH balance',
        { balance: formatEther(balance) },
        'ICOAutomation'
      );
    }

    // Check token contract exists
    if (
      this.config.tokenAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      const code = await this.publicClient.getCode({
        address: this.config.tokenAddress,
      });
      if (!code || code === '0x') {
        logger.warn('Token contract not deployed', undefined, 'ICOAutomation');
      }
    }
  }

  // ===========================================================================
  // PHASE MANAGEMENT
  // ===========================================================================

  async getCurrentPhase(): Promise<ICOPhase> {
    if (
      this.config.presaleAddress ===
      '0x0000000000000000000000000000000000000000'
    ) {
      return {
        name: 'NOT_STARTED',
        timestamp: Date.now(),
        details: 'Presale contract not deployed',
      };
    }

    const [presaleStart, finalized, failed] = await Promise.all([
      this.publicClient.readContract({
        address: this.config.presaleAddress,
        abi: ICO_PRESALE_ABI,
        functionName: 'presaleStart',
      }),
      this.publicClient.readContract({
        address: this.config.presaleAddress,
        abi: ICO_PRESALE_ABI,
        functionName: 'finalized',
      }),
      this.publicClient.readContract({
        address: this.config.presaleAddress,
        abi: ICO_PRESALE_ABI,
        functionName: 'failed',
      }),
    ]);

    const now = Math.floor(Date.now() / 1000);

    if (presaleStart === 0n) {
      return {
        name: 'NOT_STARTED',
        timestamp: now,
        details: 'Presale not yet started',
      };
    }

    if (failed) {
      return {
        name: 'FAILED',
        timestamp: now,
        details: 'Presale failed - soft cap not reached',
      };
    }

    if (finalized) {
      return {
        name: 'TGE_COMPLETE',
        timestamp: now,
        details: 'TGE complete - tokens distributed',
      };
    }

    const presaleEnd = await this.publicClient.readContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'presaleEnd',
    });

    if (now < Number(presaleEnd)) {
      return {
        name: 'PRESALE_ACTIVE',
        timestamp: now,
        details: `Presale active - ${Number(presaleEnd) - now} seconds remaining`,
      };
    }

    return {
      name: 'PRESALE_ENDED',
      timestamp: now,
      details: 'Presale ended - awaiting finalization',
    };
  }

  async getPresaleStats(): Promise<PresaleStats> {
    if (
      this.config.presaleAddress ===
      '0x0000000000000000000000000000000000000000'
    ) {
      return {
        totalRaised: 0n,
        totalParticipants: 0,
        tokensAllocated: 0n,
        progress: 0,
        timeRemaining: 0,
        isActive: false,
        isFinalized: false,
        isFailed: false,
      };
    }

    const status = await this.publicClient.readContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'getStatus',
    });

    const [
      raised,
      participants,
      progress,
      timeRemaining,
      isActive,
      isFinalized,
      isFailed,
    ] = status as [bigint, bigint, bigint, bigint, boolean, boolean, boolean];

    // Calculate tokens allocated from raised ETH
    const tokensAllocated =
      this.config.presale.presalePrice > 0n
        ? (raised * parseUnits('1', 18)) / this.config.presale.presalePrice
        : 0n;

    return {
      totalRaised: raised,
      totalParticipants: Number(participants),
      tokensAllocated,
      progress: Number(progress),
      timeRemaining: Number(timeRemaining),
      isActive,
      isFinalized,
      isFailed,
    };
  }

  // ===========================================================================
  // PRESALE OPERATIONS
  // ===========================================================================

  async startPresale(): Promise<`0x${string}`> {
    logger.info('Starting presale', undefined, 'ICOAutomation');

    const txHash = await this.walletClient.writeContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'startPresale',
      chain: this.chain,
      account: this.account,
    });

    logger.info('Presale started', { txHash }, 'ICOAutomation');

    // Wait for confirmation
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    return txHash;
  }

  async contribute(amountEth: bigint): Promise<`0x${string}`> {
    const txHash = await this.walletClient.writeContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'contribute',
      value: amountEth,
      chain: this.chain,
      account: this.account,
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    logger.info(
      'Contribution made',
      { amount: formatEther(amountEth), txHash },
      'ICOAutomation'
    );

    return txHash;
  }

  async getContribution(address: Address): Promise<ContributorInfo> {
    const contribution = await this.publicClient.readContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'getContribution',
      args: [address],
    });

    const [ethAmount, tokenAllocation, claimedTokens, claimable, isRefunded] =
      contribution as [bigint, bigint, bigint, bigint, boolean];

    // Check ELIZA bonus
    const elizaBonus = await this.calculateElizaBonus(address, tokenAllocation);

    return {
      address,
      ethAmount,
      tokenAllocation,
      claimedTokens,
      claimable,
      isRefunded,
      elizaBonus,
    };
  }

  // ===========================================================================
  // ELIZA HOLDER VERIFICATION
  // ===========================================================================

  async checkElizaHolder(address: Address): Promise<boolean> {
    // Check ELIZA balance on mainnet
    const elizaBalance = await this.publicClient.readContract({
      address: this.config.elizaToken.mainnet,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    return elizaBalance >= this.config.elizaMinBalance;
  }

  async calculateElizaBonus(
    address: Address,
    baseAllocation: bigint
  ): Promise<bigint> {
    const isElizaHolder = await this.checkElizaHolder(address);
    if (!isElizaHolder) return 0n;

    return (baseAllocation * BigInt(this.config.elizaBonusBps)) / 10000n;
  }

  // ===========================================================================
  // TGE (TOKEN GENERATION EVENT)
  // ===========================================================================

  async finalize(): Promise<TGEResult> {
    logger.info(
      'Finalizing presale and executing TGE',
      undefined,
      'ICOAutomation'
    );

    // Get stats before finalization
    const statsBefore = await this.getPresaleStats();

    // Execute finalization
    const txHash = await this.walletClient.writeContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'finalize',
      chain: this.chain,
      account: this.account,
    });

    // Wait for confirmation
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    // Check if failed (soft cap not reached)
    const failed = await this.publicClient.readContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'failed',
    });

    if (failed) {
      logger.warn(
        'Presale failed - soft cap not reached',
        { raised: formatEther(statsBefore.totalRaised) },
        'ICOAutomation'
      );

      return {
        success: false,
        lpPairAddress: '0x0000000000000000000000000000000000000000' as Address,
        lpTokensLocked: 0n,
        tokensDistributed: 0n,
        ethToTreasury: 0n,
        ethToLiquidity: 0n,
        txHash,
      };
    }

    // Get LP pair address from presale contract
    const lpPair = await this.publicClient.readContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'lpPair',
    });

    // Calculate distribution
    const ethToLiquidity =
      (statsBefore.totalRaised * BigInt(this.config.presale.lpFundingBps)) /
      10000n;
    const ethToTreasury = statsBefore.totalRaised - ethToLiquidity;

    logger.info(
      'TGE completed successfully',
      {
        txHash,
        lpPair,
        totalRaised: formatEther(statsBefore.totalRaised),
        ethToLiquidity: formatEther(ethToLiquidity),
        ethToTreasury: formatEther(ethToTreasury),
        participants: statsBefore.totalParticipants,
      },
      'ICOAutomation'
    );

    return {
      success: true,
      lpPairAddress: lpPair as Address,
      lpTokensLocked: 0n, // Would need to query LP locker
      tokensDistributed: statsBefore.tokensAllocated,
      ethToTreasury,
      ethToLiquidity,
      txHash,
    };
  }

  // ===========================================================================
  // CLAIM AND REFUND
  // ===========================================================================

  async claim(): Promise<`0x${string}`> {
    const txHash = await this.walletClient.writeContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'claim',
      chain: this.chain,
      account: this.account,
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    logger.info('Tokens claimed', { txHash }, 'ICOAutomation');

    return txHash;
  }

  async refund(): Promise<`0x${string}`> {
    const txHash = await this.walletClient.writeContract({
      address: this.config.presaleAddress,
      abi: ICO_PRESALE_ABI,
      functionName: 'refund',
      chain: this.chain,
      account: this.account,
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    logger.info('Refund claimed', { txHash }, 'ICOAutomation');

    return txHash;
  }

  // ===========================================================================
  // SCHEDULING
  // ===========================================================================

  private schedulePresaleStart(): void {
    const now = Date.now();
    const startTime = this.config.timeline.presaleStart * 1000;
    const delay = startTime - now;

    if (delay <= 0) {
      logger.info(
        'Presale start time already passed',
        undefined,
        'ICOAutomation'
      );
      return;
    }

    logger.info(
      'Scheduling presale start',
      { startTime: new Date(startTime).toISOString(), delayMs: delay },
      'ICOAutomation'
    );

    const timeout = setTimeout(async () => {
      await this.startPresale();
    }, delay);

    this.scheduledTasks.set('presale_start', timeout);
  }

  private scheduleTGE(): void {
    const now = Date.now();
    const tgeTime = this.config.timeline.tgeTimestamp * 1000;
    const delay = tgeTime - now;

    if (delay <= 0) {
      logger.info('TGE time already passed', undefined, 'ICOAutomation');
      return;
    }

    logger.info(
      'Scheduling TGE',
      { tgeTime: new Date(tgeTime).toISOString(), delayMs: delay },
      'ICOAutomation'
    );

    const timeout = setTimeout(async () => {
      await this.finalize();
    }, delay);

    this.scheduledTasks.set('tge', timeout);
  }

  scheduleTask(
    taskId: string,
    executeAt: number,
    task: () => Promise<void>
  ): void {
    const now = Date.now();
    const delay = executeAt * 1000 - now;

    if (delay <= 0) {
      logger.warn(
        `Task ${taskId} time already passed`,
        undefined,
        'ICOAutomation'
      );
      return;
    }

    const timeout = setTimeout(task, delay);
    this.scheduledTasks.set(taskId, timeout);

    logger.info(
      `Scheduled task: ${taskId}`,
      { executeAt: new Date(executeAt * 1000).toISOString() },
      'ICOAutomation'
    );
  }

  cancelTask(taskId: string): boolean {
    const timeout = this.scheduledTasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTasks.delete(taskId);
      logger.info(`Cancelled task: ${taskId}`, undefined, 'ICOAutomation');
      return true;
    }
    return false;
  }

  // ===========================================================================
  // AIRDROP INTEGRATION
  // ===========================================================================

  async triggerAirdropSnapshot(): Promise<void> {
    // Import airdrop service lazily to avoid circular dependencies
    const { getAirdropBonusService } = await import('./airdrop-bonus-service');
    const airdropService = getAirdropBonusService();

    const now = new Date();
    await airdropService.initializeBonusPeriod(now);
    await airdropService.takePointsSnapshot();

    logger.info('Airdrop snapshot triggered', undefined, 'ICOAutomation');
  }

  // ===========================================================================
  // NPC FUNDING
  // ===========================================================================

  async fundNPCsFromTreasury(): Promise<void> {
    // NPC funding is handled by the agents package via NPCTokenWalletService
    // This method can be called from external orchestration once agents package is wired up
    logger.info(
      'NPC funding triggered - would call NPCTokenWalletService.fundAllNPCsFromTreasury',
      { treasuryAddress: this.config.treasuryAddress },
      'ICOAutomation'
    );
  }

  // ===========================================================================
  // STATUS & CLEANUP
  // ===========================================================================

  getConfig(): ICOConfig {
    return { ...this.config };
  }

  async getFullStatus(): Promise<{
    phase: ICOPhase;
    stats: PresaleStats;
    config: ICOConfig;
    scheduledTasks: string[];
  }> {
    const [phase, stats] = await Promise.all([
      this.getCurrentPhase(),
      this.getPresaleStats(),
    ]);

    return {
      phase,
      stats,
      config: this.getConfig(),
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
    };
  }

  shutdown(): void {
    for (const [taskId, timeout] of this.scheduledTasks) {
      clearTimeout(timeout);
      logger.info(`Cancelled task: ${taskId}`, undefined, 'ICOAutomation');
    }
    this.scheduledTasks.clear();
    this.initialized = false;
    logger.info('ICO Automation Service shut down', undefined, 'ICOAutomation');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let icoAutomationService: ICOAutomationService | null = null;

export function getICOAutomationService(
  config?: Partial<ICOConfig>
): ICOAutomationService {
  if (!icoAutomationService) {
    icoAutomationService = new ICOAutomationService(config);
  }
  return icoAutomationService;
}

export async function initializeICOAutomation(
  config?: Partial<ICOConfig>
): Promise<ICOAutomationService> {
  const service = getICOAutomationService(config);
  await service.initialize();
  return service;
}

export function resetICOAutomationService(): void {
  if (icoAutomationService) {
    icoAutomationService.shutdown();
  }
  icoAutomationService = null;
}
