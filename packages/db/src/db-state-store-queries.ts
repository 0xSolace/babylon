/**
 * Reads/writes for `DbStateStore` (game tick simulation state).
 *
 * **Why here:** Keeps question/market/post/world-event SQL under `asSystem`.
 */

import { and, eq, lte } from 'drizzle-orm';
import { asSystem } from './db';
import { markets } from './tables/markets';
import { posts } from './tables/posts';
import { questions } from './tables/questions';
import { worldEvents } from './tables/world-events';

export async function fetchDbStateStoreActiveQuestionRows() {
  return asSystem(
    async (c) =>
      c.select().from(questions).where(eq(questions.status, 'active')),
    'db-state-store-active-questions'
  );
}

export async function fetchDbStateStoreQuestionsToResolveRows(
  beforeTime: Date
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.status, 'active'),
            lte(questions.resolutionDate, beforeTime)
          )
        ),
    'db-state-store-questions-to-resolve'
  );
}

export async function insertDbStateStoreQuestionRow(params: {
  id: string;
  questionNumber: number;
  text: string;
  resolutionDate: Date;
  scenarioId: number;
}): Promise<void> {
  const { id, questionNumber, text, resolutionDate, scenarioId } = params;
  await asSystem(
    async (c) =>
      c.insert(questions).values({
        id,
        questionNumber,
        text,
        status: 'active',
        outcome: false,
        rank: 1,
        resolutionDate,
        scenarioId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    'db-state-store-create-question'
  );
}

export async function updateDbStateStoreQuestionResolved(
  questionId: string,
  outcome: boolean
): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(questions)
        .set({
          status: 'resolved',
          outcome,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, questionId)),
    'db-state-store-resolve-question'
  );
}

export async function fetchDbStateStoreActiveMarketRows() {
  return asSystem(
    async (c) => c.select().from(markets).where(eq(markets.resolved, false)),
    'db-state-store-active-markets'
  );
}

export async function insertDbStateStorePostRow(params: {
  id: string;
  authorId: string;
  content: string;
  type: string;
  timestamp: Date;
  gameId: string;
}): Promise<void> {
  const { id, authorId, content, type, timestamp, gameId } = params;
  await asSystem(
    async (c) =>
      c.insert(posts).values({
        id,
        authorId,
        content,
        type,
        timestamp,
        gameId,
      }),
    'db-state-store-create-post'
  );
}

export async function insertDbStateStoreWorldEventRow(params: {
  id: string;
  eventType: string;
  description: string;
  dayNumber: number;
  actors: string[];
  visibility: string;
  pointsToward?: string;
  relatedQuestion?: number;
}): Promise<void> {
  const {
    id,
    eventType,
    description,
    dayNumber,
    actors,
    visibility,
    pointsToward,
    relatedQuestion,
  } = params;
  await asSystem(
    async (c) =>
      c.insert(worldEvents).values({
        id,
        eventType,
        description,
        dayNumber,
        actors,
        visibility,
        pointsToward,
        relatedQuestion,
        timestamp: new Date(),
      }),
    'db-state-store-create-event'
  );
}
