/**
 * Direct Executors for Multi-Step Agent Actions
 *
 * These are "dumb" executors that take specific parameters and execute directly
 * without making their own LLM calls. The multi-step decision loop handles all
 * LLM reasoning - these just execute the decided actions.
 */

import {
  broadcastAgentActivity,
  broadcastChatMessage,
  broadcastToChannel,
  type CommentActivityData,
  cachedDb,
  type MessageActivityData,
  notifyGroupChatMessage,
  type PostActivityData,
} from '@babylon/api';
import { PerpDbAdapter, PerpMarketService } from '@babylon/core/markets/perps';
import {
  PredictionDbAdapter,
  PredictionMarketService,
} from '@babylon/core/markets/prediction';
import {
  type DrizzleClient,
  deleteFollowByFollowerAndFollowingReturningId,
  fetchChatNameById,
  insertCommentRowForDirectExecutor,
  insertDirectExecutorDmChatBundle,
  insertFollowOnConflictDoNothingReturningId,
  insertMessageRow,
  insertPostRowForDirectExecutor,
  insertReactionLikeOnConflictDoNothingReturningId,
  insertShareAndOptionalQuotePostInTransaction,
  type JsonValue,
  npcActorStateAtomicCredit,
  npcActorStateAtomicDebit,
  selectActorStateIdOnlyById,
  selectChatIdById,
  selectChatParticipantUserIdsByChatId,
  selectCommentIdById,
  selectDmChatIdBetweenUsers,
  selectExistingDirectCommentReply,
  selectExistingDirectTopLevelComment,
  selectNpcActorTradingBalance,
  selectOpenPerpPositionByUserIdTicker,
  selectPostIdById,
  selectPostRepostSliceById,
  selectShareIdByUserIdAndPostId,
  selectUserDisplayAndUsernameById,
  selectUserIdAndIsActorById,
  selectUserIdOnlyById,
  selectUserManagedByById,
  type Transaction,
} from '@babylon/db';
import * as engineStorage from '@babylon/db/engine-storage';

const db = engineStorage.db;

import {
  createPerpPriceImpactPort,
  FEE_CONFIG,
  FeeService,
  type GeneratedTag,
  generateTagsFromPost,
  invalidateAfterPredictionTrade,
  PredictionPricing,
  StaticDataRegistry,
  storeTagsForPost,
  WalletService,
} from '@babylon/engine';
import { isPureRepost } from '@babylon/shared';
import { agentPnLService } from '../services/AgentPnLService';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';
import { topicDiversityService } from './TopicDiversityService';
import { resolvePerpTicker } from './utils/resolvePerpTicker';

/**
 * Helper to get agent display name for broadcasting.
 *
 * Currently called only within `if (!isNpc)` blocks, but includes a defensive
 * NPC check for reusability. The StaticDataRegistry lookup is O(1) so this
 * adds negligible overhead while future-proofing the helper for callers that
 * may not have already performed the NPC check.
 */
async function getAgentDisplayName(agentUserId: string): Promise<string> {
  // Defensive NPC check - O(1) fast-path for potential future callers
  // that haven't already verified the agent is not an NPC
  const npcActor = StaticDataRegistry.getActor(agentUserId);
  if (npcActor) {
    return npcActor.name;
  }

  const row = await selectUserDisplayAndUsernameById(db, agentUserId);
  return row?.displayName ?? 'Agent';
}

const SHARE_LIKE_MAX_INTEGER = 10;
const SHARE_LIKE_RATIO_THRESHOLD = 0.01;
// Minimum shares threshold - positions with fewer shares are considered closed
const MIN_SHARES_THRESHOLD = 0.01;

// =============================================================================
// Wallet Adapter Helper
// =============================================================================

/**
 * Creates a wallet adapter for perp trading operations.
 * NPCs use actorState.tradingBalance, while regular users use WalletService.
 */
function createPerpWalletAdapter(isNpc: boolean) {
  if (isNpc) {
    return {
      debit: async ({
        userId: uid,
        amount: amt,
      }: {
        userId: string;
        amount: number;
        reason: string;
        description?: string;
        relatedId?: string;
      }) => {
        // Atomic debit with balance check to prevent negative balance
        const result = await npcActorStateAtomicDebit(db, uid, amt);

        if (result.length === 0) {
          throw new Error(`Insufficient NPC balance for perp trade: $${amt}`);
        }
      },
      credit: async ({
        userId: uid,
        amount: amt,
      }: {
        userId: string;
        amount: number;
        reason: string;
        description?: string;
        relatedId?: string;
      }) => {
        await npcActorStateAtomicCredit(db, uid, amt);
      },
      recordPnL: async (_args: {
        userId: string;
        pnl: number;
        reason: string;
        relatedId?: string;
      }) => {
        // NPCs don't track PnL
      },
      getBalance: async (uid: string) => {
        const actor = await selectNpcActorTradingBalance(db, uid);
        return {
          balance: Number(actor?.tradingBalance ?? 10000),
          totalDeposited: 0,
          totalWithdrawn: 0,
          lifetimePnL: 0,
        };
      },
    };
  }

  return {
    debit: ({
      userId: uid,
      amount: amt,
      reason,
      description,
      relatedId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      description?: string;
      relatedId?: string;
    }) => WalletService.debit(uid, amt, reason, description ?? '', relatedId),
    credit: ({
      userId: uid,
      amount: amt,
      reason,
      description,
      relatedId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      description?: string;
      relatedId?: string;
    }) => WalletService.credit(uid, amt, reason, description ?? '', relatedId),
    recordPnL: async ({
      userId: uid,
      pnl,
      reason,
      relatedId,
    }: {
      userId: string;
      pnl: number;
      reason: string;
      relatedId?: string;
    }) => {
      await WalletService.recordPnL(uid, pnl, reason, relatedId);
    },
    getBalance: (uid: string) => WalletService.getBalance(uid),
  };
}

/** PnL record to be processed after transaction completes */
interface DeferredPnLRecord {
  userId: string;
  pnl: number;
  reason: string;
  relatedId?: string;
}

