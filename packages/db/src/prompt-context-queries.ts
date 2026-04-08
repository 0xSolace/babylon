/**
 * Reads for NPC / game prompt context (`context-builder`, `game-context-builder`,
 * `topic-diversity-service`).
 *
 * **Why here:** Keeps `WorldEvent` / `Post` / `Question` filters in `@babylon/db`
 * under `asSystem`.
 */

import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { asSystem } from './db';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { type WorldEvent, worldEvents } from './tables/world-events';

export async function listWorldEventsBetweenTimestampsOrderedDesc(params: {
  sinceInclusive: Date;
  untilInclusive: Date;
  limit: number;
}): Promise<WorldEvent[]> {
  const { sinceInclusive, untilInclusive, limit } = params;
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldEvents)
        .where(
          and(
            gte(worldEvents.timestamp, sinceInclusive),
            lte(worldEvents.timestamp, untilInclusive)
          )
        )
        .orderBy(desc(worldEvents.timestamp))
        .limit(limit),
    'context-builder-recent-events'
  );
}

export async function listWorldEventsOptionalGameIdOrderedDesc(params: {
  gameId?: string | null | undefined;
  limit: number;
}): Promise<WorldEvent[]> {
  return asSystem(async (c) => {
    const base = c.select().from(worldEvents);
    const filtered = params.gameId
      ? base.where(eq(worldEvents.gameId, params.gameId))
      : base;
    return filtered.orderBy(desc(worldEvents.timestamp)).limit(params.limit);
  }, 'rich-game-context-events');
}

export async function listPostsOptionalGameIdCreatedAtGteOrderedDesc(params: {
  gameId?: string | null | undefined;
  createdAtGte: Date;
  limit: number;
}): Promise<(typeof posts.$inferSelect)[]> {
  const conditions = [gte(posts.createdAt, params.createdAtGte)];
  if (params.gameId) {
    conditions.push(eq(posts.gameId, params.gameId));
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(posts)
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt))
        .limit(params.limit),
    'rich-game-context-posts'
  );
}

export async function listQuestionsOrderedDescLimit(
  limit: number
): Promise<(typeof questions.$inferSelect)[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(questions)
        .orderBy(desc(questions.createdAt))
        .limit(limit),
    'rich-game-context-questions'
  );
}

export type TopicDiversityArticleRow = {
  articleTitle: string | null;
  content: string;
  timestamp: Date;
};

export async function listRecentArticlePostsForTopicDiversity(
  windowStart: Date
): Promise<TopicDiversityArticleRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          articleTitle: posts.articleTitle,
          content: posts.content,
          timestamp: posts.timestamp,
        })
        .from(posts)
        .where(
          and(
            eq(posts.type, 'article'),
            gte(posts.timestamp, windowStart),
            isNull(posts.deletedAt)
          )
        )
        .orderBy(desc(posts.timestamp)),
    'topic-diversity-recent-articles'
  );
}
