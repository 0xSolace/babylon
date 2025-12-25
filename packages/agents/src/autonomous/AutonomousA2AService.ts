// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * Autonomous A2A Service
 *
 * Handles autonomous agent actions using the A2A protocol for protocol-compliant
 * interactions. Provides advanced actions beyond direct database access.
 *
 * @packageDocumentation
 */

import { db, eq, users } from '@babylon/db'
import { shuffleArray } from '@babylon/engine'
import type { IAgentRuntime } from '@elizaos/core'
import { callAgentLLM } from '../llm'
import type { BabylonRuntime } from '../plugins/babylon/types'
import { agentPnLService } from '../services/AgentPnLService'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'
import {
  A2ATradeDecisionSchema,
  parseLLMResponse,
} from './schemas/llm-response-schemas'

/**
 * Type guard to check if runtime has A2A client
 *
 * @internal
 */
function isBabylonRuntime(runtime: IAgentRuntime): runtime is BabylonRuntime {
  return (
    'a2aClient' in runtime &&
    (runtime as BabylonRuntime).a2aClient !== undefined
  )
}

/**
 * Prediction market data structure
 * @internal
 */
interface PredictionMarket {
  id: string
  yesShares: number
  noShares: number
  liquidity: number
  question: string
}

/**
 * Perpetual position data structure
 * @internal
 */
interface PerpPosition {
  id: string
  side: string
  currentPrice: number
  entryPrice: number
}

/**
 * Portfolio response from A2A service
 * @internal
 */
interface PortfolioResponse {
  balance: number
  positions: Array<PortfolioPosition>
  pnl: number
}

interface PortfolioPosition {
  id: string
  marketId?: string
  ticker?: string
  side: string
  amount: number
  price: number
  pnl?: number
  type: 'prediction' | 'perp'
}

/**
 * Service for autonomous actions via A2A protocol
 */