/**
 * Creates a wallet adapter for prediction market trading operations.
 *
 * - NPCs use actorState.tradingBalance (within the provided transaction context).
 * - Regular users use WalletService.
 *
 * IMPORTANT: recordPnL is deferred to avoid nested transaction deadlocks.
 * The caller must process deferredPnL after the transaction completes.
 */
function createPredictionWalletAdapter(
  isNpc: boolean,
  txDb?: DrizzleClient | Transaction,
  deferredPnL?: DeferredPnLRecord[]
) {
  if (isNpc) {
    if (!txDb) {
      throw new Error('Transaction context required for NPC prediction wallet');
    }
    return {
      debit: async ({
        userId: uid,
        amount: amt,
      }: {
        userId: string;
        amount: number;
        reason: string;
        description?: string;
        relatedId?: string;
      }) => {
        const result = await npcActorStateAtomicDebit(txDb, uid, amt);

        if (result.length === 0) {
          throw new Error(
            `Insufficient NPC balance for prediction trade: $${amt}`
          );
        }
      },
      credit: async ({
        userId: uid,
        amount: amt,
      }: {
        userId: string;
        amount: number;
        reason: string;
        description?: string;
        relatedId?: string;
      }) => {
        await npcActorStateAtomicCredit(txDb, uid, amt);
      },
      recordPnL: async (_args: {
        userId: string;
        pnl: number;
        reason: string;
        relatedId?: string;
      }) => {
        // NPCs don't track PnL
      },
      getBalance: async (uid: string) => {
        const actor = await selectNpcActorTradingBalance(txDb, uid);
        return {
          balance: Number(actor?.tradingBalance ?? 0),
          totalDeposited: 0,
          totalWithdrawn: 0,
          lifetimePnL: 0,
        };
      },
    };
  }

  return {
    debit: ({
      userId: uid,
      amount: amt,
      reason,
      description,
      relatedId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      description?: string;
      relatedId?: string;
    }) =>
      WalletService.debit(uid, amt, reason, description ?? '', relatedId, txDb),
    credit: ({
      userId: uid,
      amount: amt,
      reason,
      description,
      relatedId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      description?: string;
      relatedId?: string;
    }) =>
      WalletService.credit(
        uid,
        amt,
        reason,
        description ?? '',
        relatedId,
        txDb
      ),
    recordPnL: async ({
      userId: uid,
      pnl,
      reason,
      relatedId,
    }: {
      userId: string;
      pnl: number;
      reason: string;
      relatedId?: string;
    }) => {
      // Defer PnL recording to avoid nested transaction deadlocks
      // The PnL will be recorded after the transaction completes
      if (deferredPnL) {
        deferredPnL.push({ userId: uid, pnl, reason, relatedId });
      } else {
        // Fallback for callers that don't use deferredPnL (shouldn't happen in new code)
        await WalletService.recordPnL(uid, pnl, reason, relatedId);
      }
    },
    getBalance: (uid: string) => WalletService.getBalance(uid),
  };
}

// =============================================================================
// Types
// =============================================================================

export interface DirectTradeParams {
  agentUserId: string;
  marketType: 'prediction' | 'perp';
  marketId: string; // Market ID for prediction, ticker/name/id for perp
  side:
    | 'buy_yes'
    | 'buy_no'
    | 'sell_yes'
    | 'sell_no'
    | 'open_long'
    | 'open_short'
    | 'close_position';
  amount: number;
  reasoning?: string;
  /**
   * Skip resolving the perp ticker when the caller already passed the canonical ticker.
   * Useful for services that call resolvePerpTicker upstream.
   */
  skipPerpResolution?: boolean;
}

export interface DirectTradeResult {
  success: boolean;
  marketId?: string;
  ticker?: string;
  side?: string;
  shares?: number;
  error?: string;
}

export interface DirectPostParams {
  agentUserId: string;
  content: string;
}

export interface DirectPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface DirectCommentParams {
  agentUserId: string;
  postId: string;
  content: string;
  parentCommentId?: string;
}

export interface DirectCommentResult {
  success: boolean;
  commentId?: string;
  error?: string;
}

export interface DirectMessageParams {
  agentUserId: string;
  chatId?: string;
  recipientId?: string;
  content: string;
}

export interface DirectMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DirectLikeParams {
  agentUserId: string;
  postId: string;
}

export interface DirectLikeResult {
  success: boolean;
  liked?: boolean;
  error?: string;
}

export interface DirectRepostParams {
  agentUserId: string;
  postId: string;
  comment?: string;
}

export interface DirectRepostResult {
  success: boolean;
  repostId?: string;
  quotePostId?: string;
  error?: string;
}

export interface DirectFollowParams {
  agentUserId: string;
  targetUserId: string;
}

export interface DirectFollowResult {
  success: boolean;
  followed?: boolean;
  alreadyFollowing?: boolean;
  unfollowed?: boolean;
  wasFollowing?: boolean;
  targetUserId?: string;
  error?: string;
}

// =============================================================================
// Direct Trade Executor
// =============================================================================

/**
 * Execute a trade directly without LLM decision-making.
 * Validates balance for entry trades; exit trades (sell_yes/sell_no/close_position)
 * can close positions even when balance is $0.
 */
