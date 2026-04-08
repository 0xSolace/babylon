/**
 * Reads for `MarketDecisionEngine` (active questions + recent NPC posts).
 *
 * **Why here:** Keeps Drizzle under `asSystem`; prompt formatting stays in engine.
 */

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';
import { questions } from './tables/questions';

export type MarketDecisionActiveQuestionRow = {
  text: string;
  resolutionDate: Date;
};

export async function listActiveQuestionsForMarketDecision(
  limit = 10
): Promise<MarketDecisionActiveQuestionRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          text: questions.text,
          resolutionDate: questions.resolutionDate,
        })
        .from(questions)
        .where(eq(questions.status, 'active'))
        .orderBy(desc(questions.createdAt))
        .limit(limit),
    'market-decision-engine-active-questions'
  );
}

export type MarketDecisionRecentPostRow = {
  content: string;
  authorId: string;
};

export async function listRecentActorPostsForMarketDecision(params: {
  since: Date;
  actorIds: string[];
  limit?: number;
}): Promise<MarketDecisionRecentPostRow[]> {
  const { since, actorIds, limit = 10 } = params;
  if (actorIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({ content: posts.content, authorId: posts.authorId })
        .from(posts)
        .where(
          and(
            gte(posts.createdAt, since),
            inArray(posts.authorId, actorIds),
            eq(posts.type, 'post')
          )
        )
        .orderBy(desc(posts.createdAt))
        .limit(limit),
    'market-decision-engine-recent-posts'
  );
}
