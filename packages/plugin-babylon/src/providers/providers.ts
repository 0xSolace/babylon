/**
 * Babylon Game Providers
 *
 * Providers supply real-time data and context to the agent runtime.
 * They are called automatically by runtime.composeState() to inject
 * current market conditions, wallet status, and position data into
 * every agent decision.
 */

import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  ServiceTypeName,
  State,
} from '@elizaos/core'
import { BabylonClientService } from '../plugin'
import { assertDefined, isA2ACachedMarketData, isA2AService } from '../types'

/**
 * Market Data Provider
 *
 * Aggregates active market information to give agent awareness of:
 * - Total number of active markets
 * - Highest volume markets
 * - Market opportunities
 */
export const marketDataProvider: Provider = {
  name: 'marketDataProvider',
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()
    const markets = await client.getActiveMarkets()

    if (markets.length === 0) {
      return {
        text: 'No active markets currently available',
      }
    }

    const sortedMarkets = markets.sort((a, b) => b.totalVolume - a.totalVolume)
    const topMarket = sortedMarkets[0]
    const highVolumeMarkets = sortedMarkets.filter((m) => m.totalVolume > 1000)

    let overviewText = `📊 Market Overview:\n- Active Markets: ${markets.length}`

    if (topMarket) {
      overviewText += `\n- Top Volume: "${topMarket.question}" ($${topMarket.totalVolume.toFixed(0)})`
    }

    overviewText += `\n- High Volume Markets (>$1000): ${highVolumeMarkets.length}`
    overviewText += `\n- Average Yes Price: ${((markets.reduce((sum, m) => sum + m.yesPrice, 0) / markets.length) * 100).toFixed(1)}%`

    return {
      text: overviewText,
      data: {
        markets,
        topMarket,
        highVolumeMarkets,
      },
    }
  },
}

/**
 * Wallet Status Provider
 *
 * Injects current wallet balance information into agent context.
 * Essential for making informed trading decisions based on available funds.
 */
export const walletStatusProvider: Provider = {
  name: 'walletStatusProvider',
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()
    const wallet = await client.getWallet()

    const utilizationRate =
      wallet.balance > 0
        ? ((wallet.lockedBalance / wallet.balance) * 100).toFixed(1)
        : '0.0'

    return {
      text: `💰 Wallet Status:
- Available Balance: $${wallet.availableBalance.toFixed(2)}
- Locked in Positions: $${wallet.lockedBalance.toFixed(2)}
- Total Balance: $${wallet.balance.toFixed(2)}
- Capital Utilization: ${utilizationRate}%`,
      data: { wallet },
    }
  },
}

/**
 * Position Summary Provider
 *
 * Provides overview of current trading positions including:
 * - Total positions
 * - Profitable vs losing positions
 * - Overall P&L
 * - Performance metrics
 */
export const positionSummaryProvider: Provider = {
  name: 'positionSummaryProvider',
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()
    const positions = await client.getPositions()

    if (positions.length === 0) {
      return {
        text: '📈 Positions: No active positions',
      }
    }

    const profitablePositions = positions.filter((p) => p.pnl > 0)
    const losingPositions = positions.filter((p) => p.pnl < 0)
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0)
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const winRate = (
      (profitablePositions.length / positions.length) *
      100
    ).toFixed(1)

    return {
      text: `📈 Position Summary:
- Active Positions: ${positions.length}
- Profitable: ${profitablePositions.length} | Losing: ${losingPositions.length}
- Win Rate: ${winRate}%
- Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}
- Position Value: $${totalValue.toFixed(2)}`,
      data: {
        positions,
        profitablePositions,
        losingPositions,
        totalPnL,
        totalValue,
        winRate: parseFloat(winRate),
      },
    }
  },
}

/**
 * A2A Market Data Provider
 *
 * Provides real-time market data from A2A WebSocket connections when available.
 * Falls back to REST API if A2A is not connected.
 */
export const a2aMarketDataProvider: Provider = {
  name: 'a2aMarketDataProvider',
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const a2aService = runtime.getService?.('babylon-a2a' as ServiceTypeName)

    // Check if A2A service is available and connected
    if (a2aService && isA2AService(a2aService) && a2aService.isConnected()) {
      const cacheKey = 'a2a.market.updates'
      const cachedDataPromise = runtime.getCache?.(cacheKey)

      if (cachedDataPromise) {
        const cachedData = await cachedDataPromise
        if (isA2ACachedMarketData(cachedData)) {
          return {
            text: `📡 A2A Real-time Market Data: ${cachedData.markets.length} markets updated`,
            data: { markets: cachedData.markets, source: 'a2a' },
          }
        }
      }
    }

    // Fall back to REST API
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()
    const markets = await client.getActiveMarkets()

    if (markets.length === 0) {
      return {
        text: 'No active markets currently available',
      }
    }

    return {
      text: `📊 Market Data (REST): ${markets.length} active markets`,
      data: { markets, source: 'rest' },
    }
  },
}

/**
 * Social Feed Provider
 *
 * Provides recent posts and social context to the agent.
 * Injected automatically via runtime.composeState()
 */
export const socialFeedProvider: Provider = {
  name: 'socialFeedProvider',
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const babylonService = runtime.getService<BabylonClientService>(
      BabylonClientService.serviceType,
    )
    assertDefined(babylonService, 'BabylonClientService')

    const client = babylonService.getClient()
    const posts = await client.getRecentPosts(20)

    if (posts.length === 0) {
      return {
        text: 'No recent posts available',
      }
    }

    const topPosts = posts
      .filter((p) => p.likeCount > 0 || p.commentCount > 0)
      .slice(0, 5)

    const popularAuthors = new Map<string, number>()
    posts.forEach((post) => {
      const engagement = post.likeCount + post.commentCount
      const current = popularAuthors.get(post.authorId) || 0
      popularAuthors.set(post.authorId, current + engagement)
    })

    const topAuthors = Array.from(popularAuthors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    let overviewText = `📱 Social Feed:\n- Recent Posts: ${posts.length}`

    if (topPosts.length > 0) {
      const topPost = topPosts[0]
      overviewText += `\n- Trending Posts: ${topPosts.length}`
      overviewText += `\n- Top Post Engagement: ${topPost.likeCount} likes, ${topPost.commentCount} comments`
    }

    if (topAuthors.length > 0) {
      overviewText += `\n- Active Authors: ${topAuthors.length}`
    }

    return {
      text: overviewText,
      data: {
        posts,
        topPosts,
        topAuthors,
        totalPosts: posts.length,
      },
    }
  },
}

/**
 * Export all providers for plugin registration
 */
export const babylonGameProviders: Provider[] = [
  marketDataProvider,
  walletStatusProvider,
  positionSummaryProvider,
  a2aMarketDataProvider,
  socialFeedProvider,
]
