/**
 * NPC On-Chain Trading Service
 *
 * Bridges NPC trading decisions to on-chain execution on Jeju network.
 * Integrates with:
 * - NPCTokenWalletService for wallet management
 * - Diamond contracts for market operations
 * - ERC-4337 paymaster for gasless BBLN-funded transactions
 * - Stop-loss automation
 *
 * @packageDocumentation
 */

import {
  getNPCIdentityService,
  getNPCTokenWalletService,
  initializeNPCTokenWalletService,
  STOP_LOSS_CONFIG,
} from '@babylon/agents';
import { getPaymasterClient } from '@babylon/api';
import { db, npcTrades } from '@babylon/db';
import { generateSnowflakeId, logger } from '@babylon/shared';
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  keccak256,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { TradingDecision } from '../types/market-decisions';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface OnChainConfig {
  rpcUrl: string;
  diamondAddress: Address;
  tokenAddress: Address;
  chainId: number;
}

function getOnChainConfig(): OnChainConfig {
  return {
    rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:9545',
    diamondAddress: (process.env.DIAMOND_ADDRESS ?? '0x0') as Address,
    tokenAddress: (process.env.BBLN_TOKEN_ADDRESS ?? '0x0') as Address,
    chainId: parseInt(process.env.JEJU_CHAIN_ID ?? '31337'),
  };
}

// =============================================================================
// TYPES
// =============================================================================

export interface OnChainTradeResult {
  success: boolean;
  txHash: Hex | null;
  gasUsed: bigint;
  error?: string;
}

export interface BatchTradeResult {
  totalDecisions: number;
  onChainTrades: number;
  offChainTrades: number;
  failed: number;
  stopLossTriggered: number;
  results: OnChainTradeResult[];
}

// =============================================================================
// NPC KEY MANAGEMENT
// =============================================================================

import { getNPCMasterKey } from '../config/dev-keys';

/**
 * NPC private key derivation
 * Uses deterministic derivation from master key + actor ID
 * In production, keys should be managed via KMS
 */
function getNPCPrivateKey(actorId: string): Hex {
  const masterKey = getNPCMasterKey();
  const derivedKey = keccak256(toHex(`${masterKey}:${actorId}`));
  return derivedKey;
}

// =============================================================================
// SERVICE
// =============================================================================

export class NPCOnChainTradingService {
  private config: OnChainConfig;
  private publicClient: ReturnType<typeof createPublicClient>;
  private chain: Chain;
  private initialized = false;