export async function executeDirectTrade(
  params: DirectTradeParams
): Promise<DirectTradeResult> {
  const { agentUserId, marketType, marketId, side, reasoning } = params;
  let { amount } = params;

  if (!Number.isFinite(amount)) {
    return {
      success: false,
      error: 'Invalid trade amount. Must be a finite number.',
    };
  }

  // Check if this is an NPC (system-defined actor from static data files).
  // User-created agents are NOT in StaticDataRegistry, so they won't match.
  // This ensures only system NPCs skip broadcasting - user agents always broadcast.
  const npcActor = StaticDataRegistry.getActor(agentUserId);
  const isNpc = !!npcActor;

  const isExitTrade =
    (marketType === 'prediction' &&
      (side === 'sell_yes' || side === 'sell_no')) ||
    (marketType === 'perp' && side === 'close_position');

  // Get current balance
  let balance = 0;
  if (isNpc) {
    const actor = await selectNpcActorTradingBalance(db, agentUserId);
    balance = Number(actor?.tradingBalance ?? 0);
  } else {
    const walletBalance = await WalletService.getBalance(agentUserId);
    balance = walletBalance.balance;
  }

  if (!isExitTrade) {
    const looksLikeShareCount =
      Number.isInteger(amount) &&
      amount >= 1 &&
      amount <= SHARE_LIKE_MAX_INTEGER &&
      balance > 0 &&
      amount / balance < SHARE_LIKE_RATIO_THRESHOLD;
    if (looksLikeShareCount) {
      logger.warn(
        `[DirectExecutor] Trade amount $${amount.toFixed(
          2
        )} looks like a share count relative to $${balance.toFixed(
          2
        )} balance. Expected Babylon Points.`,
        { agentUserId, marketType, side, balance },
        'DirectExecutors'
      );
    }

    // Cannot trade more than balance
    if (amount > balance) {
      logger.warn(
        `[DirectExecutor] Trade capped to balance: $${amount} -> $${balance}`,
        { agentUserId, isNpc },
        'DirectExecutors'
      );
      amount = balance;
    }

    // Reject if insufficient funds
    if (amount < 1) {
      return {
        success: false,
        error: `Insufficient balance: $${balance.toFixed(2)}`,
      };
    }
  } else if (amount < 0) {
    return {
      success: false,
      error: 'Amount must be 0 or greater for exit trades',
    };
  }

  // Get agent's managed by for recording (for USER_CONTROLLED agents)
  const agentManagedBy = agentUserId;

  logger.info(
    `[DirectExecutor] Executing ${marketType} trade: ${side} $${amount} on ${marketId}`,
    { agentUserId, isNpc, balance },
    'DirectExecutors'
  );

  if (marketType === 'prediction') {
    // Handle sell (close prediction position)
    if (side === 'sell_yes' || side === 'sell_no') {
      return executePredictionSell({
        agentUserId,
        marketId,
        side: side as 'sell_yes' | 'sell_no',
        amount,
        reasoning,
        isNpc,
        agentManagedBy,
      });
    }

    return executePredictionTrade({
      agentUserId,
      marketId,
      side: side as 'buy_yes' | 'buy_no',
      amount,
      reasoning,
      isNpc,
      agentManagedBy,
    });
  }

  const perpTicker = params.skipPerpResolution
    ? marketId
    : resolvePerpTicker(marketId)?.ticker;

  if (!perpTicker) {
    return { success: false, error: `Perp market not found: ${marketId}` };
  }

  // Handle close_position
  if (side === 'close_position') {
    return executeClosePerpPosition({
      agentUserId,
      ticker: perpTicker,
      reasoning,
      isNpc,
      agentManagedBy,
    });
  }

  return executePerpTrade({
    agentUserId,
    ticker: perpTicker,
    side: side as 'open_long' | 'open_short',
    amount,
    reasoning,
    isNpc,
    agentManagedBy,
  });
}

async function executePredictionTrade(params: {
  agentUserId: string;
  marketId: string;
  side: 'buy_yes' | 'buy_no';
  amount: number;
  reasoning?: string;
  isNpc: boolean;
  agentManagedBy: string;
}): Promise<DirectTradeResult> {
  const {
    agentUserId,
    marketId,
    side,
    amount,
    reasoning,
    isNpc,
    agentManagedBy,
  } = params;

  const isBuyYes = side === 'buy_yes';
  const sideLabel = isBuyYes ? 'yes' : 'no';

  const tradeOperation = async (
    txDb: Parameters<Parameters<typeof engineStorage.asUser>[1]>[0]
  ) => {
    const service = new PredictionMarketService({
      db: new PredictionDbAdapter(txDb),
      wallet: createPredictionWalletAdapter(isNpc, txDb),
      broadcast: {
        emit: (channel, payload) =>
          broadcastToChannel(channel, payload as Record<string, JsonValue>),
      },
      cache: { invalidate: () => invalidateAfterPredictionTrade(marketId) },
      fees: {
        tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
        platformShare: FEE_CONFIG.PLATFORM_SHARE,
        referrerShare: FEE_CONFIG.REFERRER_SHARE,
        minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
      },
      tradeSource: isNpc ? 'npc_trade' : 'user_trade',
      tradeActorType: isNpc ? 'npc' : 'user',
      feeProcessor: isNpc
        ? undefined
        : {
            processTradingFee: ({
              userId,
              amount,
              type,
              relatedId,
              positionId,
            }) =>
              FeeService.processTradingFee(
                userId,
                type as (typeof FEE_CONFIG.FEE_TYPES)[keyof typeof FEE_CONFIG.FEE_TYPES],
                amount,
                positionId,
                relatedId,
                txDb // Pass the existing transaction to avoid nested transaction deadlocks
              ),
          },
    });

    return service.buy({
      userId: agentUserId,
      marketId,
      side: sideLabel,
      amount,
    });
  };

  const result = isNpc
    ? await engineStorage.asSystem(tradeOperation, 'npc_prediction_trade')
    : await engineStorage.asUser({ userId: agentUserId }, tradeOperation);

  // Record in AgentTrade
  await agentPnLService.recordTrade({
    agentId: agentUserId,
    userId: agentManagedBy,
    marketType: 'prediction',
    marketId,
    action: 'open',
    side: sideLabel,
    amount,
    price: result.avgPrice,
    reasoning,
  });

  const sharesRounded = Math.round(result.shares * 100) / 100;

  logger.info(
    `[DirectExecutor] Prediction trade executed: ${isBuyYes ? 'YES' : 'NO'} on market ${marketId}`,
    { shares: sharesRounded },
    'DirectExecutors'
  );

  return {
    success: true,
    marketId,
    side: isBuyYes ? 'YES' : 'NO',
    shares: sharesRounded,
  };
}

