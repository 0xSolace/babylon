// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * Trade Execution Service
 *
 * Executes LLM-generated trading decisions for NPCs.
 * Creates positions, updates balances, records trades.
 *
 * NPC perp trades now use PerpMarketService for consistency with user trades,
 * ensuring funding and liquidation logic applies uniformly.
 */

import {
  actorState,
  and,
  db,
  eq,
  gte,
  npcTrades,
  organizationState,
  perpPositions,
  poolPositions,
  type SQLitClient,
  sql,
} from '@babylon/db'
import type { WalletPort } from '@babylon/shared'
import { logger, TradingDecisionSchema } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { z } from 'zod'
import { FEE_CONFIG } from '../config/fees'
import type {
  ExecutedTrade,
  TradingDecision,
  TradingExecutionResult,
} from '../types/market-decisions'
import { FeeService } from './fee-service'
import {
  type AggregatedImpact,
  aggregateTradeImpacts,
  createMarketImpactService,
} from './market-impact-service'
import {
  PredictionDbAdapter as CorePredictionDbAdapter,
  PredictionMarketService as CorePredictionMarketService,
  PerpDbAdapter,
  PerpMarketService,
} from './markets'
import { createNpcWalletAdapter } from './npc-wallet-adapter'
import { StaticDataRegistry } from './static-data-registry'
import { invalidateAfterPredictionTrade } from './trade-cache-invalidation'

type PredictionTradeBroadcast = {
  type: 'prediction_trade'
  version?: string
  marketId: string
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  liquidity?: number
  trade: {
    actorType: 'user' | 'npc' | 'system'
    actorId?: string
    action: 'buy' | 'sell' | 'close'
    side: 'yes' | 'no'
    shares: number
    amount: number
    price: number
    source: 'user_trade' | 'npc_trade' | 'system'
    timestamp: string
  }
}

type PredictionResolutionBroadcast = {
  type: 'prediction_resolution'
  version?: string
  marketId: string
  winningSide: 'yes' | 'no'
  yesShares: number
  noShares: number
  liquidity?: number
  totalPayout: number
  timestamp: string
  resolutionProofUrl?: string | null
  resolutionDescription?: string | null
}

type PredictionBroadcastPayload =
  | PredictionTradeBroadcast
  | PredictionResolutionBroadcast

const isPredictionBroadcastPayload = (
  payload: Record<string, unknown>,
): payload is PredictionBroadcastPayload => {
  const type = payload.type
  return type === 'prediction_trade' || type === 'prediction_resolution'
}

export class TradeExecutionService {
  /**
   * Execute a batch of trading decisions
   *
   * All trades use real BBLN tokens - no simulation mode.
   */
  async executeDecisionBatch(
    decisions: TradingDecision[],
  ): Promise<TradingExecutionResult> {
    // Validate input decisions
    z.array(TradingDecisionSchema).parse(decisions)

    const startTime = Date.now()

    const result: TradingExecutionResult = {
      totalDecisions: decisions.length,
      successfulTrades: 0,
      failedTrades: 0,
      holdDecisions: 0,
      totalVolumePerp: 0,
      totalVolumePrediction: 0,
      errors: [],
      executedTrades: [],
    }

    for (const decision of decisions) {
      if (decision.action === 'hold') {
        result.holdDecisions++
        continue
      }

      try {
        const executedTrade = await this.executeSingleDecision(decision)
        result.executedTrades.push(executedTrade)
        result.successfulTrades++

        if (executedTrade.marketType === 'perp') {
          result.totalVolumePerp += executedTrade.size
        } else {
          result.totalVolumePrediction += executedTrade.size
        }
      } catch (error) {
        result.failedTrades++
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        result.errors.push({
          npcId: decision.npcId,
          decision,
          error: errorMessage,
        })

        // Use warn level for expected failures (non-existent organizations, insufficient balance)
        // Use error level for unexpected system failures
        const isExpectedFailure =
          errorMessage.includes('Organization not found') ||
          errorMessage.includes('Insufficient trading balance') ||
          errorMessage.includes('Market not found') ||
          errorMessage.includes('Market already resolved') ||
          errorMessage.includes('Market expired') ||
          errorMessage.includes('Order size exceeds market limit') ||
          errorMessage.includes('Position already closed') ||
          errorMessage.includes('Position not found')
        const logLevel = isExpectedFailure ? 'warn' : 'error'

        logger[logLevel](
          `Failed to execute trade for ${decision.npcName}`,
          {
            error,
            decision,
          },
          'TradeExecutionService',
        )

        // FAIL FAST in development: throw on any trade execution error
        if (process.env.NODE_ENV !== 'production' && !isExpectedFailure) {
          throw new Error(
            `[DEV] NPC trade execution failed for ${decision.npcName}: ${errorMessage}`,
            { cause: error },
          )
        }
      }
    }

    const duration = Date.now() - startTime

    logger.info(
      `Executed ${result.successfulTrades} trades in ${duration}ms`,
      {
        ...result,
        durationMs: duration,
      },
      'TradeExecutionService',
    )

    return result
  }

