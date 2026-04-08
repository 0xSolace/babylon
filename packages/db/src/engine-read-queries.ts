/**
 * Shared read queries for game engine paths (questions, markets, games, world events,
 * arc state, actors, posts).
 *
 * **Why here:** The engine previously carried a copy under `packages/engine/src/db/`
 * that was easy to miss in review. Centralizing in `@babylon/db` keeps `where` clauses
 * auditable next to other query modules and RLS helpers (`asSystem` in `./db`).
 */

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { actorState } from './tables/actor-state';
import { arcStates } from './tables/arc-states';
import { games } from './tables/games';
import { markets } from './tables/markets';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export async function getActiveQuestions() {
  return asSystem(
    (c) => c.select().from(questions).where(eq(questions.status, 'active')),
    'queries-get-active-questions'
  );
}

export async function getActiveQuestionsWithLimit(limit: number) {
  return asSystem(
    (c) =>
      c
        .select()
        .from(questions)
        .where(eq(questions.status, 'active'))
        .limit(limit),
    'queries-get-active-questions-limited'
  );
}

export async function getQuestionByNumber(questionNumber: number) {
  return asSystem(async (c) => {
    const [question] = await c
      .select()
      .from(questions)
      .where(eq(questions.questionNumber, questionNumber))
      .limit(1);
    return question;
  }, 'queries-get-question-by-number');
}

export async function getQuestionById(id: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);
    return row;
  }, 'queries-get-question-by-id');
}

export async function getActiveMarkets(timestamp: Date = new Date()) {
  return asSystem(
    (c) =>
      c
        .select()
        .from(markets)
        .where(
          and(eq(markets.resolved, false), gte(markets.endDate, timestamp))
        ),
    'queries-get-active-markets'
  );
}

export async function getMarketById(id: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(markets)
      .where(eq(markets.id, id))
      .limit(1);
    return row;
  }, 'queries-get-market-by-id');
}

export async function getMarketByQuestion(questionText: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(markets)
      .where(eq(markets.question, questionText))
      .limit(1);
    return row;
  }, 'queries-get-market-by-question');
}

export async function getContinuousGame() {
  return asSystem(async (c) => {
    const [game] = await c
      .select()
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);
    return game;
  }, 'queries-get-continuous-game');
}

/** Minimal continuous-game row for cron ticks (cache-friendly slice). */
export type ContinuousGameCronState = {
  id: string;
  isRunning: boolean;
  isContinuous: boolean;
  currentDay: number | null;
};

/**
 * Same row shape as cron routes previously loaded inline; `observationTag` preserves
 * per-job tracing (e.g. article-tick vs npc-tick).
 */
export async function selectContinuousGameStateForCron(
  observationTag: string
): Promise<ContinuousGameCronState | null> {
  return asSystem(async (c) => {
    const [game] = await c
      .select({
        id: games.id,
        isRunning: games.isRunning,
        isContinuous: games.isContinuous,
        currentDay: games.currentDay,
      })
      .from(games)
      .where(eq(games.isContinuous, true))
      .limit(1);
    return game ?? null;
  }, observationTag);
}

/** Latest continuous game row by `startedAt` (for day-number calculation). */
export async function fetchLatestContinuousGameDayRow() {
  return asSystem(async (c) => {
    const [game] = await c
      .select({
        currentDay: games.currentDay,
        startedAt: games.startedAt,
      })
      .from(games)
      .where(eq(games.isContinuous, true))
      .orderBy(desc(games.startedAt))
      .limit(1);
    return game ?? null;
  }, 'game-service-current-day');
}

/** Minimal active prediction markets for NPC summaries. */
export async function fetchActiveMarketSummaries(limit: number) {
  return asSystem(
    async (c) =>
      c
        .select({
          id: markets.id,
          question: markets.question,
        })
        .from(markets)
        .where(eq(markets.resolved, false))
        .limit(limit),
    'game-service-active-markets'
  );
}

export async function getGameById(id: string) {
  return asSystem(async (c) => {
    const [game] = await c
      .select()
      .from(games)
      .where(eq(games.id, id))
      .limit(1);
    return game;
  }, 'queries-get-game-by-id');
}

export async function getRecentWorldEvents(since: Date, limit?: number) {
  return asSystem(async (c) => {
    const query = c
      .select()
      .from(worldEvents)
      .where(gte(worldEvents.timestamp, since))
      .orderBy(desc(worldEvents.timestamp));
    return limit ? query.limit(limit) : query;
  }, 'queries-recent-world-events');
}

export async function getWorldEventsForQuestion(questionId: string) {
  const numericId = Number(questionId);
  if (Number.isNaN(numericId)) {
    throw new Error(
      `getWorldEventsForQuestion: Invalid questionId "${questionId}" - must be a numeric string for worldEvents.relatedQuestion`
    );
  }
  return asSystem(
    (c) =>
      c
        .select()
        .from(worldEvents)
        .where(eq(worldEvents.relatedQuestion, numericId))
        .orderBy(desc(worldEvents.timestamp)),
    'queries-world-events-for-question'
  );
}

export async function getArcStateByQuestionId(questionId: string) {
  return asSystem(async (c) => {
    const [arcState] = await c
      .select()
      .from(arcStates)
      .where(eq(arcStates.questionId, questionId))
      .limit(1);
    return arcState;
  }, 'queries-arc-state-by-question');
}

export async function getArcStatesByQuestionIds(questionIds: string[]) {
  if (questionIds.length === 0) return [];
  return asSystem(
    (c) =>
      c
        .select()
        .from(arcStates)
        .where(inArray(arcStates.questionId, questionIds)),
    'queries-arc-states-by-questions'
  );
}

export async function getActorById(actorId: string) {
  return asSystem(async (c) => {
    const [actor] = await c
      .select()
      .from(actorState)
      .where(eq(actorState.id, actorId.toLowerCase()))
      .limit(1);
    return actor;
  }, 'queries-get-actor-by-id');
}

export async function getActorsByIds(actorIds: string[]) {
  if (actorIds.length === 0) return [];
  const normalizedIds = actorIds.map((id) => id.toLowerCase());
  return asSystem(
    (c) =>
      c.select().from(actorState).where(inArray(actorState.id, normalizedIds)),
    'queries-get-actors-by-ids'
  );
}

export async function getRecentPosts(since: Date, limit?: number) {
  return asSystem(async (c) => {
    const query = c
      .select()
      .from(posts)
      .where(gte(posts.timestamp, since))
      .orderBy(desc(posts.timestamp));
    return limit ? query.limit(limit) : query;
  }, 'queries-recent-posts');
}

export async function getPostsByAuthor(authorId: string, limit?: number) {
  return asSystem(async (c) => {
    const query = c
      .select()
      .from(posts)
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.timestamp));
    return limit ? query.limit(limit) : query;
  }, 'queries-posts-by-author');
}
