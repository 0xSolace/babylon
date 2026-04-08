/**
 * RSS feed sources and headline persistence.
 *
 * **Why here:** Keeps `RSSFeedSource` / `RSSHeadline` / `ParodyHeadline` SQL in one
 * module; `RSSFeedService` keeps HTTP, XML parsing, and orchestration.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { asSystem } from './db';
import { parodyHeadlines } from './tables/parody-headlines';
import type { RSSFeedSource } from './tables/rss-feed-sources';
import { rssFeedSources } from './tables/rss-feed-sources';
import type { RSSHeadline } from './tables/rss-headlines';
import { rssHeadlines } from './tables/rss-headlines';
import type { JsonValue } from './types';

export async function listActiveRssFeedSources(): Promise<RSSFeedSource[]> {
  return asSystem(
    async (c) =>
      c.select().from(rssFeedSources).where(eq(rssFeedSources.isActive, true)),
    'rss-feed-list-sources'
  );
}

export async function findRssHeadlineIdByLink(
  link: string
): Promise<string | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: rssHeadlines.id })
      .from(rssHeadlines)
      .where(eq(rssHeadlines.link, link))
      .limit(1);
    return row?.id ?? null;
  }, 'rss-feed-existing-headline');
}

export async function insertRssHeadlineRow(params: {
  sourceId: string;
  title: string;
  link: string | null;
  publishedAt: Date;
  summary: string | null;
  content: string | null;
  rawData: JsonValue;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c.insert(rssHeadlines).values({
        id: await generateSnowflakeId(),
        sourceId: params.sourceId,
        title: params.title,
        link: params.link,
        publishedAt: params.publishedAt,
        summary: params.summary,
        content: params.content,
        rawData: params.rawData,
        fetchedAt: new Date(),
      }),
    'rss-feed-insert-headline'
  );
}

export async function touchRssFeedSourceFetched(
  sourceId: string
): Promise<void> {
  await asSystem(
    async (c) =>
      c
        .update(rssFeedSources)
        .set({
          lastFetched: new Date(),
          fetchErrors: 0,
        })
        .where(eq(rssFeedSources.id, sourceId)),
    'rss-feed-source-fetched'
  );
}

export async function listRssHeadlinesWithoutParody(params: {
  publishedSince: Date;
  limit: number;
}): Promise<RSSHeadline[]> {
  const { publishedSince, limit } = params;
  return asSystem(
    async (c) =>
      c
        .select()
        .from(rssHeadlines)
        .where(
          and(
            gte(rssHeadlines.publishedAt, publishedSince),
            sql`NOT EXISTS (
            SELECT 1 FROM ${parodyHeadlines}
            WHERE ${parodyHeadlines.originalHeadlineId} = ${rssHeadlines.id}
          )`
          )
        )
        .orderBy(desc(rssHeadlines.publishedAt))
        .limit(limit),
    'rss-feed-untransformed'
  );
}

export async function deleteRssHeadlinesPublishedBefore(
  cutoff: Date
): Promise<number> {
  return asSystem(async (c) => {
    const result = await c
      .delete(rssHeadlines)
      .where(lt(rssHeadlines.publishedAt, cutoff))
      .returning({ id: rssHeadlines.id });
    return result.length;
  }, 'rss-feed-cleanup-old');
}
