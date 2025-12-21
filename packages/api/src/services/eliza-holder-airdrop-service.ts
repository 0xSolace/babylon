/**
 * elizaOS Holder Airdrop Service
 *
 * Manages the 10% BBLN allocation for elizaOS token holders.
 *
 * Key features:
 * - Cross-chain snapshot of ELIZA token balances (Ethereum, Base, Solana, etc.)
 * - Same vesting as regular users: 10% initial + 2% daily
 * - 180-day claim period
 * - Unclaimed tokens return to Eliza Foundation
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  parseUnits,
} from 'viem';
import { base, bsc, mainnet } from 'viem/chains';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Total BBLN allocated to elizaOS holders (10% of 1B = 100M) */
const ELIZA_HOLDER_POOL = parseUnits('100000000', 18);

/** Claim period in days */
const CLAIM_PERIOD_DAYS = 180;

/** Vesting mechanics (same as regular users) - exported for reuse */
export const ELIZA_VESTING = {
  INITIAL_CLAIM_PERCENT: 10,
  DAILY_DRIP_PERCENT: 2,
  DRIP_COOLDOWN_HOURS: 20,
  TOTAL_DRIP_DAYS: 45,
} as const;

const {
  TOTAL_DRIP_DAYS,
  DRIP_COOLDOWN_HOURS,
  INITIAL_CLAIM_PERCENT,
  DAILY_DRIP_PERCENT,
} = ELIZA_VESTING;

/** ELIZA token address - same on Base, BSC, and Ethereum mainnet */
const ELIZA_TOKEN_ADDRESS =
  '0xea17df5cf6d172224892b5477a16acb111182478' as Address;

/** Solana ELIZA token address */
const ELIZA_TOKEN_SOLANA = 'DuMbhu7mvQvqQHGcnikDgb4XegXJRyhUBfdU22uELiZA';

/** Supported EVM chains for ELIZA token */
const SUPPORTED_EVM_CHAINS = {
  ethereum: {
    chain: mainnet,
    elizaToken: ELIZA_TOKEN_ADDRESS,
    rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
  },
  base: {
    chain: base,
    elizaToken: ELIZA_TOKEN_ADDRESS,
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
  },
  bsc: {
    chain: bsc,
    elizaToken: ELIZA_TOKEN_ADDRESS,
    rpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
  },
} as const;

/** Solana RPC endpoint */
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

/** ERC20 ABI for balance checks */
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'totalSupply',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// =============================================================================
// TYPES
// =============================================================================

