/**
 * ELIZA Token Verification Service
 *
 * Verifies ELIZA OS token holdings for ICO bonus eligibility across chains:
 * - Ethereum Mainnet
 * - Base
 * - BSC
 *
 * Holders of ELIZA tokens receive a 50% bonus on their presale allocation.
 *
 * @packageDocumentation
 */

import { db, elizaHolders, eq, users } from '@babylon/db';
import { logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  type PublicClient,
  parseUnits,
  zeroAddress,
} from 'viem';
import { base, bsc, mainnet } from 'viem/chains';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * ELIZA OS token contract addresses by chain
 * Same address deployed on Ethereum Mainnet, Base, and BSC
 */
export const ELIZA_TOKEN_ADDRESSES = {
  mainnet: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
  base: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
  bsc: '0xea17df5cf6d172224892b5477a16acb111182478' as Address,
} as const;

/**
 * Minimum ELIZA balance required for bonus (1000 ELIZA)
 */
export const ELIZA_MIN_BALANCE = parseUnits('1000', 18);

/**
 * Bonus multiplier for ELIZA holders (5000 bps = 50%)
 */
export const ELIZA_BONUS_BPS = 5000;

/**
 * Chain configurations for verification
 */
const CHAIN_CONFIGS = {
  mainnet: {
    chain: mainnet,
    rpcUrl: process.env.MAINNET_RPC_URL ?? 'https://eth.llamarpc.com',
    tokenAddress: ELIZA_TOKEN_ADDRESSES.mainnet,
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    tokenAddress: ELIZA_TOKEN_ADDRESSES.base,
  },
  bsc: {
    chain: bsc,
    rpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    tokenAddress: ELIZA_TOKEN_ADDRESSES.bsc,
  },
} as const;

type SupportedChain = keyof typeof CHAIN_CONFIGS;

// =============================================================================
// TYPES
// =============================================================================

export interface ElizaHolderStatus {
  address: Address;
  isHolder: boolean;
  totalBalance: bigint;
  balanceByChain: {
    mainnet: bigint;
    base: bigint;
    bsc: bigint;
  };
  qualifiesForBonus: boolean;
  bonusMultiplierBps: number;
  verifiedAt: Date;
}

export interface ElizaVerificationResult {
  userId: string;
  walletAddress: Address;
  status: ElizaHolderStatus;
  bonusAmount: bigint;
  baseAllocation: bigint;
  totalAllocation: bigint;
}

export interface BatchVerificationResult {
  processed: number;
  qualified: number;
  totalBonusAllocated: bigint;
  errors: Array<{ userId: string; error: string }>;
}

// =============================================================================
// ABI
// =============================================================================

const ERC20_BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// =============================================================================
// SERVICE
// =============================================================================

export class ElizaVerificationService {
  private mainnetClient: PublicClient;
  private baseClient: PublicClient;
  private bscClient: PublicClient;
  private minBalance: bigint;
  private bonusBps: number;
  private cacheTimeout = 3600_000; // 1 hour cache
  private balanceCache: Map<string, { balance: bigint; timestamp: number }> =
    new Map();

  constructor(config: { minBalance?: bigint; bonusBps?: number } = {}) {
    this.minBalance = config.minBalance ?? ELIZA_MIN_BALANCE;
    this.bonusBps = config.bonusBps ?? ELIZA_BONUS_BPS;

    // Initialize clients for each chain
    this.mainnetClient = createPublicClient({
      chain: mainnet,
      transport: http(CHAIN_CONFIGS.mainnet.rpcUrl),
    }) as PublicClient;
    this.baseClient = createPublicClient({
      chain: base,
      transport: http(CHAIN_CONFIGS.base.rpcUrl),
    }) as PublicClient;
    this.bscClient = createPublicClient({
      chain: bsc,
      transport: http(CHAIN_CONFIGS.bsc.rpcUrl),
    }) as PublicClient;
  }

  private getClient(chain: SupportedChain) {
    switch (chain) {
      case 'mainnet':
        return this.mainnetClient;
      case 'base':
        return this.baseClient;
      case 'bsc':
        return this.bscClient;
    }
  }

