/**
 * Market Domain Types
 *
 * Shared types for prediction and perpetual markets.
 * Client-safe - no database dependencies.
 */

import { z } from 'zod'

// =============================================================================
// Common Types
// =============================================================================

export type MarketKind = 'prediction' | 'perp'

export interface FeeConfig {
  tradingFeeRate: number // e.g. 0.001 = 0.1%
  platformShare: number // 0-1
  referrerShare: number // 0-1
  minFeeAmount: number
}

export interface FeeProcessor {
  processTradingFee: (params: {
    userId: string
    amount: number
    type: string
    relatedId?: string
    positionId?: string
  }) => Promise<{ feeCharged: number; referrerPaid?: number }>
}

export interface WalletPort {
  debit(params: {
    userId: string
    amount: number
    reason: string
    description?: string
    relatedId?: string
  }): Promise<void>
  credit(params: {
    userId: string
    amount: number
    reason: string
    description?: string
    relatedId?: string
  }): Promise<void>
  recordPnL(params: {
    userId: string
    pnl: number
    reason: string
    relatedId?: string
  }): Promise<void>
  getBalance(userId: string): Promise<{ balance: number; lifetimePnL?: number }>
}

export interface BroadcastPort {
  emit(channel: string, payload: Record<string, unknown>): Promise<void>
}

export interface CachePort {
  invalidate(pattern: string): Promise<void>
}

export interface ClockPort {
  now(): Date
}

// =============================================================================
// Prediction Market Types
// =============================================================================

export const PredictionSideSchema = z.enum(['yes', 'no'])
export type PredictionSide = z.infer<typeof PredictionSideSchema>

export const PredictionBuyInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  marketId: z.string().min(1, 'marketId is required'),
  side: PredictionSideSchema,
  amount: z.number().positive('Amount must be positive'),
})
export type PredictionBuyInput = z.infer<typeof PredictionBuyInputSchema>

export const PredictionSellInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  marketId: z.string().min(1, 'marketId is required'),
  shares: z.number().positive('Shares must be positive'),
  positionId: z.string().min(1).optional(),
})
export type PredictionSellInput = z.infer<typeof PredictionSellInputSchema>

export const PredictionResolveInputSchema = z.object({
  marketId: z.string().min(1, 'marketId is required'),
  winningSide: PredictionSideSchema,
  resolvedAt: z.date().optional(),
  resolutionProofUrl: z.string().url().optional(),
  resolutionDescription: z.string().optional(),
})
export type PredictionResolveInput = z.infer<
  typeof PredictionResolveInputSchema
>

export interface QuestionRecord {
  id: string
  /** Question number for ordering, null if not assigned */
  questionNumber?: number | null
  text: string
  status: 'active' | 'resolved' | 'cancelled'
  resolutionDate: Date | null
  resolvedOutcome?: boolean | null
  createdDate?: Date
}

export interface PredictionMarketRecord {
  id: string
  question: string
  description?: string | null
  yesShares: number
  noShares: number
  liquidity: number
  endDate: Date | null
  resolved: boolean
  resolution?: boolean | null
  onChainMarketId?: string | null
  /** Whether on-chain market is resolved, null if not on-chain */
  onChainResolved?: boolean | null
  oracleCommitTxHash?: string | null
  oracleRevealTxHash?: string | null
  resolutionProofUrl?: string | null
  resolutionDescription?: string | null
  status?: 'active' | 'resolved' | 'cancelled'
  createdAt?: Date
  updatedAt?: Date
}

export interface PredictionPositionRecord {
  id: string
  userId: string
  marketId: string
  side: PredictionSide
  shares: number
  avgPrice: number
  status?: 'active' | 'resolved'
  outcome?: boolean | null
  pnl?: number
  resolvedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface PredictionPriceSnapshotRecord {
  marketId: string
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  liquidity: number
  eventType: 'trade' | 'resolution'
  source: 'user_trade' | 'npc_trade' | 'system'
  createdAt?: Date
}

export interface PredictionTradeResult {
  positionId: string
  marketId: string
  side: PredictionSide
  shares: number
  avgPrice: number
  totalCost?: number // buy
  totalProceeds?: number // gross proceeds (sell)
  netProceeds?: number // sell (after fee)
  feePaid: number
  pnl?: number
  remainingShares?: number
  positionClosed?: boolean
  balance?: number
  market: {
    yesPrice: number
    noPrice: number
    yesShares: number
    noShares: number
    priceImpact: number
    liquidity: number
  }
}

// =============================================================================
// Perpetual Market Types
// =============================================================================

export const PerpSideSchema = z.enum(['long', 'short'])
export type PerpSide = z.infer<typeof PerpSideSchema>

export const PerpOpenInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  ticker: z.string().min(1).max(20),
  side: PerpSideSchema,
  size: z.number().positive('Size must be positive'),
  leverage: z.number().int().min(1).max(100),
  maxSlippage: z.number().min(0).max(1).optional(),
})
export type PerpOpenInput = z.infer<typeof PerpOpenInputSchema>

export const PerpCloseInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  positionId: z.string().min(1, 'positionId is required'),
  percentage: z.number().min(0).max(1).optional(),
  exitPriceOverride: z.number().positive().optional(),
  maxSlippage: z.number().min(0).max(1).optional(),
})
export type PerpCloseInput = z.infer<typeof PerpCloseInputSchema>

