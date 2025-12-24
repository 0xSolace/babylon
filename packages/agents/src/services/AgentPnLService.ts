/**
 * Agent P&L Service
 *
 * Handles P&L tracking and trade recording for agents.
 *
 * @packageDocumentation
 */

import { db, type JsonValue } from '@babylon/db'
import { generateSnowflakeId } from '@babylon/shared'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../shared/logger'

/**
 * Service for agent profit and loss tracking
 */
export class AgentPnLService {
  /**
   * Records a trade for an agent and updates P&L
   *
   * @param params - Trade parameters
   * @param params.agentId - Agent ID
   * @param params.userId - User ID (manager)
   * @param params.marketType - Market type (prediction or perp)
   * @param params.marketId - Market ID for prediction markets
   * @param params.ticker - Ticker for perpetual markets
   * @param params.action - Trade action (open or close)
   * @param params.side - Trade side (long/short/yes/no)
   * @param params.amount - Trade amount
   * @param params.price - Trade price
   * @param params.pnl - Realized P&L (for close actions)
   * @param params.reasoning - Trade reasoning
   */
  async recordTrade(params: {
    agentId: string
    userId: string
    marketType: 'prediction' | 'perp'
    marketId?: string
    ticker?: string
    action: 'open' | 'close'
    side?: 'long' | 'short' | 'yes' | 'no'
    amount: number
    price: number
    pnl?: number
    reasoning?: string
  }): Promise<void> {
    const {
      agentId,
      marketType,
      marketId,
      ticker,
      action,
      side,
      amount,
      price,
      pnl,
      reasoning,
    } = params

    // Create trade record
    // Note: marketType, ticker, action, reasoning stored in metadata
    await db.agentTrade.create({
      data: {
        id: uuidv4(),
        agentId,
        agentUserId: agentId,
        marketId: marketId ?? `${marketType}:${ticker ?? 'unknown'}`,
        side: side ?? 'long',
        amount: String(amount),
        price: String(price),
        pnl: String(pnl ?? 0),
        status: 'executed',
        executedAt: new Date(),
        metadata: {
          marketType,
          ticker,
          action,
          reasoning,
        } as JsonValue,
      },
    })

    // Update agent P&L if provided
    if (pnl !== undefined && pnl !== null) {
      // Get current lifetimePnL
      const agent = await db.user.findFirst({
        where: { id: agentId },
      })

      const currentPnL = agent?.lifetimePnL
        ? Number.parseFloat(String(agent.lifetimePnL))
        : 0

      await db.user.update({
        where: { id: agentId },
        data: {
          lifetimePnL: String(currentPnL + pnl),
          updatedAt: new Date(),
        },
      })
    }

    // Log the trade
    await db.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId: agentId,
        type: 'trade',
        level: 'info',
        content: `Trade executed: ${action} ${side || ''} ${amount} @ ${price}`,
        metadata: {
          marketType,
          marketId,
          ticker,
          pnl,
          reasoning,
        } as JsonValue,
      },
    })

    logger.info(
      `Trade recorded for agent ${agentId}`,
      undefined,
      'AgentPnLService',
    )
  }

  /**
   * Get agent trades
   */
  async getAgentTrades(agentUserId: string, limit = 50) {
    return db.agentTrade.findMany({
      where: { agentId: agentUserId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Get total agent P&L for a user (manager) by summing their agents' lifetimePnL
   */
  async getUserAgentPnL(userId: string): Promise<number> {
    const agents = await db.user.findMany({
      where: { managedBy: userId },
    })

    return agents.reduce((sum, agent) => {
      return (
        sum +
        (agent.lifetimePnL ? Number.parseFloat(String(agent.lifetimePnL)) : 0)
      )
    }, 0)
  }
}

export const agentPnLService = new AgentPnLService()