/** Database row type for eliza holder allocations */
interface ElizaHolderAllocationRow {
  id: string;
  walletAddress: string;
  elizaBalanceSnapshot: string;
  chainBalances: string | null;
  snapshotBlock: string | null;
  snapshotTime: Date | null;
  bblnAllocation: string;
  dripsUnlocked: number;
  totalClaimed: string;
  lastDripTime: Date | null;
  lastDripAction: string | null;
  fullyClaimed: boolean;
  registeredOnChain: boolean;
  claimTxHash: string | null;
  claimDeadline: Date | null;
  expired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ElizaHolderSnapshot {
  walletAddress: Address;
  chain: keyof typeof SUPPORTED_EVM_CHAINS;
  elizaBalance: bigint;
  snapshotBlock: bigint;
  snapshotTime: Date;
}

export interface ElizaHolderAllocation {
  walletAddress: Address;
  totalElizaBalance: bigint; // Sum across all chains
  shareOfPool: number; // Percentage of ELIZA pool
  bblnAllocation: bigint;
  claimed: boolean;
  claimDeadline: Date;
}

export interface ClaimStatus {
  eligible: boolean;
  walletAddress: Address;
  totalAllocation: bigint;
  dripsUnlocked: number;
  totalDrips: number;
  amountUnlocked: bigint;
  amountClaimed: bigint;
  amountClaimable: bigint;
  nextDripTime: Date | null;
  canDripNow: boolean;
  claimDeadline: Date;
  daysRemaining: number;
  expired: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ElizaHolderAirdropService {
  private _snapshotDate: Date | null = null;
  private claimDeadline: Date | null = null;

  /** Get the snapshot date */
  get snapshotDate(): Date | null {
    return this._snapshotDate;
  }

  /**
   * Initialize the claim period
   */
  async initializeClaimPeriod(snapshotDate: Date): Promise<{
    snapshotDate: Date;
    claimDeadline: Date;
    daysRemaining: number;
  }> {
    this._snapshotDate = snapshotDate;
    this.claimDeadline = new Date(snapshotDate);
    this.claimDeadline.setDate(
      this.claimDeadline.getDate() + CLAIM_PERIOD_DAYS
    );

    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (this.claimDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    logger.info(
      'Initialized elizaOS holder claim period',
      {
        snapshotDate: snapshotDate.toISOString(),
        claimDeadline: this.claimDeadline.toISOString(),
        daysRemaining,
      },
      'ElizaHolderAirdropService'
    );

    return {
      snapshotDate,
      claimDeadline: this.claimDeadline,
      daysRemaining,
    };
  }

  /**
   * Take cross-chain snapshot of ELIZA holdings
   */
  async takeSnapshot(
    blockNumbers?: Partial<Record<keyof typeof SUPPORTED_EVM_CHAINS, bigint>>
  ): Promise<{
    totalHolders: number;
    totalElizaSupply: bigint;
    chainSnapshots: Array<{
      chain: string;
      blockNumber: bigint;
      holdersOnChain: number;
    }>;
  }> {
    const allSnapshots: ElizaHolderSnapshot[] = [];
    const chainSnapshots: Array<{
      chain: string;
      blockNumber: bigint;
      holdersOnChain: number;
    }> = [];

    for (const [chainName, config] of Object.entries(SUPPORTED_EVM_CHAINS)) {
      const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      });

      const blockNumber =
        blockNumbers?.[chainName as keyof typeof SUPPORTED_EVM_CHAINS] ??
        (await client.getBlockNumber());

      // In production, this would query an indexer or iterate through transfer events
      // For now, we'll store the snapshot config
      logger.info(
        `Taking ELIZA snapshot on ${chainName}`,
        { chain: chainName, block: blockNumber.toString() },
        'ElizaHolderAirdropService'
      );

      chainSnapshots.push({
        chain: chainName,
        blockNumber,
        holdersOnChain: 0, // Would be populated from indexer
      });
    }

    // Calculate total supply for allocation calculations
    const totalElizaSupply = 0n; // Would query from contracts

    return {
      totalHolders: allSnapshots.length,
      totalElizaSupply,
      chainSnapshots,
    };
  }

  /**
   * Check ELIZA balance for a wallet across all EVM chains
   */
  async getWalletElizaBalance(walletAddress: Address): Promise<{
    totalBalance: bigint;
    byChain: Record<string, bigint>;
  }> {
    const byChain: Record<string, bigint> = {};
    let totalBalance = 0n;

    // Check EVM chains in parallel
    const evmPromises = Object.entries(SUPPORTED_EVM_CHAINS).map(
      async ([chainName, config]) => {
        const client = createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl),
        });

        const balance = await client.readContract({
          address: config.elizaToken,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        });

