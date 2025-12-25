/**
 * Babylon Game API Client
 *
 * Client for interacting with Babylon prediction market API
 * Supports both manual auth tokens and automatic agent authentication
 */

import { logger } from '@elizaos/core'
import { isObject } from '@jejunetwork/shared'
import { AgentAuthService } from './agent-auth-service'
import type {
  AgentConfig,
  BabylonMarket,
  BabylonMarketHistory,
  BabylonPosition,
  BabylonWallet,
  Chat,
  TradeRequest,
  TradeResult,
} from './types'
import {
  extractPositions,
  getApiErrorMessage,
  isBabylonMarket,
  isBabylonWallet,
  isBuySharesResponse,
  isChatsListResponse,
  isCreateCommentResponse,
  isCreatePostResponse,
  isMarketsListResponse,
  isPositionsResponse,
  isPostsListResponse,
  isSellSharesResponse,
} from './types'

// Type for HTTP headers
type HeadersInit = Record<string, string>

export class BabylonApiClient {
  private config: AgentConfig
  private baseUrl: string
  private authToken?: string
  private agentAuthService?: AgentAuthService
  private useAgentAuth = false

  constructor(config: AgentConfig) {
    this.config = config
    this.baseUrl = config.apiBaseUrl || 'http://localhost:3000'
    this.authToken = config.authToken

    // Enable automatic agent authentication if no manual token provided
    if (!this.authToken) {
      this.agentAuthService = new AgentAuthService(this.baseUrl)
      this.useAgentAuth = this.agentAuthService.hasCredentials()

      if (this.useAgentAuth) {
        logger.info('🤖 Agent authentication enabled')
      }
    }
  }

  /**
   * Set authentication token (from OAuth3 or other auth provider)
   */
  setAuthToken(token: string): void {
    this.authToken = token
    this.useAgentAuth = false // Disable auto-auth when manual token is set
  }

