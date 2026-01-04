import {
  db as defaultDb,
  type Market,
  type NewMarket,
  type NewPosition,
  type NewPredictionPriceHistory,
  type Position,
  type Question,
  type SQLitClient,
} from '@babylon/db'
import type {
  PredictionDbPort,
  PredictionMarketRecord,
  PredictionPositionRecord,
  PredictionPriceSnapshotRecord,
  PredictionSide,
  QuestionRecord,
} from '@babylon/shared'
import { generateSnowflakeId } from '@jejunetwork/shared'

type MarketRow = Market
type PositionRow = Position
type QuestionRow = Question

// Extended market row type that may include joined oracle fields from questions table
type MarketRowWithOracleFields = MarketRow & {
  oracleCommitTxHash?: string | null
  oracleRevealTxHash?: string | null
}

/** SQLit query parameter type (matches @jejunetwork/db QueryParam) */
type Param = string | number | boolean | bigint | Uint8Array | null
type ParamInput =
  | string
  | number
  | boolean
  | bigint
  | Uint8Array
  | null
  | undefined
  | Date
  | object

const toSideBool = (side: PredictionSide) => side === 'yes'
const fromSideBool = (side: boolean): PredictionSide => (side ? 'yes' : 'no')

/** Convert a value to a SQLit-compatible query parameter */
function toParam(value: ParamInput): Param {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value
  }
  if (value instanceof Uint8Array) return value
  return JSON.stringify(value)
}

const mapMarket = (m: MarketRowWithOracleFields): PredictionMarketRecord => {
  // Parse date for fields that expect Date | null
  const parseDateOrNull = (
    val: string | Date | null | undefined,
  ): Date | null => {
    if (!val) return null
    if (val instanceof Date) return val
    return new Date(val)
  }

  // Parse date for fields that expect Date | undefined
  const parseDateOrUndefined = (
    val: string | Date | null | undefined,
  ): Date | undefined => {
    if (!val) return undefined
    if (val instanceof Date) return val
    return new Date(val)
  }

  return {
    id: m.id,
    question: m.question ?? '',
    description: m.description,
    yesShares: Number(m.yesShares),
    noShares: Number(m.noShares),
    liquidity: Number(m.liquidity),
    endDate: parseDateOrNull(m.endDate),
    resolved: m.resolved ?? false,
    resolution:
      m.resolution === 'yes' || m.resolution === 'true'
        ? true
        : m.resolution === 'no' || m.resolution === 'false'
          ? false
          : null,
    onChainMarketId: m.onChainMarketId,
    onChainResolved: m.onChainResolved,
    // Oracle fields may be joined from questions table
    oracleCommitTxHash: m.oracleCommitTxHash,
    oracleRevealTxHash: m.oracleRevealTxHash,
    resolutionProofUrl: m.resolutionProofUrl,
    resolutionDescription: m.resolutionDescription,
    createdAt: parseDateOrUndefined(m.createdAt),
    updatedAt: parseDateOrUndefined(m.updatedAt),
  }
}

const mapPosition = (p: PositionRow): PredictionPositionRecord => ({
  id: p.id,
  userId: p.userId,
  marketId: p.marketId,
  side: fromSideBool(
    typeof p.side === 'boolean'
      ? p.side
      : p.side === 'yes' || p.side === 'true',
  ),
  shares: Number(p.shares),
  avgPrice: Number(p.avgPrice),
  status: p.status as PredictionPositionRecord['status'],
  outcome:
    p.outcome === 'yes' || p.outcome === 'true'
      ? true
      : p.outcome === 'no' || p.outcome === 'false'
        ? false
        : null,
  pnl: p.pnl ? Number(p.pnl) : undefined,
  resolvedAt: p.resolvedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
})

