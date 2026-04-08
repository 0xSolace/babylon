/**
 * Reads/writes for `FollowingMechanics` (NPC follow probability, proactive follows, unfollow sweeps).
 *
 * **Why here:** System/cron paths use `asSystem`; SQL stays in `@babylon/db`.
 * Streak/quality math, shuffling, and config thresholds stay in `packages/engine`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, asc, count, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import type { FollowStatus } from './tables/follow-statuses';
import { followStatuses } from './tables/follow-statuses';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { users } from './tables/user';
import { userInteractions } from './tables/user-interactions';

export async function fetchFollowingChanceContext(params: {
  userId: string;
  npcId: string;
}): Promise<{
  followRow: FollowStatus | undefined;
  interactions: { qualityScore: number }[];
}> {
  const { userId, npcId } = params;

  return asSystem(async (c) => {
    const [followRow] = await c
      .select()
      .from(followStatuses)
      .where(
        and(eq(followStatuses.userId, userId), eq(followStatuses.npcId, npcId))
      )
      .limit(1);

    const interactions = await c
      .select({
        qualityScore: userInteractions.qualityScore,
      })
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          eq(userInteractions.npcId, npcId)
        )
      );

    return { followRow, interactions };
  }, 'following-mechanics-calculate-chance');
}

export async function upsertNpcFollowAndMarkInteractions(params: {
  userId: string;
  npcId: string;
  reason: string;
}): Promise<void> {
  const { userId, npcId, reason } = params;

  await asSystem(async (c) => {
    const existing = await c
      .select({ id: followStatuses.id })
      .from(followStatuses)
      .where(
        and(eq(followStatuses.userId, userId), eq(followStatuses.npcId, npcId))
      )
      .limit(1);

    if (existing.length > 0) {
      await c
        .update(followStatuses)
        .set({
          isActive: true,
          followedAt: new Date(),
          unfollowedAt: null,
          followReason: reason,
        })
        .where(
          and(
            eq(followStatuses.userId, userId),
            eq(followStatuses.npcId, npcId)
          )
        );
    } else {
      await c.insert(followStatuses).values({
        id: await generateSnowflakeId(),
        userId,
        npcId,
        followReason: reason,
      });
    }

    await c
      .update(userInteractions)
      .set({ wasFollowed: true })
      .where(
        and(
          eq(userInteractions.userId, userId),
          eq(userInteractions.npcId, npcId)
        )
      );
  }, 'following-mechanics-record-follow');
}

export async function fetchNpcFollowActive(
  userId: string,
  npcId: string
): Promise<boolean> {
  const follow = await asSystem(
    async (c) =>
      c
        .select({ isActive: followStatuses.isActive })
        .from(followStatuses)
        .where(
          and(
            eq(followStatuses.userId, userId),
            eq(followStatuses.npcId, npcId)
          )
        )
        .limit(1),
    'following-mechanics-is-following'
  );

  return follow[0]?.isActive ?? false;
}

export async function listActiveNpcFollowRowsForUser(
  userId: string
): Promise<FollowStatus[]> {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(followStatuses)
        .where(
          and(
            eq(followStatuses.userId, userId),
            eq(followStatuses.isActive, true)
          )
        )
        .orderBy(desc(followStatuses.followedAt)),
    'following-mechanics-get-followers'
  );
}

export async function deactivateNpcFollow(params: {
  userId: string;
  npcId: string;
}): Promise<void> {
  const { userId, npcId } = params;

  await asSystem(
    async (c) =>
      c
        .update(followStatuses)
        .set({
          isActive: false,
          unfollowedAt: new Date(),
        })
        .where(
          and(
            eq(followStatuses.userId, userId),
            eq(followStatuses.npcId, npcId),
            eq(followStatuses.isActive, true)
          )
        ),
    'following-mechanics-unfollow'
  );
}

export async function listRecentUserNpcInteractionSlice(params: {
  userId: string;
  npcId: string;
  limit: number;
}): Promise<{ qualityScore: number; timestamp: Date }[]> {
  const { userId, npcId, limit } = params;

  return asSystem(
    async (c) =>
      c
        .select({
          qualityScore: userInteractions.qualityScore,
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
    'following-mechanics-should-unfollow'
  );
}

export type FollowingMechanicsActivePlayerRow = {
  userId: string;
  username: string | null;
  postCount: number;
};

export async function listFollowingMechanicsActivePlayerRows(params: {
  since: Date;
  minPosts: number;
  limit: number;
}): Promise<FollowingMechanicsActivePlayerRow[]> {
  const { since, minPosts, limit } = params;

  const rows = await asSystem(
    async (c) =>
      c
        .select({
          userId: users.id,
          username: users.username,
          postCount: count(posts.id),
        })
        .from(users)
        .innerJoin(posts, eq(posts.authorId, users.id))
        .where(and(gte(posts.timestamp, since), eq(users.isActor, false)))
        .groupBy(users.id, users.username)
        .having(gte(count(posts.id), minPosts))
        .limit(limit),
    'following-mechanics-active-players'
  );

  return rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    postCount: Number(r.postCount),
  }));
}

export type FollowingMechanicsReactionCountRow = {
  userId: string;
  reactionCount: number;
};

export async function listFollowingMechanicsReactionCountsSince(params: {
  userIds: string[];
  since: Date;
}): Promise<FollowingMechanicsReactionCountRow[]> {
  const { userIds, since } = params;
  if (userIds.length === 0) return [];

  const rows = await asSystem(
    async (c) =>
      c
        .select({
          userId: reactions.userId,
          reactionCount: count(reactions.id),
        })
        .from(reactions)
        .where(
          and(
            inArray(reactions.userId, userIds),
            gte(reactions.createdAt, since)
          )
        )
        .groupBy(reactions.userId),
    'following-mechanics-reaction-counts'
  );

  return rows.map((r) => ({
    userId: r.userId,
    reactionCount: Number(r.reactionCount),
  }));
}

export type FollowingMechanicsFollowPairRow = {
  userId: string;
  npcId: string;
};

export async function listFollowingMechanicsActiveFollowPairs(params: {
  userIds: string[];
}): Promise<FollowingMechanicsFollowPairRow[]> {
  const { userIds } = params;
  if (userIds.length === 0) return [];

  return asSystem(
    async (c) =>
      c
        .select({
          userId: followStatuses.userId,
          npcId: followStatuses.npcId,
        })
        .from(followStatuses)
        .where(
          and(
            inArray(followStatuses.userId, userIds),
            eq(followStatuses.isActive, true)
          )
        ),
    'following-mechanics-existing-follows'
  );
}

export type FollowingMechanicsEngagementCountRow = {
  userId: string;
  authorId: string;
  engagementCount: number;
};

export async function listFollowingMechanicsEngagementCounts(params: {
  userIds: string[];
  authorIds: string[];
  since: Date;
}): Promise<FollowingMechanicsEngagementCountRow[]> {
  const { userIds, authorIds, since } = params;
  if (userIds.length === 0 || authorIds.length === 0) return [];

  const rows = await asSystem(
    async (c) =>
      c
        .select({
          userId: reactions.userId,
          authorId: posts.authorId,
          engagementCount: count(reactions.id),
        })
        .from(reactions)
        .innerJoin(posts, eq(posts.id, reactions.postId))
        .where(
          and(
            inArray(reactions.userId, userIds),
            inArray(posts.authorId, authorIds),
            gte(reactions.createdAt, since)
          )
        )
        .groupBy(reactions.userId, posts.authorId),
    'following-mechanics-engagement-counts'
  );

  return rows.map((r) => ({
    userId: r.userId,
    authorId: r.authorId,
    engagementCount: Number(r.engagementCount),
  }));
}

export async function countFollowingMechanicsActiveFollows(): Promise<number> {
  const countResult = await asSystem(
    async (c) =>
      c
        .select({ total: count(followStatuses.id) })
        .from(followStatuses)
        .where(eq(followStatuses.isActive, true)),
    'following-mechanics-unfollow-count'
  );

  return Number(countResult[0]?.total ?? 0);
}

export type FollowingMechanicsActiveFollowBatchRow = {
  id: string;
  userId: string;
  npcId: string;
};

export async function listFollowingMechanicsActiveFollowBatch(params: {
  batchSize: number;
  offset: number;
}): Promise<FollowingMechanicsActiveFollowBatchRow[]> {
  const { batchSize, offset } = params;

  return asSystem(
    async (c) =>
      c
        .select({
          id: followStatuses.id,
          userId: followStatuses.userId,
          npcId: followStatuses.npcId,
        })
        .from(followStatuses)
        .where(eq(followStatuses.isActive, true))
        .orderBy(asc(followStatuses.id))
        .limit(batchSize)
        .offset(offset),
    'following-mechanics-active-follows-batch'
  );
}

export type FollowingMechanicsUnfollowInteractionRow = {
  userId: string;
  npcId: string;
  qualityScore: number;
  timestamp: Date;
};

export async function listFollowingMechanicsInteractionsForUnfollowSweep(params: {
  userIds: string[];
  npcIds: string[];
  since: Date;
  limit: number;
}): Promise<FollowingMechanicsUnfollowInteractionRow[]> {
  const { userIds, npcIds, since, limit } = params;
  if (userIds.length === 0 || npcIds.length === 0) return [];

  return asSystem(
    async (c) =>
      c
        .select({
          userId: userInteractions.userId,
          npcId: userInteractions.npcId,
          qualityScore: userInteractions.qualityScore,
          timestamp: userInteractions.timestamp,
        })
        .from(userInteractions)
        .where(
          and(
            inArray(userInteractions.userId, userIds),
            inArray(userInteractions.npcId, npcIds),
            gte(userInteractions.timestamp, since)
          )
        )
        .orderBy(desc(userInteractions.timestamp))
        .limit(limit),
    'following-mechanics-unfollow-interactions'
  );
}
