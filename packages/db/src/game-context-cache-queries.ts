/**
 * Reads for `GameContextCache` (continuous game + questions + world events).
 *
 * **Why here:** Keeps cron-oriented game context SQL under `asSystem`.
 */

import { asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { games } from './tables/games';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export type GameContextCacheGameStateRow = {
  id: string;
  isRunning: boolean;
  currentDay: number;
  startedAt: Date | null;
  updatedAt: Date;
};

export async function fetchContinuousGameStateForCache(): Promise<GameContextCacheGameStateRow | null> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({
          id: games.id,
          isRunning: games.isRunning,
          currentDay: games.currentDay,
          startedAt: games.startedAt,
          updatedAt: games.updatedAt,
        })
        .from(games)
        .where(eq(games.isContinuous, true))
        .limit(1),
    'game-context-cache-game-state'
  );
  return rows[0] ?? null;
}

export type GameContextCacheActiveQuestionRow = {
  id: string;
  questionNumber: number;
  text: string;
  outcome: boolean;
  status: string;
  resolutionDate: Date | null;
  rank: number | null;
};

export async function listActiveQuestionsForGameContextCache(): Promise<
  GameContextCacheActiveQuestionRow[]
> {
  return asSystem(
    async (c) =>
      c
        .select({
          id: questions.id,
          questionNumber: questions.questionNumber,
          text: questions.text,
          outcome: questions.outcome,
          status: questions.status,
          resolutionDate: questions.resolutionDate,
          rank: questions.rank,
        })
        .from(questions)
        .where(inArray(questions.status, ['active', 'traded']))
        .orderBy(asc(questions.questionNumber), asc(questions.id)),
    'game-context-cache-active-questions'
  );
}

export type GameContextCacheRecentWorldEventRow = {
  id: string;
  eventType: string;
  description: string;
  dayNumber: number | null;
  timestamp: Date;
  relatedQuestion: number | null;
  pointsToward: string | null;
};

export async function listRecentWorldEventsForGameContextCache(params: {
  since: Date;
  limit?: number;
}): Promise<GameContextCacheRecentWorldEventRow[]> {
  const { since, limit = 100 } = params;
  return asSystem(
    async (c) =>
      c
        .select({
          id: worldEvents.id,
          eventType: worldEvents.eventType,
          description: worldEvents.description,
          dayNumber: worldEvents.dayNumber,
          timestamp: worldEvents.timestamp,
          relatedQuestion: worldEvents.relatedQuestion,
          pointsToward: worldEvents.pointsToward,
        })
        .from(worldEvents)
        .where(gte(worldEvents.timestamp, since))
        .orderBy(desc(worldEvents.timestamp))
        .limit(limit),
    'game-context-cache-world-events'
  );
}