        return { chainName, balance };
      }
    );

    const evmResults = await Promise.all(evmPromises);
    for (const { chainName, balance } of evmResults) {
      byChain[chainName] = balance;
      totalBalance += balance;
    }

    return { totalBalance, byChain };
  }

  /**
   * Check Solana ELIZA balance for a wallet
   * @param solanaAddress - Base58 encoded Solana wallet address
   */
  async getSolanaElizaBalance(solanaAddress: string): Promise<bigint> {
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          solanaAddress,
          { mint: ELIZA_TOKEN_SOLANA },
          { encoding: 'jsonParsed' },
        ],
      }),
    });

    const data = (await response.json()) as {
      result?: {
        value?: Array<{
          account: {
            data: {
              parsed: {
                info: { tokenAmount: { amount: string } };
              };
            };
          };
        }>;
      };
    };

    if (!data.result?.value?.length) {
      return 0n;
    }

    // Sum all token accounts (should typically be just one)
    let total = 0n;
    for (const account of data.result.value) {
      const amount = account.account.data.parsed.info.tokenAmount.amount;
      total += BigInt(amount);
    }

    return total;
  }

  /**
   * Get combined ELIZA balance across all chains including Solana
   */
  async getFullElizaBalance(
    evmAddress: Address,
    solanaAddress?: string
  ): Promise<{
    totalBalance: bigint;
    byChain: Record<string, bigint>;
  }> {
    const { totalBalance: evmTotal, byChain } =
      await this.getWalletElizaBalance(evmAddress);

    let totalBalance = evmTotal;

    if (solanaAddress) {
      const solanaBalance = await this.getSolanaElizaBalance(solanaAddress);
      byChain['solana'] = solanaBalance;
      totalBalance += solanaBalance;
    }

    return { totalBalance, byChain };
  }

  /**
   * Snapshot a single wallet and create/update their allocation record
   */
  async snapshotWallet(
    evmAddress: Address,
    solanaAddress: string | undefined,
    totalElizaSupply: bigint,
    snapshotTime: Date,
    snapshotBlock?: string
  ): Promise<{
    walletAddress: Address;
    totalBalance: bigint;
    bblnAllocation: bigint;
    isNew: boolean;
  }> {
    const { totalBalance, byChain } = await this.getFullElizaBalance(
      evmAddress,
      solanaAddress
    );

    if (totalBalance === 0n) {
      return {
        walletAddress: evmAddress,
        totalBalance: 0n,
        bblnAllocation: 0n,
        isNew: false,
      };
    }

    const bblnAllocation = this.calculateAllocation(
      totalBalance,
      totalElizaSupply
    );
    const claimDeadline = new Date(snapshotTime);
    claimDeadline.setDate(claimDeadline.getDate() + CLAIM_PERIOD_DAYS);

    // Check if allocation already exists
    const existingRows = await db.query<{ id: string }>(
      `SELECT "id" FROM "ElizaHolderAllocation" WHERE "walletAddress" = $1 LIMIT 1`,
      [evmAddress]
    );
    const existing = existingRows[0];

    if (existing) {
      // Update existing allocation
      await db.exec(
        `UPDATE "ElizaHolderAllocation" SET 
          "elizaBalanceSnapshot" = $1,
          "chainBalances" = $2,
          "bblnAllocation" = $3,
          "snapshotBlock" = $4,
          "snapshotTime" = $5,
          "claimDeadline" = $6,
          "updatedAt" = $7
        WHERE "id" = $8`,
        [
          totalBalance.toString(),
          JSON.stringify(
            Object.fromEntries(
              Object.entries(byChain).map(([k, v]) => [k, v.toString()])
            )
          ),
          bblnAllocation.toString(),
          snapshotBlock ?? null,
          snapshotTime.toISOString(),
          claimDeadline.toISOString(),
          new Date().toISOString(),
          existing.id,
        ]
      );

      logger.info(
        'Updated ELIZA holder allocation',
        {
          wallet: evmAddress,
          balance: formatUnits(totalBalance, 18),
          allocation: formatUnits(bblnAllocation, 18),
        },
        'ElizaHolderAirdropService'
      );

      return {
        walletAddress: evmAddress,
        totalBalance,
        bblnAllocation,
        isNew: false,
      };
    }

    // Create new allocation
    const allocationId = await generateSnowflakeId();
    const now = new Date();
    await db.exec(
      `INSERT INTO "ElizaHolderAllocation" (
        "id", "walletAddress", "elizaBalanceSnapshot", "chainBalances",
        "snapshotBlock", "snapshotTime", "bblnAllocation", "dripsUnlocked",
        "totalClaimed", "fullyClaimed", "registeredOnChain", "claimDeadline",
        "expired", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        allocationId,
        evmAddress,
        totalBalance.toString(),
        JSON.stringify(
          Object.fromEntries(
            Object.entries(byChain).map(([k, v]) => [k, v.toString()])
          )
        ),
        snapshotBlock ?? null,
        snapshotTime.toISOString(),
        bblnAllocation.toString(),
        0,
        '0',
        false,
        false,
        claimDeadline.toISOString(),
        false,
        now.toISOString(),
        now.toISOString(),
      ]
    );

    logger.info(
      'Created ELIZA holder allocation',
      {
        wallet: evmAddress,
        balance: formatUnits(totalBalance, 18),
        allocation: formatUnits(bblnAllocation, 18),
      },
      'ElizaHolderAirdropService'
    );

    return {
      walletAddress: evmAddress,
      totalBalance,
      bblnAllocation,
      isNew: true,
    };
  }

  /**
   * Run a full snapshot for a list of wallets
   * In production, this would be called with addresses from an indexer
   */
  async runFullSnapshot(
    wallets: Array<{ evmAddress: Address; solanaAddress?: string }>,
    totalElizaSupply: bigint
  ): Promise<{
    processed: number;
    newAllocations: number;
    updatedAllocations: number;
    totalBblnAllocated: bigint;
    snapshotTime: Date;
  }> {
    const snapshotTime = new Date();
    let newAllocations = 0;
    let updatedAllocations = 0;
    let totalBblnAllocated = 0n;

    // Get current block for reference
    const ethClient = createPublicClient({
      chain: mainnet,
      transport: http(SUPPORTED_EVM_CHAINS.ethereum.rpcUrl),
    });
    const snapshotBlock = (await ethClient.getBlockNumber()).toString();

    // Initialize claim period
    await this.initializeClaimPeriod(snapshotTime);

    logger.info(
      'Starting ELIZA holder snapshot',
      {
        walletCount: wallets.length,
        totalSupply: formatUnits(totalElizaSupply, 18),
        snapshotBlock,
      },
      'ElizaHolderAirdropService'
    );

    // Process wallets in batches of 10 for rate limiting
    const batchSize = 10;
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map((w) =>
          this.snapshotWallet(
            w.evmAddress,
            w.solanaAddress,
            totalElizaSupply,
            snapshotTime,
            snapshotBlock
          )
        )
      );

      for (const result of results) {
        if (result.bblnAllocation > 0n) {
          if (result.isNew) newAllocations++;
          else updatedAllocations++;
          totalBblnAllocated += result.bblnAllocation;
        }
      }

      // Brief delay between batches to avoid rate limits
      if (i + batchSize < wallets.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    logger.info(
      'Completed ELIZA holder snapshot',
      {
        processed: wallets.length,
        newAllocations,
        updatedAllocations,
        totalAllocated: formatUnits(totalBblnAllocated, 18),
      },
      'ElizaHolderAirdropService'
    );

    return {
      processed: wallets.length,
      newAllocations,
      updatedAllocations,
      totalBblnAllocated,
      snapshotTime,
    };
  }

  /**
   * Get total ELIZA supply across all chains for allocation calculations
   */
  async getTotalElizaSupply(): Promise<bigint> {
    let totalSupply = 0n;

    for (const [chainName, config] of Object.entries(SUPPORTED_EVM_CHAINS)) {
      const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      });

      const supply = await client.readContract({
        address: config.elizaToken,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      });

      // For same token on multiple chains, take the max (circulating supply)
      // This avoids double-counting bridged tokens
      if (supply > totalSupply) {
        totalSupply = supply;
        logger.debug(
          `ELIZA supply on ${chainName}: ${formatUnits(supply, 18)}`
        );
      }
    }

    return totalSupply;
  }

  /**
   * Get all current allocations from the database
   */
  async getAllAllocations(): Promise<
    Array<{
      walletAddress: string;
      elizaBalance: string;
      bblnAllocation: string;
      dripsUnlocked: number;
      totalClaimed: string;
      expired: boolean;
    }>
  > {
    const allocations = await db.query<{
      walletAddress: string;
      elizaBalanceSnapshot: string;
      bblnAllocation: string;
      dripsUnlocked: number;
      totalClaimed: string;
      expired: boolean;
    }>(
      `SELECT "walletAddress", "elizaBalanceSnapshot", "bblnAllocation", 
              "dripsUnlocked", "totalClaimed", "expired" 
       FROM "ElizaHolderAllocation"`
    );

    return allocations.map((row) => ({
      walletAddress: row.walletAddress,
      elizaBalance: row.elizaBalanceSnapshot,
      bblnAllocation: row.bblnAllocation,
      dripsUnlocked: Number(row.dripsUnlocked),
      totalClaimed: row.totalClaimed,
      expired: Boolean(row.expired),
    }));
  }

  /**
   * Get snapshot statistics
   */
  async getSnapshotStats(): Promise<{
    totalHolders: number;
    totalElizaSnapshotted: bigint;
    totalBblnAllocated: bigint;
    claimsStarted: number;
    fullyClaimed: number;
    expired: number;
  }> {
    const rows = await db.query<{
      totalHolders: string | number;
      totalEliza: string | null;
      totalBbln: string | null;
      claimsStarted: string | number;
      fullyClaimed: string | number;
      expired: string | number;
    }>(
      `SELECT 
        COUNT(*) as "totalHolders",
        SUM(CAST("elizaBalanceSnapshot" AS numeric)) as "totalEliza",
        SUM(CAST("bblnAllocation" AS numeric)) as "totalBbln",
        COUNT(*) FILTER (WHERE "dripsUnlocked" > 0) as "claimsStarted",
        COUNT(*) FILTER (WHERE "fullyClaimed" = true) as "fullyClaimed",
        COUNT(*) FILTER (WHERE "expired" = true) as "expired"
      FROM "ElizaHolderAllocation"`
    );
    const stats = rows[0];

    return {
      totalHolders: Number(stats?.totalHolders ?? 0),
      totalElizaSnapshotted: BigInt(stats?.totalEliza ?? '0'),
      totalBblnAllocated: BigInt(stats?.totalBbln ?? '0'),
      claimsStarted: Number(stats?.claimsStarted ?? 0),
      fullyClaimed: Number(stats?.fullyClaimed ?? 0),
      expired: Number(stats?.expired ?? 0),
    };
  }

  /**
   * Calculate BBLN allocation for an ELIZA holder
   */
  calculateAllocation(elizaBalance: bigint, totalElizaSupply: bigint): bigint {
    if (totalElizaSupply === 0n || elizaBalance === 0n) {
      return 0n;
    }

    // Pro-rata share of the ELIZA holder pool
    return (elizaBalance * ELIZA_HOLDER_POOL) / totalElizaSupply;
  }

  /**
   * Record a drip claim for ELIZA holder
   * Same mechanics as regular users: 10% initial + 2% daily
   */
  async recordDripClaim(
    walletAddress: Address,
    action: 'visit' | 'post' | 'trade' | 'agent_interaction'
  ): Promise<{
    canDrip: boolean;
    dripDay: number;
    amount: bigint;
    isInitialClaim: boolean;
    nextDripTime: Date | null;
    expired: boolean;
  }> {
    // Check if claim period has expired
    if (this.claimDeadline && new Date() > this.claimDeadline) {
      return {
        canDrip: false,
        dripDay: 0,
        amount: 0n,
        isInitialClaim: false,
        nextDripTime: null,
        expired: true,
      };
    }

    // Get allocation from database
    const allocations = await db.query<ElizaHolderAllocationRow>(
      `SELECT * FROM "ElizaHolderAllocation" WHERE "walletAddress" = $1 LIMIT 1`,
      [walletAddress]
    );
    const allocation = allocations[0];

    if (!allocation) {
      return {
        canDrip: false,
        dripDay: 0,
        amount: 0n,
        isInitialClaim: false,
        nextDripTime: null,
        expired: false,
      };
    }

    const now = new Date();
    const totalAllocation = BigInt(allocation.bblnAllocation);
    const dripsUnlocked = allocation.dripsUnlocked;
    const lastDripTime = allocation.lastDripTime;

    // Check cooldown
    if (lastDripTime) {
      const cooldownMs = DRIP_COOLDOWN_HOURS * 60 * 60 * 1000;
      const nextDripTime = new Date(lastDripTime.getTime() + cooldownMs);
      if (now < nextDripTime) {
        return {
          canDrip: false,
          dripDay: dripsUnlocked,
          amount: 0n,
          isInitialClaim: false,
          nextDripTime,
          expired: false,
        };
      }
    }

    // Calculate drip amount
    const isInitialClaim = dripsUnlocked === 0;
    const percent = isInitialClaim ? INITIAL_CLAIM_PERCENT : DAILY_DRIP_PERCENT;
    const amount = (totalAllocation * BigInt(percent)) / 100n;
    const newDripsUnlocked = dripsUnlocked + 1;

    // Update allocation
    await db.exec(
      `UPDATE "ElizaHolderAllocation" SET 
        "dripsUnlocked" = $1,
        "lastDripTime" = $2,
        "lastDripAction" = $3,
        "totalClaimed" = $4,
        "fullyClaimed" = $5,
        "updatedAt" = $6
      WHERE "id" = $7`,
      [
        newDripsUnlocked,
        now.toISOString(),
        action,
        (BigInt(allocation.totalClaimed) + amount).toString(),
        newDripsUnlocked > TOTAL_DRIP_DAYS,
        now.toISOString(),
        allocation.id,
      ]
    );

    logger.info(
      'ELIZA holder drip executed',
      {
        walletAddress,
        action,
        dripDay: newDripsUnlocked,
        amount: amount.toString(),
        isInitialClaim,
      },
      'ElizaHolderAirdropService'
    );

    return {
      canDrip: true,
      dripDay: newDripsUnlocked,
      amount,
      isInitialClaim,
      nextDripTime: new Date(
        now.getTime() + DRIP_COOLDOWN_HOURS * 60 * 60 * 1000
      ),
      expired: false,
    };
  }

  /**
   * Get claim status for an ELIZA holder
   */
  async getClaimStatus(walletAddress: Address): Promise<ClaimStatus | null> {
    if (!this.claimDeadline) {
      return null;
    }

    const now = new Date();
    const expired = now > this.claimDeadline;
    const daysRemaining = expired
      ? 0
      : Math.ceil(
          (this.claimDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

    // Query allocation from database
    const allocations = await db.query<ElizaHolderAllocationRow>(
      `SELECT * FROM "ElizaHolderAllocation" WHERE "walletAddress" = $1 LIMIT 1`,
      [walletAddress]
    );
    const allocation = allocations[0];

    if (!allocation) {
      return {
        eligible: false,
        walletAddress,
        totalAllocation: 0n,
        dripsUnlocked: 0,
        totalDrips: TOTAL_DRIP_DAYS + 1,
        amountUnlocked: 0n,
        amountClaimed: 0n,
        amountClaimable: 0n,
        nextDripTime: null,
        canDripNow: false,
        claimDeadline: this.claimDeadline,
        daysRemaining,
        expired,
      };
    }

    const totalAllocation = BigInt(allocation.bblnAllocation);
    const amountClaimed = BigInt(allocation.totalClaimed);

    // Calculate unlocked amount
    let amountUnlocked = 0n;
    if (allocation.dripsUnlocked > 0) {
      // Initial claim (10%) + daily drips (2% each)
      const initialAmount =
        (totalAllocation * BigInt(INITIAL_CLAIM_PERCENT)) / 100n;
      const dailyDrips = allocation.dripsUnlocked - 1;
      const dailyAmount =
        (totalAllocation * BigInt(DAILY_DRIP_PERCENT) * BigInt(dailyDrips)) /
        100n;
      amountUnlocked = initialAmount + dailyAmount;
    }

    const amountClaimable = amountUnlocked - amountClaimed;

    // Check if can drip now
    let canDripNow = false;
    let nextDripTime: Date | null = null;
    if (allocation.lastDripTime) {
      const cooldownMs = DRIP_COOLDOWN_HOURS * 60 * 60 * 1000;
      nextDripTime = new Date(allocation.lastDripTime.getTime() + cooldownMs);
      canDripNow =
        now >= nextDripTime && allocation.dripsUnlocked <= TOTAL_DRIP_DAYS;
    } else {
      canDripNow = true; // No previous drip, can do initial claim
    }

    return {
      eligible: true,
      walletAddress,
      totalAllocation,
      dripsUnlocked: allocation.dripsUnlocked,
      totalDrips: TOTAL_DRIP_DAYS + 1,
      amountUnlocked,
      amountClaimed,
      amountClaimable,
      nextDripTime,
      canDripNow: canDripNow && !expired,
      claimDeadline: allocation.claimDeadline ?? this.claimDeadline,
      daysRemaining,
      expired,
    };
  }

  /**
   * Snapshot ELIZA balances and create allocations for a list of wallet addresses.
   * This is the main entry point for creating elizaHolderAllocations.
   */
  async snapshotAndCreateAllocations(
    walletAddresses: Address[],
    options: {
      solanaAddresses?: Record<string, string>; // EVM address -> Solana address mapping
      snapshotBlock?: bigint;
    } = {}
  ): Promise<{
    created: number;
    skipped: number;
    totalElizaBalance: bigint;
    totalBblnAllocated: bigint;
  }> {
    const snapshotTime = new Date();
    const claimDeadline = new Date(snapshotTime);
    claimDeadline.setDate(claimDeadline.getDate() + CLAIM_PERIOD_DAYS);

    // First pass: gather all balances
    const balances: Map<
      string,
      {
        evmBalance: bigint;
        solanaBalance: bigint;
        chainBreakdown: Record<string, string>;
      }
    > = new Map();
    let totalElizaSupply = 0n;

    logger.info(
      'Starting ELIZA holder snapshot',
      {
        walletCount: walletAddresses.length,
        chains: Object.keys(SUPPORTED_EVM_CHAINS),
      },
      'ElizaHolderAirdropService'
    );

    for (const wallet of walletAddresses) {
      const { totalBalance, byChain } =
        await this.getWalletElizaBalance(wallet);

      // Check Solana balance if mapping provided
      let solanaBalance = 0n;
      const solanaAddr = options.solanaAddresses?.[wallet.toLowerCase()];
      if (solanaAddr) {
        solanaBalance = await this.getSolanaElizaBalance(solanaAddr);
      }

      const combinedBalance = totalBalance + solanaBalance;
      if (combinedBalance > 0n) {
        balances.set(wallet.toLowerCase(), {
          evmBalance: totalBalance,
          solanaBalance,
          chainBreakdown: Object.fromEntries(
            Object.entries(byChain).map(([k, v]) => [k, v.toString()])
          ),
        });
        totalElizaSupply += combinedBalance;
      }
    }

    logger.info(
      'Balances gathered',
      {
        holdersWithBalance: balances.size,
        totalSupply: formatUnits(totalElizaSupply, 18),
      },
      'ElizaHolderAirdropService'
    );

    // Second pass: create allocations
    let created = 0;
    let skipped = 0;
    let totalBblnAllocated = 0n;

    for (const [
      wallet,
      { evmBalance, solanaBalance, chainBreakdown },
    ] of balances) {
      const walletAddress = wallet as Address;
      const totalBalance = evmBalance + solanaBalance;

      // Check if allocation already exists
      const existingRows = await db.query<{ id: string }>(
        `SELECT "id" FROM "ElizaHolderAllocation" WHERE "walletAddress" = $1 LIMIT 1`,
        [walletAddress]
      );
      const existing = existingRows[0];

      if (existing) {
        skipped++;
        continue;
      }

      // Calculate allocation
      const bblnAllocation = this.calculateAllocation(
        totalBalance,
        totalElizaSupply
      );
      totalBblnAllocated += bblnAllocation;

      // Store in database
      const now = new Date();
      await db.exec(
        `INSERT INTO "ElizaHolderAllocation" (
          "id", "walletAddress", "elizaBalanceSnapshot", "chainBalances",
          "snapshotBlock", "snapshotTime", "bblnAllocation", "dripsUnlocked",
          "totalClaimed", "claimDeadline", "fullyClaimed", "registeredOnChain",
          "expired", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          await generateSnowflakeId(),
          walletAddress,
          totalBalance.toString(),
          JSON.stringify({
            ...chainBreakdown,
            solana: solanaBalance.toString(),
          }),
          options.snapshotBlock?.toString() ?? null,
          snapshotTime.toISOString(),
          bblnAllocation.toString(),
          0,
          '0',
          claimDeadline.toISOString(),
          false,
          false,
          false,
          now.toISOString(),
          now.toISOString(),
        ]
      );

      created++;
    }

    logger.info(
      'Snapshot complete',
      {
        created,
        skipped,
        totalElizaBalance: formatUnits(totalElizaSupply, 18),
        totalBblnAllocated: formatUnits(totalBblnAllocated, 18),
      },
      'ElizaHolderAirdropService'
    );

    return {
      created,
      skipped,
      totalElizaBalance: totalElizaSupply,
      totalBblnAllocated,
    };
  }

  /**
   * Calculate unclaimed tokens to return to Eliza Foundation
   * Called after claim period ends
   */
  async calculateUnclaimedTokens(): Promise<{
    totalAllocated: bigint;
    totalClaimed: bigint;
    unclaimedToReturn: bigint;
    claimRate: number;
  }> {
    // This would aggregate from elizaHolderAllocations table
    const totalAllocated = ELIZA_HOLDER_POOL;
    const totalClaimed = 0n; // Would be sum of claimed amounts

    const unclaimedToReturn = totalAllocated - totalClaimed;
    const claimRate =
      totalAllocated > 0n
        ? Number((totalClaimed * 10000n) / totalAllocated) / 100
        : 0;

    return {
      totalAllocated,
      totalClaimed,
      unclaimedToReturn,
      claimRate,
    };
  }

  /**
   * Return unclaimed tokens to Eliza Foundation
   */
  async returnUnclaimedToFoundation(foundationAddress: Address): Promise<{
    amount: bigint;
    txHash: string | null;
  }> {
    const { unclaimedToReturn } = await this.calculateUnclaimedTokens();

    if (unclaimedToReturn === 0n) {
      return { amount: 0n, txHash: null };
    }

    // This would execute an on-chain transfer to the foundation
    logger.info(
      'Returning unclaimed ELIZA holder tokens to foundation',
      {
        amount: formatUnits(unclaimedToReturn, 18),
        foundation: foundationAddress,
      },
      'ElizaHolderAirdropService'
    );

    return {
      amount: unclaimedToReturn,
      txHash: null, // Would be actual tx hash
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let elizaHolderAirdropService: ElizaHolderAirdropService | null = null;

export function getElizaHolderAirdropService(): ElizaHolderAirdropService {
  if (!elizaHolderAirdropService) {
    elizaHolderAirdropService = new ElizaHolderAirdropService();
  }
  return elizaHolderAirdropService;
}

export function resetElizaHolderAirdropService(): void {
  elizaHolderAirdropService = null;
}
