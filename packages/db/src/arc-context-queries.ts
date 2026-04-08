/**
 * Arc state + question text for NPC arc-awareness (single transaction).
 *
 * **Why here:** Matches prior `asSystem` boundary — one round-trip for arcs and
 * related `questions` rows.
 */

import { inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { arcStates } from './tables/arc-states';
import type { ArcStateType } from './tables/narrative-types';
import { questions } from './tables/questions';

export type ArcContextActiveArcRow = {
  id: string;
  questionId: string;
  currentState: ArcStateType;
};

export type ArcContextQuestionTextRow = {
  id: string;
  text: string;
};

export async function fetchArcContextNpcRead(): Promise<{
  activeArcs: ArcContextActiveArcRow[];
  questionRows: ArcContextQuestionTextRow[];
}> {
  return asSystem(async (c) => {
    const arcs = await c
      .select({
        id: arcStates.id,
        questionId: arcStates.questionId,
        currentState: arcStates.currentState,
      })
      .from(arcStates)
      .limit(50);

    if (arcs.length === 0) {
      return { activeArcs: arcs, questionRows: [] };
    }

    const questionIds = arcs.map((a) => a.questionId);
    const rows = await c
      .select({
        id: questions.id,
        text: questions.text,
      })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    return { activeArcs: arcs, questionRows: rows };
  }, 'arc-context-service-npc-queries');
}
