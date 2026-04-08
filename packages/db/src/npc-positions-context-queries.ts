/**
 * Reads for `npc-positions-context-service` (actor positions for prompts).
 *
 * **Why here:** Keeps `Position` / `PerpPosition` / `Question` SQL under `asSystem`
 * (replaces repository `findMany` inside a single system transaction).
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { asSystem } from './db';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { questions } from './tables/questions';

export type NpcContextPredictionPositionRow = {
  userId: string;
  side: boolean;
  questionId: number | null;
  pnl: string | null;
  amount: string;
  shares: string;
};

export type NpcContextPerpPositionRow = {
  userId: string;
  ticker: string;
  side: string;
  leverage: number;
  size: number;
  unrealizedPnL: number;
  liquidationPrice: number;
};

export type NpcContextQuestionLabelRow = {
  questionNumber: number;
  text: string;
};

export async function loadNpcPositionsContextBundle(
  actorIds: string[]
): Promise<{
  predictionPositions: NpcContextPredictionPositionRow[];
  perpPositions: NpcContextPerpPositionRow[];
  questions: NpcContextQuestionLabelRow[];
}> {
  if (actorIds.length === 0) {
    return {
      predictionPositions: [],
      perpPositions: [],
      questions: [],
    };
  }

  return asSystem(async (c) => {
    const [pred, perp] = await Promise.all([
      c
        .select({
          userId: positions.userId,
          side: positions.side,
          questionId: positions.questionId,
          pnl: positions.pnl,
          amount: positions.amount,
          shares: positions.shares,
        })
        .from(positions)
        .where(
          and(
            inArray(positions.userId, actorIds),
            eq(positions.status, 'active')
          )
        ),
      c
        .select({
          userId: perpPositions.userId,
          ticker: perpPositions.ticker,
          side: perpPositions.side,
          leverage: perpPositions.leverage,
          size: perpPositions.size,
          unrealizedPnL: perpPositions.unrealizedPnL,
          liquidationPrice: perpPositions.liquidationPrice,
        })
        .from(perpPositions)
        .where(
          and(
            inArray(perpPositions.userId, actorIds),
            isNull(perpPositions.closedAt)
          )
        ),
    ]);

    const questionNumbers = Array.from(
      new Set(
        pred
          .map((p) => p.questionId)
          .filter((q): q is number => typeof q === 'number')
      )
    );

    const qs = questionNumbers.length
      ? await c
          .select({
            questionNumber: questions.questionNumber,
            text: questions.text,
          })
          .from(questions)
          .where(inArray(questions.questionNumber, questionNumbers))
      : [];

    return {
      predictionPositions: pred,
      perpPositions: perp,
      questions: qs,
    };
  }, 'npc-positions-context-load');
}