/**
 * Sell (close) a prediction market position
 */
async function executePredictionSell(params: {
  agentUserId: string;
  marketId: string;
  side: 'sell_yes' | 'sell_no';
  amount: number; // Amount in dollars to sell, or 0 for full position
  reasoning?: string;
  isNpc: boolean;
  agentManagedBy: string;
}): Promise<DirectTradeResult> {
  const {
    agentUserId,
    marketId,
    side,
    amount,
    reasoning,
    isNpc,
    agentManagedBy,
  } = params;

  const isSellYes = side === 'sell_yes';
  const sideLabel = isSellYes ? 'yes' : 'no';

  // Collect PnL records to process after transaction completes (avoids nested transaction deadlocks)
  const deferredPnL: DeferredPnLRecord[] = [];

  const sellOperation = async (
    txDb: Parameters<Parameters<typeof engineStorage.asUser>[1]>[0]
  ) => {
    const adapter = new PredictionDbAdapter(txDb);
    const service = new PredictionMarketService({
      db: adapter,
      wallet: createPredictionWalletAdapter(isNpc, txDb, deferredPnL),
      broadcast: {
        emit: (channel, payload) =>
          broadcastToChannel(channel, payload as Record<string, JsonValue>),
      },
      cache: { invalidate: () => invalidateAfterPredictionTrade(marketId) },
      fees: {
        tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
        platformShare: FEE_CONFIG.PLATFORM_SHARE,
        referrerShare: FEE_CONFIG.REFERRER_SHARE,
        minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
      },
      tradeSource: isNpc ? 'npc_trade' : 'user_trade',
      tradeActorType: isNpc ? 'npc' : 'user',
      feeProcessor: isNpc
        ? undefined
        : {
            processTradingFee: ({
              userId,
              amount,
              type,
              relatedId,
              positionId,
            }) =>
              FeeService.processTradingFee(
                userId,
                type as (typeof FEE_CONFIG.FEE_TYPES)[keyof typeof FEE_CONFIG.FEE_TYPES],
                amount,
                positionId,
                relatedId,
                txDb // Pass the existing transaction to avoid nested transaction deadlocks
              ),
          },
    });

    const market = await service.getMarket(marketId);
    if (!market) {
      throw new Error(`Market not found: ${marketId}`);
    }

    const position = await adapter.getPosition(
      agentUserId,
      marketId,
      sideLabel
    );
    if (
      !position ||
      position.status === 'closed' ||
      position.shares <= MIN_SHARES_THRESHOLD
    ) {
      throw new Error(`No open position found for market ${marketId}`);
    }

    const currentPrice = PredictionPricing.getCurrentPrice(
      market.yesShares,
      market.noShares,
      sideLabel
    );
    const safePrice = currentPrice > 0 ? currentPrice : 1e-9;

    // If amount is 0, close full position. Otherwise, approximate shares by current probability.
    const sharesToSell =
      amount > 0
        ? Math.min(position.shares, amount / safePrice)
        : position.shares;

    if (sharesToSell <= MIN_SHARES_THRESHOLD) {
      throw new Error('Amount too small to sell any shares');
    }

    const sellResult = await service.sell({
      userId: agentUserId,
      marketId,
      shares: sharesToSell,
      positionId: position.id,
    });

    return { sellResult, sharesToSell };
  };

  const { sellResult, sharesToSell } = isNpc
    ? await engineStorage.asSystem(sellOperation, 'npc_prediction_sell')
    : await engineStorage.asUser({ userId: agentUserId }, sellOperation);

  // Process deferred PnL records AFTER transaction completes (avoids nested transaction deadlocks)
  for (const pnlRecord of deferredPnL) {
    if (pnlRecord.pnl === 0) continue;
    await WalletService.recordPnL(
      pnlRecord.userId,
      pnlRecord.pnl,
      pnlRecord.reason,
      pnlRecord.relatedId
    );
  }

  // Record in AgentTrade
  await agentPnLService.recordTrade({
    agentId: agentUserId,
    userId: agentManagedBy,
    marketType: 'prediction',
    marketId,
    action: 'close',
    side: sideLabel,
    amount: sellResult.netProceeds ?? 0,
    price: sellResult.avgPrice,
    pnl: sellResult.pnl,
    reasoning,
  });

  logger.info(
    `[DirectExecutor] Prediction sell executed: ${isSellYes ? 'YES' : 'NO'} on market ${marketId}`,
    { sharesSold: sharesToSell, remaining: sellResult.remainingShares },
    'DirectExecutors'
  );

  return {
    success: true,
    marketId,
    side: `sold_${isSellYes ? 'YES' : 'NO'}`,
    shares: sharesToSell,
  };
}

async function executePerpTrade(params: {
  agentUserId: string;
  ticker: string;
  side: 'open_long' | 'open_short';
  amount: number;
  reasoning?: string;
  isNpc: boolean;
  agentManagedBy: string;
}): Promise<DirectTradeResult> {
  const {
    agentUserId,
    ticker,
    side,
    amount,
    reasoning,
    isNpc,
    agentManagedBy,
  } = params;

  const perpSide = side === 'open_long' ? 'long' : 'short';

  // Get org for price (search through all orgs by ticker)
  const allOrgs = StaticDataRegistry.getAllOrganizations();
  const org = allOrgs.find((o) => o.ticker === ticker);
  const currentPrice = org?.initialPrice ?? 100;

  const perpTradeOperation = async () => {
    const walletAdapter = createPerpWalletAdapter(isNpc);

    const service = new PerpMarketService({
      db: new PerpDbAdapter(),
      wallet: walletAdapter,
      fees: {
        tradingFeeRate: 0.001,
        platformShare: 0.5,
        referrerShare: 0.5,
        minFeeAmount: 0.01,
      },
      priceImpact: createPerpPriceImpactPort(),
    });

    await service.openPosition({
      userId: agentUserId,
      ticker,
      side: perpSide,
      size: amount,
      leverage: 1,
    });
  };

  // Execute with appropriate context
  if (isNpc) {
    await engineStorage.asSystem(perpTradeOperation, 'npc_perp_trade');
  } else {
    await engineStorage.asUser({ userId: agentUserId }, perpTradeOperation);
  }

  // Record trade
  await agentPnLService.recordTrade({
    agentId: agentUserId,
    userId: agentManagedBy,
    marketType: 'perp',
    ticker,
    action: 'open',
    side: perpSide,
    amount,
    price: currentPrice,
    reasoning,
  });

  logger.info(
    `[DirectExecutor] Perp trade executed: ${perpSide} $${amount} on ${ticker}`,
    undefined,
    'DirectExecutors'
  );

  return {
    success: true,
    ticker,
    side: perpSide,
  };
}

