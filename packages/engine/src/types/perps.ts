/**
 * Perps Types Stubs
 *
 * These types were removed as unused exports.
 */

export interface PerpPosition {
  id: string
  marketId: string
  userId: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  leverage: number
  liquidationPrice: number
  unrealizedPnL: number
  createdAt: number
}

export interface PerpMarket {
  id: string
  ticker: string
  name: string
  lastPrice: number
  markPrice: number
  indexPrice: number
  fundingRate: number
  openInterest: number
  volume24h: number
}
