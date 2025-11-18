import db from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { getReadyPerpsEngine } from '@/lib/perps-service';
import { prisma } from '@/lib/prisma';
import { broadcastToChannel } from '@/lib/sse/event-broadcaster';
import type { JsonValue } from '@/types/common';
import { encodePacked, keccak256 } from 'viem';

export type PriceUpdateSource = 'user_trade' | 'npc_trade' | 'event' | 'system';

export type PriceUpdateInput = {
  organizationId: string;
  newPrice: number;
  source: PriceUpdateSource;
  reason?: string;
  metadata?: Record<string, JsonValue>;
};

export type AppliedPriceUpdate = {
  organizationId: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  changePercent: number;
  source: PriceUpdateSource;
  reason?: string;
  metadata?: Record<string, JsonValue>;
  timestamp: string;
};

/**
 * Derive perpetual market ID from organization ID
 * Market IDs are keccak256(symbol + timestamp + blockNumber) in contract,
 * but for price storage we use a deterministic hash based on symbol
 */
function _deriveMarketId(organizationId: string): `0x${string}` {
  // Convert organization ID to ticker symbol (e.g., "ORG-123" -> "ORG123PERP")
  const ticker = `${organizationId.toUpperCase().replace(/-/g, '')}PERP`;
  // Use deterministic hash (without timestamp/block for consistency)
  // In production, you may want to store actual market IDs when markets are created
  return keccak256(encodePacked(['string'], [ticker]));
}

/**
 * Convert price to Chainlink format (8 decimals)
 */
function _toChainlinkFormat(price: number): bigint {
  return BigInt(Math.round(price * 1e8));
}

export class PriceUpdateService {
  /**
   * Apply a batch of price updates, ensuring persistence + engine sync + SSE broadcast + on-chain storage
   */
  static async applyUpdates(updates: PriceUpdateInput[]): Promise<AppliedPriceUpdate[]> {
    if (updates.length === 0) return [];

    const perpsEngine = await getReadyPerpsEngine();

    const appliedUpdates: AppliedPriceUpdate[] = [];
    const priceMap = new Map<string, number>();

    for (const update of updates) {
      if (!Number.isFinite(update.newPrice) || update.newPrice <= 0) {
        logger.warn('Skipping invalid price update', { update }, 'PriceUpdateService');
        continue;
      }

      const organization = await prisma.organization.findUnique({
        where: { id: update.organizationId },
        select: { id: true, currentPrice: true },
      });

      if (!organization) {
        logger.warn(
          'Organization not found for price update',
          { organizationId: update.organizationId },
          'PriceUpdateService'
        );
        continue;
      }

      const oldPrice = Number(organization.currentPrice ?? update.newPrice);
      const change = update.newPrice - oldPrice;
      const changePercent = oldPrice === 0 ? 0 : (change / oldPrice) * 100;

      await prisma.organization.update({
        where: { id: organization.id },
        data: { currentPrice: update.newPrice },
      });

      await db().recordPriceUpdate(organization.id, update.newPrice, change, changePercent);

      priceMap.set(organization.id, update.newPrice);
      appliedUpdates.push({
        organizationId: organization.id,
        oldPrice,
        newPrice: update.newPrice,
        change,
        changePercent,
        source: update.source,
        reason: update.reason,
        metadata: update.metadata,
        timestamp: new Date().toISOString(),
      });
    }

    if (priceMap.size > 0) {
      perpsEngine.updatePositions(priceMap);

      // Write prices to blockchain
      await PriceUpdateService.writePricesToChain(appliedUpdates);

      broadcastToChannel('markets', {
        type: 'price_update',
        updates: appliedUpdates as unknown as JsonValue,
      });

      logger.info(
        `Applied ${appliedUpdates.length} organization price updates`,
        { count: appliedUpdates.length },
        'PriceUpdateService'
      );
    }

    return appliedUpdates;
  }
}
