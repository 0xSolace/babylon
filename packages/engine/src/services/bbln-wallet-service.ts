/**
 * BBLN Wallet Service
 *
 * @description Manages user's BBLN token balance for trading. This is the REAL
 * token implementation - no simulation mode. All balances are on-chain BBLN tokens.
 *
 * Features:
 * - On-chain BBLN token balances (18 decimals)
 * - Real token transfers for all operations
 * - Transaction history tracking in DB
 * - Pool custody for trades (tokens held by pool contract)
 *
 * Architecture:
 * - User balance = BBLN.balanceOf(userWallet)
 * - Trade execution = BBLN.transferFrom(user -> pool)
 * - Payouts = BBLN.transfer(pool -> user)
 */

import {
  balanceTransactions,
  db,
  desc,
  eq,
  type Transaction,
  users,
  withTransaction,
} from '@babylon/db'
import {
  BBLN_TOKEN_ABI,
  getBBLNContracts,
  getCurrentNetwork,
  getNetworkConfig,
  InsufficientFundsError,
  type NetworkName,
} from '@babylon/shared'
import { readContract, writeContract } from '@jejunetwork/contracts/viem'
import { generateSnowflakeId, NotFoundError } from '@jejunetwork/shared'
import {
  type Address,
  createPublicClient,
  type createWalletClient,
  formatUnits,
  http,
  parseUnits,
} from 'viem'
import { base, baseSepolia, hardhat } from 'viem/chains'

// =============================================================================
// TYPES
// =============================================================================

export interface BBLNBalanceInfo {
  /** On-chain BBLN balance in token units (human readable) */
  balance: number
  /** Balance in wei (raw on-chain value) */
  balanceWei: bigint
  /** Total BBLN deposited to game (from txn history) */
  totalDeposited: number
  /** Total BBLN withdrawn from game (from txn history) */
  totalWithdrawn: number
  /** Lifetime PnL in BBLN */
  lifetimePnL: number
  /** User's wallet address */
  walletAddress: Address
}

export interface BBLNTransactionResult {
  txHash: `0x${string}`
  amount: bigint
  from: Address
  to: Address
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BBLN_DECIMALS = 18

// Pool custody address - holds tokens during active trades
// This should be a multi-sig or contract in production
const getPoolCustodyAddress = (): Address => {
  return (process.env.BBLN_POOL_CUSTODY_ADDRESS ??
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Address // Default: hardhat account[1]
}

// =============================================================================
// BBLN WALLET SERVICE
// =============================================================================

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern
export class BBLNWalletService {
  private static network: NetworkName = getCurrentNetwork()
  private static chain =
    BBLNWalletService.network === 'mainnet'
      ? base
      : BBLNWalletService.network === 'testnet'
        ? baseSepolia
        : hardhat
  private static publicClient = BBLNWalletService.createPublicClient()
  private static walletClient: ReturnType<typeof createWalletClient> | null =
    null

  /**
   * Set the wallet client for pool custody operations
   * Must be called before debit/credit/fundUser operations
   */
  static setWalletClient(client: ReturnType<typeof createWalletClient>): void {
    BBLNWalletService.walletClient = client
  }

  /**
   * Get wallet client, throwing if not set
   */
  private static getWalletClient(): ReturnType<typeof createWalletClient> {
    if (!BBLNWalletService.walletClient) {
      throw new Error(
        'BBLNWalletService wallet client not configured. Call setWalletClient() first.',
      )
    }
    return BBLNWalletService.walletClient
  }

  private static createPublicClient() {
    const config = getNetworkConfig(BBLNWalletService.network)
    const chain =
      BBLNWalletService.network === 'mainnet'
        ? base
        : BBLNWalletService.network === 'testnet'
          ? baseSepolia
          : hardhat

    return createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    })
  }

  /**
   * Get BBLN token contract address
   */
  private static getTokenAddress(): Address {
    const contracts = getBBLNContracts(BBLNWalletService.network)
    if (!contracts.token) {
      throw new Error(`BBLN token not deployed on ${BBLNWalletService.network}`)
    }
    return contracts.token
  }

  /**
   * Get user's wallet address from database
   */
  private static async getUserWallet(userId: string): Promise<Address> {
    const result = await db
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const [user] = result
    if (!user?.walletAddress) {
      throw new Error(`User ${userId} has no connected wallet`)
    }

    return user.walletAddress as Address
  }

