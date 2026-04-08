/**
 * ActorState reads/writes for `npc-running-bit-service` (running bit memories).
 *
 * **Why here:** Replaces repository `findMany` / `create` / `updateMany` under `asSystem`.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { asSystem } from './db';
import type { NpcMemory } from './tables/actor-state';
import { actorState } from './tables/actor-state';

export type RunningBitActorStateRow = {
  id: string;
  recentMemories: unknown;
  updatedAt: Date;
};

export async function findActorStatesForRunningBit(
  actorIds: string[]
): Promise<RunningBitActorStateRow[]> {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: actorState.id,
          recentMemories: actorState.recentMemories,
          updatedAt: actorState.updatedAt,
        })
        .from(actorState)
        .where(inArray(actorState.id, actorIds)),
    'npc-running-bit-find-states'
  );
}

export async function insertActorStateForRunningBit(params: {
  id: string;
  now: Date;
}): Promise<void> {
  const { id, now } = params;
  await asSystem(async (c) => {
    await c.insert(actorState).values({
      id,
      tradingBalance: '10000',
      reputationPoints: 10000,
      hasPool: false,
      postsToday: 0,
      currentMood: '0',
      recentMemories: sql`'[]'::jsonb`,
      relationships: sql`'{}'::jsonb`,
      createdAt: now,
      updatedAt: now,
    });
  }, 'npc-running-bit-create-state');
}

export async function updateActorStateRecentMemoriesOptimistic(params: {
  actorId: string;
  memories: NpcMemory[];
  now: Date;
  expectedUpdatedAt: Date;
}): Promise<number> {
  const { actorId, memories, now, expectedUpdatedAt } = params;
  return asSystem(async (c) => {
    const result = await c
      .update(actorState)
      .set({
        recentMemories: memories,
        updatedAt: now,
      })
      .where(
        and(
          eq(actorState.id, actorId),
          eq(actorState.updatedAt, expectedUpdatedAt)
        )
      )
      .returning({ id: actorState.id });
    return result.length;
  }, 'npc-running-bit-update-optimistic');
}

export async function updateActorStateRecentMemoriesUnconditional(params: {
  actorId: string;
  memories: NpcMemory[];
  now: Date;
}): Promise<void> {
  const { actorId, memories, now } = params;
  await asSystem(async (c) => {
    await c
      .update(actorState)
      .set({
        recentMemories: memories,
        updatedAt: now,
      })
      .where(eq(actorState.id, actorId));
  }, 'npc-running-bit-update-fallback');
}