const mapQuestion = (q: QuestionRow): QuestionRecord => ({
  id: q.id,
  questionNumber: q.questionNumber,
  text: q.text,
  status: (q.status as QuestionRecord['status']) ?? 'active',
  resolutionDate: q.resolutionDate,
  resolvedOutcome:
    q.resolvedOutcome === 'yes' || q.resolvedOutcome === 'true'
      ? true
      : q.resolvedOutcome === 'no' || q.resolvedOutcome === 'false'
        ? false
        : null,
  createdDate: q.createdDate,
})

/**
 * SQLit adapter for PredictionDbPort.
 *
 * Uses raw SQL queries for all operations to ensure proper condition handling.
 */
export class PredictionDbAdapter implements PredictionDbPort {
  constructor(private readonly client: SQLitClient = defaultDb) {}

  async getMarketById(id: string): Promise<PredictionMarketRecord | null> {
    const results = await this.client.query<MarketRow>(
      'SELECT * FROM "Market" WHERE id = $1 LIMIT 1',
      [id],
    )
    return results[0] ? mapMarket(results[0]) : null
  }

  async getMarketsByIds(ids: string[]): Promise<PredictionMarketRecord[]> {
    if (ids.length === 0) return []

    // Build parameterized query for array
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const results = await this.client.query<MarketRow>(
      `SELECT * FROM "Market" WHERE id IN (${placeholders})`,
      ids,
    )
    return results.map(mapMarket)
  }

  async listMarkets(): Promise<PredictionMarketRecord[]> {
    const rows = await this.client.query<MarketRow>('SELECT * FROM "Market"')
    return rows.map(mapMarket)
  }

  async listUserPositions(userId: string): Promise<PredictionPositionRecord[]> {
    // Only return active positions with sellable shares (not resolved)
    const rows = await this.client.query<PositionRow>(
      `SELECT * FROM "Position" WHERE "userId" = $1 AND status != 'resolved'`,
      [userId],
    )
    // Filter out positions with negligible shares (closed but not marked resolved)
    return rows
      .map(mapPosition)
      .filter((p: PredictionPositionRecord) => p.shares >= 0.01)
  }

  async getQuestion(idOrNumber: string): Promise<QuestionRecord | null> {
    // First try by ID
    const byIdResults = await this.client.query<QuestionRow>(
      'SELECT * FROM "Question" WHERE id = $1 LIMIT 1',
      [idOrNumber],
    )
    if (byIdResults[0]) {
      return mapQuestion(byIdResults[0])
    }

    // Then try by question number
    const num = Number.parseInt(idOrNumber, 10)
    if (Number.isNaN(num)) return null

    const byNumResults = await this.client.query<QuestionRow>(
      'SELECT * FROM "Question" WHERE "questionNumber" = $1 LIMIT 1',
      [num],
    )
    return byNumResults[0] ? mapQuestion(byNumResults[0]) : null
  }

  async createMarketFromQuestion(
    question: QuestionRecord,
    initialLiquidity: number,
    options?: { description?: string | null },
  ): Promise<PredictionMarketRecord> {
    const now = new Date()
    const liquidityHalf = initialLiquidity / 2

    // Default end date to far future if not specified
    const defaultEndDate = new Date('2099-12-31T23:59:59Z')

    const data: NewMarket = {
      id: question.id,
      question: question.text,
      description: options?.description ?? null,
      gameId: 'continuous',
      dayNumber: null,
      yesShares: String(liquidityHalf),
      noShares: String(liquidityHalf),
      liquidity: String(initialLiquidity),
      resolved: false,
      resolution: null,
      endDate: question.resolutionDate ?? defaultEndDate,
      createdAt: now,
      updatedAt: now,
      onChainMarketId: null,
      onChainResolutionTxHash: null,
      onChainResolved: false,
      oracleAddress: null,
      resolutionProofUrl: null,
      resolutionDescription: null,
    }

    // Use INSERT ... ON CONFLICT DO NOTHING ... RETURNING
    const insertResults = await this.client.query<MarketRow>(
      `INSERT INTO "Market" (
        id, question, description, "gameId", "dayNumber", "yesShares", "noShares",
        liquidity, resolved, resolution, "endDate", "createdAt", "updatedAt",
        "onChainMarketId", "onChainResolutionTxHash", "onChainResolved",
        "oracleAddress", "resolutionProofUrl", "resolutionDescription"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO NOTHING
      RETURNING *`,
      [
        data.id,
        toParam(data.question),
        toParam(data.description),
        toParam(data.gameId),
        toParam(data.dayNumber),
        toParam(data.yesShares),
        toParam(data.noShares),
        toParam(data.liquidity),
        toParam(data.resolved),
        toParam(data.resolution),
        toParam(data.endDate),
        toParam(data.createdAt),
        toParam(data.updatedAt),
        toParam(data.onChainMarketId),
        toParam(data.onChainResolutionTxHash),
        toParam(data.onChainResolved),
        toParam(data.oracleAddress),
        toParam(data.resolutionProofUrl),
        toParam(data.resolutionDescription),
      ],
    )

    if (insertResults[0]) {
      return mapMarket(insertResults[0])
    }

    // Market already existed, fetch it
    const existing = await this.getMarketById(question.id)
    if (!existing) throw new Error('Failed to create market')
    return existing
  }