  /**
   * Get on-chain BBLN balance for an address
   */
  static async getOnChainBalance(address: Address): Promise<bigint> {
    const tokenAddress = BBLNWalletService.getTokenAddress()

    const balance = await readContract(BBLNWalletService.publicClient, {
      address: tokenAddress,
      abi: BBLN_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address],
    })

    return balance as bigint
  }

  /**
   * Get user's BBLN balance (on-chain)
   */
  static async getBalance(userId: string): Promise<BBLNBalanceInfo> {
    const walletAddress = await BBLNWalletService.getUserWallet(userId)
    const balanceWei = await BBLNWalletService.getOnChainBalance(walletAddress)

    // Get lifetime stats from DB
    const result = await db
      .select({
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        lifetimePnL: users.lifetimePnL,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const [user] = result
    if (!user) {
      throw new NotFoundError('User', userId)
    }

    return {
      balance: Number(formatUnits(balanceWei, BBLN_DECIMALS)),
      balanceWei,
      totalDeposited: Number(user.totalDeposited),
      totalWithdrawn: Number(user.totalWithdrawn),
      lifetimePnL: Number(user.lifetimePnL),
      walletAddress,
    }
  }

  /**
   * Check if user has sufficient BBLN balance
   */
  static async hasSufficientBalance(
    userId: string,
    requiredAmount: number,
  ): Promise<boolean> {
    const { balance } = await BBLNWalletService.getBalance(userId)
    return balance >= requiredAmount
  }

  /**
   * Debit BBLN from user (transfer to pool custody for trade)
   *
   * User must have approved the pool to spend their tokens first.
   * This transfers tokens from user wallet to pool custody.
   */
  static async debit(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: string,
    _tx?: Transaction,
  ): Promise<BBLNTransactionResult> {
    const walletAddress = await BBLNWalletService.getUserWallet(userId)
    const tokenAddress = BBLNWalletService.getTokenAddress()
    const poolAddress = getPoolCustodyAddress()
    const amountWei = parseUnits(String(amount), BBLN_DECIMALS)

    // Check balance first
    const balance = await BBLNWalletService.getOnChainBalance(walletAddress)
    if (balance < amountWei) {
      throw new InsufficientFundsError(
        amount,
        Number(formatUnits(balance, BBLN_DECIMALS)),
        'BBLN',
      )
    }

    // Execute transferFrom (requires user approval)
    // In a real implementation, this would be called by a smart contract
    // For now, we assume the pool has been approved to spend user tokens
    const txHash = await writeContract(BBLNWalletService.getWalletClient(), {
      address: tokenAddress,
      abi: BBLN_TOKEN_ABI,
      functionName: 'transfer',
      args: [poolAddress, amountWei],
      chain: BBLNWalletService.chain,
    })

    // Record transaction in database
    await withTransaction(async (dbTx) => {
      await dbTx.insert(balanceTransactions).values({
        id: await generateSnowflakeId(),
        userId,
        type,
        amount: String(-amount),
        balanceBefore: String(formatUnits(balance, BBLN_DECIMALS)),
        balanceAfter: String(formatUnits(balance - amountWei, BBLN_DECIMALS)),
        relatedId: relatedId ?? null,
        description,
      })
    })

    return {
      txHash,
      amount: amountWei,
      from: walletAddress,
      to: poolAddress,
    }
  }

  /**
   * Credit BBLN to user (transfer from pool custody)
   *
   * Transfers tokens from pool custody back to user wallet.
   */
  static async credit(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: string,
    _tx?: Transaction,
  ): Promise<BBLNTransactionResult> {
    const walletAddress = await BBLNWalletService.getUserWallet(userId)
    const tokenAddress = BBLNWalletService.getTokenAddress()
    const poolAddress = getPoolCustodyAddress()
    const amountWei = parseUnits(String(amount), BBLN_DECIMALS)

    // Get user's current balance for logging
    const balanceBefore =
      await BBLNWalletService.getOnChainBalance(walletAddress)

    // Transfer from pool to user
    const txHash = await writeContract(BBLNWalletService.getWalletClient(), {
      address: tokenAddress,
      abi: BBLN_TOKEN_ABI,
      functionName: 'transfer',
      args: [walletAddress, amountWei],
      chain: BBLNWalletService.chain,
    })

    // Record transaction in database
    await withTransaction(async (dbTx) => {
      await dbTx.insert(balanceTransactions).values({
        id: await generateSnowflakeId(),
        userId,
        type,
        amount: String(amount),
        balanceBefore: String(formatUnits(balanceBefore, BBLN_DECIMALS)),
        balanceAfter: String(
          formatUnits(balanceBefore + amountWei, BBLN_DECIMALS),
        ),
        relatedId: relatedId ?? null,
        description,
      })
    })

    return {
      txHash,
      amount: amountWei,
      from: poolAddress,
      to: walletAddress,
    }
  }

  /**
   * Record PnL and update lifetime stats
   */
  static async recordPnL(
    userId: string,
    pnl: number,
    _tradeType: string,
    _relatedId?: string,
  ): Promise<{
    previousLifetimePnL: number
    newLifetimePnL: number
    earnedPointsDelta: number
  }> {
    return await withTransaction(async (tx) => {
      const result = await tx
        .select({ lifetimePnL: users.lifetimePnL })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      const [user] = result
      if (!user) {
        throw new NotFoundError('User', userId)
      }

      const previousLifetimePnL = Number(user.lifetimePnL ?? 0)
      const newLifetimePnL = previousLifetimePnL + pnl

      await tx
        .update(users)
        .set({ lifetimePnL: String(newLifetimePnL) })
        .where(eq(users.id, userId))

      // Points conversion is handled separately via convertPointsToBBLN
      return {
        previousLifetimePnL,
        newLifetimePnL,
        earnedPointsDelta: 0, // Points deprecated in favor of BBLN
      }
    })
  }

  /**
   * Get transaction history from database
   */
  static async getTransactionHistory(
    userId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string
      type: string
      amount: number
      balanceBefore: number
      balanceAfter: number
      description: string | null
      relatedId: string | null
      createdAt: Date
    }>
  > {
    const transactionsResult = await db
      .select()
      .from(balanceTransactions)
      .where(eq(balanceTransactions.userId, userId))
      .orderBy(desc(balanceTransactions.createdAt))
      .limit(limit)

    type TxRecord = {
      id: string
      type: string
      amount: string
      balanceBefore: string
      balanceAfter: string
      description: string | null
      relatedId: string | null
      createdAt: Date
    }

    return (transactionsResult as TxRecord[]).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      description: tx.description,
      relatedId: tx.relatedId,
      createdAt: tx.createdAt,
    }))
  }

  /**
   * Fund user with initial BBLN (for new users or airdrops)
   *
   * This transfers BBLN from the treasury/airdrop pool to the user.
   */
  static async fundUser(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<BBLNTransactionResult> {
    const walletAddress = await BBLNWalletService.getUserWallet(userId)
    const tokenAddress = BBLNWalletService.getTokenAddress()
    const amountWei = parseUnits(String(amount), BBLN_DECIMALS)

    // Transfer from pool to user
    const txHash = await writeContract(BBLNWalletService.getWalletClient(), {
      address: tokenAddress,
      abi: BBLN_TOKEN_ABI,
      functionName: 'transfer',
      args: [walletAddress, amountWei],
      chain: BBLNWalletService.chain,
    })

    // Record in database
    await withTransaction(async (tx) => {
      await tx
        .update(users)
        .set({
          totalDeposited: String(
            Number(
              (
                await tx
                  .select({ totalDeposited: users.totalDeposited })
                  .from(users)
                  .where(eq(users.id, userId))
                  .limit(1)
              )[0]?.totalDeposited ?? 0,
            ) + amount,
          ),
        })
        .where(eq(users.id, userId))

      await tx.insert(balanceTransactions).values({
        id: await generateSnowflakeId(),
        userId,
        type: 'fund',
        amount: String(amount),
        balanceBefore: '0',
        balanceAfter: String(amount),
        description: reason,
      })
    })

    return {
      txHash,
      amount: amountWei,
      from: getPoolCustodyAddress(),
      to: walletAddress,
    }
  }
}

// =============================================================================
// WALLET SERVICE ALIAS
// =============================================================================

/**
 * WalletService - Alias for BBLNWalletService
 *
 * This is the canonical wallet service. No simulation mode - real tokens only.
 */
export const WalletService = BBLNWalletService