export class AutonomousA2AService {
  /**
   * Executes autonomous trading via A2A protocol
   *
   * Uses LLM-based decision making to analyze market conditions and execute
   * intelligent trades through the A2A protocol.
   *
   * @param agentUserId - Agent user ID
   * @param runtime - Agent runtime with A2A client
   * @returns Trade execution result
   * @throws Error if agent not found or A2A client unavailable
   */
  async executeA2ATrade(
    agentUserId: string,
    runtime: IAgentRuntime,
  ): Promise<{
    success: boolean
    tradeId?: string
    marketId?: string
    ticker?: string
    side?: string
    marketType?: 'prediction' | 'perp'
  }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      logger.debug('A2A not available, skipping A2A trade', { agentUserId })
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    const agentResult = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1)
    const agent = agentResult[0]
    const config = await getAgentConfig(agentUserId)

    if (!agent || !agent.isAgent || !config?.autonomousTrading) {
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Get available markets (both prediction and perpetual)
    const predictionsResponse = await a2aClient.sendRequest<{
      predictions?: PredictionMarket[]
    }>('a2a.getPredictions', {
      status: 'active',
    })

    const perpetualsResponse = await a2aClient.sendRequest<{
      perpetuals?: Array<{
        ticker: string
        price: number
        priceChange24h?: number
        volume24h: number
      }>
    }>('a2a.getPerpetuals', {})

    const hasPredictions =
      predictionsResponse?.predictions &&
      predictionsResponse.predictions.length > 0
    const hasPerpetuals =
      perpetualsResponse?.perpetuals && perpetualsResponse.perpetuals.length > 0

    if (!hasPredictions && !hasPerpetuals) {
      logger.debug('No markets available for trading', { agentUserId })
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    // Get portfolio for context
    const portfolio = await a2aClient.sendRequest<PortfolioResponse>(
      'a2a.getPortfolio',
      {},
    )

    // Shuffle markets to provide variety and avoid bias toward first markets
    const predictionsList = predictionsResponse?.predictions ?? []
    const perpetualsList = perpetualsResponse?.perpetuals ?? []
    const shuffledPredictions = hasPredictions
      ? shuffleArray([...predictionsList])
      : []
    const shuffledPerpetuals = hasPerpetuals
      ? shuffleArray([...perpetualsList])
      : []

    // Build LLM decision prompt with both market types
    const predictions = shuffledPredictions.slice(0, 5)
    const perpetuals = shuffledPerpetuals.slice(0, 5)

    const prompt = `${config?.systemPrompt ?? 'You are an autonomous trading agent.'}

You are ${agent.displayName}, an autonomous trading agent making a prediction market trading decision.

Current Status:
- Balance: $${portfolio.balance.toFixed(2)}
- P&L: $${portfolio.pnl.toFixed(2)}
- Open Positions: ${portfolio.positions.length}

Available Prediction Markets:
${
  predictions.length > 0
    ? predictions
        .map((m: PredictionMarket, i: number) => {
          const totalShares = m.yesShares + m.noShares
          const yesPrice = totalShares > 0 ? m.yesShares / totalShares : 0.5
          const noPrice = 1 - yesPrice
          return `${i + 1}. "${m.question}"
   - Market ID: ${m.id}
   - YES: ${(yesPrice * 100).toFixed(1)}% (${m.yesShares} shares)
   - NO: ${(noPrice * 100).toFixed(1)}% (${m.noShares} shares)
   - Liquidity: $${m.liquidity?.toFixed(0) || '0'}`
        })
        .join('\n\n')
    : '(None available)'
}

Available Perpetual Markets:
${
  perpetuals.length > 0
    ? perpetuals
        .map((m, i: number) => {
          const priceChange = m.priceChange24h || 0
          const changePercent = (priceChange * 100).toFixed(1)
          const trend = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️'
          return `${i + 1}. ${m.ticker}
   - Current Price: $${m.price.toFixed(2)}
   - 24h Change: ${trend} ${changePercent}%
   - Volume: $${m.volume24h.toFixed(0)}`
        })
        .join('\n\n')
    : '(None available)'
}

Analyze these markets and decide if you should trade. Consider:
- Market odds vs your assessment
- Your available balance
- Risk/reward ratio
- Your existing positions

IMPORTANT: You MUST respond with ONLY valid JSON, nothing else. No explanations, no thinking, just the JSON.

JSON format for prediction markets:
{
  "action": "trade",
  "trade": {
    "type": "prediction",
    "marketId": "market-id",
    "outcome": "YES" | "NO",
    "amount": number (10-100),
    "reasoning": "brief explanation"
  }
}

JSON format for perpetual markets:
{
  "action": "trade",
  "trade": {
    "type": "perp",
    "ticker": "BTC" | "ETH" | etc,
    "side": "LONG" | "SHORT",
    "size": number (10-100),
    "leverage": number (1-5),
    "reasoning": "brief explanation"
  }
}

If you don't see a good opportunity: {"action": "hold", "reasoning": "why not"}

Your JSON response:`

    // Call LLM for decision
    const decision = await callAgentLLM({
      prompt,
      system: config?.systemPrompt,
      modelSize: 'large',
      runtime, // Pass runtime to access W&B trained models AND trajectory context
      temperature: 0.7,
      maxTokens: 400,
      actionType: 'evaluate_a2a_trade',
      purpose: 'action', // RLAIF: This is a trading action decision
    })

    // Parse decision with Zod validation
    const tradeDecision = parseLLMResponse(decision, A2ATradeDecisionSchema)
    if (!tradeDecision) {
      logger.debug('No valid JSON in LLM response', {
        agentUserId,
        responseLength: decision.length,
      })
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    if (tradeDecision.action !== 'trade' || !tradeDecision.trade) {
      logger.debug('Agent decided to hold', { agentUserId })
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    const trade = tradeDecision.trade
    const tradeType = trade.type || 'prediction' // Default to prediction for backward compat

    // Execute based on trade type
    if (tradeType === 'perp') {
      // Perpetual market trade
      const { ticker, side, size, leverage, reasoning } = trade

      if (!ticker || !side || !size || size < 10 || size > portfolio.balance) {
        logger.warn('Invalid perp trade parameters', {
          ticker,
          side,
          size,
          balance: portfolio.balance,
        })
        return {
          success: false,
          marketId: undefined,
          ticker: undefined,
          side: undefined,
          marketType: undefined,
        }
      }

      const perpLeverage = leverage || 1
      const tradeResult = await a2aClient.sendRequest<{
        positionId?: string
        entryPrice?: number
      }>('a2a.openPosition', {
        ticker,
        side,
        size,
        leverage: perpLeverage,
      })

      logger.info('A2A LLM-based perp trade executed', {
        agentUserId,
        ticker,
        side,
        size,
        leverage: perpLeverage,
        reasoning,
      })

      // Record trade via shared service (DRY - same as DirectExecutors)
      const perpSide = side.toLowerCase()
      await agentPnLService.recordTrade({
        agentId: agentUserId,
        userId: agentUserId, // A2A trades are self-managed
        marketType: 'perp',
        ticker,
        action: 'open',
        side: perpSide === 'long' || perpSide === 'short' ? perpSide : 'long',
        amount: size,
        price: tradeResult.entryPrice || 0,
        reasoning: `LLM decision (${perpLeverage}x leverage): ${reasoning}`,
      })

      return {
        success: true,
        tradeId: tradeResult.positionId,
        marketId: undefined,
        ticker,
        side,
        marketType: 'perp',
      }
    }
    // Prediction market trade
    const { marketId, outcome, amount, reasoning } = trade

    if (
      !marketId ||
      !outcome ||
      !amount ||
      amount < 10 ||
      amount > portfolio.balance
    ) {
      logger.warn('Invalid prediction trade parameters', {
        marketId,
        outcome,
        amount,
        balance: portfolio.balance,
      })
      return {
        success: false,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    const tradeResult = await a2aClient.sendRequest<{
      shares?: number
      avgPrice?: number
      positionId?: string
    }>('a2a.buyShares', {
      marketId,
      outcome,
      amount,
    })

    logger.info('A2A LLM-based trade executed', {
      agentUserId,
      marketId,
      outcome,
      amount,
      shares: tradeResult.shares || 0,
      reasoning,
    })

    // Record trade via shared service (DRY - same as DirectExecutors)
    await agentPnLService.recordTrade({
      agentId: agentUserId,
      userId: agentUserId, // A2A trades are self-managed
      marketType: 'prediction',
      marketId,
      action: 'open',
      side: outcome.toLowerCase() as 'yes' | 'no',
      amount,
      price: tradeResult.avgPrice || 0,
      reasoning: `LLM decision: ${reasoning}`,
    })

    return {
      success: true,
      tradeId: tradeResult.positionId,
      marketId,
      ticker: undefined,
      side: outcome,
      marketType: 'prediction',
    }
  }

  /**
   * Post via A2A with enhanced context
   */
  async createA2APost(
    agentUserId: string,
    runtime: IAgentRuntime,
    content: string,
  ): Promise<{ success: boolean; postId?: string }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      logger.debug('A2A not connected, skipping A2A post', { agentUserId })
      return { success: false }
    }

    const agentResult = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1)
    const agent = agentResult[0]
    const postingConfig = await getAgentConfig(agentUserId)

    if (!agent || !agent.isAgent || !postingConfig?.autonomousPosting) {
      return { success: false }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Create post via A2A
    const postResult = await a2aClient.sendRequest<{ postId?: string }>(
      'a2a.createPost',
      {
        content,
        type: 'post',
      },
    )

    logger.info('A2A post created', {
      agentUserId,
      postId: postResult.postId,
      contentLength: content.length,
    })

    return { success: true, postId: postResult.postId }
  }

  /**
   * Engage with trending content via A2A
   */
  async engageWithTrending(
    agentUserId: string,
    runtime: IAgentRuntime,
  ): Promise<{ success: boolean; engagements: number }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      return { success: false, engagements: 0 }
    }

    const agentResult = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1)
    const agent = agentResult[0]

    if (!agent || !agent.isAgent) {
      return { success: false, engagements: 0 }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Get trending topics
    const trendingResponse = await a2aClient.sendRequest<{
      tags?: Array<{
        name: string
        displayName: string
        category: string
        postCount: number
      }>
    }>('a2a.getTrendingTags', {
      limit: 3,
    })

    if (!trendingResponse?.tags || trendingResponse.tags.length === 0) {
      return { success: false, engagements: 0 }
    }

    let engagements = 0

    // Engage with top trending topic
    const topTag = trendingResponse.tags[0]
    if (!topTag?.name) {
      return { success: false, engagements: 0 }
    }
    const postsResponse = await a2aClient.sendRequest<{
      posts?: Array<{
        id: string
        content: string
        authorId: string
        timestamp: string
      }>
    }>('a2a.getPostsByTag', {
      tag: topTag.name,
      limit: 5,
      offset: 0,
    })

    if (postsResponse?.posts && postsResponse.posts.length > 0) {
      // Like first post
      const post = postsResponse.posts[0]
      if (post?.id) {
        await a2aClient.sendRequest('a2a.likePost', {
          postId: post.id,
          userId: agentUserId, // Pass the agent's actual user ID
        })
        engagements++

        logger.info('A2A engagement completed', {
          agentUserId,
          tag: topTag.name,
          engagements,
        })
      }
    }

    return { success: true, engagements }
  }

  /**
   * Monitor positions via A2A
   */
  async monitorPositions(
    agentUserId: string,
    runtime: IAgentRuntime,
  ): Promise<{ success: boolean; actionsTaken: number }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      return { success: false, actionsTaken: 0 }
    }

    const agentResult = await db
      .select()
      .from(users)
      .where(eq(users.id, agentUserId))
      .limit(1)
    const agent = agentResult[0]
    const tradingConfig = await getAgentConfig(agentUserId)

    if (!agent || !agent.isAgent || !tradingConfig?.autonomousTrading) {
      return { success: false, actionsTaken: 0 }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Get positions via A2A
    const positionsResponse = await a2aClient.sendRequest<{
      perpPositions?: PerpPosition[]
    }>('a2a.getPositions', {
      userId: agentUserId,
    })

    let actions = 0

    // Check perp positions for stop-loss
    if (
      positionsResponse?.perpPositions &&
      positionsResponse.perpPositions.length > 0
    ) {
      for (const position of positionsResponse.perpPositions) {
        const pnlPercent =
          ((position.currentPrice - position.entryPrice) /
            position.entryPrice) *
          100

        // Close if losing > 25%
        if (position.side === 'long' && pnlPercent < -25) {
          await a2aClient.sendRequest('a2a.closePosition', {
            positionId: position.id,
          })
          actions++

          logger.info('A2A stop-loss triggered', {
            agentUserId,
            positionId: position.id,
            pnlPercent,
          })
        }

        // Take profits if > 100%
        if (position.side === 'long' && pnlPercent > 100) {
          await a2aClient.sendRequest('a2a.closePosition', {
            positionId: position.id,
          })
          actions++

          logger.info('A2A take-profit triggered', {
            agentUserId,
            positionId: position.id,
            pnlPercent,
          })
        }
      }
    }

    return { success: true, actionsTaken: actions }
  }
}

export const autonomousA2AService = new AutonomousA2AService()
