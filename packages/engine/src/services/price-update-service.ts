import { db, eq, getDbInstance, organizations } from '@babylon/db'
import type { JsonValue } from '@babylon/shared'
import { logger } from '@babylon/shared'
import { FEE_CONFIG } from '../config/fees'
import { engineEvents } from '../events'
import { PerpDbAdapter, PerpMarketService } from './markets'
import { WalletService } from './wallet-service'

export type PriceUpdateSource = 'user_trade' | 'npc_trade' | 'event' | 'system'

export interface PriceUpdateInput {
  organizationId: string
  newPrice: number
  source: PriceUpdateSource
  reason?: string
  metadata?: Record<string, JsonValue>
}

export interface AppliedPriceUpdate {
  organizationId: string
  oldPrice: number
  newPrice: number
  change: number
  changePercent: number
  source: PriceUpdateSource
  reason?: string
  metadata?: Record<string, JsonValue>
  timestamp: string
}

/**
 * Apply a batch of price updates with persistence, engine sync, and SSE broadcast
 */
export async function applyPriceUpdates(
  updates: PriceUpdateInput[],
): Promise<AppliedPriceUpdate[]> {
  if (updates.length === 0) return []

  const perpService = new PerpMarketService({
    db: new PerpDbAdapter(),
    wallet: {
      debit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.debit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId,
        ),
      credit: ({ userId, amount, reason, description, relatedId }) =>
        WalletService.credit(
          userId,
          amount,
          reason,
          description ?? '',
          relatedId,
        ),
      recordPnL: async ({ userId, pnl, reason, relatedId }) => {
        await WalletService.recordPnL(userId, pnl, reason, relatedId)
      },
      getBalance: (userId: string) => WalletService.getBalance(userId),
    },
    fees: {
      tradingFeeRate: FEE_CONFIG.TRADING_FEE_RATE,
      platformShare: FEE_CONFIG.PLATFORM_SHARE,
      referrerShare: FEE_CONFIG.REFERRER_SHARE,
      minFeeAmount: FEE_CONFIG.MIN_FEE_AMOUNT,
    },
  })
  const appliedUpdates: AppliedPriceUpdate[] = []
  const priceMap = new Map<string, number>()

  for (const update of updates) {
    if (!Number.isFinite(update.newPrice) || update.newPrice <= 0) {
      logger.warn(
        'Skipping invalid price update',
        { update },
        'PriceUpdateService',
      )
      continue
    }

    const [organization] = await db
      .select({
        id: organizations.id,
        currentPrice: organizations.currentPrice,
      })
      .from(organizations)
      .where(eq(organizations.id, update.organizationId))
      .limit(1)

    if (!organization) {
      logger.warn(
        'Organization not found for price update',
        { organizationId: update.organizationId },
        'PriceUpdateService',
      )
      continue
    }

    const orgId = String(organization.id)
    const oldPrice = Number(organization.currentPrice ?? update.newPrice)
    const change = update.newPrice - oldPrice
    const changePercent = oldPrice === 0 ? 0 : (change / oldPrice) * 100

    await db
      .update(organizations)
      .set({ currentPrice: update.newPrice, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))

    await getDbInstance().recordPriceUpdate(
      orgId,
      update.newPrice,
      change,
      changePercent,
    )

    priceMap.set(orgId, update.newPrice)

    appliedUpdates.push({
      organizationId: orgId,
      oldPrice,
      newPrice: update.newPrice,
      change,
      changePercent,
      source: update.source,
      reason: update.reason,
      metadata: update.metadata,
      timestamp: new Date().toISOString(),
    })
  }

  if (priceMap.size > 0) {
    await perpService.applyPriceUpdates(priceMap)

    // Emit price update event - listeners (e.g., SSE) can broadcast
    engineEvents.emit('priceUpdate', {
      channel: 'markets',
      updates: JSON.parse(JSON.stringify(appliedUpdates)) as JsonValue,
    })

    logger.info(
      `Applied ${appliedUpdates.length} organization price updates`,
      { count: appliedUpdates.length },
      'PriceUpdateService',
    )
  }

  return appliedUpdates
}
