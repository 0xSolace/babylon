/**
 * Babylon Game Plugin Types
 *
 * Type definitions for Eliza agents interacting with Babylon prediction markets
 * Includes type guards, API response interfaces, and state extensions
 */

import {
  hasBooleanProperty,
  hasNumberProperty,
  hasStringProperty,
  isObject,
} from '@babylon/shared'
import { asUUID, type State, type UUID } from '@elizaos/core'

// Re-export type guards that are used in exported function bodies
export { isObject }

// =============================================================================
// System Constants
// =============================================================================

/**
 * System UUID for automated messages and internal operations.
 * Uses ElizaOS's asUUID for proper type safety.
 */
export const SYSTEM_ENTITY_ID: UUID = asUUID(
  '00000000-0000-0000-0000-000000000000',
)

/**
 * Default room ID for Babylon operations
 */
export const BABYLON_ROOM_ID: UUID = asUUID(
  '00000000-0000-0000-0000-000000000001',
)

// =============================================================================
// Core Domain Types
// =============================================================================

export interface BabylonMarket {
  id: string
  questionId: number
  question: string
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  totalVolume: number
  status: 'active' | 'resolved' | 'cancelled'
  closeDate: string
  metadata?: {
    category?: string
    tags?: string[]
  }
}

export interface BabylonPosition {
  id: string
  marketId: string
  side: boolean // true = YES, false = NO
  shares: number
  avgPrice: number
  currentValue: number
  pnl: number
}

export interface BabylonWallet {
  userId: string
  balance: number
  lockedBalance: number
  availableBalance: number
}

export interface TradeRequest {
  marketId: string
  side: 'yes' | 'no'
  amount: number
}

export interface TradeResult {
  success: boolean
  shares?: number
  avgPrice?: number
  newPosition?: BabylonPosition
  error?: string
}

export interface MarketAnalysis {
  marketId: string
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  confidence: number
  reasoning: string
  targetSide: 'yes' | 'no'
  suggestedAmount?: number
  riskLevel: 'low' | 'medium' | 'high'
}

export interface BabylonMarketHistory {
  marketId: string
  priceHistory: Array<{
    timestamp: string
    yesPrice: number
    noPrice: number
    volume: number
  }>
  trades: Array<{
    timestamp: string
    side: 'yes' | 'no'
    shares: number
    price: number
  }>
}

export interface AgentConfig {
  characterId: string
  apiBaseUrl: string
  authToken?: string
  walletAddress?: string
  privateKey?: string
  tradingLimits: {
    maxTradeSize: number
    maxPositionSize: number
    minConfidence: number
  }
}

export interface Chat {
  id: string
  name: string
  theme: string
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from markets list endpoint
 */
export interface MarketsListResponse {
  markets: BabylonMarket[]
}

/**
 * Response from positions endpoint with multiple position sources
 */
export interface PositionsResponse {
  positions?: BabylonPosition[]
  predictions?: { positions?: BabylonPosition[] }
  perpetuals?: { positions?: BabylonPosition[] }
}

/**
 * Response from buy shares endpoint
 */
export interface BuySharesResponse {
  shares: number
  avgPrice: number
  position: BabylonPosition
}

/**
 * Response from sell shares endpoint
 */
export interface SellSharesResponse {
  shares: number
  avgPrice: number
}

/**
 * Generic error response from API
 */
export interface ApiErrorResponse {
  error?: string
  message?: string
}

/**
 * Response from auth endpoint
 */
export interface AgentAuthResponse {
  success: boolean
  sessionToken?: string
  expiresAt?: number
  expiresIn?: number
  error?: string
}

/**
 * Response from onboard status check
 */
export interface OnboardStatusResponse {
  isRegistered: boolean
  tokenId: number
  reputationAwarded: boolean
}

/**
 * Response from onboard registration
 */
export interface OnboardRegisterResponse {
  tokenId: number
  walletAddress: string
}

/**
 * Response from create post endpoint
 */
export interface CreatePostResponse {
  post: { id: string }
}

/**
 * Response from comment endpoint
 */
export interface CreateCommentResponse {
  comment: { id: string }
}

/**
 * Response from chats list endpoint
 */
export interface ChatsListResponse {
  chats: Chat[]
}

/**
 * Social post from feed
 */
export interface SocialPost {
  id: string
  content: string
  authorId: string
  timestamp: string
  likeCount: number
  commentCount: number
}

/**
 * Response from posts list endpoint
 */
export interface PostsListResponse {
  posts: SocialPost[]
}

// =============================================================================
// Base Type Guards (Primitives)
// =============================================================================

/**
 * Check if a value has a property that is a function.
 */
export function hasFunctionProperty(
  obj: Record<string, unknown>,
  key: string,
): boolean {
  return typeof obj[key] === 'function'
}

/**
 * Check if a nested object has a string property.
 * Safely navigates obj[parentKey][childKey] and checks if it's a string.
 */
export function hasNestedStringProperty(
  obj: Record<string, unknown>,
  parentKey: string,
  childKey: string,
): boolean {
  const parent = obj[parentKey]
  if (!isObject(parent)) return false
  return typeof parent[childKey] === 'string'
}

// =============================================================================
// Type Guards for API Responses
// =============================================================================

/**
 * Type guard for MarketsListResponse
 */
export function isMarketsListResponse(
  data: unknown,
): data is MarketsListResponse {
  return isObject(data) && Array.isArray(data.markets)
}

/**
 * Type guard for BabylonMarket
 */
export function isBabylonMarket(data: unknown): data is BabylonMarket {
  if (!isObject(data)) return false
  return (
    hasStringProperty(data, 'id') &&
    hasNumberProperty(data, 'questionId') &&
    hasStringProperty(data, 'question') &&
    hasNumberProperty(data, 'yesPrice') &&
    hasNumberProperty(data, 'noPrice')
  )
}

/**
 * Type guard for BabylonWallet
 */
export function isBabylonWallet(data: unknown): data is BabylonWallet {
  if (!isObject(data)) return false
  return (
    hasNumberProperty(data, 'balance') &&
    hasNumberProperty(data, 'availableBalance') &&
    hasNumberProperty(data, 'lockedBalance')
  )
}

/**
 * Type guard for PositionsResponse
 */
export function isPositionsResponse(data: unknown): data is PositionsResponse {
  if (!isObject(data)) return false
  // Valid if any of the position sources exist
  return (
    (data.positions === undefined || Array.isArray(data.positions)) &&
    (data.predictions === undefined || isObject(data.predictions)) &&
    (data.perpetuals === undefined || isObject(data.perpetuals))
  )
}

/**
 * Type guard for BuySharesResponse
 */
export function isBuySharesResponse(data: unknown): data is BuySharesResponse {
  if (!isObject(data)) return false
  return (
    hasNumberProperty(data, 'shares') &&
    hasNumberProperty(data, 'avgPrice') &&
    'position' in data &&
    isObject(data.position)
  )
}

/**
 * Type guard for SellSharesResponse
 */
export function isSellSharesResponse(
  data: unknown,
): data is SellSharesResponse {
  if (!isObject(data)) return false
  return (
    hasNumberProperty(data, 'shares') && hasNumberProperty(data, 'avgPrice')
  )
}

/**
 * Type guard for ApiErrorResponse
 */
export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  if (!isObject(data)) return false
  return hasStringProperty(data, 'error') || hasStringProperty(data, 'message')
}