  /**
   * Execute a single trading decision
   */
  async executeSingleDecision(
    decision: TradingDecision,
  ): Promise<ExecutedTrade> {
    // Normalize NPC ID to lowercase for case-insensitive lookup
    const normalizedNpcId = decision.npcId.toLowerCase()

    // Normalize amount - handle string amounts with commas (e.g., "12,000" -> 12000)
    if (typeof decision.amount === 'string') {
      const cleanedAmount = String(decision.amount).replace(/,/g, '')
      decision.amount = Number.parseFloat(cleanedAmount)
    }

    // For close_position, amount=0 is valid (we close the full position)
    // For other actions, amount must be > 0
    const isClosePosition = decision.action === 'close_position'
    if (Number.isNaN(decision.amount)) {
      throw new Error(`Invalid amount (NaN): ${decision.amount}`)
    }
    if (!isClosePosition && decision.amount <= 0) {
      throw new Error(`Invalid amount: ${decision.amount}`)
    }

    // Get NPC actor
    const actorResults = await db
      .select()
      .from(actorState)
      .where(eq(actorState.id, normalizedNpcId))
      .limit(1)

    const actor = actorResults[0]
    if (!actor) {
      throw new Error(`Actor not found: ${decision.npcId}`)
    }

    // Update decision to use normalized ID
    decision.npcId = normalizedNpcId

    // Balance checks are performed inside transactions to ensure atomicity
    // and prevent race conditions when multiple trades are queued for the same NPC

    const actorId = String(actor.id ?? '')

    // Handle close position
    if (decision.action === 'close_position') {
      return await this.closePosition(decision, actorId)
    }

    // Handle open position
    if (decision.action === 'open_long' || decision.action === 'open_short') {
      return await this.openPerpPosition(decision, actorId)
    }

    if (decision.action === 'buy_yes' || decision.action === 'buy_no') {
      return await this.openPredictionPosition(decision, actorId)
    }

    throw new Error(`Unknown action: ${decision.action}`)
  }

  private createPredictionBroadcast() {
    return {
      emit: async (_channel: string, payload: Record<string, unknown>) => {
        if (!isPredictionBroadcastPayload(payload)) return

        // Broadcast events are handled by the service's internal broadcast mechanism
        // The payload is logged for debugging purposes
        logger.debug('Prediction broadcast event', {
          type: payload.type,
          marketId: payload.marketId,
        })
      },
    }
  }