  // ===========================================================================
  // BALANCE CHECKING
  // ===========================================================================

  /**
   * Get ELIZA balance on a specific chain
   */
  async getBalanceOnChain(
    address: Address,
    chain: SupportedChain
  ): Promise<bigint> {
    const cacheKey = `${address.toLowerCase()}-${chain}`;
    const cached = this.balanceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.balance;
    }

    const client = this.getClient(chain);
    const tokenAddress = CHAIN_CONFIGS[chain].tokenAddress;

    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    this.balanceCache.set(cacheKey, {
      balance,
      timestamp: Date.now(),
    });

    return balance;
  }

  /**
   * Get total ELIZA balance across all supported chains
   */
  async getTotalBalance(address: Address): Promise<{
    total: bigint;
    byChain: { mainnet: bigint; base: bigint; bsc: bigint };
  }> {
    const [mainnetBalance, baseBalance, bscBalance] = await Promise.all([
      this.getBalanceOnChain(address, 'mainnet'),
      this.getBalanceOnChain(address, 'base'),
      this.getBalanceOnChain(address, 'bsc'),
    ]);

    return {
      total: mainnetBalance + baseBalance + bscBalance,
      byChain: {
        mainnet: mainnetBalance,
        base: baseBalance,
        bsc: bscBalance,
      },
    };
  }

  // ===========================================================================
  // HOLDER VERIFICATION
  // ===========================================================================

  /**
   * Check if an address qualifies as an ELIZA holder
   */
  async checkHolderStatus(address: Address): Promise<ElizaHolderStatus> {
    const { total, byChain } = await this.getTotalBalance(address);
    const qualifiesForBonus = total >= this.minBalance;

    return {
      address,
      isHolder: total > BigInt(0),
      totalBalance: total,
      balanceByChain: byChain,
      qualifiesForBonus,
      bonusMultiplierBps: qualifiesForBonus ? this.bonusBps : 0,
      verifiedAt: new Date(),
    };
  }

  /**
   * Verify user's ELIZA holdings and calculate bonus allocation
   */
  async verifyAndCalculateBonus(
    userId: string,
    walletAddress: Address,
    baseAllocation: bigint
  ): Promise<ElizaVerificationResult> {
    const status = await this.checkHolderStatus(walletAddress);

    const bonusAmount = status.qualifiesForBonus
      ? (baseAllocation * BigInt(this.bonusBps)) / BigInt(10000)
      : BigInt(0);

    const totalAllocation = baseAllocation + bonusAmount;

    logger.info(
      'Verified ELIZA holdings',
      {
        userId,
        walletAddress,
        qualifies: status.qualifiesForBonus,
        totalEliza: formatUnits(status.totalBalance, 18),
        baseAllocation: formatUnits(baseAllocation, 18),
        bonusAmount: formatUnits(bonusAmount, 18),
      },
      'ElizaVerification'
    );

    return {
      userId,
      walletAddress,
      status,
      bonusAmount,
      baseAllocation,
      totalAllocation,
    };
  }

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================

  /**
   * Store verified ELIZA holder status in database
   */
  async storeHolderStatus(
    userId: string,
    walletAddress: Address,
    status: ElizaHolderStatus
  ): Promise<void> {
    // Check if elizaHolders table exists in schema
    // Using upsert pattern
    await db
      .insert(elizaHolders)
      .values({
        userId,
        walletAddress,
        totalBalance: status.totalBalance.toString(),
        mainnetBalance: status.balanceByChain.mainnet.toString(),
        baseBalance: status.balanceByChain.base.toString(),
        bscBalance: status.balanceByChain.bsc.toString(),
        qualifiesForBonus: status.qualifiesForBonus,
        verifiedAt: status.verifiedAt,
      })
      .onConflictDoUpdate({
        target: elizaHolders.userId,
        set: {
          walletAddress,
          totalBalance: status.totalBalance.toString(),
          mainnetBalance: status.balanceByChain.mainnet.toString(),
          baseBalance: status.balanceByChain.base.toString(),
          bscBalance: status.balanceByChain.bsc.toString(),
          qualifiesForBonus: status.qualifiesForBonus,
          verifiedAt: status.verifiedAt,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Get stored ELIZA holder status from database
   */
  async getStoredHolderStatus(
    userId: string
  ): Promise<ElizaHolderStatus | null> {
    const [record] = await db
      .select()
      .from(elizaHolders)
      .where(eq(elizaHolders.userId, userId))
      .limit(1);

    if (!record) return null;

    const totalBalance = BigInt(String(record.totalBalance ?? '0'));
    const qualifies = Boolean(record.qualifiesForBonus);

    return {
      address: record.walletAddress as Address,
      isHolder: totalBalance > BigInt(0),
      totalBalance,
      balanceByChain: {
        mainnet: BigInt(String(record.mainnetBalance ?? '0')),
        base: BigInt(String(record.baseBalance ?? '0')),
        bsc: BigInt(String(record.bscBalance ?? '0')),
      },
      qualifiesForBonus: qualifies,
      bonusMultiplierBps: qualifies ? this.bonusBps : 0,
      verifiedAt:
        record.verifiedAt instanceof Date
          ? record.verifiedAt
          : new Date(String(record.verifiedAt ?? Date.now())),
    };
  }

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /**
   * Verify all users who haven't been verified recently
   */
  async batchVerifyUsers(
    _maxAge: number = 24 * 60 * 60 * 1000 // 24 hours - reserved for future filtering
  ): Promise<BatchVerificationResult> {
    const result: BatchVerificationResult = {
      processed: 0,
      qualified: 0,
      totalBonusAllocated: BigInt(0),
      errors: [],
    };

    // Get all users with wallet addresses
    const usersToVerify = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(eq(users.walletAddress, zeroAddress));

    // Filter users without valid wallet addresses
    const validUsers = usersToVerify.filter(
      (u) => u.walletAddress && u.walletAddress !== zeroAddress
    );

    for (const user of validUsers) {
      result.processed++;

      const status = await this.checkHolderStatus(
        user.walletAddress as Address
      );

      await this.storeHolderStatus(
        user.id,
        user.walletAddress as Address,
        status
      );

      if (status.qualifiesForBonus) {
        result.qualified++;
      }
    }

    logger.info(
      'Batch ELIZA verification complete',
      {
        processed: result.processed,
        qualified: result.qualified,
        errors: result.errors.length,
      },
      'ElizaVerification'
    );

    return result;
  }

  /**
   * Get all qualified ELIZA holders
   */
  async getQualifiedHolders(): Promise<
    Array<{ userId: string; walletAddress: Address; balance: bigint }>
  > {
    const holders = await db
      .select({
        userId: elizaHolders.userId,
        walletAddress: elizaHolders.walletAddress,
        totalBalance: elizaHolders.totalBalance,
      })
      .from(elizaHolders)
      .where(eq(elizaHolders.qualifiesForBonus, true));

    return holders.map((h) => ({
      userId: h.userId,
      walletAddress: h.walletAddress as Address,
      balance: BigInt(h.totalBalance),
    }));
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  /**
   * Clear balance cache
   */
  clearCache(): void {
    this.balanceCache.clear();
  }

  /**
   * Get service configuration
   */
  getConfig(): {
    minBalance: bigint;
    bonusBps: number;
    tokenAddresses: typeof ELIZA_TOKEN_ADDRESSES;
  } {
    return {
      minBalance: this.minBalance,
      bonusBps: this.bonusBps,
      tokenAddresses: ELIZA_TOKEN_ADDRESSES,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let elizaVerificationService: ElizaVerificationService | null = null;

export function getElizaVerificationService(): ElizaVerificationService {
  if (!elizaVerificationService) {
    elizaVerificationService = new ElizaVerificationService();
  }
  return elizaVerificationService;
}

export function resetElizaVerificationService(): void {
  elizaVerificationService = null;
}