/**
 * Type guard for AgentAuthResponse
 */
export function isAgentAuthResponse(data: unknown): data is AgentAuthResponse {
  if (!isObject(data)) return false
  return hasBooleanProperty(data, 'success')
}

/**
 * Type guard for OnboardStatusResponse
 */
export function isOnboardStatusResponse(
  data: unknown,
): data is OnboardStatusResponse {
  if (!isObject(data)) return false
  return (
    hasBooleanProperty(data, 'isRegistered') &&
    hasNumberProperty(data, 'tokenId')
  )
}

/**
 * Type guard for OnboardRegisterResponse
 */
export function isOnboardRegisterResponse(
  data: unknown,
): data is OnboardRegisterResponse {
  if (!isObject(data)) return false
  return (
    hasNumberProperty(data, 'tokenId') &&
    hasStringProperty(data, 'walletAddress')
  )
}

/**
 * Type guard for CreatePostResponse
 */
export function isCreatePostResponse(
  data: unknown,
): data is CreatePostResponse {
  if (!isObject(data)) return false
  return hasNestedStringProperty(data, 'post', 'id')
}

/**
 * Type guard for CreateCommentResponse
 */
export function isCreateCommentResponse(
  data: unknown,
): data is CreateCommentResponse {
  if (!isObject(data)) return false
  return hasNestedStringProperty(data, 'comment', 'id')
}

/**
 * Type guard for ChatsListResponse
 */
export function isChatsListResponse(data: unknown): data is ChatsListResponse {
  return isObject(data) && Array.isArray(data.chats)
}

/**
 * Type guard for SocialPost
 */
export function isSocialPost(data: unknown): data is SocialPost {
  if (!isObject(data)) return false
  return (
    hasStringProperty(data, 'id') &&
    hasStringProperty(data, 'content') &&
    hasStringProperty(data, 'authorId')
  )
}

/**
 * Type guard for PostsListResponse
 */
export function isPostsListResponse(data: unknown): data is PostsListResponse {
  return isObject(data) && Array.isArray(data.posts)
}

// =============================================================================
// State Extensions for Babylon
// =============================================================================

/**
 * Extended State for Babylon trading context
 */
export interface BabylonTradingState extends State {
  analyses?: MarketAnalysis[]
  markets?: BabylonMarket[]
  tradeRequest?: TradeRequest
  marketId?: string
  side?: 'yes' | 'no'
  amount?: number
  portfolioMetrics?: {
    totalPnL: number
    winRate: number
    profitablePositions: number
    losingPositions: number
  }
  recommendations?: string[]
}

/**
 * Extended State for Babylon actions
 */
