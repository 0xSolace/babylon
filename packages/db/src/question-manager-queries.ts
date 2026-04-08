/**
 * Reads/writes for `QuestionManager` (continuous + timeframe question generation).
 *
 * **Why here:** `WorldEvent`, `Question`, and trending-tag join SQL under **`asSystem`**;
 * LLM prompts, arc planning, and market service wiring stay in engine.
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { asSystem } from './db';
import { questions } from './tables/questions';
import { tags } from './tables/tags';
import { trendingTags } from './tables/trending-tags';
import { worldEvents } from './tables/world-events';

export type QuestionManagerQuestionInsert = typeof questions.$inferInsert;

export async function fetchLatestQuestionNumberForQuestionManager() {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ questionNumber: questions.questionNumber })
      .from(questions)
      .orderBy(desc(questions.questionNumber))
      .limit(1);
    return row?.questionNumber ?? null;
  }, 'qm-latest-qnum');
}

export async function insertQuestionRowForQuestionManager(
  row: QuestionManagerQuestionInsert
) {
  return asSystem(async (c) => {
    const inserted = await c.insert(questions).values(row).returning();
    const first = inserted[0];
    if (!first) {
      throw new Error('Question insert returned empty');
    }
    return first;
  }, 'qm-insert-question');
}

export async function listPublicWorldEventsSinceForQuestionManager(
  since: Date,
  limit: number
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldEvents)
        .where(
          and(
            gte(worldEvents.timestamp, since),
            eq(worldEvents.visibility, 'public')
          )
        )
        .orderBy(desc(worldEvents.timestamp))
        .limit(limit),
    'qm-world-events-since'
  );
}

export async function listActiveQuestionsForQuestionManager(limit: number) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(questions)
        .where(eq(questions.status, 'active'))
        .orderBy(desc(questions.createdAt))
        .limit(limit),
    'qm-active-questions'
  );
}

export async function listResolvedQuestionOutcomesForQuestionManager(
  updatedSince: Date,
  limit: number
) {
  return asSystem(
    async (c) =>
      c
        .select({
          text: questions.text,
          resolvedOutcome: questions.resolvedOutcome,
          resolutionDate: questions.resolutionDate,
        })
        .from(questions)
        .where(
          and(
            eq(questions.status, 'resolved'),
            gte(questions.updatedAt, updatedSince)
          )
        )
        .orderBy(desc(questions.updatedAt))
        .limit(limit),
    'qm-resolved-outcomes'
  );
}

export type QuestionManagerTrendingTagRow = {
  id: string;
  tagId: string;
  score: number;
  tagName: string | null;
  tagDisplayName: string | null;
  tagCategory: string | null;
};

export async function listTrendingTagsWithNamesForQuestionManager(
  limit: number
): Promise<QuestionManagerTrendingTagRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          id: trendingTags.id,
          tagId: trendingTags.tagId,
          score: trendingTags.score,
          tagName: tags.name,
          tagDisplayName: tags.displayName,
          tagCategory: tags.category,
        })
        .from(trendingTags)
        .leftJoin(tags, eq(trendingTags.tagId, tags.id))
        .orderBy(desc(trendingTags.score))
        .limit(limit),
    'qm-trending-tags'
  );
}
