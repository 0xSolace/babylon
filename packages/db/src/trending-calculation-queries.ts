/**
 * Trending tag snapshots and tag name lookups for cron + prompt context.
 *
 * **Why here:** `TrendingTag` / `Tag` SQL moves out of engine; scoring stays in
 * `trending-calculation-service` and `tag-service`.
 */

import { desc, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { tags } from './tables/tags';
import { trendingTags } from './tables/trending-tags';

export async function fetchLatestTrendingTagsCalculatedAt(): Promise<Date | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ calculatedAt: trendingTags.calculatedAt })
      .from(trendingTags)
      .orderBy(desc(trendingTags.calculatedAt))
      .limit(1);
    return row?.calculatedAt ?? null;
  }, 'trending-last-calculation');
}

export type TrendingTagPromptRow = {
  tagId: string;
  score: number;
  postCount: number;
  rank: number;
  relatedContext: string | null;
};

export async function listTrendingTagPromptRows(
  limit: number
): Promise<TrendingTagPromptRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          tagId: trendingTags.tagId,
          score: trendingTags.score,
          postCount: trendingTags.postCount,
          rank: trendingTags.rank,
          relatedContext: trendingTags.relatedContext,
        })
        .from(trendingTags)
        .orderBy(trendingTags.rank)
        .limit(limit),
    'trending-prompt-context'
  );
}

export type TagNameRow = {
  id: string;
  name: string;
  displayName: string;
};

export async function fetchTagNameRowsByIds(
  tagIds: string[]
): Promise<TagNameRow[]> {
  if (tagIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: tags.id,
          name: tags.name,
          displayName: tags.displayName,
        })
        .from(tags)
        .where(inArray(tags.id, tagIds)),
    'trending-tag-details'
  );
}
