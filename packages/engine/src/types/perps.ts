/**
 * Perpetual Futures Trading Types
 *
 * Defines all types for perps markets:
 * - Positions (long/short with leverage)
 * - Funding rates
 * - Liquidation mechanics
 * - PnL calculations
 */

import { MARKET_CONFIG } from '../config/fees'

// biome-ignore lint/correctness/noUnusedVariables: Documents position structure
interface PerpPosition {
  id: string
  userId: string
  ticker: string
  organizationId: string
  side: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  liquidationPrice: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  fundingPaid: number
  openedAt: string
  lastUpdated: string
}

export interface FundingRate {
  ticker: string
  rate: number
  nextFundingTime: string
  predictedRate: number
}

// biome-ignore lint/correctness/noUnusedVariables: Documents market structure
interface PerpMarket {
  ticker: string
  organizationId: string
  name: string
  currentPrice: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  fundingRate: FundingRate
  maxLeverage: number
  minOrderSize: number
  maxPositionSize: number // Maximum single position size (based on liquidity)
  markPrice: number
  indexPrice: number
}

// biome-ignore lint/correctness/noUnusedVariables: Documents order request
interface OrderRequest {
  ticker: string
  side: 'long' | 'short'
  size: number
  leverage: number
  orderType: 'market' | 'limit'
  limitPrice?: number
}

// biome-ignore lint/correctness/noUnusedVariables: Documents position update
interface PositionUpdate {
  positionId: string
  action: 'increase' | 'decrease' | 'close'
  amount?: number
  newLeverage?: number
}

// biome-ignore lint/correctness/noUnusedVariables: Documents liquidation event
interface Liquidation {
  positionId: string
  ticker: string
  side: 'long' | 'short'
  liquidationPrice: number
  actualPrice: number
  loss: number
  timestamp: string
}

// biome-ignore lint/correctness/noUnusedVariables: Documents price snapshot
interface DailyPriceSnapshot {
  date: string
  ticker: string
  organizationId: string
  openPrice: number
  closePrice: number
  highPrice: number
  lowPrice: number
  volume: number
  timestamp: string
}

// biome-ignore lint/correctness/noUnusedVariables: Documents trading stats
interface TradingStats {
  totalVolume: number
  totalTrades: number
  totalPnL: number
  winRate: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  totalFundingPaid: number
  totalLiquidations: number
}

/**
 * Calculate liquidation price for a position
 */
function _calculateLiquidationPrice(
  entryPrice: number,
  side: 'long' | 'short',
  leverage: number,
): number {
  const liquidationThreshold = 0.9 / leverage

  if (side === 'long') {
    return entryPrice * (1 - liquidationThreshold)
  }
  return entryPrice * (1 + liquidationThreshold)
}

/**
 * Calculate unrealized PnL for a position
 */
function _calculateUnrealizedPnL(
  entryPrice: number,
  currentPrice: number,
  side: 'long' | 'short',
  size: number,
): { pnl: number; pnlPercent: number } {
  let pnl: number

  if (side === 'long') {
    pnl = ((currentPrice - entryPrice) / entryPrice) * size
  } else {
    pnl = ((entryPrice - currentPrice) / entryPrice) * size
  }

  const pnlPercent = (pnl / size) * 100

  return { pnl, pnlPercent }
}

/**
 * Calculate funding payment for a single 8-hour period
 */
function _calculateFundingPayment(
  positionSize: number,
  fundingRate: number,
): number {
  const fundingPerPeriod = fundingRate / 1095.75
  return positionSize * fundingPerPeriod
}

/**
 * Check if position should be liquidated
 */
function _shouldLiquidate(
  currentPrice: number,
  liquidationPrice: number,
  side: 'long' | 'short',
): boolean {
  if (side === 'long') {
    return currentPrice <= liquidationPrice
  }
  return currentPrice >= liquidationPrice
}

/**
 * Calculate mark price (fair value for liquidations)
 */
function _calculateMarkPrice(
  indexPrice: number,
  lastPrice: number,
  fundingRate: number,
): number {
  const baseMarkPrice = indexPrice * 0.7 + lastPrice * 0.3
  const fundingAdjustment = fundingRate * 0.01
  return baseMarkPrice * (1 + fundingAdjustment)
}

/**
 * Calculate the maximum allowed position size for a market
 * Based on configured ratio of open interest with a minimum floor
 */
function _calculateMaxPositionSize(openInterest: number): number {
  const openInterestLimit =
    openInterest * MARKET_CONFIG.OPEN_INTEREST_LIMIT_RATIO
  return Math.max(openInterestLimit, MARKET_CONFIG.MIN_MAX_POSITION_SIZE)
}
