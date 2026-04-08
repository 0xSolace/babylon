/**
 * Tag / PostTag / TrendingTag SQL for `tag-service` and trending flows.
 *
 * **Why here:** persistence and reads stay in `@babylon/db` with **`asSystem`** for RLS;
 * LLM extraction, scoring, and logging stay in engine.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, asc, count, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { asSystem, type Transaction } from './db';
import { postTags } from './tables/post-tags';
import { posts } from './tables/posts';
import { tags } from './tables/tags';
import { trendingTags } from './tables/trending-tags';

export type TagInputRow = {
  name: string;
  displayName: string;
  category?: string;
};

export async function storeTagsForPostBundle(
  postId: string,
  generatedTags: TagInputRow[]
): Promise<void> {
  if (generatedTags.length === 0) return;

  await asSystem(async (c) => {
    const tagNames = generatedTags.map((t) => t.name);
    const existingTagsList = await c
      .select()
      .from(tags)
      .where(inArray(tags.name, tagNames));

    const existingTagMap = new Map(
      existingTagsList.map((t) => [t.name, t] as const)
    );

    const tagsToCreate = generatedTags.filter(
      (t) => !existingTagMap.has(t.name)
    );

    if (tagsToCreate.length > 0) {
      const tagIds = await Promise.all(
        tagsToCreate.map(() => generateSnowflakeId())
      );

      const rows = tagsToCreate.map((tag, index) => {
        const tagId = tagIds[index];
        if (!tagId) {
          throw new Error(`Failed to generate tag ID for index ${index}`);
        }
        return {
          id: tagId,
          name: tag.name,
          displayName: tag.displayName,
          category: tag.category ?? null,
          updatedAt: new Date(),
        };
      });

      await c.insert(tags).values(rows).onConflictDoNothing();

      const createdTags = await c
        .select()
        .from(tags)
        .where(
          inArray(
            tags.name,
            tagsToCreate.map((t) => t.name)
          )
        );

      for (const t of createdTags) {
        existingTagMap.set(t.name, t);
      }
    }

    const postTagIds = await Promise.all(
      generatedTags.map(() => generateSnowflakeId())
    );

    const linkRows = generatedTags.map((tag, idx) => {
      const dbTag = existingTagMap.get(tag.name);
      if (!dbTag) {
        throw new Error(`Tag ${tag.name} not found in existing tags`);
      }
      const postTagId = postTagIds[idx];
      if (!postTagId) {
        throw new Error(`Failed to generate post tag ID for index ${idx}`);
      }
      return {
        id: postTagId,
        postId,
        tagId: dbTag.id,
      };
    });

    await c.insert(postTags).values(linkRows).onConflictDoNothing();
  }, 'tag-store-post');
}

export async function fetchTagsForPostWithRelations(postId: string) {
  return asSystem(
    async (c) =>
      c.query.postTags.findMany({
        where: eq(postTags.postId, postId),
        with: {
          tag: true,
        },
        orderBy: asc(postTags.createdAt),
      }),
    'tag-list-for-post'
  );
}

export type TagRow = typeof tags.$inferSelect;
export type PostRow = typeof posts.$inferSelect;

export async function fetchPostsByTagPage(
  tagName: string,
  options: { limit: number; offset: number }
): Promise<{ tag: TagRow | null; posts: PostRow[]; total: number }> {
  const { limit, offset } = options;

  return asSystem(async (c) => {
    const [tag] = await c
      .select()
      .from(tags)
      .where(eq(tags.name, tagName.toLowerCase()))
      .limit(1);

    if (!tag) {
      return { tag: null, posts: [], total: 0 };
    }

    const [postTagsList, totalResult] = await Promise.all([
      c.query.postTags.findMany({
        where: eq(postTags.tagId, tag.id),
        with: { post: true },
        orderBy: desc(postTags.createdAt),
        offset,
        limit,
      }),
      c
        .select({ count: count() })
        .from(postTags)
        .where(eq(postTags.tagId, tag.id)),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const postList = postTagsList
      .map((pt) => pt.post)
      .filter((post): post is NonNullable<typeof post> => post !== null);

    return {
      tag,
      posts: postList,
      total,
    };
  }, 'tag-posts-by-name');
}

export type PostTagStatsWindowRow = {
  createdAt: Date;
  tagId: string;
  tag: {
    id: string;
    name: string;
    displayName: string;
    category: string | null;
  };
  postDeletedAt: Date | null;
};

export async function listPostTagsInWindowForStatistics(
  windowStart: Date,
  windowEnd: Date
): Promise<PostTagStatsWindowRow[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({
        ptCreatedAt: postTags.createdAt,
        tagId: postTags.tagId,
        tagIdCol: tags.id,
        tagName: tags.name,
        tagDisplayName: tags.displayName,
        tagCategory: tags.category,
        postDeletedAt: posts.deletedAt,
      })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(
        and(
          gte(postTags.createdAt, windowStart),
          lte(postTags.createdAt, windowEnd)
        )
      )
      .orderBy(asc(postTags.createdAt));

    return rows.map((r) => ({
      createdAt: r.ptCreatedAt,
      tagId: r.tagId,
      tag: {
        id: r.tagIdCol,
        name: r.tagName,
        displayName: r.tagDisplayName,
        category: r.tagCategory,
      },
      postDeletedAt: r.postDeletedAt,
    }));
  }, 'tag-stats-window');
}

export type TrendingTagInsertRow = {
  id: string;
  tagId: string;
  score: number;
  postCount: number;
  rank: number;
  windowStart: Date;
  windowEnd: Date;
  relatedContext: string | null;
};

export async function insertTrendingTagRows(
  tx: Transaction,
  rows: TrendingTagInsertRow[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(trendingTags).values(rows);
}

export async function fetchCurrentTrendingTagsWithRelations(limit: number) {
  return asSystem(async (c) => {
    const [latestCalculation] = await c
      .select({ calculatedAt: trendingTags.calculatedAt })
      .from(trendingTags)
      .orderBy(desc(trendingTags.calculatedAt))
      .limit(1);

    if (!latestCalculation) {
      return [];
    }

    const cutoffTime = new Date(
      latestCalculation.calculatedAt.getTime() - 1000
    );

    return c.query.trendingTags.findMany({
      where: gte(trendingTags.calculatedAt, cutoffTime),
      with: { tag: true },
      orderBy: asc(trendingTags.rank),
      limit,
    });
  }, 'tag-current-trending');
}

export async function fetchRelatedTagDisplayNames(
  tagId: string,
  limit: number
): Promise<string[]> {
  return asSystem(async (c) => {
    const postsWithTagResult = await c
      .select({ postId: postTags.postId })
      .from(postTags)
      .where(eq(postTags.tagId, tagId))
      .orderBy(desc(postTags.createdAt))
      .limit(100);

    const postIds = postsWithTagResult.map((pt) => pt.postId);

    if (postIds.length === 0) {
      return [];
    }

    const coOccurringPostTags = await c
      .select({ coTagId: postTags.tagId })
      .from(postTags)
      .where(and(inArray(postTags.postId, postIds), ne(postTags.tagId, tagId)));

    const tagCounts = new Map<string, number>();
    for (const pt of coOccurringPostTags) {
      tagCounts.set(pt.coTagId, (tagCounts.get(pt.coTagId) || 0) + 1);
    }

    const sortedTagIds = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (sortedTagIds.length === 0) {
      return [];
    }

    const tagsList = await c
      .select({ id: tags.id, displayName: tags.displayName })
      .from(tags)
      .where(inArray(tags.id, sortedTagIds));

    const tagMap = new Map(tagsList.map((t) => [t.id, t.displayName]));
    return sortedTagIds
      .map((id) => tagMap.get(id))
      .filter((name): name is string => name !== undefined);
  }, 'tag-related-names');
}