  /**
   * Get authentication headers
   */
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`
      return headers
    }

    if (this.useAgentAuth && this.agentAuthService) {
      const sessionToken = await this.agentAuthService.getSessionToken()
      headers.Authorization = `Bearer ${sessionToken}`
    }

    return headers
  }

  /**
   * Fetch active markets
   */
  async getActiveMarkets(): Promise<BabylonMarket[]> {
    const response = await fetch(`${this.baseUrl}/api/markets/predictions`, {
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isMarketsListResponse(data)) {
      throw new Error('Invalid markets response format')
    }
    return data.markets
  }

  /**
   * Get specific market by ID
   */
  async getMarket(marketId: string): Promise<BabylonMarket> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}`,
      {
        headers: await this.getHeaders(),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch market: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isBabylonMarket(data)) {
      throw new Error('Invalid market response format')
    }
    return data
  }

  /**
   * Get user's wallet balance
   */
  async getWallet(): Promise<BabylonWallet> {
    const endpoint = this.useAgentAuth
      ? `${this.baseUrl}/api/agents/wallet`
      : `${this.baseUrl}/api/wallet/balance`

    const response = await fetch(endpoint, {
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch wallet: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isBabylonWallet(data)) {
      throw new Error('Invalid wallet response format')
    }
    return data
  }

  /**
   * Get user's positions
   */
  async getPositions(): Promise<BabylonPosition[]> {
    const endpoint = this.useAgentAuth
      ? `${this.baseUrl}/api/agents/positions`
      : `${this.baseUrl}/api/positions`

    const response = await fetch(endpoint, {
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isPositionsResponse(data)) {
      throw new Error('Invalid positions response format')
    }
    return extractPositions(data)
  }

  /**
   * Place a trade (buy shares)
   */
  async buyShares(request: TradeRequest): Promise<TradeResult> {
    if (request.amount < 1) {
      throw new Error('Minimum trade size is $1')
    }

    if (!['yes', 'no'].includes(request.side)) {
      throw new Error('Side must be "yes" or "no"')
    }

    const wallet = await this.getWallet()
    if (wallet.availableBalance < request.amount) {
      throw new Error('Insufficient balance')
    }

    if (request.amount > this.config.tradingLimits.maxTradeSize) {
      throw new Error(
        `Trade size exceeds limit of $${this.config.tradingLimits.maxTradeSize}`,
      )
    }

    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${request.marketId}/buy`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          side: request.side,
          amount: request.amount,
        }),
      },
    )

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(getApiErrorMessage(errorData, response.statusText))
    }

    const data: unknown = await response.json()
    if (!isBuySharesResponse(data)) {
      throw new Error('Invalid buy shares response format')
    }

    return {
      success: true,
      shares: data.shares,
      avgPrice: data.avgPrice,
      newPosition: data.position,
    }
  }

  /**
   * Sell shares (close position)
   */
  async sellShares(marketId: string, shares: number): Promise<TradeResult> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}/sell`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          shares,
        }),
      },
    )

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(getApiErrorMessage(errorData, response.statusText))
    }

    const data: unknown = await response.json()
    if (!isSellSharesResponse(data)) {
      throw new Error('Invalid sell shares response format')
    }

    return {
      success: true,
      shares: data.shares,
      avgPrice: data.avgPrice,
    }
  }

  /**
   * Get market history and price data
   */
  async getMarketHistory(marketId: string): Promise<BabylonMarketHistory> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}/history`,
      {
        headers: await this.getHeaders(),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch market history: ${response.statusText}`)
    }

    // Market history structure matches our interface directly
    const data: unknown = await response.json()
    if (
      !isObject(data) ||
      typeof data.marketId !== 'string' ||
      !Array.isArray(data.priceHistory) ||
      !Array.isArray(data.trades)
    ) {
      throw new Error('Invalid market history response format')
    }
    // After validation, we know the shape matches BabylonMarketHistory
    return {
      marketId: data.marketId,
      priceHistory: data.priceHistory as BabylonMarketHistory['priceHistory'],
      trades: data.trades as BabylonMarketHistory['trades'],
    }
  }

  async getChats(): Promise<Chat[]> {
    const response = await fetch(`${this.baseUrl}/api/chats`, {
      headers: await this.getHeaders(),
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch chats: ${response.statusText}`)
    }
    const data: unknown = await response.json()
    if (!isChatsListResponse(data)) {
      return []
    }
    return data.chats
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/chats/${chatId}/message`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ content }),
      },
    )

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        getApiErrorMessage(
          errorData,
          `Failed to send message: ${response.statusText}`,
        ),
      )
    }
  }

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        getApiErrorMessage(
          errorData,
          `Failed to like post: ${response.statusText}`,
        ),
      )
    }
  }

  /**
   * Create a post
   */
  async createPost(content: string): Promise<{ postId: string }> {
    const response = await fetch(`${this.baseUrl}/api/posts`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        getApiErrorMessage(
          errorData,
          `Failed to create post: ${response.statusText}`,
        ),
      )
    }

    const data: unknown = await response.json()
    if (!isCreatePostResponse(data)) {
      throw new Error('Invalid create post response format')
    }
    return { postId: data.post.id }
  }

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/users/${encodeURIComponent(userId)}/follow`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
      },
    )

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        getApiErrorMessage(
          errorData,
          `Failed to follow user: ${response.statusText}`,
        ),
      )
    }
  }

  /**
   * Comment on a post
   */
  async commentOnPost(
    postId: string,
    content: string,
  ): Promise<{ commentId: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ content }),
      },
    )

    if (!response.ok) {
      const errorData: unknown = await response.json()
      throw new Error(
        getApiErrorMessage(
          errorData,
          `Failed to comment: ${response.statusText}`,
        ),
      )
    }

    const data: unknown = await response.json()
    if (!isCreateCommentResponse(data)) {
      throw new Error('Invalid create comment response format')
    }
    return { commentId: data.comment.id }
  }

  /**
   * Get recent posts from feed
   */
  async getRecentPosts(limit = 20): Promise<
    Array<{
      id: string
      content: string
      authorId: string
      timestamp: string
      likeCount: number
      commentCount: number
    }>
  > {
    const response = await fetch(`${this.baseUrl}/api/posts?limit=${limit}`, {
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`)
    }

    const data: unknown = await response.json()
    if (!isPostsListResponse(data)) {
      return []
    }
    return data.posts
  }
}