export interface PerpMarketRecord {
  ticker: string
  organizationId: string
  name?: string | null
  currentPrice: number
  /** Price from 24 hours ago (for accurate change calculation) */
  price24hAgo?: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  fundingRate: {
    rate: number
    nextFundingTime: string
    predictedRate: number
  }
  maxLeverage: number
  minOrderSize: number
  markPrice?: number
  indexPrice?: number
}

export interface PerpPositionRecord {
  id: string
  userId: string
  ticker: string
  organizationId: string
  side: PerpSide
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  liquidationPrice: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  fundingPaid: number
  openedAt: Date
  lastUpdated: Date
  closedAt?: Date | null
  realizedPnL?: number | null
}

export interface PerpTradeResult {
  positionId: string
  ticker: string
  side: PerpSide
  size: number
  leverage: number
  entryPrice: number
  exitPrice?: number
  liquidationPrice: number
  marginPaid?: number
  realizedPnL?: number
  feePaid: number
  balance?: number
  /** If partial close, the remaining position size */
  remainingSize?: number
  /** True if position was fully closed */
  fullyClosed?: boolean
}

// =============================================================================
// Database Ports (interfaces for server-side adapters)
// =============================================================================

export interface PredictionDbPort {
  getMarketById(id: string): Promise<PredictionMarketRecord | null>
  getMarketsByIds(ids: string[]): Promise<PredictionMarketRecord[]>
  listMarkets?(): Promise<PredictionMarketRecord[]>
  listUserPositions?(userId: string): Promise<PredictionPositionRecord[]>
  getQuestion?(idOrNumber: string): Promise<QuestionRecord | null>
  createMarketFromQuestion(
    question: QuestionRecord,
    initialLiquidity: number,
    options?: { description?: string | null },
  ): Promise<PredictionMarketRecord>
  updateMarketState(
    marketId: string,
    updates: Partial<
      Pick<
        PredictionMarketRecord,
        | 'yesShares'
        | 'noShares'
        | 'liquidity'
        | 'resolved'
        | 'resolution'
        | 'onChainMarketId'
        | 'onChainResolved'
        | 'resolutionProofUrl'
        | 'resolutionDescription'
      >
    >,
  ): Promise<PredictionMarketRecord>
  getPosition(
    userId: string,
    marketId: string,
    side: PredictionSide,
  ): Promise<PredictionPositionRecord | null>
  upsertPosition(
    position: Omit<PredictionPositionRecord, 'id'> & { id?: string },
  ): Promise<PredictionPositionRecord>
  deletePosition(positionId: string): Promise<void>
  listPositionsForMarket(marketId: string): Promise<PredictionPositionRecord[]>
  insertPriceSnapshot?(snapshot: PredictionPriceSnapshotRecord): Promise<void>
}

export interface PerpDbPort {
  listMarkets(): Promise<PerpMarketRecord[]>
  listOpenPositions(): Promise<PerpPositionRecord[]>
  getPositionById(id: string): Promise<PerpPositionRecord | null>
  /** Get all open positions for a user */
  getOpenPositionsByUser(userId: string): Promise<PerpPositionRecord[]>
  /** Get existing open position for user on specific ticker (for consolidation) */
  getOpenPositionByUserAndTicker(
    userId: string,
    ticker: string,
  ): Promise<PerpPositionRecord | null>
  upsertPosition(
    position: Omit<PerpPositionRecord, 'id'> & { id?: string },
  ): Promise<PerpPositionRecord>
  /**
   * Execute operations within a transaction for atomicity.
   * If the callback throws, all changes are rolled back.
   */
  transaction<T>(fn: (tx: PerpDbPort) => Promise<T>): Promise<T>
  updateOpenPosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
        | 'fundingPaid'
        | 'liquidationPrice'
        | 'lastUpdated'
        | 'size'
      >
    >,
  ): Promise<void>
  closePosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'closedAt'
        | 'realizedPnL'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
      >
    >,
  ): Promise<void>
  updateMarketStats(
    ticker: string,
    updates: Partial<
      Pick<
        PerpMarketRecord,
        | 'currentPrice'
        | 'price24hAgo'
        | 'change24h'
        | 'changePercent24h'
        | 'high24h'
        | 'low24h'
        | 'volume24h'
        | 'openInterest'
        | 'fundingRate'
        | 'markPrice'
        | 'indexPrice'
      >
    >,
  ): Promise<void>
  getMarketByTicker?(ticker: string): Promise<PerpMarketRecord | null>
  upsertMarketSnapshot?(market: PerpMarketRecord): Promise<PerpMarketRecord>
}

// =============================================================================
// Service Dependencies
// =============================================================================

export interface PredictionServiceDeps {
  db: PredictionDbPort
  wallet: WalletPort
  broadcast?: BroadcastPort
  cache?: CachePort
  clock?: ClockPort
  fees: FeeConfig
  feeProcessor?: FeeProcessor
}

export interface PerpServiceDeps {
  db: PerpDbPort
  wallet: WalletPort
  broadcast?: BroadcastPort
  cache?: CachePort
  clock?: ClockPort
  fees: FeeConfig
  feeProcessor?: FeeProcessor
}