/**
 * Close an existing perp position
 */
async function executeClosePerpPosition(params: {
  agentUserId: string;
  ticker: string;
  reasoning?: string;
  isNpc: boolean;
  agentManagedBy: string;
}): Promise<DirectTradeResult> {
  const { agentUserId, ticker, reasoning, isNpc, agentManagedBy } = params;

  const existingPosition = await selectOpenPerpPositionByUserIdTicker(
    db,
    agentUserId,
    ticker
  );

  if (!existingPosition) {
    return {
      success: false,
      error: `No open position found for ${ticker}`,
    };
  }

  const closeOperation = async () => {
    const walletAdapter = createPerpWalletAdapter(isNpc);

    const service = new PerpMarketService({
      db: new PerpDbAdapter(),
      wallet: walletAdapter,
      fees: {
        tradingFeeRate: 0.001,
        platformShare: 0.5,
        referrerShare: 0.5,
        minFeeAmount: 0.01,
      },
      priceImpact: createPerpPriceImpactPort(),
    });

    // Capture the result from closePosition to get accurate realizedPnL
    const result = await service.closePosition({
      positionId: existingPosition.id,
      userId: agentUserId,
    });

    return result;
  };

  // Execute with appropriate context and capture the result
  const closeResult = isNpc
    ? await engineStorage.asSystem(closeOperation, 'npc_perp_close')
    : await engineStorage.asUser({ userId: agentUserId }, closeOperation);

  // Use the realized P&L from the service (computed with actual exit price)
  // This is more accurate than recalculating from potentially stale position data
  // closePosition() always returns these fields - validate at runtime for safety
  if (
    closeResult.realizedPnL == null ||
    closeResult.exitPrice == null ||
    closeResult.size == null
  ) {
    throw new Error(
      `[DirectExecutor] closePosition did not return expected fields: realizedPnL=${closeResult.realizedPnL}, exitPrice=${closeResult.exitPrice}, size=${closeResult.size}`
    );
  }
  const { realizedPnL, size, exitPrice } = closeResult;

  // Record trade
  await agentPnLService.recordTrade({
    agentId: agentUserId,
    userId: agentManagedBy,
    marketType: 'perp',
    ticker,
    action: 'close',
    side: existingPosition.side as 'long' | 'short',
    amount: size,
    price: exitPrice,
    pnl: realizedPnL,
    reasoning,
  });

  logger.info(
    `[DirectExecutor] Perp position closed: ${existingPosition.side} $${size} on ${ticker} (P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)})`,
    undefined,
    'DirectExecutors'
  );

  return {
    success: true,
    ticker,
    side: `closed_${existingPosition.side}`,
  };
}

// =============================================================================
// Direct Post Executor
// =============================================================================

/**
 * Create a post directly without LLM decision-making.
 * Validates content for diversity before creating.
 */
export async function executeDirectPost(
  params: DirectPostParams
): Promise<DirectPostResult> {
  const { agentUserId, content } = params;

  if (!content || content.trim().length < 5) {
    return { success: false, error: 'Content too short' };
  }

  const cleanContent = content.trim();

  // DIVERSITY CHECK: Validate content before creating post
  const diversityIssues = topicDiversityService.validateContent(
    agentUserId,
    cleanContent
  );

  if (diversityIssues.length > 0) {
    logger.warn(
      `[DirectExecutor] Post rejected for diversity issues`,
      {
        agentUserId,
        issues: diversityIssues,
        contentPreview: cleanContent.substring(0, 100),
      },
      'DirectExecutors'
    );

    return {
      success: false,
      error: `Content rejected: ${diversityIssues[0]}`,
    };
  }

  // Check if this is an NPC (system-defined actor from static data files).
  // User-created agents are NOT in StaticDataRegistry, so they won't match.
  const npcActor = StaticDataRegistry.getActor(agentUserId);
  const isNpc = !!npcActor;

  logger.info(
    `[DirectExecutor] Creating post for ${isNpc ? 'NPC' : 'user'} ${agentUserId}`,
    { contentPreview: cleanContent.substring(0, 50) },
    'DirectExecutors'
  );

  // Create the post
  const postId = await generateSnowflakeId();
  const now = new Date();

  await insertPostRowForDirectExecutor(db, {
    id: postId,
    content: cleanContent,
    authorId: agentUserId,
    timestamp: now,
    createdAt: now,
  });

  // Record topic coverage for future diversity checks
  topicDiversityService.recordTopicCoverage(agentUserId, cleanContent);

  // Generate and store tags
  const tags: GeneratedTag[] = await generateTagsFromPost(cleanContent);
  if (tags.length > 0) {
    await storeTagsForPost(postId, tags);
  }

  logger.info(
    `[DirectExecutor] Post created: ${postId}`,
    { tags: tags.length },
    'DirectExecutors'
  );

  // Broadcast activity for real-time UI updates (only for non-NPCs)
  if (!isNpc) {
    const agentName = await getAgentDisplayName(agentUserId);
    const activityData: PostActivityData = {
      postId,
      contentPreview: cleanContent.substring(0, 200),
    };

    broadcastAgentActivity(agentUserId, agentName, 'post', activityData).catch(
      (error: Error) => {
        logger.warn(
          `Failed to broadcast post activity: ${error.message}`,
          { agentUserId, postId },
          'DirectExecutors'
        );
      }
    );
  }

  return {
    success: true,
    postId,
  };
}

