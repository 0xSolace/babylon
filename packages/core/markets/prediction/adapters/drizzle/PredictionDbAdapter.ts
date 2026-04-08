import {
  corePredictionDeletePosition,
  corePredictionInsertMarketOnConflictDoNothing,
  corePredictionInsertPriceHistory,
  corePredictionSelectActiveMarkets,
  corePredictionSelectActiveUserPositions,
  corePredictionSelectMarketById,
  corePredictionSelectMarketsByIds,
  corePredictionSelectPositionByUserMarketSide,
  corePredictionSelectPositionsForMarket,
  corePredictionSelectQuestionById,
  corePredictionSelectQuestionByQuestionNumber,
  corePredictionUpdateMarketReturning,
  corePredictionUpsertPositionReturning,
  type Market,
  type NewMarket,
  type NewPosition,
  type NewPredictionPriceHistory,
  type Position,
  type Question,
  type Transaction,
} from '@babylon/db';
import { db as defaultDb } from '@babylon/db/engine-storage';
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

type DbClient = typeof defaultDb | Transaction;

const mapMarket = (m: Market): PredictionMarketRecord => {
  const extra = m as unknown as Partial<PredictionMarketRecord>;
  return {
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
    oracleCommitTxHash: extra.oracleCommitTxHash ?? undefined,
    oracleRevealTxHash: extra.oracleRevealTxHash ?? undefined,
    resolutionProofUrl: extra.resolutionProofUrl ?? undefined,
    resolutionDescription: extra.resolutionDescription ?? undefined,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
};

const mapPosition = (p: Position): PredictionPositionRecord => ({
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

const mapQuestionRow = (q: Question): QuestionRecord => ({
  id: q.id,
  questionNumber: q.questionNumber ?? undefined,
  text: q.text,
  status: (q.status as QuestionRecord['status']) ?? 'active',
  resolutionDate: q.resolutionDate,
  resolvedOutcome: q.resolvedOutcome,
  createdDate: q.createdDate,
});

export class PredictionDbAdapter implements PredictionDbPort {
  constructor(private readonly client: DbClient = defaultDb) {}

  async getMarketById(id: string): Promise<PredictionMarketRecord | null> {
    const m = await corePredictionSelectMarketById(this.client, id);
    return m ? mapMarket(m) : null;
  }

  async getMarketsByIds(ids: string[]): Promise<PredictionMarketRecord[]> {
    const ms = await corePredictionSelectMarketsByIds(this.client, ids);
    return ms.map(mapMarket);
  }

  async listMarkets(): Promise<PredictionMarketRecord[]> {
    const rows = await corePredictionSelectActiveMarkets(this.client);
    return rows.map(mapMarket);
  }

  async listUserPositions(userId: string): Promise<PredictionPositionRecord[]> {
    const rows = await corePredictionSelectActiveUserPositions(
      this.client,
      userId
    );
    return rows.map(mapPosition).filter((p) => p.shares >= 0.01);
  }

  async getQuestion(idOrNumber: string): Promise<QuestionRecord | null> {
    const byId = await corePredictionSelectQuestionById(
      this.client,
      idOrNumber
    );
    if (byId) {
      return mapQuestionRow(byId);
    }

    const num = Number.parseInt(idOrNumber, 10);
    if (Number.isNaN(num)) return null;
    const q = await corePredictionSelectQuestionByQuestionNumber(
      this.client,
      num
    );
    return q ? mapQuestionRow(q) : null;
  }

  async createMarketFromQuestion(
    question: QuestionRecord,
    initialLiquidity: number,
    options?: {
      description?: string | null;
      gameId?: string | null;
      dayNumber?: number | null;
    }
  ): Promise<PredictionMarketRecord> {
    const now = new Date();
    const liquidityHalf = initialLiquidity / 2;
    const data: NewMarket = {
      id: question.id,
      question: question.text,
      description: options?.description ?? null,
      gameId: options?.gameId ?? 'continuous',
      dayNumber: options?.dayNumber ?? null,
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

    const inserted = await corePredictionInsertMarketOnConflictDoNothing(
      this.client,
      data
    );

    if (inserted) {
      return mapMarket(inserted);
    }

    const existing = await this.getMarketById(question.id);
    if (!existing) throw new Error('Failed to create market');
    return existing;
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
    const updated = await corePredictionUpdateMarketReturning(
      this.client,
      marketId,
      {
        yesShares:
          updates.yesShares != null ? String(updates.yesShares) : undefined,
        noShares:
          updates.noShares != null ? String(updates.noShares) : undefined,
        liquidity:
          updates.liquidity != null ? String(updates.liquidity) : undefined,
        resolved: updates.resolved ?? undefined,
        resolution: updates.resolution ?? undefined,
        onChainMarketId: updates.onChainMarketId ?? undefined,
        onChainResolved: updates.onChainResolved ?? undefined,
        resolutionProofUrl: updates.resolutionProofUrl ?? undefined,
        resolutionDescription: updates.resolutionDescription ?? undefined,
        updatedAt: new Date(),
      }
    );

    if (!updated) throw new Error(`Market not found: ${marketId}`);
    return mapMarket(updated);
  }

  async getPosition(
    userId: string,
    marketId: string,
    side: PredictionSide
  ): Promise<PredictionPositionRecord | null> {
    const p = await corePredictionSelectPositionByUserMarketSide(
      this.client,
      userId,
      marketId,
      toSideBool(side)
    );
    return p ? mapPosition(p) : null;
  }

  async upsertPosition(
    position: Omit<PredictionPositionRecord, 'id'> & { id?: string }
  ): Promise<PredictionPositionRecord> {
    const now = new Date();
    const id = position.id ?? (await generateSnowflakeId());
    const row: NewPosition = {
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

    const result = await corePredictionUpsertPositionReturning(
      this.client,
      row,
      now
    );
    return mapPosition(result);
  }

  async deletePosition(positionId: string): Promise<void> {
    await corePredictionDeletePosition(this.client, positionId);
  }

  async listPositionsForMarket(
    marketId: string
  ): Promise<PredictionPositionRecord[]> {
    const rows = await corePredictionSelectPositionsForMarket(
      this.client,
      marketId
    );
    return rows.map(mapPosition);
  }

  async insertPriceSnapshot(
    snapshot: PredictionPriceSnapshotRecord
  ): Promise<void> {
    const row: NewPredictionPriceHistory = {
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
    };
    await corePredictionInsertPriceHistory(this.client, row);
  }
}
