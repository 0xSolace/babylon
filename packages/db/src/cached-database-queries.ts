/**
 * Drizzle queries backing `@babylon/api` `CachedDatabaseService`.
 *
 * **Why here:** Keeps `drizzle-orm` out of `packages/api` for these read paths.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Market, Post, User } from './model-types';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { markets } from './tables/markets';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { tags } from './tables/tags';
import { trendingTags } from './tables/trending-tags';
import { users } from './tables/user';
import { userActorFollows } from './tables/user-actor-follows';

type CachedDbExecutor = DrizzleClient | Transaction;

export async function selectTestUserIdsAmongFollowed(
  client: CachedDbExecutor,
  followedIds: string[]
): Promise<string[]> {
  if (followedIds.length === 0) return [];
  const rows = await client
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, followedIds), eq(users.isTest, true)));
  return rows.map((r) => r.id);
}

export async function selectPostsForFollowingFeed(
  client: CachedDbExecutor,
  params: {
    nonTestFollowedIds: string[];
    limit: number;
    cursor?: string;
    offset: number;
    now: Date;
  }
): Promise<Post[]> {
  const { nonTestFollowedIds, limit, cursor, offset, now } = params;
  if (nonTestFollowedIds.length === 0) return [];

  const conditions = [
    inArray(posts.authorId, nonTestFollowedIds),
    isNull(posts.deletedAt),
  ];

  if (cursor) {
    conditions.push(lt(posts.timestamp, new Date(cursor)));
    conditions.push(lte(posts.timestamp, now));
  } else {
    conditions.push(lte(posts.timestamp, now));
  }

  return client
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.timestamp))
    .limit(limit)
    .offset(cursor ? 0 : offset);
}

export async function selectUserRowById(
  client: CachedDbExecutor,
  userId: string
): Promise<User | undefined> {
  const [row] = await client
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUserRowsByIds(
  client: CachedDbExecutor,
  ids: string[]
): Promise<User[]> {
  if (ids.length === 0) return [];
  return client.select().from(users).where(inArray(users.id, ids));
}

export async function selectUserBalanceRow(
  client: CachedDbExecutor,
  userId: string
): Promise<
  | {
      virtualBalance: string;
      totalDeposited: string;
      totalWithdrawn: string;
      lifetimePnL: string;
    }
  | undefined
> {
  const [row] = await client
    .select({
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type CachedUserProfileStats = {
  followers: number;
  following: number;
  positions: number;
  comments: number;
  reactions: number;
  posts: number;
};

export async function fetchCachedUserProfileStats(
  client: CachedDbExecutor,
  userId: string
): Promise<CachedUserProfileStats> {
  const [
    followersResult,
    followingResult,
    actorFollowsResult,
    positionsResult,
    commentsResult,
    reactionsResult,
    postCountResult,
  ] = await Promise.all([
    client
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, userId)),

    client
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId)),

    client
      .select({ count: count() })
      .from(userActorFollows)
      .where(eq(userActorFollows.userId, userId)),

    client
      .select({ count: count() })
      .from(positions)
      .where(eq(positions.userId, userId)),

    client
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.authorId, userId)),

    client
      .select({ count: count() })
      .from(reactions)
      .where(eq(reactions.userId, userId)),

    client
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.authorId, userId)),
  ]);

  const followers = Number(followersResult[0]?.count ?? 0);
  const following = Number(followingResult[0]?.count ?? 0);
  const actorFollows = Number(actorFollowsResult[0]?.count ?? 0);

  return {
    followers,
    following: following + actorFollows,
    positions: Number(positionsResult[0]?.count ?? 0),
    comments: Number(commentsResult[0]?.count ?? 0),
    reactions: Number(reactionsResult[0]?.count ?? 0),
    posts: Number(postCountResult[0]?.count ?? 0),
  };
}

export async function selectActiveUnresolvedMarkets(
  client: CachedDbExecutor
): Promise<Market[]> {
  return client
    .select()
    .from(markets)
    .where(eq(markets.resolved, false))
    .orderBy(desc(markets.createdAt));
}

export async function selectTrendingTagsWithTag(
  client: CachedDbExecutor,
  limit: number
) {
  return client
    .select({
      id: trendingTags.id,
      tagId: trendingTags.tagId,
      rank: trendingTags.rank,
      score: trendingTags.score,
      postCount: trendingTags.postCount,
      calculatedAt: trendingTags.calculatedAt,
      tag: {
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      },
    })
    .from(trendingTags)
    .leftJoin(tags, eq(trendingTags.tagId, tags.id))
    .limit(limit)
    .orderBy(asc(trendingTags.rank));
}
