/**
 * Question arc plan persistence for `narrative-state-service`.
 *
 * **Why here:** Replaces `asSystem` + `questionArcPlan` repository with plain
 * `questionArcPlans` SQL under `asSystem`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { ScheduledEvent } from './tables/narrative-types';
import {
  type QuestionArcPlan,
  questionArcPlans,
} from './tables/question-arc-plans';

/** Alias for consumers that used the old repository row name */
export type DatabaseArcPlan = QuestionArcPlan;

export async function insertQuestionArcPlanRow(params: {
  questionId: string;
  uncertaintyPeakDay: number;
  clarityOnsetDay: number;
  verificationDay: number;
  insiderActorIds: string[];
  deceiverActorIds: string[];
  phaseRatios: {
    early: number;
    middle: number;
    late: number;
    climax: number;
  };
  eventSchedule: ScheduledEvent[];
}): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(questionArcPlans).values({
      id: await generateSnowflakeId(),
      questionId: params.questionId,
      uncertaintyPeakDay: params.uncertaintyPeakDay,
      clarityOnsetDay: params.clarityOnsetDay,
      verificationDay: params.verificationDay,
      insiderActorIds: params.insiderActorIds,
      deceiverActorIds: params.deceiverActorIds,
      phaseRatios: params.phaseRatios,
      eventSchedule: params.eventSchedule,
      createdAt: new Date(),
    });
  }, 'narrative-state-save-arc-plan');
}

export async function fetchQuestionArcPlanByQuestionId(
  questionId: string
): Promise<QuestionArcPlan | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(questionArcPlans)
      .where(eq(questionArcPlans.questionId, questionId))
      .limit(1);
    return row ?? null;
  }, 'narrative-state-get-arc-plan');
}
