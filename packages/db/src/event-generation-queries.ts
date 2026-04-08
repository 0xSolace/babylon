/**
 * World event writes / arc-pulse reads for `event-generation-helpers`.
 *
 * **Why here:** Keeps `WorldEvent` SQL under `asSystem`.
 */

import { and, desc, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import {
  createWorldEventRow,
  type WorldEvent,
  worldEvents,
} from './tables/world-events';

export type CreateWorldEventRowInput = Parameters<
  typeof createWorldEventRow
>[1];

/** Same validation/INT4 guards as `createWorldEventRow`; runs under **`asSystem`**. */
export async function createWorldEventRowAsSystem(
  event: CreateWorldEventRowInput
): Promise<WorldEvent> {
  return asSystem(
    async (c) => createWorldEventRow(c, event),
    'world-event-insert-as-system'
  );
}

export async function insertWorldEventFromEventGeneration(params: {
  id: string;
  eventType: string;
  description: string;
  actors: string[];
  relatedQuestion?: number;
  visibility: string;
  gameId: string;
  dayNumber?: number;
  timestamp: Date;
  pointsToward?: string | null;
}): Promise<void> {
  await asSystem(async (c) => {
    await createWorldEventRow(c, {
      id: params.id,
      eventType: params.eventType,
      description: params.description,
      actors: params.actors,
      relatedQuestion: params.relatedQuestion,
      visibility: params.visibility,
      gameId: params.gameId,
      dayNumber: params.dayNumber,
      timestamp: params.timestamp,
      pointsToward: params.pointsToward ?? undefined,
    });
  }, 'event-generation-insert');
}

export type ArcPulseWorldEventRow = {
  relatedQuestion: number | null;
  timestamp: Date;
};

export async function listWorldEventsForArcPulseLookback(params: {
  questionNumbers: number[];
  lookbackDate: Date;
}): Promise<ArcPulseWorldEventRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          relatedQuestion: worldEvents.relatedQuestion,
          timestamp: worldEvents.timestamp,
        })
        .from(worldEvents)
        .where(
          and(
            inArray(worldEvents.relatedQuestion, params.questionNumbers),
            gte(worldEvents.timestamp, params.lookbackDate)
          )
        )
        .orderBy(desc(worldEvents.timestamp)),
    'event-generation-arc-pulse-recent'
  );
}
