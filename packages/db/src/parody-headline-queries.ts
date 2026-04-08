/**
 * Parody headline persistence and listing.
 *
 * **Why here:** `ParodyHeadline` insert/update/select lives under `asSystem`; engine
 * keeps LLM prompts and `characterMappingService` orchestration.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { desc, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import type { ParodyHeadline } from './tables/parody-headlines';
import { parodyHeadlines } from './tables/parody-headlines';
import type { JsonValue } from './types';

export async function insertParodyHeadlineRow(params: {
  originalHeadlineId: string;
  originalTitle: string;
  originalSource: string;
  parodyTitle: string;
  parodyContent: string | null;
  characterMappings: JsonValue;
  organizationMappings: JsonValue;
}): Promise<ParodyHeadline | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .insert(parodyHeadlines)
      .values({
        id: await generateSnowflakeId(),
        originalHeadlineId: params.originalHeadlineId,
        originalTitle: params.originalTitle,
        originalSource: params.originalSource,
        parodyTitle: params.parodyTitle,
        parodyContent: params.parodyContent,
        characterMappings: params.characterMappings,
        organizationMappings: params.organizationMappings,
        generatedAt: new Date(),
      })
      .returning();
    return row ?? null;
  }, 'parody-headline-insert');
}

export async function listParodyHeadlinesGeneratedSince(
  since: Date
): Promise<ParodyHeadline[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(parodyHeadlines)
        .where(gte(parodyHeadlines.generatedAt, since))
        .orderBy(desc(parodyHeadlines.generatedAt)),
    'parody-headline-recent'
  );
}

export async function markParodyHeadlinesUsed(
  parodyIds: string[]
): Promise<void> {
  if (parodyIds.length === 0) return;
  await asSystem(
    async (c) =>
      c
        .update(parodyHeadlines)
        .set({
          isUsed: true,
          usedAt: new Date(),
        })
        .where(inArray(parodyHeadlines.id, parodyIds)),
    'parody-headline-mark-used'
  );
}
