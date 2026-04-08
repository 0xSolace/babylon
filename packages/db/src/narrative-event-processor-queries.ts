/**
 * Arc state, arc plan, question, and world-event SQL for `narrative-event-processor`.
 *
 * **Why here:** Drizzle for narrative ticks lives in `@babylon/db` with **`asSystem`**
 * for standalone ops and **`Transaction`** helpers for the arc + world-event bundle;
 * LLM/article/market orchestration stays in engine.
 */

import { and, eq } from 'drizzle-orm';
import { asSystem, type Transaction } from './db';
import { arcStates } from './tables/arc-states';
import type { ArcStateType, ScheduledEvent } from './tables/narrative-types';
import { questionArcPlans } from './tables/question-arc-plans';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export type ArcStateRow = typeof arcStates.$inferSelect;
export type NewArcStateRow = typeof arcStates.$inferInsert;
export type NewWorldEventRow = typeof worldEvents.$inferInsert;

export async function transitionArcStateWithOptimisticLockAsSystem(
  arcId: string,
  newState: ArcStateType,
  attemptState: ArcStateType,
  now: Date
): Promise<{ id: string }[]> {
  return asSystem(
    async (c) =>
      c
        .update(arcStates)
        .set({
          currentState: newState,
          stateEnteredAt: now,
          updatedAt: now,
          pendingTransitions: [],
        })
        .where(
          and(eq(arcStates.id, arcId), eq(arcStates.currentState, attemptState))
        )
        .returning({ id: arcStates.id }),
    'narrative-arc-transition-optimistic'
  );
}

export async function transitionArcStateSimpleAsSystem(
  arcId: string,
  newState: ArcStateType,
  now: Date
): Promise<void> {
  await asSystem(async (c) => {
    await c
      .update(arcStates)
      .set({
        currentState: newState,
        stateEnteredAt: now,
        updatedAt: now,
        pendingTransitions: [],
      })
      .where(eq(arcStates.id, arcId));
  }, 'narrative-arc-transition-simple');
}

export async function fetchArcStateCurrentStateOnly(
  arcId: string
): Promise<{ currentState: ArcStateType } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ currentState: arcStates.currentState })
      .from(arcStates)
      .where(eq(arcStates.id, arcId))
      .limit(1);
    return row;
  }, 'narrative-arc-current-state');
}

export async function fetchQuestionArcPlanScheduleRow(
  questionId: string
): Promise<
  | {
      id: string;
      eventSchedule: ScheduledEvent[] | null;
    }
  | undefined
> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: questionArcPlans.id,
        eventSchedule: questionArcPlans.eventSchedule,
      })
      .from(questionArcPlans)
      .where(eq(questionArcPlans.questionId, questionId))
      .limit(1);
    return row;
  }, 'narrative-arc-plan-schedule');
}

export async function updateQuestionArcPlanEventScheduleAsSystem(
  planId: string,
  eventSchedule: ScheduledEvent[]
): Promise<void> {
  await asSystem(async (c) => {
    await c
      .update(questionArcPlans)
      .set({ eventSchedule })
      .where(eq(questionArcPlans.id, planId));
  }, 'narrative-arc-plan-schedule-update');
}

export async function insertWorldEventFromArcAsSystem(
  row: NewWorldEventRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(worldEvents).values(row);
  }, 'narrative-world-event-insert');
}

export async function insertWorldEventFromArcInTx(
  tx: Transaction,
  row: NewWorldEventRow
): Promise<void> {
  await tx.insert(worldEvents).values(row);
}

export async function fetchQuestionTextAndNumberForNarrative(
  questionId: string
): Promise<
  | {
      text: string;
      questionNumber: number | null;
    }
  | undefined
> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        text: questions.text,
        questionNumber: questions.questionNumber,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    return row;
  }, 'narrative-question-details');
}

export async function fetchQuestionTextForNarrative(
  questionId: string
): Promise<{ text: string } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ text: questions.text })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    return row;
  }, 'narrative-question-text');
}

export async function fetchQuestionArcPlanActorAssignments(
  questionId: string
): Promise<
  | {
      insiderActorIds: string[] | null;
      deceiverActorIds: string[] | null;
    }
  | undefined
> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        insiderActorIds: questionArcPlans.insiderActorIds,
        deceiverActorIds: questionArcPlans.deceiverActorIds,
      })
      .from(questionArcPlans)
      .where(eq(questionArcPlans.questionId, questionId))
      .limit(1);
    return row;
  }, 'narrative-arc-plan-actors');
}

export async function fetchArcStateRowById(
  arcId: string
): Promise<ArcStateRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(arcStates)
      .where(eq(arcStates.id, arcId))
      .limit(1);
    return row;
  }, 'narrative-arc-by-id');
}

export type QuestionArcPlanProcessRow = {
  id: string;
  insiderActorIds: string[] | null;
  deceiverActorIds: string[] | null;
  eventSchedule: ScheduledEvent[] | null;
};

export async function fetchQuestionArcPlanForProcessTick(
  questionId: string
): Promise<QuestionArcPlanProcessRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: questionArcPlans.id,
        insiderActorIds: questionArcPlans.insiderActorIds,
        deceiverActorIds: questionArcPlans.deceiverActorIds,
        eventSchedule: questionArcPlans.eventSchedule,
      })
      .from(questionArcPlans)
      .where(eq(questionArcPlans.questionId, questionId))
      .limit(1);
    return row;
  }, 'narrative-arc-plan-process');
}

export async function bumpArcStateEventsGeneratedOptimisticInTx(
  tx: Transaction,
  params: {
    arcId: string;
    expectedUpdatedAt: Date;
    now: Date;
    nextEventsGenerated: number;
  }
): Promise<{ id: string }[]> {
  return tx
    .update(arcStates)
    .set({
      eventsGenerated: params.nextEventsGenerated,
      lastEventAt: params.now,
      updatedAt: params.now,
    })
    .where(
      and(
        eq(arcStates.id, params.arcId),
        eq(arcStates.updatedAt, params.expectedUpdatedAt)
      )
    )
    .returning({ id: arcStates.id });
}

export async function findArcStateIdByQuestionId(
  questionId: string
): Promise<{ id: string } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: arcStates.id })
      .from(arcStates)
      .where(eq(arcStates.questionId, questionId))
      .limit(1);
    return row;
  }, 'narrative-arc-id-by-question');
}

export async function insertArcStateRowAsSystem(
  row: NewArcStateRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(arcStates).values(row);
  }, 'narrative-arc-insert');
}
