import { type CQLClient, db as defaultDb, type PerpPosition } from '@babylon/db'
import {
  generateSnowflakeId,
  type PerpDbPort,
  type PerpMarketRecord,
  type PerpPositionRecord,
  type PerpSide,
} from '@babylon/shared'

type NewPerpPosition = Partial<PerpPosition> &
  Pick<
    PerpPosition,
    | 'id'
    | 'userId'
    | 'ticker'
    | 'organizationId'
    | 'side'
    | 'entryPrice'
    | 'currentPrice'
    | 'size'
    | 'leverage'
  >

/** Partial update data for PerpPosition */
type PerpPositionUpdateData = Partial<
  Pick<
    PerpPosition,
    | 'currentPrice'
    | 'unrealizedPnL'
    | 'unrealizedPnLPercent'
    | 'fundingPaid'
    | 'liquidationPrice'
    | 'lastUpdated'
    | 'size'
  >
>

interface PerpMarketSnapshot {
  ticker: string
  organizationId: string
  name: string | null
  currentPrice: number
  price24hAgo: number | null
  price24hAgoUpdatedAt: Date | string | null
  metrics24hResetAt: Date | string | null
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  fundingRate:
    | { rate: number; nextFundingTime: string; predictedRate: number }
    | string
    | null
  maxLeverage: number
  minOrderSize: number
  markPrice: number | null
  indexPrice: number | null
}

/**
 * CQL adapter for PerpDbPort.
 *
 * Notes:
 * - Uses PerpMarketSnapshot as single source for market-level stats.
 * - Generates IDs via snowflake when none provided.
 * - Uses raw SQL for PerpMarketSnapshot (has ticker as PK, not id).
 */
export class PerpDbAdapter implements PerpDbPort {
  private readonly dbClient: CQLClient

  constructor(dbClient?: CQLClient, _isTransaction = false) {
    void _isTransaction // Stored for potential future transaction-aware operations
    this.dbClient = dbClient ?? defaultDb
  }

  async listMarkets(): Promise<PerpMarketRecord[]> {
    const snapshots = await this.dbClient.query<PerpMarketSnapshot>(
      'SELECT * FROM "PerpMarketSnapshot"',
    )
    return snapshots.map(mapMarketSnapshot)
  }

  async listOpenPositions(): Promise<PerpPositionRecord[]> {
    const positions = await this.dbClient.perpPosition.findMany({
      where: { closedAt: null },
    })
    return positions.map(mapPosition)
  }

  async getPositionById(id: string): Promise<PerpPositionRecord | null> {
    const pos = await this.dbClient.perpPosition.findUnique({
      where: { id },
    })
    return pos ? mapPosition(pos) : null
  }

  async getOpenPositionsByUser(userId: string): Promise<PerpPositionRecord[]> {
    const positions = await this.dbClient.perpPosition.findMany({
      where: { userId, closedAt: null },
    })
    return positions.map(mapPosition)
  }

  async getOpenPositionByUserAndTicker(
    userId: string,
    ticker: string,
  ): Promise<PerpPositionRecord | null> {
    const positions = await this.dbClient.perpPosition.findMany({
      where: { userId, ticker, closedAt: null },
      take: 1,
    })
    return positions[0] ? mapPosition(positions[0]) : null
  }

  async upsertPosition(
    position: Omit<PerpPositionRecord, 'id'> & { id?: string },
  ): Promise<PerpPositionRecord> {
    const now = new Date()
    const id = position.id ?? (await generateSnowflakeId())

    const data: NewPerpPosition = {
      id,
      userId: position.userId,
      ticker: position.ticker,
      organizationId: position.organizationId,
      side: position.side,
      entryPrice: String(position.entryPrice),
      currentPrice: String(position.currentPrice),
      size: String(position.size),
      leverage: position.leverage,
      liquidationPrice: String(position.liquidationPrice),
      unrealizedPnL: String(position.unrealizedPnL),
      unrealizedPnLPercent: position.unrealizedPnLPercent,
      fundingPaid: String(position.fundingPaid),
      openedAt: position.openedAt ?? now,
      lastUpdated: position.lastUpdated ?? now,
      closedAt: position.closedAt ?? null,
      realizedPnL:
        position.realizedPnL != null ? String(position.realizedPnL) : undefined,
    }

    const result = await this.dbClient.perpPosition.upsert({
      where: { id },
      create: data,
      update: { ...data, openedAt: data.openedAt },
    })

    return mapPosition(result)
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
      >
    >,
  ): Promise<void> {
    const updateData: PerpPositionUpdateData = {
      lastUpdated: updates.lastUpdated ?? new Date(),
    }
    if (updates.currentPrice !== undefined) {
      updateData.currentPrice = String(updates.currentPrice)
    }
    if (updates.unrealizedPnL !== undefined) {
      updateData.unrealizedPnL = String(updates.unrealizedPnL)
    }
    if (updates.unrealizedPnLPercent !== undefined) {
      updateData.unrealizedPnLPercent = updates.unrealizedPnLPercent
    }
    if (updates.fundingPaid !== undefined) {
      updateData.fundingPaid = String(updates.fundingPaid)
    }
    if (updates.liquidationPrice !== undefined) {
      updateData.liquidationPrice = String(updates.liquidationPrice)
    }
    if (updates.size !== undefined) {
      updateData.size = String(updates.size)
    }

    await this.dbClient.perpPosition.update({
      where: { id: positionId },
      data: updateData,
    })
  }

