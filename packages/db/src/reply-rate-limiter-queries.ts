/**
 * `UserInteraction` reads/writes for NPC reply rate limiting and streak stats.
 *
 * **Why here:** All `UserInteraction` `where` / `orderBy` live in `@babylon/db`; engine
 * keeps timing windows and streak math.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, desc, eq } from 'drizzle-orm';
import { asSystem } from './db';
import type { UserInteraction } from './tables/user-interactions';
import { userInteractions } from './tables/user-interactions';

export async function fetchLatestUserNpcInteraction(
  userId: string,
  npcId: string
): Promise<UserInteraction | null> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          eq(userInteractions.npcId, npcId)
        )
      )
      .orderBy(desc(userInteractions.timestamp))
      .limit(1);
    return row ?? null;
  }, 'reply-rate-last-interaction');
}

export async function fetchUserNpcInteractionTimestampsForStreak(
  userId: string,
  npcId: string,
  limit: number
): Promise<{ timestamp: Date }[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          timestamp: userInteractions.timestamp,
        })
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.userId, userId),
            eq(userInteractions.npcId, npcId)
          )
        )
        .orderBy(desc(userInteractions.timestamp))
        .limit(limit),
    'reply-rate-streak'
  );
}

export async function insertUserNpcReplyInteraction(params: {
  userId: string;
  npcId: string;
  postId: string;
  commentId: string;
  qualityScore: number;
}): Promise<void> {
  await asSystem(
    async (c) =>
      c.insert(userInteractions).values({
        id: await generateSnowflakeId(),
        userId: params.userId,
        npcId: params.npcId,
        postId: params.postId,
        commentId: params.commentId,
        qualityScore: params.qualityScore,
        timestamp: new Date(),
      }),
    'reply-rate-record'
  );
}

export async function listUserNpcInteractionsDesc(
  userId: string,
  npcId: string
): Promise<UserInteraction[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(userInteractions)
        .where(
          and(
            eq(userInteractions.userId, userId),
            eq(userInteractions.npcId, npcId)
          )
        )
        .orderBy(desc(userInteractions.timestamp)),
    'reply-rate-stats'
  );
}

export async function listUserInteractionsDesc(
  userId: string
): Promise<UserInteraction[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(userInteractions)
        .where(eq(userInteractions.userId, userId))
        .orderBy(desc(userInteractions.timestamp)),
    'reply-rate-all-stats'
  );
}