// =============================================================================
// Direct Comment Executor
// =============================================================================

/**
 * Create a comment directly without LLM decision-making.
 * Includes deduplication check to prevent agents from:
 * - Making multiple top-level comments on the same post
 * - Making multiple replies to the same parent comment
 */
export async function executeDirectComment(
  params: DirectCommentParams
): Promise<DirectCommentResult> {
  const { agentUserId, postId, content, parentCommentId } = params;

  if (!content || content.trim().length < 3) {
    return { success: false, error: 'Content too short' };
  }

  const cleanContent = content.trim();

  const post = await selectPostIdById(db, postId);

  if (!post) {
    return { success: false, error: `Post not found: ${postId}` };
  }

  if (parentCommentId) {
    const existingReply = await selectExistingDirectCommentReply(
      db,
      postId,
      agentUserId,
      parentCommentId
    );

    if (existingReply) {
      logger.info(
        `[DirectExecutor] Agent already replied to comment ${parentCommentId} - skipping duplicate`,
        { agentUserId, postId, existingReplyId: existingReply.id },
        'DirectExecutors'
      );
      return {
        success: false,
        error: `Already replied to this comment`,
      };
    }

    // Verify parent comment exists
    const parentComment = await selectCommentIdById(db, parentCommentId);

    if (!parentComment) {
      return {
        success: false,
        error: `Parent comment not found: ${parentCommentId}`,
      };
    }
  } else {
    const existingComment = await selectExistingDirectTopLevelComment(
      db,
      postId,
      agentUserId
    );

    if (existingComment) {
      logger.info(
        `[DirectExecutor] Agent already made top-level comment on post ${postId} - skipping duplicate`,
        { agentUserId, existingCommentId: existingComment.id },
        'DirectExecutors'
      );
      return {
        success: false,
        error: `Already commented on this post`,
      };
    }
  }

  logger.info(
    `[DirectExecutor] Creating comment on post ${postId}`,
    { parentCommentId, contentPreview: cleanContent.substring(0, 50) },
    'DirectExecutors'
  );

  const commentId = await generateSnowflakeId();
  const now = new Date();

  await insertCommentRowForDirectExecutor(db, {
    id: commentId,
    content: cleanContent,
    postId,
    authorId: agentUserId,
    parentCommentId: parentCommentId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  logger.info(
    `[DirectExecutor] Comment created: ${commentId}`,
    undefined,
    'DirectExecutors'
  );

  // Broadcast activity for real-time UI updates (only for non-NPCs)
  const isNpc = !!StaticDataRegistry.getActor(agentUserId);
  if (!isNpc) {
    const agentName = await getAgentDisplayName(agentUserId);
    const activityData: CommentActivityData = {
      commentId,
      postId,
      contentPreview: cleanContent.substring(0, 200),
      parentCommentId: parentCommentId ?? null,
    };

    broadcastAgentActivity(
      agentUserId,
      agentName,
      'comment',
      activityData
    ).catch((error: Error) => {
      logger.warn(
        `Failed to broadcast comment activity: ${error.message}`,
        { agentUserId, commentId },
        'DirectExecutors'
      );
    });
  }

  return {
    success: true,
    commentId,
  };
}

// =============================================================================
// Direct Message Executor
// =============================================================================

/**
 * Strip `<think>...</think>` reasoning blocks from content.
 * Removes paired blocks first, then any orphan tags.
 * Returns empty string if only reasoning was present.
 */
function stripThinkTags(text: string): string {
  // Remove paired <think>...</think> blocks
  const withoutBlocks = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Also strip orphan tags (unclosed/unmatched)
  return withoutBlocks.replace(/<\/?think>/gi, '').trim();
}

export async function executeDirectMessage(
  params: DirectMessageParams
): Promise<DirectMessageResult> {
  const { agentUserId, chatId: providedChatId, recipientId, content } = params;

  // Strip think tags and clean content
  const cleanContent = stripThinkTags(content?.trim() ?? '');
  if (cleanContent.length < 3) {
    return {
      success: false,
      error: 'Content too short or only contained thinking',
    };
  }
  let chatId = providedChatId;

  // If chatId not provided, resolve it from recipientId
  if (!chatId && recipientId) {
    // Check if agent is trying to DM their owner - not allowed
    // Agents should communicate with owners through Agents (team chat)
    const agent = await selectUserManagedByById(db, agentUserId);

    if (agent?.managedBy === recipientId) {
      return {
        success: false,
        error: 'Agent-owner DMs are not allowed - use Agents chat instead',
      };
    }

    // Check if recipient exists
    const recipient = await selectUserIdOnlyById(db, recipientId);

    if (!recipient) {
      const npc = await selectActorStateIdOnlyById(db, recipientId);

      if (!npc) {
        return { success: false, error: `Recipient not found: ${recipientId}` };
      }
    }

    const existingDm = await selectDmChatIdBetweenUsers(
      db,
      agentUserId,
      recipientId
    );

    if (existingDm) {
      chatId = existingDm.chatId;
    }

    // If still no chatId, create new DM
    if (!chatId) {
      chatId = await generateSnowflakeId();
      const now = new Date();

      try {
        const participantAgentId = await generateSnowflakeId();
        const participantRecipientId = await generateSnowflakeId();
        const dmAcceptanceId = await generateSnowflakeId();

        await db.transaction(async (tx) => {
          await insertDirectExecutorDmChatBundle(tx, {
            chat: {
              id: chatId!,
              isGroup: false,
              createdAt: now,
              updatedAt: now,
            },
            participants: [
              {
                id: participantAgentId,
                chatId: chatId!,
                userId: agentUserId,
                joinedAt: now,
                isActive: true,
              },
              {
                id: participantRecipientId,
                chatId: chatId!,
                userId: recipientId,
                joinedAt: now,
                isActive: true,
              },
            ],
            dmAcceptance: {
              id: dmAcceptanceId,
              chatId: chatId!,
              userId: recipientId,
              otherUserId: agentUserId,
              status: 'accepted',
              createdAt: now,
              acceptedAt: now,
            },
          });
        });

        logger.info(
          `[DirectExecutor] Created new DM chat ${chatId} between ${agentUserId} and ${recipientId}`,
          undefined,
          'DirectExecutors'
        );
      } catch (error) {
        // Handle race condition - if chat was created by another process, try to find it
        if (error instanceof Error && error.message.includes('duplicate key')) {
          logger.warn(
            `[DirectExecutor] Race condition detected, retrying chat lookup`,
            { agentUserId, recipientId },
            'DirectExecutors'
          );
          const retryMatch = await selectDmChatIdBetweenUsers(
            db,
            agentUserId,
            recipientId
          );

          if (retryMatch) {
            chatId = retryMatch.chatId;
          } else {
            throw error; // Re-throw if we still can't find the chat
          }
        } else {
          throw error;
        }
      }
    }
  }

  if (!chatId) {
    return {
      success: false,
      error: 'Chat ID required or could not be resolved',
    };
  }

  // Verify chat exists (if provided directly)
  if (providedChatId) {
    const chat = await selectChatIdById(db, chatId);

    if (!chat) {
      return { success: false, error: `Chat not found: ${chatId}` };
    }
  }

  logger.info(
    `[DirectExecutor] Creating message in chat ${chatId}`,
    { contentPreview: cleanContent.substring(0, 50) },
    'DirectExecutors'
  );

  const messageId = await generateSnowflakeId();
  const now = new Date();

  await insertMessageRow(db, {
    id: messageId,
    chatId,
    senderId: agentUserId,
    content: cleanContent,
    createdAt: now,
  });

  logger.info(
    `[DirectExecutor] Message created: ${messageId}`,
    undefined,
    'DirectExecutors'
  );

  // Broadcast to chat channel for real-time message updates
  // This ensures all chat participants see the message immediately
  broadcastChatMessage(chatId, {
    id: messageId,
    content: cleanContent,
    chatId,
    senderId: agentUserId,
    type: 'user',
    createdAt: now.toISOString(),
    isGameChat: false,
    isDMChat: Boolean(recipientId),
  }).catch((error: Error) => {
    logger.warn(
      `Failed to broadcast chat message: ${error.message}`,
      { chatId, messageId },
      'DirectExecutors'
    );
  });

  // Broadcast activity for real-time UI updates (only for non-NPCs)
  const isNpc = !!StaticDataRegistry.getActor(agentUserId);
  if (!isNpc) {
    const agentName = await getAgentDisplayName(agentUserId);
    const activityData: MessageActivityData = {
      messageId,
      chatId,
      recipientId: recipientId ?? null,
      contentPreview: cleanContent.substring(0, 200),
    };

    broadcastAgentActivity(
      agentUserId,
      agentName,
      'message',
      activityData
    ).catch((error: Error) => {
      logger.warn(
        `Failed to broadcast message activity: ${error.message}`,
        { agentUserId, messageId },
        'DirectExecutors'
      );
    });
  }

  // Notify group chat members for offline/push notifications
  // Only for group messages (no recipientId means it's a group chat message)
  if (!recipientId && chatId) {
    const participantRows = await selectChatParticipantUserIdsByChatId(
      db,
      chatId
    );
    const recipientIds = participantRows
      .map((p) => p.userId)
      .filter((id) => id !== agentUserId);

    if (recipientIds.length > 0) {
      const chatTitle = (await fetchChatNameById(chatId)) ?? 'Group Chat';

      notifyGroupChatMessage(
        recipientIds,
        agentUserId,
        chatId,
        chatTitle,
        cleanContent.substring(0, 50)
      ).catch((error: Error) => {
        logger.warn(
          `Failed to notify group chat message: ${error.message}`,
          { chatId, messageId },
          'DirectExecutors'
        );
      });
    }
  }

  return {
    success: true,
    messageId,
  };
}

// =============================================================================
// Direct Follow / Unfollow Executors
// =============================================================================

/**
 * Follow a user/agent directly without LLM decision-making.
 * This action is restricted to real users/agents (not static NPC actors).
 */
export async function executeDirectFollow(
  params: DirectFollowParams
): Promise<DirectFollowResult> {
  const { agentUserId, targetUserId } = params;
  const cleanTargetUserId = targetUserId?.trim();

  if (!cleanTargetUserId) {
    return { success: false, error: 'Target user ID is required' };
  }

  if (cleanTargetUserId === agentUserId) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  const targetUser = await selectUserIdAndIsActorById(db, cleanTargetUserId);

  if (!targetUser) {
    return { success: false, error: `User not found: ${cleanTargetUserId}` };
  }

  if (targetUser.isActor) {
    return {
      success: false,
      error:
        'FOLLOW supports users/agents only. NPC actors are not supported here',
    };
  }

  logger.info(
    `[DirectExecutor] Following user ${cleanTargetUserId}`,
    { agentUserId },
    'DirectExecutors'
  );

  const followId = await generateSnowflakeId();
  const insertResult = await insertFollowOnConflictDoNothingReturningId(db, {
    id: followId,
    followerId: agentUserId,
    followingId: cleanTargetUserId,
  });

  const followed = insertResult.length > 0;

  if (followed) {
    await Promise.all([
      cachedDb.invalidateUserCache(agentUserId),
      cachedDb.invalidateUserCache(cleanTargetUserId),
    ]).catch((error: unknown) => {
      logger.warn('Failed to invalidate user cache after direct follow', {
        error,
      });
    });
  }

  return {
    success: true,
    followed,
    alreadyFollowing: !followed,
    targetUserId: cleanTargetUserId,
  };
}

/**
 * Unfollow a user/agent directly without LLM decision-making.
 * Returns success even if there was no active follow relationship (idempotent).
 */
export async function executeDirectUnfollow(
  params: DirectFollowParams
): Promise<DirectFollowResult> {
  const { agentUserId, targetUserId } = params;
  const cleanTargetUserId = targetUserId?.trim();

  if (!cleanTargetUserId) {
    return { success: false, error: 'Target user ID is required' };
  }

  if (cleanTargetUserId === agentUserId) {
    return { success: false, error: 'Cannot unfollow yourself' };
  }

  const targetUserUnfollow = await selectUserIdAndIsActorById(
    db,
    cleanTargetUserId
  );

  if (!targetUserUnfollow) {
    return { success: false, error: `User not found: ${cleanTargetUserId}` };
  }

  if (targetUserUnfollow.isActor) {
    return {
      success: false,
      error:
        'UNFOLLOW supports users/agents only. NPC actors are not supported here',
    };
  }

  logger.info(
    `[DirectExecutor] Unfollowing user ${cleanTargetUserId}`,
    { agentUserId },
    'DirectExecutors'
  );

  const deletedRows = await deleteFollowByFollowerAndFollowingReturningId(
    db,
    agentUserId,
    cleanTargetUserId
  );

  const wasFollowing = deletedRows.length > 0;

  if (wasFollowing) {
    await Promise.all([
      cachedDb.invalidateUserCache(agentUserId),
      cachedDb.invalidateUserCache(cleanTargetUserId),
    ]).catch((error: unknown) => {
      logger.warn('Failed to invalidate user cache after direct unfollow', {
        error,
      });
    });
  }

  return {
    success: true,
    unfollowed: wasFollowing,
    wasFollowing,
    targetUserId: cleanTargetUserId,
  };
}

// =============================================================================
// Direct Like Executor
// =============================================================================

/**
 * Like a post directly without LLM decision-making.
 * Includes deduplication to prevent double-liking.
 */
export async function executeDirectLike(
  params: DirectLikeParams
): Promise<DirectLikeResult> {
  const { agentUserId, postId } = params;

  const postLike = await selectPostIdById(db, postId);

  if (!postLike) {
    return { success: false, error: `Post not found: ${postId}` };
  }

  logger.info(
    `[DirectExecutor] Liking post ${postId}`,
    { agentUserId },
    'DirectExecutors'
  );

  const reactionId = await generateSnowflakeId();

  // Use onConflictDoNothing to handle race conditions and prevent duplicate likes atomically
  // This relies on a unique index on (userId, postId, type) for the reactions table
  // No pre-check needed - the insert handles duplicates automatically
  const insertResult = await insertReactionLikeOnConflictDoNothingReturningId(
    db,
    {
      id: reactionId,
      postId,
      userId: agentUserId,
      type: 'like',
      createdAt: new Date(),
    }
  );

  const alreadyLiked = insertResult.length === 0;
  logger.info(
    `[DirectExecutor] Post ${alreadyLiked ? 'already liked' : 'liked'}: ${postId}`,
    { agentUserId, alreadyLiked },
    'DirectExecutors'
  );

  return {
    success: true,
    liked: !alreadyLiked,
  };
}

// =============================================================================
// Direct Repost Executor
// =============================================================================

/**
 * Repost/share a post directly without LLM decision-making.
 * Creates a share record and optionally a quote post.
 */
export async function executeDirectRepost(
  params: DirectRepostParams
): Promise<DirectRepostResult> {
  const { agentUserId, postId, comment } = params;

  const post = await selectPostRepostSliceById(db, postId);

  if (!post) {
    return { success: false, error: `Post not found: ${postId}` };
  }

  let targetPost = post;
  let targetPostId = postId;

  if (isPureRepost(post)) {
    const resolvedPost = await selectPostRepostSliceById(
      db,
      post.originalPostId
    );

    if (!resolvedPost) {
      return {
        success: false,
        error: 'Original post no longer exists',
      };
    }

    targetPost = resolvedPost;
    targetPostId = resolvedPost.id;
  }

  // Don't let agents repost their own content
  if (targetPost.authorId === agentUserId) {
    return { success: false, error: 'Cannot repost own content' };
  }

  // Note: We rely on the transaction's unique constraint handling to detect duplicates.
  // The pre-check was removed to avoid TOCTOU race conditions.

  logger.info(
    `[DirectExecutor] Reposting post ${targetPostId}`,
    { agentUserId, hasComment: !!comment, requestedPostId: postId },
    'DirectExecutors'
  );

  const now = new Date();

  try {
    // Pre-generate IDs before transaction
    const shareId = await generateSnowflakeId();
    const hasQuote = comment && comment.trim().length >= 3;
    const quotePostId = hasQuote ? await generateSnowflakeId() : undefined;

    // Use transaction to ensure atomicity of share and quote post
    await db.transaction(async (tx) => {
      await insertShareAndOptionalQuotePostInTransaction(tx, {
        share: {
          id: shareId,
          userId: agentUserId,
          postId: targetPostId,
          createdAt: now,
        },
        quotePost:
          hasQuote && quotePostId
            ? {
                id: quotePostId,
                content: comment!.trim(),
                authorId: agentUserId,
                originalPostId: targetPostId,
                type: 'repost',
                timestamp: now,
                createdAt: now,
              }
            : undefined,
      });
    });

    logger.info(
      `[DirectExecutor] Post reposted: ${targetPostId} -> share ${shareId}${quotePostId ? ` with quote ${quotePostId}` : ''}`,
      undefined,
      'DirectExecutors'
    );

    return {
      success: true,
      repostId: shareId,
      quotePostId,
    };
  } catch (error) {
    // Handle unique constraint violation (concurrent repost)
    // Check error code for PostgreSQL (23505) or Prisma (P2002)
    const errorCode = (error as { code?: string }).code;
    const isUniqueConstraint =
      errorCode === '23505' ||
      errorCode === 'P2002' ||
      (error as Error).message?.includes('unique constraint');

    if (isUniqueConstraint) {
      const share = await selectShareIdByUserIdAndPostId(
        db,
        agentUserId,
        targetPostId
      );

      if (!share?.id) {
        throw new Error(
          'Share not found after unique constraint violation - concurrent repost race condition'
        );
      }

      return { success: true, repostId: share.id };
    }
    throw error;
  }
}
