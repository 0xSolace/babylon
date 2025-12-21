/**
 * Autonomous Trading Service
 *
 * Handles agents making REAL trades on prediction markets and perps
 */

import { countTokensSync, truncateToTokenLimitSync } from '@babylon/api';
import { PerpDbAdapter, PerpMarketService } from '@babylon/core/markets/perps';
import { asUser, db } from '@babylon/db';
import {
  formatRandomContext,
  generateRandomMarketContext,
  PredictionPricing,
  StaticDataRegistry,
  shuffleArray,
  WalletService,
} from '@babylon/engine';
import type { IAgentRuntime } from '@elizaos/core';
import { callJejuDirect } from '../llm';
import { agentPnLService } from '../services/AgentPnLService';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

export class AutonomousTradingService {
  /**
   * Evaluate and execute trades for an agent
   */
  async executeTrades(
    agentUserId: string,
    _runtime: IAgentRuntime
  ): Promise<{
    tradesExecuted: number;
    marketId?: string;
    ticker?: string;
    side?: string;
    marketType?: 'prediction' | 'perp';
  }> {
    const agent = await db.user.findUnique({
      where: { id: agentUserId },
    });

    if (!agent?.isAgent) {
      logger.error('Agent not found or not an agent', { agentUserId });
      throw new Error('Agent not found');
    }

    const config = await getAgentConfig(agentUserId);

    // Get agent's positions separately
    const positionsResult = await db.position.findMany({
      where: { userId: agentUserId, status: 'active' },
    });

    const perpPositionsResult = await db.perpPosition.findMany({
      where: { userId: agentUserId, closedAt: null },
    });

    // Get current markets
    const predictionMarkets = await db.market.findMany({
      where: { resolved: false, endDate: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get perp markets from static registry with dynamic prices
    const orgStates = await db.organizationState.findMany({
      orderBy: { currentPrice: 'desc' },
    });
    const perpMarkets = orgStates
      .slice(0, 10)
      .map((state) => {
        const staticOrg = StaticDataRegistry.getOrganization(String(state.id));
        return staticOrg
          ? {
              ...staticOrg,
              currentPrice:
                (state.currentPrice ? Number(state.currentPrice) : null) ??
                staticOrg.initialPrice,
            }
          : null;
      })
      .filter(
        (o): o is NonNullable<typeof o> => o !== null && o.type === 'company'
      );

    const balance = await WalletService.getBalance(agentUserId);

    // Shuffle markets to add variety to prompts
    const shuffledPredictions = shuffleArray(predictionMarkets);
    const shuffledPerps = shuffleArray(perpMarkets);

    // Get random market context for variety
    const marketContext = await generateRandomMarketContext({
      includeGainers: true,
      includeLosers: true,
      includeQuestions: true,
      includePosts: false,
      includeEvents: true,
    });
    const contextString = formatRandomContext(marketContext);

    const displayName = agent.displayName ? String(agent.displayName) : 'Agent';
    const lifetimePnL = agent.lifetimePnL ? Number(agent.lifetimePnL) : 0;
    const managedBy = agent.managedBy ? String(agent.managedBy) : null;

    // Build trading decision prompt
    const prompt = `${config?.systemPrompt ?? 'You are an autonomous trading agent on Babylon.'}

You are ${displayName}, an autonomous trading agent.

Trading Strategy: ${config?.tradingStrategy ?? 'General market analysis'}

Current Status:
- Balance: $${balance.balance}
- P&L: ${lifetimePnL}
- Open Positions: ${positionsResult.length + perpPositionsResult.length}

Available Prediction Markets:
${shuffledPredictions
  .slice(0, 5)
  .map((m) => {
    const question = m.question ? String(m.question) : 'Unknown';
    return `- ${question} (YES: ${m.yesShares}, NO: ${m.noShares})`;
  })
  .join('\n')}

Available Perp Markets:
${shuffledPerps
  .slice(0, 5)
  .map((o) => {
    const initial = o.initialPrice ?? 100;
    const current = o.currentPrice ?? initial;
    const changePercent = (((current - initial) / initial) * 100).toFixed(1);
    const direction = current > initial ? '📈' : current < initial ? '📉' : '➡️';
    return `- ${o.ticker}: ${o.name} @ $${current.toFixed(2)} ${direction} ${changePercent}% from IPO ($${initial})`;
  })
  .join('\n')}

Your Open Positions:
${positionsResult.map((p) => `- Prediction: ${p.marketId}, ${p.side ? 'YES' : 'NO'}, ${p.shares} shares`).join('\n') || 'None'}
${perpPositionsResult.map((p) => `- Perp: ${p.ticker}, ${p.side}, $${p.size}, ${p.leverage}x`).join('\n') || 'None'}

Analyze the markets and decide if you should trade based on YOUR strategy and personality.

Trading Guidelines:
- Consider using 10-20% of balance per trade (e.g. $100-$200 with $1000 balance)
- Prediction markets: buy_yes, buy_no, or sell existing positions
- Perp markets: open_long, open_short, or close existing positions
- Consider YES/NO odds and look for value
- You decide the trade size based on your conviction and strategy

IMPORTANT: After your analysis, you MUST output valid JSON at the end.

Your response format:
1. Think through the decision (optional analysis/reasoning)
2. End with ONLY this JSON (no text after):

{"action": "hold"} OR
{"action": "trade", "trade": {"type": "prediction"|"perp", "market": "market_id_or_name", "action": "buy_yes"|"buy_no"|"open_long"|"open_short", "amount": number, "reasoning": "brief_reason"}}

${contextString}

Now analyze and decide:`;

    // Ensure prompt fits within context limit
    const estimatedTokens = countTokensSync(prompt);
    let finalPrompt = prompt;

    if (estimatedTokens > 30000) {
      logger.warn(
        `Trading prompt too long: ${estimatedTokens} tokens, truncating`,
        undefined,
        'AutonomousTrading'
      );
      const truncated = truncateToTokenLimitSync(prompt, 30000, {
        ellipsis: true,
      });
      finalPrompt = truncated.text;
      logger.info(
        `Truncated to ${truncated.tokens} tokens`,
        undefined,
        'AutonomousTrading'
      );
    }

    // Use large model for trading decisions
    const decisionText = await callJejuDirect({
      prompt: finalPrompt,
      system: config?.systemPrompt ?? undefined,
      modelSize: 'large',
      runtime: _runtime,
      temperature: 0.7,
      maxTokens: 800,
      actionType: 'make_trade_decision',
      purpose: 'response',
    });

    // Parse trade decision from response
    const tradeDecision = parseTradeDecision(decisionText);

    if (tradeDecision.action === 'hold') {
      logger.info(
        `Agent ${displayName} decided to hold`,
        undefined,
        'AutonomousTrading'
      );
      return {
        tradesExecuted: 0,
        marketId: undefined,
        ticker: undefined,
        side: undefined,
        marketType: undefined,
      };
    }

    const trade = tradeDecision.trade;
    let tradesExecuted = 0;
    let lastMarketId: string | undefined;
    let lastTicker: string | undefined;
    let lastSide: string | undefined;
    let lastMarketType: 'prediction' | 'perp' | undefined;

    // Execute the trade based on type
    if (trade.type === 'prediction' && predictionMarkets.length > 0) {
      const market = predictionMarkets.find((m) => {
        const marketId = String(m.id);
        const marketQuestion = m.question ? String(m.question) : '';
        return (
          marketId === trade.market || marketQuestion.includes(trade.market)
        );
      });
      if (market && trade.amount <= Number(balance.balance)) {
        if (trade.action === 'buy_yes' || trade.action === 'buy_no') {
          const side = trade.action === 'buy_yes';
          const marketIdStr = String(market.id);

          // Execute buy via internal service
          const result = await asUser({ userId: agentUserId }, async () => {
            // Calculate shares and pricing
            const calculation = PredictionPricing.calculateBuyWithFees(
              Number(market.yesShares),
              Number(market.noShares),
              side ? 'yes' : 'no',
              trade.amount
            );

            // Debit amount from balance
            const marketQuestion = market.question
              ? String(market.question)
              : 'Market';
            await WalletService.debit(
              agentUserId,
              trade.amount,
              'pred_buy',
              `Bought ${calculation.sharesBought} ${side ? 'YES' : 'NO'} shares: ${marketQuestion}`,
              marketIdStr
            );

            // Update market shares via raw SQL
            const newYesShares = side
              ? Number(market.yesShares) + calculation.sharesBought
              : calculation.newYesShares;
            const newNoShares = side
              ? calculation.newNoShares
              : Number(market.noShares) + calculation.sharesBought;

            await db.market.update({
              where: { id: marketIdStr },
              data: {
                yesShares: String(newYesShares),
                noShares: String(newNoShares),
              },
            });

            // Create or update position
            const existingPosition = await db.position.findFirst({
              where: { userId: agentUserId, marketId: marketIdStr },
            });

            let position;
            if (existingPosition) {
              const existingPositionId = String(existingPosition.id);
              const newShares =
                Number(existingPosition.shares) + calculation.sharesBought;
              const newAmount = Number(existingPosition.amount) + trade.amount;

              position = await db.position.update({
                where: { id: existingPositionId },
                data: {
                  shares: String(newShares),
                  amount: String(newAmount),
                  updatedAt: new Date(),
                },
              });
            } else {
              position = await db.position.create({
                data: {
                  id: await generateSnowflakeId(),
                  userId: agentUserId,
                  marketId: marketIdStr,
                  side,
                  shares: String(calculation.sharesBought),
                  avgPrice: String(calculation.avgPrice),
                  amount: String(trade.amount),
                  status: 'active',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            return { position, calculation };
          });

          // Record in AgentTrade
          await agentPnLService.recordTrade({
            agentId: agentUserId,
            userId: managedBy || agentUserId,
            marketType: 'prediction',
            marketId: marketIdStr,
            action: 'open',
            side: side ? 'yes' : 'no',
            amount: trade.amount,
            price: (result as { calculation: { avgPrice: number } }).calculation
              .avgPrice,
            reasoning: trade.reasoning || undefined,
          });

          tradesExecuted++;
          lastMarketId = marketIdStr;
          lastSide = side ? 'YES' : 'NO';
          lastMarketType = 'prediction';
          const logMarketQuestion = market.question
            ? String(market.question)
            : 'Market';
          logger.info(
            `Agent ${displayName} bought ${side ? 'YES' : 'NO'} on ${logMarketQuestion}`,
            undefined,
            'AutonomousTrading'
          );
        }
      }
    } else if (trade.type === 'perp' && perpMarkets.length > 0) {
      const org = perpMarkets.find(
        (o) =>
          o.name === trade.market ||
          o.id === trade.market ||
          o.ticker === trade.market
      );
      if (org && trade.amount <= Number(balance.balance)) {
        if (trade.action === 'open_long' || trade.action === 'open_short') {
          const side = trade.action === 'open_long' ? 'long' : 'short';
          const ticker = org.name;

          await asUser({ userId: agentUserId }, async () => {
            const service = new PerpMarketService({
              db: new PerpDbAdapter(),
              wallet: {
                debit: (params: {
                  userId: string;
                  amount: number;
                  reason: string;
                  description?: string;
                  relatedId?: string;
                }) => {
                  return WalletService.debit(
                    params.userId,
                    params.amount,
                    params.reason,
                    params.description ?? '',
                    params.relatedId ?? ''
                  );
                },
                credit: (params: {
                  userId: string;
                  amount: number;
                  reason: string;
                  description?: string;
                  relatedId?: string;
                }) => {
                  return WalletService.credit(
                    params.userId,
                    params.amount,
                    params.reason,
                    params.description ?? '',
                    params.relatedId ?? ''
                  );
                },
                getBalance: (userId: string) =>
                  WalletService.getBalance(userId),
                recordPnL: async (params: {
                  userId: string;
                  pnl: number;
                  reason: string;
                  relatedId?: string;
                }) => {
                  // Record PnL using credit/debit based on sign
                  if (params.pnl > 0) {
                    await WalletService.credit(
                      params.userId,
                      params.pnl,
                      'perp_pnl',
                      params.reason
                    );
                  } else if (params.pnl < 0) {
                    await WalletService.debit(
                      params.userId,
                      Math.abs(params.pnl),
                      'perp_pnl',
                      params.reason
                    );
                  }
                },
              },
              fees: {
                tradingFeeRate: 0.001,
                platformShare: 0.5,
                referrerShare: 0.5,
                minFeeAmount: 0.01,
              },
            });

            await service.openPosition({
              userId: agentUserId,
              ticker: ticker ?? '',
              side,
              size: trade.amount,
              leverage: 1,
            });
          });

          await agentPnLService.recordTrade({
            agentId: agentUserId,
            userId: managedBy ?? agentUserId,
            marketType: 'perp',
            ticker: org.name ?? '',
            action: 'open',
            side,
            amount: trade.amount,
            price: Number(org.currentPrice ?? 0),
            reasoning: trade.reasoning ?? undefined,
          });

          tradesExecuted++;
          lastTicker = org.name;
          lastSide = side;
          lastMarketType = 'perp';
          logger.info(
            `Agent ${displayName} opened ${side} position on ${org.name}`,
            undefined,
            'AutonomousTrading'
          );
        }
      }
    }

    return {
      tradesExecuted,
      marketId: lastMarketId,
      ticker: lastTicker,
      side: lastSide,
      marketType: lastMarketType,
    };
  }
}

/**
 * Parse trade decision from LLM response
 */
function parseTradeDecision(response: string): {
  action: 'hold' | 'trade';
  trade: {
    type: 'prediction' | 'perp';
    market: string;
    action: 'buy_yes' | 'buy_no' | 'open_long' | 'open_short';
    amount: number;
    reasoning?: string;
  };
} {
  // Find JSON in response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.warn(
      'No JSON found in trade decision response',
      undefined,
      'AutonomousTrading'
    );
    return {
      action: 'hold',
      trade: { type: 'prediction', market: '', action: 'buy_yes', amount: 0 },
    };
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    action?: string;
    trade?: {
      type?: string;
      market?: string;
      action?: string;
      amount?: number;
      reasoning?: string;
    };
  };

  if (parsed.action === 'hold' || !parsed.trade) {
    return {
      action: 'hold',
      trade: { type: 'prediction', market: '', action: 'buy_yes', amount: 0 },
    };
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
  };
}

export const autonomousTradingService = new AutonomousTradingService();
