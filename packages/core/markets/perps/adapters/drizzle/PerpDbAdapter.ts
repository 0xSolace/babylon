import {
  type CorePerpClosePositionFieldPatch,
  type CorePerpMarketSnapshotFullUpdate,
  type CorePerpOpenPositionFieldPatch,
  corePerpClosePositionFields,
  corePerpSelectAllMarketSnapshots,
  corePerpSelectMarketSnapshotByTicker,
  corePerpSelectOpenPositionByUserAndTicker,
  corePerpSelectOpenPositions,
  corePerpSelectOpenPositionsByUserId,
  corePerpSelectPositionById,
  corePerpUpdateMarketSnapshotFull,
  corePerpUpdateOpenPositionFields,
  corePerpUpsertPositionReturning,
  type PerpPosition as DbPerpPosition,
  type NewPerpPosition,
  type Transaction,
} from '@babylon/db';
import { db as defaultDb } from '@babylon/db/engine-storage';
import { generateSnowflakeId } from '@babylon/shared';
import type {
  PerpDbPort,
  PerpMarketRecord,
  PerpPositionRecord,
  PerpSide,
} from '../../types';

type DbExecutor = typeof defaultDb | Transaction;

/**
 * Drizzle adapter for PerpDbPort.
 *
 * Notes:
 * - Uses PerpMarketSnapshot as single source for market-level stats.
 * - Generates IDs via snowflake when none provided.
 * - Supports transactions via constructor injection or transaction() method.
 */
export class PerpDbAdapter implements PerpDbPort {
  private readonly dbClient: DbExecutor;

  constructor(dbClient?: DbExecutor) {
    this.dbClient = dbClient ?? defaultDb;
  }

  async listMarkets(): Promise<PerpMarketRecord[]> {
    const snapshots = await corePerpSelectAllMarketSnapshots(this.dbClient);
    if (snapshots.length === 0) return [];

    return snapshots.map((s) => ({
      ticker: s.ticker,
      organizationId: s.organizationId,
      name: s.name ?? undefined,
      currentPrice: Number(s.currentPrice),
      price24hAgo: s.price24hAgo ? Number(s.price24hAgo) : undefined,
      change24h: Number(s.change24h ?? 0),
      changePercent24h: Number(s.changePercent24h ?? 0),
      high24h: Number(s.high24h),
      low24h: Number(s.low24h),
      volume24h: Number(s.volume24h ?? 0),
      openInterest: Number(s.openInterest ?? 0),
      fundingRate: (s.fundingRate ?? {
        ticker: s.ticker,
        rate: 0,
        nextFundingTime: new Date().toISOString(),
        predictedRate: 0,
      }) as PerpMarketRecord['fundingRate'],
      maxLeverage: Number(s.maxLeverage ?? 100),
      minOrderSize: Number(s.minOrderSize ?? 10),
      markPrice: s.markPrice ? Number(s.markPrice) : undefined,
      indexPrice: s.indexPrice ? Number(s.indexPrice) : undefined,
    }));
  }

  async listOpenPositions(): Promise<PerpPositionRecord[]> {
    const positions = await corePerpSelectOpenPositions(this.dbClient);
    return positions.map(mapPosition);
  }

  async getPositionById(id: string): Promise<PerpPositionRecord | null> {
    const pos = await corePerpSelectPositionById(this.dbClient, id);
    return pos ? mapPosition(pos) : null;
  }

  async getOpenPositionsByUser(userId: string): Promise<PerpPositionRecord[]> {
    const positions = await corePerpSelectOpenPositionsByUserId(
      this.dbClient,
      userId
    );
    return positions.map(mapPosition);
  }

  async getOpenPositionByUserAndTicker(
    userId: string,
    ticker: string
  ): Promise<PerpPositionRecord | null> {
    const pos = await corePerpSelectOpenPositionByUserAndTicker(
      this.dbClient,
      userId,
      ticker
    );
    return pos ? mapPosition(pos) : null;
  }

  async upsertPosition(
    position: Omit<PerpPositionRecord, 'id'> & { id?: string }
  ): Promise<PerpPositionRecord> {
    const now = new Date();
    const id = position.id ?? (await generateSnowflakeId());
    const insert: NewPerpPosition = {
      id,
      userId: position.userId,
      ticker: position.ticker,
      organizationId: position.organizationId,
      side: position.side,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      size: position.size,
      leverage: position.leverage,
      liquidationPrice: position.liquidationPrice,
      unrealizedPnL: position.unrealizedPnL,
      unrealizedPnLPercent: position.unrealizedPnLPercent,
      fundingPaid: position.fundingPaid,
      openedAt: position.openedAt ?? now,
      lastUpdated: position.lastUpdated ?? now,
      closedAt: position.closedAt ?? null,
      realizedPnL: position.realizedPnL ?? null,
    };

    const row = await corePerpUpsertPositionReturning(this.dbClient, insert);
    return mapPosition(row);
  }