  async closePosition(
    positionId: string,
    closeData: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'closedAt'
        | 'realizedPnL'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
      >
    >,
  ): Promise<void> {
    await this.dbClient.perpPosition.update({
      where: { id: positionId },
      data: {
        closedAt: closeData.closedAt ?? new Date(),
        realizedPnL:
          closeData.realizedPnL != null
            ? String(closeData.realizedPnL)
            : undefined,
        currentPrice:
          closeData.currentPrice != null
            ? String(closeData.currentPrice)
            : undefined,
        unrealizedPnL:
          closeData.unrealizedPnL != null
            ? String(closeData.unrealizedPnL)
            : undefined,
        unrealizedPnLPercent: closeData.unrealizedPnLPercent,
      },
    })
  }

  async getMarketByTicker(ticker: string): Promise<PerpMarketRecord | null> {
    const snapshots = await this.dbClient.query<PerpMarketSnapshot>(
      'SELECT * FROM "PerpMarketSnapshot" WHERE ticker = $1 LIMIT 1',
      [ticker],
    )
    return snapshots[0] ? mapMarketSnapshot(snapshots[0]) : null
  }

  async upsertMarketSnapshot(
    market: PerpMarketRecord,
  ): Promise<PerpMarketRecord> {
    const now = new Date().toISOString()
    const fundingRateJson = JSON.stringify(market.fundingRate)

    await this.dbClient.exec(
      `INSERT INTO "PerpMarketSnapshot" (
        ticker, "organizationId", name, "currentPrice", "price24hAgo",
        "change24h", "changePercent24h", "high24h", "low24h", "volume24h",
        "openInterest", "fundingRate", "maxLeverage", "minOrderSize",
        "markPrice", "indexPrice", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (ticker) DO UPDATE SET
        "organizationId" = $2, name = $3, "currentPrice" = $4, "price24hAgo" = $5,
        "change24h" = $6, "changePercent24h" = $7, "high24h" = $8, "low24h" = $9,
        "volume24h" = $10, "openInterest" = $11, "fundingRate" = $12,
        "maxLeverage" = $13, "minOrderSize" = $14, "markPrice" = $15,
        "indexPrice" = $16, "updatedAt" = $17`,
      [
        market.ticker,
        market.organizationId,
        market.name ?? null,
        market.currentPrice,
        market.price24hAgo ?? null,
        market.change24h,
        market.changePercent24h,
        market.high24h,
        market.low24h,
        market.volume24h,
        market.openInterest,
        fundingRateJson,
        market.maxLeverage,
        market.minOrderSize,
        market.markPrice ?? null,
        market.indexPrice ?? null,
        now,
      ],
    )

    return market
  }

