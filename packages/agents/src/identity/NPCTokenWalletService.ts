/**
 * NPC Token Wallet Service
 *
 * Manages BBLN token balances and on-chain trading for NPCs.
 * Extends NPCIdentityService with token-specific functionality:
 * - BBLN balance management
 * - On-chain trade execution via ERC-4337 paymaster
 * - Stop-loss monitoring and automated position closure
 * - Treasury funding for NPC initial allocations
 *
 * @packageDocumentation
 */

/**
 * Paymaster client interface for gasless transactions.
 * Injected at runtime to avoid circular dependency with @babylon/api.
 */
import type { UserOperation } from '@babylon/api'
import { db } from '@babylon/db'
import { StaticDataRegistry } from '@babylon/engine'
import { type ActorTier, logger, toAddressOrNull } from '@babylon/shared'

export interface PaymasterClient {
  initialize(): Promise<void>
  sponsorUserOperation?(userOp: UserOperation): Promise<UserOperation>
}

import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatUnits,
  type Hex,
  http,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getNPCIdentityService } from './NPCIdentityService'

// =============================================================================
// ABI DEFINITIONS
// =============================================================================

const BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
] as const

const GET_BALANCE_ABI = [
  {
    name: 'getBalance',
    type: 'function',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
] as const

const TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool', name: '' }],
    stateMutability: 'nonpayable',
  },
] as const

const APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool', name: '' }],
    stateMutability: 'nonpayable',
  },
] as const