  async updateOpenPosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
        | 'fundingPaid'
        | 'liquidationPrice'
        | 'lastUpdated'
        | 'size'
        | 'entryPrice'
      >
    >
  ): Promise<void> {
    const patch: CorePerpOpenPositionFieldPatch = {
      ...updates,
      lastUpdated: updates.lastUpdated ?? new Date(),
    };
    await corePerpUpdateOpenPositionFields(this.dbClient, positionId, patch);
  }

  async closePosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'closedAt'
        | 'realizedPnL'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
      >
    >
  ): Promise<void> {
    const patch: CorePerpClosePositionFieldPatch = { ...updates };
    await corePerpClosePositionFields(this.dbClient, positionId, patch);
  }

  async updateMarketStats(
    ticker: string,
    updates: Partial<
      Pick<
        PerpMarketRecord,
        | 'currentPrice'
        | 'price24hAgo'
        | 'change24h'
        | 'changePercent24h'
        | 'high24h'
        | 'low24h'
        | 'volume24h'
        | 'openInterest'
        | 'fundingRate'
        | 'markPrice'
        | 'indexPrice'
        | 'maxLeverage'
        | 'minOrderSize'
      >
    >
  ): Promise<void> {
    const now = new Date();
    const existing = await corePerpSelectMarketSnapshotByTicker(
      this.dbClient,
      ticker
    );

    if (!existing) {
      throw new Error(
        `Cannot update market snapshot for ${ticker}: snapshot not found. ` +
          'Run perp market seeding to create snapshots from static organization data.'
      );
    }

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    let price24hAgo = updates.price24hAgo ?? existing.price24hAgo;
    let price24hAgoUpdatedAt = existing.price24hAgoUpdatedAt;

    if (
      !price24hAgoUpdatedAt ||
      now.getTime() - price24hAgoUpdatedAt.getTime() >= TWENTY_FOUR_HOURS
    ) {
      price24hAgo = existing.currentPrice;
      price24hAgoUpdatedAt = now;
    }

    let high24h = updates.high24h ?? existing.high24h;
    let low24h = updates.low24h ?? existing.low24h;
    let volume24h = updates.volume24h ?? existing.volume24h;
    let metrics24hResetAt = existing.metrics24hResetAt;

    if (
      !metrics24hResetAt ||
      now.getTime() - metrics24hResetAt.getTime() >= TWENTY_FOUR_HOURS
    ) {
      const currentPrice = updates.currentPrice ?? existing.currentPrice;
      high24h = updates.high24h ?? currentPrice;
      low24h = updates.low24h ?? currentPrice;
      volume24h = updates.volume24h ?? 0;
      metrics24hResetAt = now;
    }

    const full: CorePerpMarketSnapshotFullUpdate = {
      currentPrice: updates.currentPrice ?? existing.currentPrice,
      price24hAgo,
      price24hAgoUpdatedAt,
      metrics24hResetAt,
      change24h: updates.change24h ?? existing.change24h,
      changePercent24h: updates.changePercent24h ?? existing.changePercent24h,
      high24h,
      low24h,
      volume24h,
      openInterest: updates.openInterest ?? existing.openInterest,
      fundingRate: updates.fundingRate ?? existing.fundingRate,
      maxLeverage: updates.maxLeverage ?? existing.maxLeverage,
      minOrderSize: updates.minOrderSize ?? existing.minOrderSize,
      markPrice: updates.markPrice ?? existing.markPrice,
      indexPrice: updates.indexPrice ?? existing.indexPrice,
      updatedAt: now,
    };

    await corePerpUpdateMarketSnapshotFull(this.dbClient, ticker, full);
  }

  /**
   * Execute operations within a transaction for atomicity.
   * Creates a new PerpDbAdapter bound to the transaction context.
   */
  async transaction<T>(fn: (tx: PerpDbPort) => Promise<T>): Promise<T> {
    if (this.dbClient !== defaultDb) {
      return fn(this);
    }

    return defaultDb.transaction(async (txClient) => {
      const txAdapter = new PerpDbAdapter(txClient);
      return fn(txAdapter);
    });
  }
}

function mapPosition(pos: DbPerpPosition): PerpPositionRecord {
  return {
    id: pos.id,
    userId: pos.userId,
    ticker: pos.ticker,
    organizationId: pos.organizationId,
    side: pos.side as PerpSide,
    entryPrice: Number(pos.entryPrice),
    currentPrice: Number(pos.currentPrice),
    size: Number(pos.size),
    leverage: Number(pos.leverage),
    liquidationPrice: Number(pos.liquidationPrice),
    unrealizedPnL: Number(pos.unrealizedPnL),
    unrealizedPnLPercent: Number(pos.unrealizedPnLPercent),
    fundingPaid: Number(pos.fundingPaid),
    openedAt: new Date(pos.openedAt),
    lastUpdated: new Date(pos.lastUpdated),
    closedAt: pos.closedAt ? new Date(pos.closedAt) : undefined,
    realizedPnL: pos.realizedPnL !== null ? Number(pos.realizedPnL) : undefined,
  };
}
