/**
 * CQL-based Prediction Database Adapter
 *
 * Uses the CQL repository pattern directly - NO Drizzle ORM dependencies.
 */
import { type CQLClient, db } from '@babylon/db';
import { generateSnowflakeId } from '@babylon/shared';
import type {
  PredictionDbPort,
  PredictionMarketRecord,
  PredictionPositionRecord,
  PredictionPriceSnapshotRecord,
  PredictionSide,
  QuestionRecord,
} from '../../types';

const toSideBool = (side: PredictionSide) => side === 'yes';
const fromSideBool = (side: boolean): PredictionSide => (side ? 'yes' : 'no');

// Raw DB record types from CQL queries
interface MarketRow {
  id: string;
  question: string;
  description: string | null;
  yesShares: string;
  noShares: string;
  liquidity: string;
  endDate: Date | null;
  resolved: boolean;
  resolution: boolean | null;
  onChainMarketId: string | null;
  onChainResolved: boolean;
  oracleCommitTxHash?: string | null;
  oracleRevealTxHash?: string | null;
  resolutionProofUrl?: string | null;
  resolutionDescription?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PositionRow {
  id: string;
  userId: string;
  marketId: string;
  side: boolean;
  shares: string;
  avgPrice: string;
  status: string;
  outcome: string | null;
  pnl: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionRow {
  id: string;
  questionNumber: number | null;
  text: string;
  status: string | null;
  resolutionDate: Date | null;
  resolvedOutcome: boolean | null;
  createdDate: Date;
}

const mapMarket = (m: MarketRow): PredictionMarketRecord => ({
  id: m.id,
  question: m.question,
  description: m.description,
  yesShares: Number(m.yesShares),
  noShares: Number(m.noShares),
  liquidity: Number(m.liquidity),
  endDate: m.endDate,
  resolved: m.resolved,
  resolution: m.resolution,
  onChainMarketId: m.onChainMarketId,
  onChainResolved: m.onChainResolved,
  oracleCommitTxHash: m.oracleCommitTxHash ?? undefined,
  oracleRevealTxHash: m.oracleRevealTxHash ?? undefined,
  resolutionProofUrl: m.resolutionProofUrl ?? undefined,
  resolutionDescription: m.resolutionDescription ?? undefined,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

const mapPosition = (p: PositionRow): PredictionPositionRecord => ({
  id: p.id,
  userId: p.userId,
  marketId: p.marketId,
  side: fromSideBool(p.side),
  shares: Number(p.shares),
  avgPrice: Number(p.avgPrice),
  status: p.status as PredictionPositionRecord['status'],
  outcome: p.outcome,
  pnl: p.pnl ? Number(p.pnl) : undefined,
  resolvedAt: p.resolvedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export class PredictionDbAdapter implements PredictionDbPort {
  constructor(private readonly client: CQLClient = db) {}

  async getMarketById(id: string): Promise<PredictionMarketRecord | null> {
    const m = await this.client.market.findUnique({ where: { id } });
    return m ? mapMarket(m as MarketRow) : null;
  }

  async getMarketsByIds(ids: string[]): Promise<PredictionMarketRecord[]> {
    if (ids.length === 0) return [];
    // CQL repositories don't support IN queries directly, use raw query
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.client.query<MarketRow>(
      `SELECT * FROM "markets" WHERE "id" IN (${placeholders})`,
      ids
    );
    return rows.map(mapMarket);
  }

  async listMarkets(): Promise<PredictionMarketRecord[]> {
    const rows = await this.client.market.findMany();
    return rows.map((m) => mapMarket(m as MarketRow));
  }

  async listUserPositions(userId: string): Promise<PredictionPositionRecord[]> {
    // Use raw query for complex WHERE conditions
    const rows = await this.client.query<PositionRow>(
      `SELECT * FROM "positions" WHERE "userId" = $1 AND "status" != $2`,
      [userId, 'resolved']
    );
    // Filter out positions with negligible shares
    return rows.map(mapPosition).filter((p) => p.shares >= 0.01);
  }

  async getQuestion(idOrNumber: string): Promise<QuestionRecord | null> {
    // Try by ID first
    const byId = await this.client.question.findUnique({
      where: { id: idOrNumber },
    });
    if (byId) {
      const q = byId as QuestionRow;
      return {
        id: q.id,
        questionNumber: q.questionNumber ?? undefined,
        text: q.text,
        status: (q.status as QuestionRecord['status']) ?? 'active',
        resolutionDate: q.resolutionDate,
        resolvedOutcome: q.resolvedOutcome,
        createdDate: q.createdDate,
      };
    }

    // Try by question number
    const num = Number.parseInt(idOrNumber, 10);
    if (Number.isNaN(num)) return null;

    const byNum = await this.client.question.findFirst({
      where: { questionNumber: num },
    });
    if (!byNum) return null;

    const q = byNum as QuestionRow;
    return {
      id: q.id,
      questionNumber: q.questionNumber ?? undefined,
      text: q.text,
      status: (q.status as QuestionRecord['status']) ?? 'active',
      resolutionDate: q.resolutionDate,
      resolvedOutcome: q.resolvedOutcome,
      createdDate: q.createdDate,
    };
  }

  async createMarketFromQuestion(
    question: QuestionRecord,
    initialLiquidity: number,
    options?: { description?: string | null }
  ): Promise<PredictionMarketRecord> {
    const now = new Date();
    const liquidityHalf = initialLiquidity / 2;

    const data = {
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
      endDate: question.resolutionDate,
      createdAt: now,
      updatedAt: now,
      onChainMarketId: null,
      onChainResolutionTxHash: null,
      onChainResolved: false,
      oracleAddress: null,
      resolutionProofUrl: null,
      resolutionDescription: null,
    };

    // Use upsert for conflict handling
    const inserted = await this.client.market.upsert({
      where: { id: question.id },
      create: data,
      update: {}, // Don't update if exists
    });

    return mapMarket(inserted as MarketRow);
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
    >
  ): Promise<PredictionMarketRecord> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.yesShares != null)
      updateData.yesShares = String(updates.yesShares);
    if (updates.noShares != null)
      updateData.noShares = String(updates.noShares);
    if (updates.liquidity != null)
      updateData.liquidity = String(updates.liquidity);
    if (updates.resolved !== undefined) updateData.resolved = updates.resolved;
    if (updates.resolution !== undefined)
      updateData.resolution = updates.resolution;
    if (updates.onChainMarketId !== undefined)
      updateData.onChainMarketId = updates.onChainMarketId;
    if (updates.onChainResolved !== undefined)
      updateData.onChainResolved = updates.onChainResolved;
    if (updates.resolutionProofUrl !== undefined)
      updateData.resolutionProofUrl = updates.resolutionProofUrl;
    if (updates.resolutionDescription !== undefined)
      updateData.resolutionDescription = updates.resolutionDescription;

    const updated = await this.client.market.update({
      where: { id: marketId },
      data: updateData,
    });

    return mapMarket(updated as MarketRow);
  }

  async getPosition(
    userId: string,
    marketId: string,
    side: PredictionSide
  ): Promise<PredictionPositionRecord | null> {
    // Use raw query for compound WHERE
    const rows = await this.client.query<PositionRow>(
      `SELECT * FROM "positions" WHERE "userId" = $1 AND "marketId" = $2 AND "side" = $3 LIMIT 1`,
      [userId, marketId, toSideBool(side)]
    );
    const p = rows[0];
    return p ? mapPosition(p) : null;
  }

  async upsertPosition(
    position: Omit<PredictionPositionRecord, 'id'> & { id?: string }
  ): Promise<PredictionPositionRecord> {
    const now = new Date();
    const id = position.id ?? (await generateSnowflakeId());

    const data = {
      id,
      userId: position.userId,
      marketId: position.marketId,
      side: toSideBool(position.side),
      shares: String(position.shares),
      avgPrice: String(position.avgPrice),
      outcome: position.outcome ?? null,
      pnl: position.pnl != null ? String(position.pnl) : null,
      questionId: null,
      resolvedAt: position.resolvedAt ?? null,
      status: position.status ?? 'active',
      createdAt: position.createdAt ?? now,
      updatedAt: position.updatedAt ?? now,
      amount: String(position.avgPrice * position.shares),
    };

    const result = await this.client.position.upsert({
      where: { id },
      create: data,
      update: {
        shares: data.shares,
        avgPrice: data.avgPrice,
        pnl: data.pnl,
        outcome: data.outcome,
        resolvedAt: data.resolvedAt,
        status: data.status,
        updatedAt: now,
      },
    });

    return mapPosition(result as PositionRow);
  }

  async deletePosition(positionId: string): Promise<void> {
    await this.client.position.delete({ where: { id: positionId } });
  }

  async listPositionsForMarket(
    marketId: string
  ): Promise<PredictionPositionRecord[]> {
    const rows = await this.client.position.findMany({
      where: { marketId },
    });
    return rows.map((p) => mapPosition(p as PositionRow));
  }

  async insertPriceSnapshot(
    snapshot: PredictionPriceSnapshotRecord
  ): Promise<void> {
    await this.client.predictionPriceHistory.create({
      data: {
        id: await generateSnowflakeId(),
        marketId: snapshot.marketId,
        yesPrice: snapshot.yesPrice,
        noPrice: snapshot.noPrice,
        yesShares: String(snapshot.yesShares),
        noShares: String(snapshot.noShares),
        liquidity: String(snapshot.liquidity),
        eventType: snapshot.eventType,
        source: snapshot.source,
        createdAt: snapshot.createdAt ?? new Date(),
      },
    });
  }
}