export interface BabylonActionState extends State {
  marketId?: string
  side?: 'yes' | 'no'
  amount?: number
  shares?: number
  inTradingFlow?: boolean
  pendingTradeAmount?: number
  postId?: string
  userId?: string
  postContent?: string
  commentContent?: string
}

/**
 * Extended State for market analysis
 */
export interface MarketAnalysisState extends State {
  marketId?: string
  minConfidence?: number
  analysis?: MarketAnalysis
  analyses?: MarketAnalysis[]
  marketCount?: number
  market?: BabylonMarket
  error?: string
}

/**
 * Extended State for portfolio management
 */
export interface PortfolioManagementState extends State {
  positions?: BabylonPosition[]
  wallet?: BabylonWallet
  portfolioMetrics?: {
    totalPositionValue: number
    totalPnL: number
    profitablePositions: number
    losingPositions: number
    exposureRatio: number
    winRate: number
  }
  recommendations?: string[]
  error?: string
}

/**
 * Extended State for social interactions
 */
export interface SocialInteractionState extends State {
  posts?: SocialPost[]
  topPosts?: SocialPost[]
  topAuthors?: string[]
  shouldLike?: boolean
  shouldComment?: boolean
  shouldFollow?: boolean
  shouldPost?: boolean
  targetPostId?: string
  targetUserId?: string
  interactionReason?: string
}

// =============================================================================
// Options Types for Actions
// =============================================================================

/**
 * Options for Babylon action handlers
 */
export interface BabylonActionOptions {
  marketId?: string
  side?: 'yes' | 'no'
  amount?: number
  shares?: number
  detailed?: boolean
  includeTradingContext?: boolean
  postId?: string
  userId?: string
  content?: string
}

// =============================================================================
// Service Types
// =============================================================================

/**
 * Discovery service interface for Agent0 integration
 */
export interface DiscoveryServiceInterface {
  discoverAndConnect: () => Promise<DiscoverableGameResult>
}

/**
 * Result from discovery service
 */
export interface DiscoverableGameResult {
  name: string
  endpoints: {
    api: string
    a2a: string
    mcp: string
  }
  capabilities: {
    markets: string[]
  }
  tokenId: number
  reputation?: {
    trustScore: number
  }
}

/**
 * Type guard for DiscoveryServiceInterface
 */
export function isDiscoveryService(
  service: unknown,
): service is DiscoveryServiceInterface {
  if (!isObject(service)) return false
  return hasFunctionProperty(service, 'discoverAndConnect')
}

// =============================================================================
// A2A Types
// =============================================================================

/**
 * A2A service connection check interface
 */
export interface A2AServiceInterface {
  isConnected: () => boolean
}

/**
 * Type guard for A2A service
 */
export function isA2AService(service: unknown): service is A2AServiceInterface {
  if (!isObject(service)) return false
  return hasFunctionProperty(service, 'isConnected')
}

/**
 * Cached market data from A2A
 */
export interface A2ACachedMarketData {
  markets: BabylonMarket[]
  timestamp?: number
}

/**
 * Type guard for A2A cached market data
 */
export function isA2ACachedMarketData(
  data: unknown,
): data is A2ACachedMarketData {
  if (!isObject(data)) return false
  // Ensure it's not a Promise (has 'then' method)
  if (hasFunctionProperty(data, 'then')) return false
  return Array.isArray(data.markets)
}

// =============================================================================
// Character Settings Types
// =============================================================================

/**
 * Character settings for trading
 */
export interface TradingCharacterSettings {
  strategies?: string[]
  riskTolerance?: number
  autoTrading?: boolean
  babylonApiUrl?: string
  babylonAuthToken?: string
  babylonMaxTradeSize?: number
  babylonMaxPositionSize?: number
  babylonMinConfidence?: number
}

// =============================================================================
// Memory Content Types
// =============================================================================

/**
 * Content with metadata for market context
 */
export interface ContentWithMarketMetadata {
  text?: string
  metadata?: {
    marketId?: string
  }
}

/**
 * Type guard for content with market metadata
 */
export function hasMarketMetadata(
  content: unknown,
): content is ContentWithMarketMetadata {
  if (!isObject(content)) return false
  return content.metadata === undefined || isObject(content.metadata)
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Safely extract error message from API response
 */
export function getApiErrorMessage(data: unknown, fallback: string): string {
  if (isApiErrorResponse(data)) {
    return data.error || data.message || fallback
  }
  return fallback
}

/**
 * Extract positions from PositionsResponse
 */
export function extractPositions(data: PositionsResponse): BabylonPosition[] {
  if (data.positions) {
    return data.positions
  }
  const predictionPositions = data.predictions?.positions || []
  const perpetualPositions = data.perpetuals?.positions || []
  return [...predictionPositions, ...perpetualPositions]
}

/**
 * Convert typed object to Record<string, unknown> for Eliza Content.data.
 * Uses Object.fromEntries to create a proper index-signature-compatible object.
 */
export function toDataRecord(obj: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj))
}

/**
 * Assert a value is defined, throwing with a descriptive error if not.
 * Use for values that should exist based on prior validation.
 */
export function assertDefined<T>(
  value: T | undefined | null,
  name: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${name} is not available`)
  }
}