  /**
   * Open a perpetual position
   */
  private async openPerpPosition(
    decision: TradingDecision,
    actorId: string,
  ): Promise<ExecutedTrade> {
    if (!decision.ticker) {
      throw new Error('Ticker required for perp position')
    }

    // Try multiple lookup strategies to handle LLM-generated ticker variations
    const tickerLower = decision.ticker.toLowerCase()

    // Use StaticDataRegistry for organization lookup (organizations aren't in DB)
    const allOrgs = StaticDataRegistry.getAllOrganizations()

    // Strategy 1: Exact ID match
    let staticOrg = allOrgs.find((o) => o.id === decision.ticker)

    // Strategy 2: Ticker field match (case-insensitive)
    if (!staticOrg) {
      staticOrg = allOrgs.find((o) => o.ticker?.toLowerCase() === tickerLower)
    }

    // Strategy 3: ID contains match
    if (!staticOrg) {
      staticOrg = allOrgs.find(
        (o) =>
          o.id.toLowerCase().includes(tickerLower) ||
          tickerLower.includes(o.id.toLowerCase()),
      )
    }

    // Strategy 4: Normalized name/ticker match
    if (!staticOrg) {
      const normalizedTicker = tickerLower.replace(/[^a-z0-9]/g, '')
      staticOrg = allOrgs.find((o) => {
        const normalizedName = o.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        const normalizedOrgTicker = (o.ticker || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
        const normalizedOrgId = o.id.toLowerCase().replace(/[^a-z0-9]/g, '')

        return (
          normalizedName === normalizedTicker ||
          normalizedOrgTicker === normalizedTicker ||
          normalizedOrgId === normalizedTicker ||
          normalizedName.includes(normalizedTicker) ||
          normalizedTicker.includes(normalizedName)
        )
      })
    }

    // Get price from organizationState
    let currentPrice: number | null = null
    if (staticOrg) {
      const stateResults = await db
        .select({ currentPrice: organizationState.currentPrice })
        .from(organizationState)
        .where(eq(organizationState.id, staticOrg.id))
        .limit(1)
      const state = stateResults[0]
      const statePrice =
        state?.currentPrice != null ? Number(state.currentPrice) : null
      currentPrice = statePrice ?? staticOrg.initialPrice ?? null
    }

    if (!staticOrg || !currentPrice) {
      logger.warn(
        'NPC tried to trade non-existent organization or org has no price',
        {
          npcId: decision.npcId,
          npcName: decision.npcName,
          ticker: decision.ticker,
          action: decision.action,
          orgFound: !!staticOrg,
          hasPrice: !!currentPrice,
        },
        'TradeExecutionService',
      )
      throw new Error(`Organization not found: ${decision.ticker}`)
    }

    // Use staticOrg for the rest of the function
    const org = staticOrg

    const leverage = 5 // Standard leverage for NPCs
    const side = decision.action === 'open_long' ? 'long' : 'short'
    const positionSize = decision.amount * leverage

    // Use PerpMarketService for consistency with user trades
    // This ensures NPC positions get funding and liquidation applied
    const perpService = new PerpMarketService({
      db: new PerpDbAdapter(),
      wallet: createNpcWalletAdapter(actorId),
      fees: {
        tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
        platformShare: FEE_CONFIG.PLATFORM_SHARE,
        referrerShare: FEE_CONFIG.REFERRER_SHARE,
        minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
      },
    })

    // Open position via PerpMarketService (uses perpPositions table)
    // Use org.ticker for perp market lookup (e.g., "NVDAI" not "nvidai")
    const tradeTicker = org.ticker || org.id
    const result = await perpService.openPosition({
      userId: actorId, // Use actorId as userId for NPC
      ticker: tradeTicker,
      side,
      size: positionSize,
      leverage,
    })

    // Record NPC trade for analytics/tracking (separate from position)
    await db.insert(npcTrades).values({
      id: await generateSnowflakeId(),
      npcActorId: decision.npcId,
      poolId: null,
      marketType: 'perp',
      ticker: tradeTicker,
      action: decision.action,
      side,
      amount: decision.amount,
      price: result.entryPrice,
      sentiment: decision.confidence * (side === 'long' ? 1 : -1),
      reason: decision.reasoning,
    })

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId: actorId, // Using actorId for backward compatibility
      marketType: 'perp',
      ticker: decision.ticker,
      action: decision.action,
      side,
      amount: decision.amount,
      size: positionSize,
      executionPrice: result.entryPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: result.positionId,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Open a prediction market position
   */
  private async openPredictionPosition(
    decision: TradingDecision,
    actorId: string,
  ): Promise<ExecutedTrade> {
    if (!decision.marketId) {
      throw new Error('MarketId required for prediction position')
    }

    const sideLabel: 'yes' | 'no' = decision.action === 'buy_yes' ? 'yes' : 'no'

    const broadcast = this.createPredictionBroadcast()

    const service = new CorePredictionMarketService({
      db: new CorePredictionDbAdapter(),
      wallet: this.buildActorWallet(actorId),
      broadcast,
      cache: {
        invalidate: () =>
          invalidateAfterPredictionTrade(decision.marketId as string),
      },
      fees: {
        tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
        platformShare: FEE_CONFIG.PLATFORM_SHARE,
        referrerShare: FEE_CONFIG.REFERRER_SHARE,
        minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
      },
    })

    const result = await service.buy({
      userId: actorId,
      marketId: decision.marketId.toString(),
      side: sideLabel,
      amount: decision.amount,
    })

    const entryPrice = result.avgPrice * 100
    const now = new Date()

    // Back-compat: store poolPositions/npcTrades for NPC analytics
    // Use onConflictDoUpdate to handle re-runs where position already exists
    await db.transaction(async (tx: SQLitClient) => {
      await tx
        .insert(poolPositions)
        .values({
          id: result.positionId,
          poolId: actorId,
          marketType: 'prediction',
          marketId: decision.marketId?.toString(),
          side: sideLabel === 'yes' ? 'YES' : 'NO',
          entryPrice,
          currentPrice:
            result.market[sideLabel === 'yes' ? 'yesPrice' : 'noPrice'] * 100,
          size: result.totalCost ?? decision.amount,
          shares: result.shares,
          unrealizedPnL: 0,
          openedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: poolPositions.id,
          set: {
            currentPrice:
              result.market[sideLabel === 'yes' ? 'yesPrice' : 'noPrice'] * 100,
            size: result.totalCost ?? decision.amount,
            shares: result.shares,
            updatedAt: now,
          },
        })

      await tx.insert(npcTrades).values({
        id: await generateSnowflakeId(),
        npcActorId: decision.npcId,
        poolId: null,
        marketType: 'prediction',
        marketId: decision.marketId?.toString(),
        action: decision.action,
        side: sideLabel === 'yes' ? 'YES' : 'NO',
        amount: decision.amount,
        price: entryPrice,
        sentiment: decision.confidence * (sideLabel === 'yes' ? 1 : -1),
        reason: decision.reasoning,
      })
    })

    await invalidateAfterPredictionTrade(decision.marketId)

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId: actorId, // Using actorId for backward compatibility
      marketType: 'prediction',
      marketId: decision.marketId,
      action: decision.action,
      side: sideLabel === 'yes' ? 'YES' : 'NO',
      amount: decision.amount,
      size: result.totalCost ?? decision.amount,
      shares: result.shares,
      executionPrice: entryPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: result.positionId,
      timestamp: now.toISOString(),
    }
  }

  /**
   * Close an existing position
   *
   * For perp positions: First checks perpPositions (new system), then poolPositions (legacy).
   * For prediction positions: Uses poolPositions.
   */
  private async closePosition(
    decision: TradingDecision,
    actorId: string,
  ): Promise<ExecutedTrade> {
    if (!decision.positionId) {
      throw new Error('PositionId required to close position')
    }

    // Try perpPositions first (new system for perp trades)
    const perpPositionRows = await db
      .select()
      .from(perpPositions)
      .where(eq(perpPositions.id, decision.positionId))
      .limit(1)

    const perpPosition = perpPositionRows[0]
    if (perpPosition && !perpPosition.closedAt) {
      // Use PerpMarketService to close perp position
      return this.closePerpPositionViaService(decision, actorId, {
        id: String(perpPosition.id ?? ''),
        ticker: String(perpPosition.ticker ?? ''),
        side: String(perpPosition.side ?? ''),
        size: Number(perpPosition.size ?? 0),
        entryPrice: Number(perpPosition.entryPrice ?? 0),
        leverage: Number(perpPosition.leverage ?? 1),
      })
    }

    // Fall back to poolPositions (legacy perp or prediction positions)
    const positionRows = await db
      .select()
      .from(poolPositions)
      .where(eq(poolPositions.id, decision.positionId))
      .limit(1)

    const position = positionRows[0] as
      | {
          id: string
          closedAt: Date | null
          marketId: string | null
          size: number | string | null
          shares: number | string | null
          side: string | null
          entryPrice: number | string | null
          ticker: string | null
          marketType: string | null
          currentPrice: number | string | null
        }
      | undefined
    if (!position) {
      throw new Error(`Position not found: ${decision.positionId}`)
    }

    // Access position properties safely - query builder returns Record<string, unknown>
    const posClosedAt = position.closedAt
    if (posClosedAt) {
      throw new Error(`Position already closed: ${decision.positionId}`)
    }

    const now = new Date()

    const positionId = String(position.id)
    const positionMarketId = position.marketId
      ? String(position.marketId)
      : null
    const positionSize = Number(position.size ?? 0)
    const positionShares = position.shares != null ? Number(position.shares) : 0
    const positionSide = String(position.side ?? '')
    const positionEntryPrice = Number(position.entryPrice ?? 0)
    const positionTicker = position.ticker ? String(position.ticker) : null
    const positionMarketType = String(position.marketType ?? '')

    if (positionMarketType === 'prediction') {
      if (!positionMarketId) {
        throw new Error(`Prediction position missing marketId: ${positionId}`)
      }

      const shares = positionShares
      if (shares <= 0) {
        throw new Error(
          `Prediction position has no shares to close: ${positionId}`,
        )
      }

      const side =
        positionSide === 'YES' || positionSide === 'NO' ? positionSide : null
      if (!side) {
        throw new Error(`Invalid prediction position side: ${positionSide}`)
      }

      const broadcast = this.createPredictionBroadcast()

      const service = new CorePredictionMarketService({
        db: new CorePredictionDbAdapter(),
        wallet: this.buildActorWallet(actorId),
        broadcast,
        cache: {
          invalidate: () => invalidateAfterPredictionTrade(positionMarketId),
        },
        fees: {
          tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
          platformShare: FEE_CONFIG.PLATFORM_SHARE,
          referrerShare: FEE_CONFIG.REFERRER_SHARE,
          minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
        },
      })

      const sellResult = await service.sell({
        userId: actorId,
        marketId: positionMarketId,
        shares,
        positionId: positionId,
      })

      // Back-compat storage updates
      await db.transaction(async (tx: SQLitClient) => {
        await tx
          .update(poolPositions)
          .set({
            closedAt: now,
            currentPrice:
              sellResult.market[
                sellResult.side === 'yes' ? 'yesPrice' : 'noPrice'
              ] * 100,
            unrealizedPnL: 0,
            realizedPnL: sellResult.pnl ?? 0,
            updatedAt: now,
          })
          .where(eq(poolPositions.id, positionId))

        await tx.insert(npcTrades).values({
          id: await generateSnowflakeId(),
          npcActorId: decision.npcId,
          poolId: null,
          marketType: 'prediction',
          marketId: positionMarketId,
          action: 'close',
          side,
          amount: sellResult.netProceeds ?? 0,
          price: (sellResult.avgPrice ?? 0) * 100,
          sentiment: 0,
          reason: decision.reasoning,
        })
      })

      await invalidateAfterPredictionTrade(positionMarketId).catch((error) => {
        logger.warn(
          'Failed to invalidate cache after NPC prediction close',
          { error, marketId: positionMarketId },
          'TradeExecutionService',
        )
      })

      return {
        npcId: decision.npcId,
        npcName: decision.npcName,
        poolId: actorId,
        marketType: 'prediction',
        marketId: positionMarketId,
        action: 'close_position',
        side,
        amount: sellResult.netProceeds ?? 0,
        size: positionSize,
        shares: positionShares > 0 ? positionShares : undefined,
        executionPrice: (sellResult.avgPrice ?? 0) * 100,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        positionId,
        timestamp: now.toISOString(),
      }
    }

    // Get current price
    let currentPrice = Number(position.currentPrice ?? 0)

    if (positionMarketType === 'perp' && positionTicker) {
      // Find org in static registry for simulation mode compatibility
      const tickerLower = positionTicker.toLowerCase()
      const staticOrg = StaticDataRegistry.getAllOrganizations().find(
        (o) =>
          o.id.toLowerCase().includes(tickerLower) ||
          tickerLower.includes(o.id.toLowerCase()) ||
          o.ticker?.toLowerCase() === tickerLower,
      )

      if (staticOrg) {
        const stateResults = await db
          .select({ currentPrice: organizationState.currentPrice })
          .from(organizationState)
          .where(eq(organizationState.id, staticOrg.id))
          .limit(1)
        const state = stateResults[0]
        const statePrice =
          state?.currentPrice != null ? Number(state.currentPrice) : null
        if (statePrice) {
          currentPrice = statePrice
        }
      }
    }

    // Calculate P&L
    const priceChange = currentPrice - positionEntryPrice
    const isLong = positionSide === 'long' || positionSide === 'YES'
    const pnlMultiplier = isLong ? 1 : -1

    let realizedPnL: number
    if (positionMarketType === 'perp') {
      const percentChange = priceChange / positionEntryPrice
      realizedPnL = percentChange * positionSize * pnlMultiplier
    } else {
      realizedPnL = (priceChange / 100) * positionShares
    }

    // Calculate trading fee (0.1% on position size)
    const feeCalc = FeeService.calculateFee(positionSize)
    const grossReturn = positionSize + realizedPnL
    const netReturn = Math.max(0, grossReturn - feeCalc.feeAmount)

    // Execute in transaction
    await db.transaction(async (tx: SQLitClient) => {
      // Close position
      await tx
        .update(poolPositions)
        .set({
          closedAt: now,
          currentPrice,
          unrealizedPnL: 0,
          realizedPnL,
          updatedAt: now,
        })
        .where(eq(poolPositions.id, decision.positionId as string))

      // Return capital + P&L to actor's trading balance (after fee deduction)
      const actorRows = await tx
        .select()
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1)

      const actor = actorRows[0] as
        | { tradingBalance: number | string | null }
        | undefined
      if (actor) {
        const actorBalance =
          actor.tradingBalance != null
            ? Number.parseFloat(String(actor.tradingBalance))
            : 0
        await tx
          .update(actorState)
          .set({
            tradingBalance: String(actorBalance + netReturn),
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, actorId))
      }

      // Record trade (poolId is optional now)
      await tx.insert(npcTrades).values({
        id: await generateSnowflakeId(),
        npcActorId: decision.npcId,
        poolId: null, // No longer using pools
        marketType: positionMarketType,
        ticker: positionTicker,
        marketId: positionMarketId,
        action: 'close',
        side: positionSide,
        amount: positionSize,
        price: currentPrice,
        sentiment: 0,
        reason: decision.reasoning,
      })
    })

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId: actorId, // Using actorId for backward compatibility
      marketType: positionMarketType as 'perp' | 'prediction',
      ticker: positionTicker,
      marketId: positionMarketId,
      action: 'close_position',
      side: positionSide,
      amount: positionSize,
      size: positionSize,
      shares: positionShares > 0 ? positionShares : undefined,
      executionPrice: currentPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Close a perp position via PerpMarketService (new system)
   */
  private async closePerpPositionViaService(
    decision: TradingDecision,
    actorId: string,
    position: {
      id: string
      ticker: string
      side: string
      size: number
      entryPrice: number
      leverage: number
    },
  ): Promise<ExecutedTrade> {
    const perpService = new PerpMarketService({
      db: new PerpDbAdapter(),
      wallet: createNpcWalletAdapter(actorId),
      fees: {
        tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
        platformShare: FEE_CONFIG.PLATFORM_SHARE,
        referrerShare: FEE_CONFIG.REFERRER_SHARE,
        minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
      },
    })

    const result = await perpService.closePosition({
      userId: actorId,
      positionId: position.id,
    })

    // Record NPC trade for analytics/tracking
    await db.insert(npcTrades).values({
      id: await generateSnowflakeId(),
      npcActorId: decision.npcId,
      poolId: null,
      marketType: 'perp',
      ticker: position.ticker,
      action: 'close',
      side: position.side,
      amount: result.size,
      price: result.exitPrice ?? result.entryPrice,
      sentiment: 0,
      reason: decision.reasoning,
    })

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId: actorId,
      marketType: 'perp',
      ticker: position.ticker,
      action: 'close_position',
      side: position.side,
      amount: result.size,
      size: result.size,
      executionPrice: result.exitPrice ?? result.entryPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: position.id,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get total trade impact by ticker/market
   */
  async getTradeImpacts(
    executedTrades: ExecutedTrade[],
  ): Promise<Map<string, AggregatedImpact>> {
    const impactService = createMarketImpactService()
    const impacts = await Promise.all(
      executedTrades.map(async (trade) => {
        const side =
          trade.side === 'long' || trade.side === 'buy' ? 'buy' : 'sell'
        return impactService.calculateImpact(
          trade.ticker ?? '',
          side,
          trade.size,
        )
      }),
    )

    const aggregated = aggregateTradeImpacts(impacts)
    const result = new Map<string, AggregatedImpact>()
    result.set('total', aggregated)
    return result
  }

  private buildActorWallet(actorId: string): WalletPort {
    const getBalance = async () => {
      const actorRows = await db
        .select()
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1)
      const actor = actorRows[0] as
        | { tradingBalance: number | string | null }
        | undefined
      if (!actor) throw new Error(`Actor not found: ${actorId}`)
      return Number(actor.tradingBalance ?? 0)
    }

    return {
      getBalance: async () => ({ balance: await getBalance() }),
      debit: async ({ amount }: { amount: number }) => {
        // Atomic debit with balance check to prevent negative balance
        const result = await db
          .update(actorState)
          .set({
            tradingBalance: sql`${actorState.tradingBalance} - ${amount}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(actorState.id, actorId),
              gte(actorState.tradingBalance, String(amount)),
            ),
          )
          .returning()

        if (result.length === 0) {
          throw new Error(
            `Insufficient NPC funds: actor ${actorId}, amount $${amount}`,
          )
        }
      },
      credit: async ({ amount }: { amount: number }) => {
        await db
          .update(actorState)
          .set({
            tradingBalance: sql`${actorState.tradingBalance} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, actorId))
      },
      recordPnL: async () => {
        // No-op for NPC wallets
      },
    }
  }
}
