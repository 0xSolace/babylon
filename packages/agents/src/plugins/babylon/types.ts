/**
 * Babylon Plugin Types
 * Type definitions for the Babylon A2A plugin
 */

import type { IAgentRuntime } from '@elizaos/core'
import type { BabylonA2AClient } from './integration-a2a-sdk'

/**
 * Extended runtime with A2A client
 */
export interface BabylonRuntime extends IAgentRuntime {
  a2aClient?: BabylonA2AClient
}

/**
 * Type guard to check if runtime is a BabylonRuntime
 */
function _isBabylonRuntime(runtime: IAgentRuntime): runtime is BabylonRuntime {
  return 'a2aClient' in runtime
}

/**
 * Convert runtime to BabylonRuntime, returning null if invalid
 */
export function toBabylonRuntime(runtime: IAgentRuntime): BabylonRuntime {
  return runtime as BabylonRuntime
}

/**
 * Market info for providers
 */
export interface MarketInfo {
  id: string
  question: string
  yesShares: number
  noShares: number
  liquidity: number
  endDate: string
  resolved: boolean
}

/**
 * Position info for providers
 */
export interface PositionInfo {
  id: string
  marketId: string
  question: string
  side: string
  shares: number
  avgPrice: number
}

/**
 * Perp position info
 */
export interface PerpPositionInfo {
  id: string
  ticker: string
  side: string
  amount: number
  leverage: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
}

/**
 * Post info for providers
 */
export interface PostInfo {
  id: string
  content: string
  authorId: string
  commentsCount: number
  reactionsCount: number
  createdAt: string
}

/**
 * Message info for providers
 */
export interface MessageInfo {
  id: string
  content: string
  senderId: string
  createdAt: string
}

/**
 * Chat info
 */
export interface ChatInfo {
  id: string
  name: string | null
  isGroup: boolean
  participants: number
  lastMessage: MessageInfo | null
  updatedAt: string
}

/**
 * Action parameters
 */
// biome-ignore lint/correctness/noUnusedVariables: Documents plugin action params
interface TradeActionParams {
  marketId: string
  side: 'YES' | 'NO'
  amount: number
}

// biome-ignore lint/correctness/noUnusedVariables: Documents plugin action params
interface PostActionParams {
  content: string
  type?: string
}

// biome-ignore lint/correctness/noUnusedVariables: Documents plugin action params
interface CommentActionParams {
  postId: string
  content: string
}

// biome-ignore lint/correctness/noUnusedVariables: Documents plugin action params
interface MessageActionParams {
  chatId: string
  content: string
}
