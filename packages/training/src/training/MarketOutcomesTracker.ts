/**
 * Market Outcomes Tracker
 *
 * Tracks market outcomes for reward backpropagation.
 * Syncs prediction and perpetual market results for a given time window.
 */

import { db } from '@babylon/db'
import { logger } from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'
import { getPreviousWindowId, getWindowRange } from './window-utils'

export interface WindowOutcomes {
  windowId: string
  stocks: Array<{
    ticker: string
    openPrice: number
    closePrice: number
    changePercent: number
    priceAtEnd?: number
    tags?: string[]
  }>
  predictions: Array<{
    marketId: string
    question: string
    outcome: string
    resolvedAtPrice: number
  }>
}

export class MarketOutcomesTracker {
  /**
   * Sync market outcomes for a specific window
   */
  async syncWindowOutcomes(windowId: string): Promise<void> {
    logger.info('Syncing market outcomes for window', { windowId })

    const range = getWindowRange(windowId)

    // Get resolved prediction markets in this window
    const resolvedMarkets = await db.market.findMany({
      where: {
        AND: [
          { resolved: true },
          { updatedAt: { gte: range.start } },
          { updatedAt: { lt: range.end } },
        ],
      },
      select: {
        id: true,
        question: true,
        resolution: true,
      },
    })

    // Get perp market snapshots which have ticker and price info
    const perpSnapshots = await db.perpMarketSnapshot.findMany({
      select: {
        ticker: true,
        currentPrice: true,
        change24h: true,
        changePercent24h: true,
      },
    })

    // Use perp snapshots for stock outcomes (filter out incomplete snapshots)
    const stockOutcomes: WindowOutcomes['stocks'] = perpSnapshots
      .filter(
        (
          snap,
        ): snap is typeof snap & {
          ticker: string
          currentPrice: number
          change24h: number
          changePercent24h: number
        } =>
          snap.ticker !== null &&
          snap.currentPrice !== null &&
          snap.change24h !== null &&
          snap.changePercent24h !== null,
      )
      .map((snap) => ({
        ticker: snap.ticker,
        openPrice: snap.currentPrice - snap.change24h,
        closePrice: snap.currentPrice,
        changePercent: snap.changePercent24h,
      }))

    // Store prediction outcomes
    for (const market of resolvedMarkets) {
      const outcomeStr = market.resolution === 'YES' ? 'YES' : 'NO'
      const existingOutcome = await db.marketOutcome.findFirst({
        where: {
          AND: [{ windowId }, { predictionMarketId: market.id }],
        },
      })

      if (!existingOutcome) {
        await db.marketOutcome.create({
          data: {
            id: await generateSnowflakeId(),
            windowId,
            predictionMarketId: market.id,
            question: market.question,
            outcome: outcomeStr,
            createdAt: new Date(),
          },
        })
      }
    }

    // Store stock outcomes
    for (const stock of stockOutcomes) {
      const existingOutcome = await db.marketOutcome.findFirst({
        where: {
          AND: [{ windowId }, { stockTicker: stock.ticker }],
        },
      })

      if (!existingOutcome) {
        await db.marketOutcome.create({
          data: {
            id: await generateSnowflakeId(),
            windowId,
            stockTicker: stock.ticker,
            startPrice: String(stock.openPrice),
            endPrice: String(stock.closePrice),
            changePercent: Number(stock.changePercent.toFixed(2)),
            outcome: stock.changePercent >= 0 ? 'up' : 'down',
            createdAt: new Date(),
          },
        })
      }
    }

    logger.info('Synced market outcomes', {
      windowId,
      predictions: resolvedMarkets.length,
      stocks: stockOutcomes.length,
    })
  }

  /**
   * Sync recent windows
   */
  async syncRecentWindows(hours = 24): Promise<number> {
    let synced = 0

    for (let i = 1; i <= hours; i++) {
      const windowId = getPreviousWindowId(i)

      // Check if already synced
      const existing = await db.marketOutcome.count({
        where: { windowId },
      })

      if (existing === 0) {
        await this.syncWindowOutcomes(windowId)
        synced++
      }
    }

    return synced
  }

  /**
   * Get outcomes for a window
   */
  async getWindowOutcomes(windowId: string): Promise<WindowOutcomes | null> {
    const outcomes = await db.marketOutcome.findMany({
      where: { windowId },
    })

    if (outcomes.length === 0) {
      return null
    }

    const stocks: WindowOutcomes['stocks'] = []
    const predictions: WindowOutcomes['predictions'] = []

    for (const outcome of outcomes) {
      if (outcome.stockTicker) {
        stocks.push({
          ticker: outcome.stockTicker,
          openPrice: Number(outcome.startPrice ?? 0),
          closePrice: Number(outcome.endPrice ?? 0),
          changePercent: Number(outcome.changePercent ?? 0),
        })
      } else if (outcome.predictionMarketId) {
        predictions.push({
          marketId: outcome.predictionMarketId,
          question: outcome.question ?? '',
          outcome: outcome.outcome ?? 'unknown',
          resolvedAtPrice: Number(outcome.finalProbability ?? 0),
        })
      }
    }

    return { windowId, stocks, predictions }
  }
}
