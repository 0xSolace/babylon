/**
 * Autonomous Trading Service
 *
 * Handles agents making REAL trades on prediction markets and perps.
 * Uses DirectExecutors for actual trade execution (DRY principle).
 */

import { db } from '@babylon/db'
import {
  formatRandomContext,
  generateRandomMarketContext,
  StaticDataRegistry,
  shuffleArray,
  WalletService,
} from '@babylon/engine'
import type { IAgentRuntime } from '@elizaos/core'
import { countTokensSync, truncateToTokenLimitSync } from '@jejunetwork/shared'
import { callAgentLLM } from '../llm'
import { getAgentConfig } from '../shared/agent-config'
import { logger } from '../shared/logger'
import { executeDirectTrade } from './DirectExecutors'
import {
  parseLLMResponseWithDefault,
  TradeDecisionSchema,
} from './schemas/llm-response-schemas'

export class AutonomousTradingService {
  /**
   * Evaluate and execute trades for an agent
   */
  async executeTrades(
    agentUserId: string,
    _runtime: IAgentRuntime,
  ): Promise<{
    tradesExecuted: number
    marketId?: string
    ticker?: string
    side?: string
    marketType?: 'prediction' | 'perp'
  }> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    })

    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

    // Get agent's positions separately
    const positionsResult = await db.position.findMany({
      where: { userId: agentUserId, status: 'active' },
    })

    const perpPositionsResult = await db.perpPosition.findMany({
      where: { userId: agentUserId, closedAt: null },
    })

    // Get current markets
    const predictionMarkets = await db.market.findMany({
      where: { resolved: false, endDate: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Get perp markets from static registry with dynamic prices
    const orgStates = await db.organizationState.findMany({
      orderBy: { currentPrice: 'desc' },
    })
    const perpMarkets = orgStates
      .slice(0, 10)
      .map((state) => {
        const staticOrg = StaticDataRegistry.getOrganization(String(state.id))
        return staticOrg
          ? {
              ...staticOrg,
              currentPrice:
                (state.currentPrice ? Number(state.currentPrice) : null) ??
                staticOrg.initialPrice,
            }
          : null
      })
      .filter(
        (o): o is NonNullable<typeof o> => o !== null && o.type === 'company',
      )

    const balance = await WalletService.getBalance(agentUserId)

    // Shuffle markets to add variety to prompts
    const shuffledPredictions = shuffleArray(predictionMarkets)
    const shuffledPerps = shuffleArray(perpMarkets)

    // Get random market context for variety
    const marketContext = await generateRandomMarketContext({
      includeGainers: true,
      includeLosers: true,
      includeQuestions: true,
      includePosts: false,
      includeEvents: false,
    })
    const contextString = formatRandomContext(marketContext)

    const config = await getAgentConfig(agentUserId)
    const displayName = agent.displayName ? String(agent.displayName) : 'Agent'
    const lifetimePnL = agent.lifetimePnL ? Number(agent.lifetimePnL) : 0

    // Build trading decision prompt
    const prompt = `${config?.systemPrompt ?? 'You are an autonomous trading agent on Babylon.'}

You are ${displayName}, an autonomous trading agent.

Current Status:
- Balance: $${balance.balance}
- P&L: ${lifetimePnL}
- Open Positions: ${positionsResult.length + perpPositionsResult.length}

Available Prediction Markets:
${shuffledPredictions
  .slice(0, 5)
  .map((m) => {
    const question = m.question ? String(m.question) : 'Unknown'
    return `- ${question} (YES: ${m.yesShares}, NO: ${m.noShares})`
  })
  .join('\n')}

Available Perp Markets:
${shuffledPerps
  .slice(0, 5)
  .map((o) => {
    const initial = o.initialPrice ?? 100
    const current = o.currentPrice ?? initial
    const changePercent = (((current - initial) / initial) * 100).toFixed(1)
    const direction = current > initial ? '📈' : current < initial ? '📉' : '➡️'
    return `- ${o.ticker}: ${o.name} @ $${current.toFixed(2)} ${direction} ${changePercent}% from IPO ($${initial})`
  })
  .join('\n')}

Strategy: ${config?.tradingStrategy || 'Balanced risk/reward seeking alpha'}

Task: Decide on ONE trade action:

{"action": "hold"} OR
{"action": "trade", "trade": {"type": "prediction"|"perp", "market": "market_id_or_name", "action": "buy_yes"|"buy_no"|"open_long"|"open_short", "amount": number, "reasoning": "brief_reason"}}

${contextString}

Now analyze and decide:`

    // Ensure prompt fits within context limit
    const estimatedTokens = countTokensSync(prompt)
    let finalPrompt = prompt
    if (estimatedTokens > 30000) {
      logger.warn(
        `Trading prompt too long: ${estimatedTokens} tokens, truncating`,
        undefined,
        'AutonomousTrading',
      )
      const truncated = truncateToTokenLimitSync(prompt, 30000, {
        ellipsis: true,
      })
      finalPrompt = truncated.text
      logger.info(
        `Truncated to ${truncated.tokens} tokens`,
        undefined,
        'AutonomousTrading',
      )
    }

    // Use large model for trading decisions
    const decisionText = await callAgentLLM({
      prompt: finalPrompt,
      system: config?.systemPrompt,
      modelSize: 'large',
      runtime: _runtime,
      temperature: 0.7,
      maxTokens: 800,
      actionType: 'make_trade_decision',
      purpose: 'response',
    })

    // Parse trade decision from response
    const tradeDecision = parseTradeDecision(decisionText)

    if (tradeDecision.action === 'hold') {
      logger.info(
        `Agent ${displayName} decided to hold`,
        undefined,
        'AutonomousTrading',
      )
      return {
        tradesExecuted: 0,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      }
    }

    const trade = tradeDecision.trade
    let tradesExecuted = 0
    let lastMarketId: string | undefined
    let lastTicker: string | undefined
    let lastSide: string | undefined
    let lastMarketType: 'prediction' | 'perp' | undefined

    // Execute the trade based on type
    if (trade.type === 'prediction' && predictionMarkets.length > 0) {
      const market = predictionMarkets.find((m) => {
        const marketId = String(m.id)
        const marketQuestion = m.question ? String(m.question) : ''
        return (
          marketId === trade.market || marketQuestion.includes(trade.market)
        )
      })
      if (market && trade.amount <= Number(balance.balance)) {
        if (trade.action === 'buy_yes' || trade.action === 'buy_no') {
          const side = trade.action === 'buy_yes'
          const marketIdStr = String(market.id)

          // Execute via DirectExecutors
          const result = await executeDirectTrade({
            agentUserId,
            marketType: 'prediction',
            marketId: marketIdStr,
            side: trade.action,
            amount: trade.amount,
            reasoning: trade.reasoning,
          })

          if (result.success) {
            tradesExecuted++
            lastMarketId = marketIdStr
            lastSide = side ? 'YES' : 'NO'
            lastMarketType = 'prediction'
            const logMarketQuestion = market.question
              ? String(market.question)
              : 'Market'
            logger.info(
              `Agent ${displayName} bought ${side ? 'YES' : 'NO'} on ${logMarketQuestion}`,
              undefined,
              'AutonomousTrading',
            )
          }
        }
      }
    } else if (trade.type === 'perp' && perpMarkets.length > 0) {
      const org = perpMarkets.find(
        (o) =>
          o.name === trade.market ||
          String(o.id) === trade.market ||
          o.ticker === trade.market,
      )
      if (org && trade.amount <= Number(balance.balance)) {
        if (trade.action === 'open_long' || trade.action === 'open_short') {
          const perpSide = trade.action === 'open_long' ? 'long' : 'short'
          const ticker = org.ticker

          if (!ticker) {
            logger.warn(
              `Org ${org.id} has no ticker`,
              undefined,
              'AutonomousTrading',
            )
          } else {
            // Execute via DirectExecutors
            const result = await executeDirectTrade({
              agentUserId,
              marketType: 'perp',
              marketId: ticker,
              side: trade.action,
              amount: trade.amount,
              reasoning: trade.reasoning,
            })

            if (result.success) {
              tradesExecuted++
              lastTicker = ticker
              lastSide = perpSide
              lastMarketType = 'perp'
              logger.info(
                `Agent ${displayName} opened ${perpSide} position on ${org.name}`,
                undefined,
                'AutonomousTrading',
              )
            }
          }
        }
      }
    }

    return {
      tradesExecuted,
      marketId: lastMarketId,
      ticker: lastTicker,
      side: lastSide,
      marketType: lastMarketType,
    }
  }
}

/**
 * Parse trade decision from LLM response with Zod validation
 */
function parseTradeDecision(response: string): {
  action: 'hold' | 'trade'
  trade: {
    type: 'prediction' | 'perp'
    market: string
    action: 'buy_yes' | 'buy_no' | 'open_long' | 'open_short'
    amount: number
    reasoning?: string
  }
} {
  const defaultHold = {
    action: 'hold' as const,
    trade: {
      type: 'prediction' as const,
      market: '',
      action: 'buy_yes' as const,
      amount: 0,
    },
  }

  const parsed = parseLLMResponseWithDefault(response, TradeDecisionSchema, {
    action: 'hold' as const,
  })

  if (parsed.action === 'hold' || !parsed.trade) {
    return defaultHold
  }

  return {
    action: 'trade',
    trade: {
      type: (parsed.trade.type === 'perp' ? 'perp' : 'prediction') as
        | 'prediction'
        | 'perp',
      market: parsed.trade.market || '',
      action: (parsed.trade.action || 'buy_yes') as
        | 'buy_yes'
        | 'buy_no'
        | 'open_long'
        | 'open_short',
      amount: parsed.trade.amount || 0,
      reasoning: parsed.trade.reasoning,
    },
  }
}

export const autonomousTradingService = new AutonomousTradingService()
