/**
 * ActorState reads/writes for `NpcMemoryService` (memories, relationships, activity).
 *
 * **Why here:** Keeps optimistic-lock SQL under `asSystem`. JSONB parsing stays in engine
 * and is passed via `parseMemories` / `parseRelationships` callbacks.
 */

import { and, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { NpcMemory, RelationshipState } from './tables/actor-state';
import { actorState } from './tables/actor-state';

export async function fetchActorStateRecentMemoriesJson(
  actorId: string
): Promise<{ recentMemories: unknown } | null> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({ recentMemories: actorState.recentMemories })
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1),
    'npc-memory-get-recent'
  );
  return rows[0] ?? null;
}

export async function fetchActorStateRelationshipsJson(
  actorId: string
): Promise<{ relationships: unknown } | null> {
  const rows = await asSystem(
    async (c) =>
      c
        .select({ relationships: actorState.relationships })
        .from(actorState)
        .where(eq(actorState.id, actorId))
        .limit(1),
    'npc-memory-get-relationship'
  );
  return rows[0] ?? null;
}

export type NpcMemoryAddTransactionResult =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | { kind: 'success'; memoryCount: number; memoryType: NpcMemory['type'] };

export async function runNpcMemoryAddTransaction(params: {
  actorId: string;
  parseMemories: (data: unknown, ctx?: { actorId?: string }) => NpcMemory[];
  buildMemories: (memories: NpcMemory[]) => {
    memories: NpcMemory[];
    memoryCount: number;
    memoryType: NpcMemory['type'];
  };
}): Promise<NpcMemoryAddTransactionResult> {
  const { actorId, parseMemories, buildMemories } = params;
  return asSystem(async (c) => {
    const [state] = await c
      .select({
        recentMemories: actorState.recentMemories,
        updatedAt: actorState.updatedAt,
      })
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1);

    if (!state) {
      return { kind: 'missing' as const };
    }

    const memories = parseMemories(state.recentMemories, { actorId });
    const built = buildMemories(memories);
    const now = new Date();

    const result = await c
      .update(actorState)
      .set({
        recentMemories: built.memories,
        updatedAt: now,
      })
      .where(
        and(
          eq(actorState.id, actorId),
          eq(actorState.updatedAt, state.updatedAt)
        )
      )
      .returning({ id: actorState.id });

    if (result.length === 0) {
      return { kind: 'conflict' as const };
    }

    return {
      kind: 'success' as const,
      memoryCount: built.memoryCount,
      memoryType: built.memoryType,
    };
  }, 'npc-memory-add');
}

export type NpcRelationshipUpdateTransactionResult =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | { kind: 'success'; newSentiment: number | undefined };

export async function runNpcRelationshipUpdateTransaction(params: {
  actorId: string;
  otherActorId: string;
  parseRelationships: (
    data: unknown,
    ctx?: { actorId?: string }
  ) => Record<string, RelationshipState>;
  mutate: (
    relationships: Record<string, RelationshipState>
  ) => Record<string, RelationshipState>;
}): Promise<NpcRelationshipUpdateTransactionResult> {
  const { actorId, otherActorId, parseRelationships, mutate } = params;
  return asSystem(async (c) => {
    const [state] = await c
      .select({
        relationships: actorState.relationships,
        updatedAt: actorState.updatedAt,
      })
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1);

    if (!state) {
      return { kind: 'missing' as const };
    }

    const relationships = parseRelationships(state.relationships, {
      actorId,
    });
    const next = mutate(relationships);
    const now = new Date();

    const result = await c
      .update(actorState)
      .set({
        relationships: next,
        updatedAt: now,
      })
      .where(
        and(
          eq(actorState.id, actorId),
          eq(actorState.updatedAt, state.updatedAt)
        )
      )
      .returning({ id: actorState.id });

    if (result.length === 0) {
      return { kind: 'conflict' as const };
    }

    return {
      kind: 'success' as const,
      newSentiment: next[otherActorId]?.sentiment,
    };
  }, 'npc-memory-update-relationship');
}

export type NpcActivityStateSlice = {
  postsToday: number | null;
  postsTodayResetAt: Date | null;
  updatedAt: Date;
};

export type NpcActivityUpdateTransactionResult =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | { kind: 'success' };

export async function runNpcActivityStateUpdateTransaction(params: {
  actorId: string;
  buildPatch: (state: NpcActivityStateSlice) =>
    | { kind: 'missing' }
    | {
        kind: 'commit';
        set: Partial<{
          lastPostAt: Date;
          lastActiveAt: Date;
          postsToday: number;
          postsTodayResetAt: Date;
          updatedAt: Date;
        }>;
      };
}): Promise<NpcActivityUpdateTransactionResult> {
  const { actorId, buildPatch } = params;
  return asSystem(async (c) => {
    const [state] = await c
      .select({
        postsToday: actorState.postsToday,
        postsTodayResetAt: actorState.postsTodayResetAt,
        updatedAt: actorState.updatedAt,
      })
      .from(actorState)
      .where(eq(actorState.id, actorId))
      .limit(1);

    if (!state) {
      return { kind: 'missing' as const };
    }

    const decision = buildPatch({
      postsToday: state.postsToday,
      postsTodayResetAt: state.postsTodayResetAt,
      updatedAt: state.updatedAt,
    });

    if (decision.kind === 'missing') {
      return { kind: 'missing' as const };
    }

    const now = new Date();
    const setPayload = { ...decision.set, updatedAt: now };

    const result = await c
      .update(actorState)
      .set(setPayload)
      .where(
        and(
          eq(actorState.id, actorId),
          eq(actorState.updatedAt, state.updatedAt)
        )
      )
      .returning({ id: actorState.id });

    if (result.length === 0) {
      return { kind: 'conflict' as const };
    }

    return { kind: 'success' as const };
  }, 'npc-memory-update-activity');
}
