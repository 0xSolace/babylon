/**
 * Widget cache types for UI state
 * These are web-app specific types for caching widget data
 */

/** A2A reputation response */
export interface A2AReputationResponse {
  userId: string
  reputation: number
  level?: string
  rank?: number
  badges?: string[]
}

/** Perp position from API */
export interface PerpPositionFromAPI {
  id: string
  userId: string
  ticker: string
  organizationId?: string
  side: 'long' | 'short' | 'LONG' | 'SHORT'
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  unrealizedPnL: number
  unrealizedPnLPercent?: number
  margin: number
  liquidationPrice: number
  fundingPaid?: number
  createdAt: string
  lastUpdated: string
  openedAt?: string
}

/** Prediction position */
export interface PredictionPosition {
  id: string
  marketId: string
  question: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  currentValue: number
  costBasis: number
  unrealizedPnL: number
  resolved: boolean
  resolution: boolean | null
  Market?: {
    question: string
    [key: string]: unknown
  }
}

/** User balance data */
export interface UserBalanceData {
  balance?: number
  virtualBalance: number
  tradingBalance: number
  lockedBalance: number
  lifetimePnL: number
  totalDeposited: number
  totalWithdrawn: number
}

/** User profile stats */
export interface UserProfileStats {
  followersCount: number
  followingCount: number
  postsCount: number
  likesReceived: number
  reputationPoints: number
  predictionAccuracy?: number
  totalTrades?: number
  winRate?: number
  // Additional stats used in UI
  following?: number
  followers?: number
  totalActivity?: number
}

/** User prediction position - used for positions fetched from API */
export interface UserPredictionPosition {
  id: string
  marketId: string
  question: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  currentValue: number
  costBasis: number
  unrealizedPnL: number
  resolved: boolean
  resolution: boolean | null
}
