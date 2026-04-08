/**
 * WorldFact table reads/writes for game generation context.
 *
 * **Why here:** Keeps all `WorldFact` SQL in `@babylon/db` under `asSystem` for RLS
 * consistent with other engine-adjacent cron/system paths.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, desc, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { WorldFact } from './tables/world-facts';
import { worldFacts } from './tables/world-facts';

export async function listActiveWorldFactsByCreatedDesc(
  limit: number
): Promise<WorldFact[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(worldFacts)
        .where(eq(worldFacts.isActive, true))
        .orderBy(desc(worldFacts.createdAt))
        .limit(limit),
    'world-facts-list-active'
  );
}

export async function insertDynamicWorldFact(params: {
  key: string;
  label: string;
  value: string;
}): Promise<WorldFact> {
  const now = new Date();
  return asSystem(async (c) => {
    const [row] = await c
      .insert(worldFacts)
      .values({
        id: await generateSnowflakeId(),
        category: 'general',
        key: params.key,
        label: params.label,
        value: params.value,
        source: 'dynamic',
        priority: 0,
        lastUpdated: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error('WorldFact insert returned no row');
    }
    return row;
  }, 'world-facts-add-dynamic');
}

export async function fetchWorldFactByCategoryAndKey(
  category: string,
  key: string
): Promise<WorldFact | null> {
  return asSystem(async (c) => {
    const [fact] = await c
      .select()
      .from(worldFacts)
      .where(and(eq(worldFacts.category, category), eq(worldFacts.key, key)))
      .limit(1);
    return fact ?? null;
  }, 'world-facts-get-by-key');
}

export async function updateWorldFactByIdForDefaultSet(params: {
  id: string;
  label: string;
  value: string;
}): Promise<WorldFact> {
  const now = new Date();
  return asSystem(async (c) => {
    const [updated] = await c
      .update(worldFacts)
      .set({
        label: params.label,
        value: params.value,
        source: 'default',
        priority: 0,
        lastUpdated: now,
        updatedAt: now,
      })
      .where(eq(worldFacts.id, params.id))
      .returning();
    if (!updated) {
      throw new Error('WorldFact update returned no row');
    }
    return updated;
  }, 'world-facts-set-by-value-update');
}

export async function insertDefaultWorldFact(params: {
  key: string;
  label: string;
  value: string;
}): Promise<WorldFact> {
  const now = new Date();
  return asSystem(async (c) => {
    const [created] = await c
      .insert(worldFacts)
      .values({
        id: await generateSnowflakeId(),
        category: 'general',
        key: params.key,
        label: params.label,
        value: params.value,
        source: 'default',
        priority: 0,
        lastUpdated: now,
        updatedAt: now,
      })
      .returning();
    if (!created) {
      throw new Error('WorldFact insert returned no row');
    }
    return created;
  }, 'world-facts-set-by-value-insert');
}

export async function fetchWorldFactById(
  id: string
): Promise<WorldFact | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(worldFacts)
      .where(eq(worldFacts.id, id))
      .limit(1);
    return row ?? null;
  }, 'world-facts-update-by-id-load');
}

export async function updateWorldFactValueById(params: {
  id: string;
  label: string;
  value: string;
}): Promise<WorldFact> {
  const now = new Date();
  return asSystem(async (c) => {
    const [updated] = await c
      .update(worldFacts)
      .set({
        label: params.label,
        value: params.value,
        lastUpdated: now,
        updatedAt: now,
      })
      .where(eq(worldFacts.id, params.id))
      .returning();
    if (!updated) {
      throw new Error('WorldFact update returned no row');
    }
    return updated;
  }, 'world-facts-update-by-id');
}

export async function deleteWorldFactById(id: string): Promise<void> {
  await asSystem(
    async (c) => c.delete(worldFacts).where(eq(worldFacts.id, id)),
    'world-facts-delete'
  );
}

export async function toggleWorldFactActiveById(
  id: string
): Promise<WorldFact> {
  return asSystem(async (c) => {
    const [fact] = await c
      .select()
      .from(worldFacts)
      .where(eq(worldFacts.id, id))
      .limit(1);
    if (!fact) {
      throw new Error('Fact not found');
    }

    const [upd] = await c
      .update(worldFacts)
      .set({ isActive: !fact.isActive })
      .where(eq(worldFacts.id, id))
      .returning();
    if (!upd) {
      throw new Error('WorldFact toggle returned no row');
    }
    return upd;
  }, 'world-facts-toggle-active');
}