  constructor() {
    this.config = getOnChainConfig();
    this.chain = {
      id: this.config.chainId,
      name: 'Jeju',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [this.config.rpcUrl] },
      },
    };
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Pass paymaster client getter to avoid circular dependency
    await initializeNPCTokenWalletService(getPaymasterClient);
    const walletService = getNPCTokenWalletService();
    walletService.startStopLossMonitoring();

    this.initialized = true;
    logger.info(
      'NPCOnChainTradingService initialized',
      undefined,
      'NPCOnChainTradingService'
    );
  }

  /**
   * Execute a batch of NPC trading decisions on-chain
   */
  async executeBatchOnChain(
    decisions: TradingDecision[]
  ): Promise<BatchTradeResult> {
    const result: BatchTradeResult = {
      totalDecisions: decisions.length,
      onChainTrades: 0,
      offChainTrades: 0,
      failed: 0,
      stopLossTriggered: 0,
      results: [],
    };

    for (const decision of decisions) {
      if (decision.action === 'hold') continue;

      const stopLossCheck = await this.checkStopLoss(decision.npcId);
      if (stopLossCheck.triggered) {
        result.stopLossTriggered++;
        result.results.push({
          success: false,
          txHash: null,
          gasUsed: 0n,
          error: `Stop-loss triggered: ${stopLossCheck.reason}`,
        });
        continue;
      }

      const tradeResult = await this.executeTradeOnChain(decision);
      result.results.push(tradeResult);

      if (tradeResult.success) {
        result.onChainTrades++;
      } else {
        result.failed++;
      }
    }

    logger.info(
      `Batch on-chain trading completed`,
      {
        total: result.totalDecisions,
        onChain: result.onChainTrades,
        failed: result.failed,
        stopLoss: result.stopLossTriggered,
      },
      'NPCOnChainTradingService'
    );

    return result;
  }

  /**
   * Execute a single trade on-chain
   */
  async executeTradeOnChain(
    decision: TradingDecision
  ): Promise<OnChainTradeResult> {
    const actorId = decision.npcId.toLowerCase();
    const identityService = getNPCIdentityService();
    const identity = await identityService.getNPCIdentity(actorId);

    if (!identity?.walletAddress) {
      return {
        success: false,
        txHash: null,
        gasUsed: 0n,
        error: `NPC ${actorId} has no wallet`,
      };
    }

    const walletService = getNPCTokenWalletService();
    const balance = await walletService.getBalance(actorId);

    if (balance.totalValue < STOP_LOSS_CONFIG.MIN_BALANCE) {
      return {
        success: false,
        txHash: null,
        gasUsed: 0n,
        error: `NPC ${actorId} below minimum balance`,
      };
    }

    const privateKey = getNPCPrivateKey(actorId);
    const account = privateKeyToAccount(privateKey);

    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });

    // Determine market type and execute
    if (decision.marketType === 'prediction') {
      return this.executePredictionTrade(decision, walletClient);
    } else {
      return this.executePerpTrade(decision, walletClient);
    }
  }

  /**
   * Execute prediction market trade
   */
  private async executePredictionTrade(
    decision: TradingDecision,
    walletClient: ReturnType<typeof createWalletClient>
  ): Promise<OnChainTradeResult> {
    if (!decision.marketId) {
      return {
        success: false,
        txHash: null,
        gasUsed: 0n,
        error: 'No market ID provided',
      };
    }

    const marketIdBytes = keccak256(toHex(String(decision.marketId)));
    const outcome = decision.action === 'buy_yes' ? 0 : 1;
    const shares = BigInt(Math.floor(decision.amount * 1e18));
    const functionName = decision.action.startsWith('buy')
      ? 'buyShares'
      : 'sellShares';

    const abi = [
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
    ] as const;

    const txHash = await walletClient.writeContract({
      chain: this.chain,
      account: walletClient.account!,
      address: this.config.diamondAddress,
      abi,
      functionName,
      args: [marketIdBytes, outcome, shares],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    await this.recordNPCTrade(decision, txHash);

    const walletService = getNPCTokenWalletService();
    await walletService.syncBalanceToDb(decision.npcId);

    return {
      success: receipt.status === 'success',
      txHash,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Execute perpetual trade
   */
  private async executePerpTrade(
    decision: TradingDecision,
    walletClient: ReturnType<typeof createWalletClient>
  ): Promise<OnChainTradeResult> {
    if (!decision.ticker) {
      return {
        success: false,
        txHash: null,
        gasUsed: 0n,
        error: 'No ticker provided',
      };
    }

    const marketIdBytes = keccak256(toHex(decision.ticker));
    const side = decision.action === 'open_long' ? 0 : 1;
    const size = BigInt(Math.floor(decision.amount * 1e18));
    const collateral = size / 5n; // 5x leverage

    if (decision.action === 'close_position') {
      const closeAbi = [
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
      ] as const;

      const txHash = await walletClient.writeContract({
        chain: this.chain,
        account: walletClient.account!,
        address: this.config.diamondAddress,
        abi: closeAbi,
        functionName: 'closePosition',
        args: [marketIdBytes, 0n],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      await this.recordNPCTrade(decision, txHash);

      return {
        success: receipt.status === 'success',
        txHash,
        gasUsed: receipt.gasUsed,
      };
    }

    const openAbi = [
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
    ] as const;

    const maxPrice = BigInt(2) ** BigInt(128) - BigInt(1);
    const txHash = await walletClient.writeContract({
      chain: this.chain,
      account: walletClient.account!,
      address: this.config.diamondAddress,
      abi: openAbi,
      functionName: 'openPosition',
      args: [marketIdBytes, side, size, collateral, maxPrice],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    await this.recordNPCTrade(decision, txHash);

    const walletService = getNPCTokenWalletService();
    await walletService.syncBalanceToDb(decision.npcId);

    return {
      success: receipt.status === 'success',
      txHash,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Record NPC trade in database
   */
  private async recordNPCTrade(
    decision: TradingDecision,
    txHash: Hex
  ): Promise<void> {
    await db.insert(npcTrades).values({
      id: await generateSnowflakeId(),
      npcActorId: decision.npcId,
      poolId: null,
      marketType: decision.marketType ?? 'perp',
      ticker: decision.ticker ?? null,
      marketId: decision.marketId?.toString() ?? null,
      action: decision.action,
      side:
        decision.action.includes('long') || decision.action === 'buy_yes'
          ? 'long'
          : 'short',
      amount: decision.amount,
      price: 0,
      sentiment: decision.confidence,
      reason: decision.reasoning,
    });

    logger.info(
      `Recorded NPC on-chain trade`,
      { npcId: decision.npcId, action: decision.action, txHash },
      'NPCOnChainTradingService'
    );
  }

  /**
   * Check stop-loss status for NPC
   */
  private async checkStopLoss(
    actorId: string
  ): Promise<{ triggered: boolean; reason: string }> {
    const walletService = getNPCTokenWalletService();
    const result = await walletService.checkStopLossForNPC(actorId);
    return { triggered: result.triggered, reason: result.reason };
  }

  /**
   * Get NPC's on-chain positions
   */
  async getNPCPositions(actorId: string): Promise<{
    prediction: Array<{ marketId: Hex; outcome: number; shares: bigint }>;
    perp: Array<{
      marketId: Hex;
      side: number;
      size: bigint;
      collateral: bigint;
      entryPrice: bigint;
    }>;
  }> {
    const identityService = getNPCIdentityService();
    const identity = await identityService.getNPCIdentity(actorId);

    if (!identity?.walletAddress) {
      return { prediction: [], perp: [] };
    }

    // Would read from on-chain contracts here
    return { prediction: [], perp: [] };
  }

  /**
   * Emergency close all positions for NPC
   */
  async emergencyCloseAllPositions(actorId: string): Promise<{
    positionsClosed: number;
    txHashes: Hex[];
  }> {
    const positions = await this.getNPCPositions(actorId);
    const txHashes: Hex[] = [];

    const privateKey = getNPCPrivateKey(actorId);
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });

    const closeAbi = [
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
    ] as const;

    const sellAbi = [
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
    ] as const;

    for (const pos of positions.perp) {
      const txHash = await walletClient.writeContract({
        chain: this.chain,
        account,
        address: this.config.diamondAddress,
        abi: closeAbi,
        functionName: 'closePosition',
        args: [pos.marketId, 0n],
      });
      txHashes.push(txHash);
    }

    for (const pos of positions.prediction) {
      const txHash = await walletClient.writeContract({
        chain: this.chain,
        account,
        address: this.config.diamondAddress,
        abi: sellAbi,
        functionName: 'sellShares',
        args: [pos.marketId, pos.outcome, pos.shares],
      });
      txHashes.push(txHash);
    }

    logger.info(
      `Emergency closed all positions for NPC ${actorId}`,
      { positionsClosed: txHashes.length },
      'NPCOnChainTradingService'
    );

    return { positionsClosed: txHashes.length, txHashes };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let npcOnChainTradingService: NPCOnChainTradingService | null = null;

export function getNPCOnChainTradingService(): NPCOnChainTradingService {
  if (!npcOnChainTradingService) {
    npcOnChainTradingService = new NPCOnChainTradingService();
  }
  return npcOnChainTradingService;
}

export async function initializeNPCOnChainTradingService(): Promise<NPCOnChainTradingService> {
  const service = getNPCOnChainTradingService();
  await service.initialize();
  return service;
}

export function resetNPCOnChainTradingService(): void {
  npcOnChainTradingService = null;
}
