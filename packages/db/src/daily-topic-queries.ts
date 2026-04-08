/**
 * Daily topic persistence — all Drizzle queries for DailyTopic / RSS / parody windows.
 *
 * **Why this file exists:** Engine and cron should not own ad-hoc `where` clauses for
 * these tables; one module makes RLS, indexes, and behavior changes auditable.
 *
 * **Why `asSystem`:** Topic recompute and candidate listing run without a logged-in
 * user; Postgres RLS must see the `system` principal (see `asSystem` in `db.ts`).
 */

import { generateSnowflakeId } from '@babylon/shared';
import { desc, eq, gte, lt } from 'drizzle-orm';
import { asSystem } from './db';
import type { DailyTopic, DailyTopicSourceType } from './tables/daily-topics';
import { dailyTopics } from './tables/daily-topics';
import { parodyHeadlines } from './tables/parody-headlines';
import { rssHeadlines } from './tables/rss-headlines';

export type UpsertDailyTopicRowInput = {
  date: Date;
  topicKey: string;
  topicLabel: string;
  summary: string;
  sourceType: DailyTopicSourceType;
  sourceHeadlineIds: string[];
  selectionReason: string | null;
  isLocked: boolean;
};

export async function listRssHeadlinesForDailyTopicCandidates(
  since: Date,
  limit = 50
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(rssHeadlines)
        .where(gte(rssHeadlines.publishedAt, since))
        .orderBy(desc(rssHeadlines.publishedAt))
        .limit(limit),
    'daily-topic-recent-rss'
  );
}

export async function listParodyHeadlinesForDailyTopicCandidates(
  since: Date,
  limit = 25
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(parodyHeadlines)
        .where(gte(parodyHeadlines.generatedAt, since))
        .orderBy(desc(parodyHeadlines.generatedAt))
        .limit(limit),
    'daily-topic-recent-parodies'
  );
}

export async function fetchDailyTopicByNormalizedDate(
  normalizedDate: Date
): Promise<DailyTopic | null> {
  return asSystem(async (c) => {
    const rows = await c
      .select()
      .from(dailyTopics)
      .where(eq(dailyTopics.date, normalizedDate))
      .limit(1);
    return rows[0] ?? null;
  }, 'daily-topic-for-date');
}

export async function fetchPreviousDailyTopicBeforeDate(
  normalizedDate: Date
): Promise<DailyTopic | null> {
  return asSystem(async (c) => {
    const rows = await c
      .select()
      .from(dailyTopics)
      .where(lt(dailyTopics.date, normalizedDate))
      .orderBy(desc(dailyTopics.date))
      .limit(1);
    return rows[0] ?? null;
  }, 'daily-topic-previous');
}

export async function deleteDailyTopicById(id: string): Promise<void> {
  await asSystem(async (c) => {
    await c.delete(dailyTopics).where(eq(dailyTopics.id, id));
  }, 'daily-topic-delete-by-id');
}

export async function upsertDailyTopicRow(
  input: UpsertDailyTopicRowInput
): Promise<DailyTopic> {
  const updatedAt = new Date();
  const topic = await asSystem(async (c) => {
    const rows = await c
      .insert(dailyTopics)
      .values({
        id: await generateSnowflakeId(),
        date: input.date,
        topicKey: input.topicKey,
        topicLabel: input.topicLabel,
        summary: input.summary,
        sourceType: input.sourceType,
        sourceHeadlineIds: input.sourceHeadlineIds,
        selectionReason: input.selectionReason,
        isLocked: input.isLocked,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: dailyTopics.date,
        set: {
          topicKey: input.topicKey,
          topicLabel: input.topicLabel,
          summary: input.summary,
          sourceType: input.sourceType,
          sourceHeadlineIds: input.sourceHeadlineIds,
          selectionReason: input.selectionReason,
          isLocked: input.isLocked,
          updatedAt,
        },
      })
      .returning();
    return rows[0] ?? null;
  }, 'daily-topic-upsert');

  if (!topic) {
    throw new Error(
      `Failed to store daily topic for ${input.date.toISOString()}`
    );
  }

  return topic;
}