  /**
   * Update market stats (partial update)
   */
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
    >,
  ): Promise<void> {
    const now = new Date()

    // Get current snapshot
    const snapshots = await this.dbClient.query<PerpMarketSnapshot>(
      'SELECT * FROM "PerpMarketSnapshot" WHERE ticker = $1 LIMIT 1',
      [ticker],
    )
    const current = snapshots[0]

    if (!current) {
      throw new Error(
        `Cannot update market snapshot for ${ticker}: snapshot not found. ` +
          'Run perp market seeding to create snapshots from static organization data.',
      )
    }

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

    const currentPrice24hAgoUpdatedAt = current.price24hAgoUpdatedAt
      ? new Date(current.price24hAgoUpdatedAt)
      : null

    // Rotate price24hAgo if more than 24 hours have passed since last rotation
    let price24hAgo = updates.price24hAgo ?? current.price24hAgo
    let price24hAgoUpdatedAt = currentPrice24hAgoUpdatedAt

    if (
      !price24hAgoUpdatedAt ||
      now.getTime() - price24hAgoUpdatedAt.getTime() >= TWENTY_FOUR_HOURS
    ) {
      // Time to rotate: current price becomes price24hAgo
      price24hAgo = current.currentPrice
      price24hAgoUpdatedAt = now
    }

    const currentMetrics24hResetAt = current.metrics24hResetAt
      ? new Date(current.metrics24hResetAt)
      : null

    // Reset 24h metrics (high/low/volume) if more than 24 hours have passed
    let high24h = updates.high24h ?? current.high24h
    let low24h = updates.low24h ?? current.low24h
    let volume24h = updates.volume24h ?? current.volume24h
    let metrics24hResetAt = currentMetrics24hResetAt

    if (
      !metrics24hResetAt ||
      now.getTime() - metrics24hResetAt.getTime() >= TWENTY_FOUR_HOURS
    ) {
      // Reset: use current price as starting point for high/low, zero volume
      const currentPrice = updates.currentPrice ?? current.currentPrice
      high24h = updates.high24h ?? currentPrice
      low24h = updates.low24h ?? currentPrice
      volume24h = updates.volume24h ?? 0
      metrics24hResetAt = now
    }

    const fundingRate = updates.fundingRate ?? current.fundingRate

    await this.dbClient.exec(
      `UPDATE "PerpMarketSnapshot" SET
        "currentPrice" = $1, "price24hAgo" = $2, "price24hAgoUpdatedAt" = $3,
        "metrics24hResetAt" = $4, "change24h" = $5, "changePercent24h" = $6,
        "high24h" = $7, "low24h" = $8, "volume24h" = $9, "openInterest" = $10,
        "fundingRate" = $11, "maxLeverage" = $12, "minOrderSize" = $13,
        "markPrice" = $14, "indexPrice" = $15, "updatedAt" = $16
      WHERE ticker = $17`,
      [
        updates.currentPrice ?? current.currentPrice,
        price24hAgo,
        price24hAgoUpdatedAt?.toISOString() ??
          (current.price24hAgoUpdatedAt instanceof Date
            ? current.price24hAgoUpdatedAt.toISOString()
            : current.price24hAgoUpdatedAt),
        metrics24hResetAt?.toISOString() ??
          (current.metrics24hResetAt instanceof Date
            ? current.metrics24hResetAt.toISOString()
            : current.metrics24hResetAt),
        updates.change24h ?? current.change24h,
        updates.changePercent24h ?? current.changePercent24h,
        high24h,
        low24h,
        volume24h,
        updates.openInterest ?? current.openInterest,
        JSON.stringify(fundingRate),
        updates.maxLeverage ?? current.maxLeverage,
        updates.minOrderSize ?? current.minOrderSize,
        updates.markPrice ?? current.markPrice,
        updates.indexPrice ?? current.indexPrice,
        now.toISOString(),
        ticker,
      ],
    )
  }

  /**
   * Execute operations within a transaction.
   *
   * NOTE: CQL handles transactions through the client.
   */
  async transaction<T>(fn: (tx: PerpDbPort) => Promise<T>): Promise<T> {
    return this.dbClient.transaction(async (tx: CQLClient) => {
      const txAdapter = new PerpDbAdapter(tx, true)
      return fn(txAdapter)
    })
  }
}

// Helper to map DB record to market record
function mapMarketSnapshot(s: PerpMarketSnapshot): PerpMarketRecord {
  return {
    ticker: s.ticker,
    organizationId: s.organizationId,
    name: s.name,
    currentPrice: Number(s.currentPrice),
    price24hAgo: s.price24hAgo ? Number(s.price24hAgo) : undefined,
    change24h: Number(s.change24h ?? 0),
    changePercent24h: Number(s.changePercent24h ?? 0),
    high24h: Number(s.high24h),
    low24h: Number(s.low24h),
    volume24h: Number(s.volume24h ?? 0),
    openInterest: Number(s.openInterest ?? 0),
    fundingRate: (s.fundingRate ?? {
      rate: 0,
      nextFundingTime: new Date().toISOString(),
      predictedRate: 0,
    }) as PerpMarketRecord['fundingRate'],
    maxLeverage: Number(s.maxLeverage ?? 100),
    minOrderSize: Number(s.minOrderSize ?? 10),
    markPrice: s.markPrice ? Number(s.markPrice) : undefined,
    indexPrice: s.indexPrice ? Number(s.indexPrice) : undefined,
  }
}

/** Map DB record to domain record */
function mapPosition(pos: PerpPosition): PerpPositionRecord {
  return {
    id: pos.id,
    userId: pos.userId,
    ticker: pos.ticker ?? '',
    organizationId: pos.organizationId ?? '',
    side: pos.side as PerpSide,
    entryPrice: Number(pos.entryPrice),
    currentPrice: pos.currentPrice != null ? Number(pos.currentPrice) : 0,
    size: Number(pos.size),
    leverage: pos.leverage,
    liquidationPrice:
      pos.liquidationPrice != null ? Number(pos.liquidationPrice) : 0,
    unrealizedPnL: Number(pos.unrealizedPnL),
    unrealizedPnLPercent: pos.unrealizedPnLPercent ?? 0,
    fundingPaid: Number(pos.fundingPaid),
    openedAt: pos.openedAt,
    lastUpdated: pos.lastUpdated,
    closedAt: pos.closedAt,
    realizedPnL: pos.realizedPnL ? Number(pos.realizedPnL) : null,
  }
}