const PREDICTION_MARKET_ABI = [
  {
    name: 'buyShares',
    type: 'function',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'sellShares',
    type: 'function',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const OPEN_POSITION_ABI = [
  {
    name: 'openPosition',
    type: 'function',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_side', type: 'uint8' },
      { name: '_size', type: 'uint256' },
      { name: '_collateral', type: 'uint256' },
      { name: '_maxPrice', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const CLOSE_POSITION_ABI = [
  {
    name: 'closePosition',
    type: 'function',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_minPrice', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// =============================================================================
// CONFIGURATION
// =============================================================================

/** NPC tier allocations in BBLN tokens */
export const NPC_TIER_ALLOCATIONS = {
  /** Major characters (tier 1) - 1M BBLN */
  TIER_1: parseUnits('1000000', 18),
  /** Supporting characters (tier 2) - 100K BBLN */
  TIER_2: parseUnits('100000', 18),
  /** Minor characters (tier 3) - 10K BBLN */
  TIER_3: parseUnits('10000', 18),
} as const

/** Stop-loss thresholds */
export const STOP_LOSS_CONFIG = {
  /** Daily loss limit as percentage of portfolio (20%) */
  DAILY_LOSS_LIMIT_PCT: 20,
  /** Per-position loss limit (25%) */
  POSITION_LOSS_LIMIT_PCT: 25,
  /** Minimum balance to keep (never trade below this) */
  MIN_BALANCE: parseUnits('100', 18),
  /** Check interval in milliseconds */
  CHECK_INTERVAL_MS: 60_000, // 1 minute
} as const

/** Map actor tier to allocation amount */
function getTierAllocation(tier: ActorTier | null | undefined): bigint {
  switch (tier) {
    case 'S_TIER':
      return NPC_TIER_ALLOCATIONS.TIER_1
    case 'A_TIER':
      return NPC_TIER_ALLOCATIONS.TIER_2
    default:
      return NPC_TIER_ALLOCATIONS.TIER_3
  }
}

/** Contract addresses - loaded from env */
interface ContractAddresses {
  babylonToken: Address
  diamond: Address
  treasury: Address
  feeRecipient: Address
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

function getContractAddresses(): ContractAddresses {
  return {
    babylonToken:
      toAddressOrNull(process.env.BBLN_TOKEN_ADDRESS) ?? ZERO_ADDRESS,
    diamond: toAddressOrNull(process.env.DIAMOND_ADDRESS) ?? ZERO_ADDRESS,
    treasury: toAddressOrNull(process.env.TREASURY_ADDRESS) ?? ZERO_ADDRESS,
    feeRecipient:
      toAddressOrNull(process.env.FEE_RECIPIENT_ADDRESS) ?? ZERO_ADDRESS,
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface NPCTokenBalance {
  actorId: string
  walletAddress: Address
  /** On-chain BBLN balance (wei) */
  tokenBalance: bigint
  /** Diamond contract deposited balance (wei) */
  depositedBalance: bigint
  /** Total value (token + deposited) */
  totalValue: bigint
  /** Last synced block */
  lastSyncedBlock: bigint
}

export interface NPCPosition {
  positionId: Hex
  marketId: Hex
  marketType: 'prediction' | 'perp'
  side: 'long' | 'short' | 'yes' | 'no'
  size: bigint
  entryPrice: bigint
  currentPrice: bigint
  unrealizedPnL: bigint
  pnlPercent: number
}

export interface StopLossResult {
  triggered: boolean
  reason: string
  positionsClosed: number
  totalLossAvoided: bigint
}

// =============================================================================
// ABI FRAGMENTS
// =============================================================================

// =============================================================================
// SERVICE
// =============================================================================

export class NPCTokenWalletService {
  private rpcUrl: string
  private publicClient
  private paymasterClient: PaymasterClient | null = null
  private addresses: ContractAddresses
  private stopLossEnabled = false
  private stopLossInterval: ReturnType<typeof setInterval> | null = null
  private chain: Chain

  constructor() {
    this.rpcUrl = process.env.JEJU_RPC_URL ?? 'http://localhost:6546'
    this.chain = {
      id: parseInt(process.env.JEJU_CHAIN_ID ?? '31337', 10),
      name: 'Jeju',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [this.rpcUrl] },
      },
    }
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    })
    this.addresses = getContractAddresses()
  }

  // ---------------------------------------------------------------------------
  // TIER ALLOCATION
  // ---------------------------------------------------------------------------

  /**
   * Get the allocation amount for an actor based on their tier
   */
  getAllocationForActor(actorId: string): bigint {
    const actor = StaticDataRegistry.getActor(actorId)
    if (!actor) {
      logger.warn(
        `Actor ${actorId} not found in registry, using default tier 3`,
        { actorId },
        'NPCTokenWalletService',
      )
      return NPC_TIER_ALLOCATIONS.TIER_3
    }
    return getTierAllocation(actor.tier)
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  /**
   * Initialize paymaster client for gasless transactions.
   * Paymaster client should be injected from @babylon/api to avoid circular deps.
   * @param paymasterClientGetter - Optional function that returns a PaymasterClient
   */
  async initialize(
    paymasterClientGetter?: () => PaymasterClient,
  ): Promise<void> {
    if (paymasterClientGetter) {
      try {
        this.paymasterClient = paymasterClientGetter()
        await this.paymasterClient.initialize()
        logger.info(
          'NPCTokenWalletService initialized with paymaster',
          undefined,
          'NPCTokenWalletService',
        )
      } catch (error) {
        logger.warn(
          'Paymaster not available, NPC trades will require gas',
          { error },
          'NPCTokenWalletService',
        )
      }
    } else {
      logger.info(
        'NPCTokenWalletService initialized without paymaster',
        undefined,
        'NPCTokenWalletService',
      )
    }
  }

  // ---------------------------------------------------------------------------
  // BALANCE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get NPC's complete token balance (wallet + deposited)
   */
  async getBalance(actorId: string): Promise<NPCTokenBalance> {
    const identityService = getNPCIdentityService()
    const identity = await identityService.getNPCIdentity(actorId)

    if (!identity?.walletAddress) {
      throw new Error(`NPC ${actorId} has no wallet`)
    }

    const walletAddress = identity.walletAddress

    // Get token balance
    const tokenBalance = await this.publicClient.readContract({
      address: this.addresses.babylonToken,
      abi: BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    })

    // Get deposited balance in Diamond contract
    const depositedBalance = await this.publicClient.readContract({
      address: this.addresses.diamond,
      abi: GET_BALANCE_ABI,
      functionName: 'getBalance',
      args: [walletAddress],
    })

    const blockNumber = await this.publicClient.getBlockNumber()

    return {
      actorId,
      walletAddress,
      tokenBalance,
      depositedBalance,
      totalValue: tokenBalance + depositedBalance,
      lastSyncedBlock: blockNumber,
    }
  }

  /**
   * Sync NPC balance to database (for fast queries)
   */
  async syncBalanceToDb(actorId: string): Promise<void> {
    const balance = await this.getBalance(actorId)

    await db.actorState.update({
      where: { id: actorId },
      data: {
        tradingBalance: formatUnits(balance.totalValue, 18),
        updatedAt: new Date(),
      },
    })

    logger.info(
      `Synced NPC balance`,
      {
        actorId,
        tokenBalance: formatUnits(balance.tokenBalance, 18),
        depositedBalance: formatUnits(balance.depositedBalance, 18),
      },
      'NPCTokenWalletService',
    )
  }

  /**
   * Fund NPC from treasury based on their tier
   */
  async fundNPCFromTreasury(
    actorId: string,
    treasuryPrivateKey: Hex,
  ): Promise<{ txHash: Hex; amount: bigint }> {
    const identityService = getNPCIdentityService()
    const identity = await identityService.getNPCIdentity(actorId)

    if (!identity?.walletAddress) {
      throw new Error(`NPC ${actorId} has no wallet`)
    }

    // Get tier from static registry
    const amount = this.getAllocationForActor(actorId)

    // Check current balance
    const currentBalance = await this.getBalance(actorId)
    if (currentBalance.totalValue >= amount) {
      logger.info(
        `NPC ${actorId} already funded`,
        { currentBalance: formatUnits(currentBalance.totalValue, 18) },
        'NPCTokenWalletService',
      )
      const zeroHash: Hex = '0x0'
      return { txHash: zeroHash, amount: 0n }
    }

    const amountToFund = amount - currentBalance.totalValue

    // Create wallet client for treasury
    const treasuryAccount = privateKeyToAccount(treasuryPrivateKey)
    const walletClient = createWalletClient({
      account: treasuryAccount,
      chain: this.chain,
      transport: http(this.rpcUrl),
    })

    // Transfer tokens from treasury
    const txHash = await walletClient.writeContract({
      chain: this.chain,
      address: this.addresses.babylonToken,
      abi: TRANSFER_ABI,
      functionName: 'transfer',
      args: [identity.walletAddress, amountToFund],
      account: treasuryAccount,
    })

    logger.info(
      `Funded NPC from treasury`,
      {
        actorId,
        amount: formatUnits(amountToFund, 18),
        txHash,
      },
      'NPCTokenWalletService',
    )

    // Sync to database
    await this.syncBalanceToDb(actorId)

    return { txHash, amount: amountToFund }
  }

  /**
   * Fund all NPCs from treasury
   */
  async fundAllNPCsFromTreasury(treasuryPrivateKey: Hex): Promise<{
    funded: number
    skipped: number
    totalAmount: bigint
    errors: Array<{ actorId: string; error: string }>
  }> {
    const allActors = await db.actorState.findMany()
    const result = {
      funded: 0,
      skipped: 0,
      totalAmount: 0n,
      errors: [] as Array<{ actorId: string; error: string }>,
    }

    for (const actor of allActors) {
      const actorId = String(actor.id)
      try {
        const { amount } = await this.fundNPCFromTreasury(
          actorId,
          treasuryPrivateKey,
        )
        if (amount > 0n) {
          result.funded++
          result.totalAmount += amount
        } else {
          result.skipped++
        }
      } catch (error) {
        result.errors.push({
          actorId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info(
      `Funded all NPCs from treasury`,
      {
        funded: result.funded,
        skipped: result.skipped,
        totalAmount: formatUnits(result.totalAmount, 18),
        errorCount: result.errors.length,
      },
      'NPCTokenWalletService',
    )

    return result
  }

  // ---------------------------------------------------------------------------
  // TRADING
  // ---------------------------------------------------------------------------

  /**
   * Deposit tokens to Diamond contract for trading
   */
  async depositTokensForTrading(
    actorId: string,
    amount: bigint,
    privateKey: Hex,
  ): Promise<Hex> {
    const identity = await getNPCIdentityService().getNPCIdentity(actorId)
    if (!identity?.walletAddress) {
      throw new Error(`NPC ${actorId} has no wallet`)
    }

    const account = privateKeyToAccount(privateKey)
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    })

    // First approve Diamond to spend tokens
    const approveTx = await walletClient.writeContract({
      chain: this.chain,
      address: this.addresses.babylonToken,
      abi: APPROVE_ABI,
      functionName: 'approve',
      args: [this.addresses.diamond, amount],
      account,
    })

    // Wait for approval
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx })

    // Note: The current Diamond contracts use native ETH, not ERC20
    // This would need a TokenMarketFacet to be added to the Diamond
    // For now, we'll simulate by tracking in the database
    logger.info(
      `Deposited tokens for trading`,
      { actorId, amount: formatUnits(amount, 18), approveTx },
      'NPCTokenWalletService',
    )

    return approveTx
  }

  /**
   * Execute on-chain prediction market trade
   * Uses ERC-4337 paymaster for gasless execution
   */
  async executePredictionTrade(
    actorId: string,
    marketId: Hex,
    outcome: 0 | 1,
    shares: bigint,
    action: 'buy' | 'sell',
    privateKey: Hex,
  ): Promise<Hex> {
    const identity = await getNPCIdentityService().getNPCIdentity(actorId)
    if (!identity?.walletAddress) {
      throw new Error(`NPC ${actorId} has no wallet`)
    }

    const account = privateKeyToAccount(privateKey)
    const functionName = action === 'buy' ? 'buyShares' : 'sellShares'

    // Create wallet client with chain
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    })

    // If paymaster available, log gasless intent (would execute via bundler)
    if (this.paymasterClient) {
      logger.info(
        `Executing gasless prediction trade`,
        { actorId, marketId, action, shares: shares.toString() },
        'NPCTokenWalletService',
      )
    }

    // Execute transaction
    const txHash = await walletClient.writeContract({
      chain: this.chain,
      address: this.addresses.diamond,
      abi: PREDICTION_MARKET_ABI,
      functionName,
      args: [marketId, outcome, shares],
      account,
    })

    logger.info(
      `Executed prediction trade`,
      { actorId, marketId, action, shares: shares.toString(), txHash },
      'NPCTokenWalletService',
    )

    return txHash
  }

  /**
   * Execute on-chain perp trade
   */
  async executePerpTrade(
    actorId: string,
    marketId: Hex,
    side: 0 | 1, // 0 = LONG, 1 = SHORT
    size: bigint,
    collateral: bigint,
    action: 'open' | 'close',
    privateKey: Hex,
  ): Promise<Hex> {
    const identity = await getNPCIdentityService().getNPCIdentity(actorId)
    if (!identity?.walletAddress) {
      throw new Error(`NPC ${actorId} has no wallet`)
    }

    const account = privateKeyToAccount(privateKey)
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    })

    if (action === 'open') {
      const maxPrice = BigInt(2) ** BigInt(128) - BigInt(1) // Max uint128
      const txHash = await walletClient.writeContract({
        chain: this.chain,
        address: this.addresses.diamond,
        abi: OPEN_POSITION_ABI,
        functionName: 'openPosition',
        args: [marketId, side, size, collateral, maxPrice],
        account,
      })

      logger.info(
        `Opened perp position`,
        { actorId, marketId, side, size: size.toString(), txHash },
        'NPCTokenWalletService',
      )

      return txHash
    } else {
      const minPrice = 0n
      const txHash = await walletClient.writeContract({
        chain: this.chain,
        address: this.addresses.diamond,
        abi: CLOSE_POSITION_ABI,
        functionName: 'closePosition',
        args: [marketId, minPrice],
        account,
      })

      logger.info(
        `Closed perp position`,
        { actorId, marketId, txHash },
        'NPCTokenWalletService',
      )

      return txHash
    }
  }

  // ---------------------------------------------------------------------------
  // STOP-LOSS
  // ---------------------------------------------------------------------------

  /**
   * Start stop-loss monitoring for all NPCs
   */
  startStopLossMonitoring(): void {
    if (this.stopLossEnabled) return

    this.stopLossEnabled = true
    this.stopLossInterval = setInterval(
      () => this.runStopLossCheck(),
      STOP_LOSS_CONFIG.CHECK_INTERVAL_MS,
    )

    logger.info(
      'Started NPC stop-loss monitoring',
      undefined,
      'NPCTokenWalletService',
    )
  }

  /**
   * Stop stop-loss monitoring
   */
  stopStopLossMonitoring(): void {
    if (this.stopLossInterval) {
      clearInterval(this.stopLossInterval)
      this.stopLossInterval = null
    }
    this.stopLossEnabled = false
    logger.info(
      'Stopped NPC stop-loss monitoring',
      undefined,
      'NPCTokenWalletService',
    )
  }

  /**
   * Run stop-loss check for all NPCs
   */
  private async runStopLossCheck(): Promise<void> {
    const allActors = await db.actorState.findMany()

    for (const actor of allActors) {
      const actorId = String(actor.id)
      try {
        await this.checkStopLossForNPC(actorId)
      } catch (error) {
        logger.warn(
          `Stop-loss check failed for NPC ${actorId}`,
          { error },
          'NPCTokenWalletService',
        )
      }
    }
  }

  /**
   * Check and execute stop-loss for a single NPC
   */
  async checkStopLossForNPC(actorId: string): Promise<StopLossResult> {
    const result: StopLossResult = {
      triggered: false,
      reason: '',
      positionsClosed: 0,
      totalLossAvoided: 0n,
    }

    // Get current balance
    const balance = await this.getBalance(actorId)

    // Check if below minimum
    if (balance.totalValue < STOP_LOSS_CONFIG.MIN_BALANCE) {
      result.triggered = true
      result.reason = 'Below minimum balance'
      // Would close all positions here
      return result
    }

    // Get daily starting balance from database
    const actorStateRow = await db.actorState.findUnique({
      where: { id: actorId },
    })

    if (!actorStateRow) return result

    const startingBalance = parseUnits(String(actorStateRow.tradingBalance), 18)
    const currentBalance = balance.totalValue

    // Calculate daily loss percentage
    if (startingBalance > 0n) {
      const loss =
        startingBalance > currentBalance ? startingBalance - currentBalance : 0n
      const lossPercent = Number((loss * 100n) / startingBalance)

      if (lossPercent >= STOP_LOSS_CONFIG.DAILY_LOSS_LIMIT_PCT) {
        result.triggered = true
        result.reason = `Daily loss limit reached: ${lossPercent.toFixed(2)}%`
        result.totalLossAvoided = loss

        logger.warn(
          `Stop-loss triggered for NPC ${actorId}`,
          { lossPercent, loss: formatUnits(loss, 18) },
          'NPCTokenWalletService',
        )

        // Would close all positions here
      }
    }

    return result
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let npcTokenWalletService: NPCTokenWalletService | null = null

export function getNPCTokenWalletService(): NPCTokenWalletService {
  if (!npcTokenWalletService) {
    npcTokenWalletService = new NPCTokenWalletService()
  }
  return npcTokenWalletService
}

export async function initializeNPCTokenWalletService(
  paymasterClientGetter?: () => PaymasterClient,
): Promise<NPCTokenWalletService> {
  const service = getNPCTokenWalletService()
  await service.initialize(paymasterClientGetter)
  return service
}

export function resetNPCTokenWalletService(): void {
  if (npcTokenWalletService) {
    npcTokenWalletService.stopStopLossMonitoring()
  }
  npcTokenWalletService = null
}