  async updateMarketState(
    marketId: string,
    updates: Partial<
      Pick<
        PredictionMarketRecord,
        | 'yesShares'
        | 'noShares'
        | 'liquidity'
        | 'resolved'
        | 'resolution'
        | 'onChainMarketId'
        | 'onChainResolved'
        | 'resolutionProofUrl'
        | 'resolutionDescription'
      >
    >,
  ): Promise<PredictionMarketRecord> {
    const setClauses: string[] = []
    const params: Param[] = []
    let paramIndex = 0

    // Build dynamic SET clause
    if (updates.yesShares != null) {
      paramIndex++
      setClauses.push(`"yesShares" = $${paramIndex}`)
      params.push(String(updates.yesShares))
    }
    if (updates.noShares != null) {
      paramIndex++
      setClauses.push(`"noShares" = $${paramIndex}`)
      params.push(String(updates.noShares))
    }
    if (updates.liquidity != null) {
      paramIndex++
      setClauses.push(`liquidity = $${paramIndex}`)
      params.push(String(updates.liquidity))
    }
    if (updates.resolved !== undefined) {
      paramIndex++
      setClauses.push(`resolved = $${paramIndex}`)
      params.push(updates.resolved)
    }
    if (updates.resolution !== undefined) {
      paramIndex++
      setClauses.push(`resolution = $${paramIndex}`)
      params.push(toParam(updates.resolution))
    }
    if (updates.onChainMarketId !== undefined) {
      paramIndex++
      setClauses.push(`"onChainMarketId" = $${paramIndex}`)
      params.push(toParam(updates.onChainMarketId))
    }
    if (updates.onChainResolved !== undefined) {
      paramIndex++
      setClauses.push(`"onChainResolved" = $${paramIndex}`)
      params.push(updates.onChainResolved)
    }
    if (updates.resolutionProofUrl !== undefined) {
      paramIndex++
      setClauses.push(`"resolutionProofUrl" = $${paramIndex}`)
      params.push(toParam(updates.resolutionProofUrl))
    }
    if (updates.resolutionDescription !== undefined) {
      paramIndex++
      setClauses.push(`"resolutionDescription" = $${paramIndex}`)
      params.push(toParam(updates.resolutionDescription))
    }

    // Always update updatedAt
    paramIndex++
    setClauses.push(`"updatedAt" = $${paramIndex}`)
    params.push(new Date().toISOString())

    // Add marketId as final param
    paramIndex++
    params.push(marketId)

    const results = await this.client.query<MarketRow>(
      `UPDATE "Market" SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    )

    if (!results[0]) throw new Error(`Market not found: ${marketId}`)
    return mapMarket(results[0])
  }

  async getPosition(
    userId: string,
    marketId: string,
    side: PredictionSide,
  ): Promise<PredictionPositionRecord | null> {
    const results = await this.client.query<PositionRow>(
      `SELECT * FROM "Position" WHERE "userId" = $1 AND "marketId" = $2 AND side = $3 LIMIT 1`,
      [userId, marketId, toSideBool(side)],
    )
    return results[0] ? mapPosition(results[0]) : null
  }

  async upsertPosition(
    position: Omit<PredictionPositionRecord, 'id'> & { id?: string },
  ): Promise<PredictionPositionRecord> {
    const now = new Date()
    const id = position.id ?? (await generateSnowflakeId())

    const row: NewPosition = {
      id,
      userId: position.userId,
      marketId: position.marketId,
      side: toSideBool(position.side) ? 'yes' : 'no',
      shares: String(position.shares),
      avgPrice: String(position.avgPrice),
      outcome:
        position.outcome != null ? (position.outcome ? 'yes' : 'no') : '',
      pnl: position.pnl != null ? String(position.pnl) : '0',
      resolvedAt: position.resolvedAt ?? null,
      status: position.status ?? 'active',
      createdAt: position.createdAt ?? now,
      updatedAt: position.updatedAt ?? now,
    }

    const results = await this.client.query<PositionRow>(
      `INSERT INTO "Position" (
        id, "userId", "marketId", side, shares, "avgPrice", outcome, pnl,
        "resolvedAt", status, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        shares = $5,
        "avgPrice" = $6,
        pnl = $8,
        outcome = $7,
        "resolvedAt" = $9,
        status = $10,
        "updatedAt" = $12
      RETURNING *`,
      [
        row.id,
        row.userId,
        row.marketId,
        row.side,
        row.shares,
        row.avgPrice,
        toParam(row.outcome),
        toParam(row.pnl),
        toParam(row.resolvedAt),
        row.status ?? 'active',
        toParam(row.createdAt),
        toParam(now), // Always use current time for updatedAt on upsert
      ],
    )

    if (!results[0]) {
      throw new Error(
        `Failed to upsert position for user ${position.userId} market ${position.marketId}`,
      )
    }
    return mapPosition(results[0])
  }

  async deletePosition(positionId: string): Promise<void> {
    await this.client.exec('DELETE FROM "Position" WHERE id = $1', [positionId])
  }

  async listPositionsForMarket(
    marketId: string,
  ): Promise<PredictionPositionRecord[]> {
    const rows = await this.client.query<PositionRow>(
      'SELECT * FROM "Position" WHERE "marketId" = $1',
      [marketId],
    )
    return rows.map(mapPosition)
  }

  async insertPriceSnapshot(
    snapshot: PredictionPriceSnapshotRecord,
  ): Promise<void> {
    const row: NewPredictionPriceHistory = {
      id: await generateSnowflakeId(),
      marketId: snapshot.marketId,
      outcomeId: null,
      price: String(snapshot.yesPrice),
      volume: null,
      yesPrice: snapshot.yesPrice,
      noPrice: snapshot.noPrice,
      yesShares: String(snapshot.yesShares),
      noShares: String(snapshot.noShares),
      liquidity: String(snapshot.liquidity),
      eventType: snapshot.eventType,
      source: snapshot.source,
      createdAt: snapshot.createdAt ?? new Date(),
    }

    await this.client.exec(
      `INSERT INTO "PredictionPriceHistory" (
        id, "marketId", "outcomeId", price, volume, "yesPrice", "noPrice", "yesShares", "noShares",
        liquidity, "eventType", source, "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        row.id,
        row.marketId,
        toParam(row.outcomeId),
        row.price,
        toParam(row.volume),
        row.yesPrice ?? 0,
        row.noPrice ?? 0,
        row.yesShares ?? '0',
        row.noShares ?? '0',
        row.liquidity ?? '0',
        row.eventType ?? 'trade',
        row.source ?? 'system',
        toParam(row.createdAt),
      ],
    )
  }
}
