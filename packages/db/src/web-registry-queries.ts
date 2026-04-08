/**
 * SQL for `apps/web` GET /api/registry and GET /api/registry/all.
 */

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { actorFollows } from './tables/actor-follows';
import { actorState } from './tables/actor-state';
import { agentPerformanceMetrics } from './tables/agent-performance-metrics';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { npcTrades } from './tables/npc-trades';
import { pools } from './tables/pools';
import { positions } from './tables/positions';
import { reactions } from './tables/reactions';
import type { User } from './tables/user';
import { users } from './tables/user';

type RegistryDb = DrizzleClient | Transaction;

export type RegistryUserIdCountRow = { userId: string; cnt: number };

export async function selectPositionCountRowsGroupedByUserId(
  db: RegistryDb,
  userIds: string[]
): Promise<RegistryUserIdCountRow[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({
      userId: positions.userId,
      cnt: count(),
    })
    .from(positions)
    .where(inArray(positions.userId, userIds))
    .groupBy(positions.userId);
  return rows.map((r) => ({
    userId: r.userId,
    cnt: Number(r.cnt),
  }));
}

export async function selectCommentCountRowsGroupedByAuthorId(
  db: RegistryDb,
  authorIds: string[]
): Promise<RegistryUserIdCountRow[]> {
  if (authorIds.length === 0) return [];
  const rows = await db
    .select({
      userId: comments.authorId,
      cnt: count(),
    })
    .from(comments)
    .where(inArray(comments.authorId, authorIds))
    .groupBy(comments.authorId);
  return rows.map((r) => ({
    userId: r.userId,
    cnt: Number(r.cnt),
  }));
}

export async function selectReactionCountRowsGroupedByUserId(
  db: RegistryDb,
  userIds: string[]
): Promise<RegistryUserIdCountRow[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({
      userId: reactions.userId,
      cnt: count(),
    })
    .from(reactions)
    .where(inArray(reactions.userId, userIds))
    .groupBy(reactions.userId);
  return rows.map((r) => ({
    userId: r.userId,
    cnt: Number(r.cnt),
  }));
}

export async function selectFollowerCountRowsGroupedByFollowingId(
  db: RegistryDb,
  followingUserIds: string[]
): Promise<RegistryUserIdCountRow[]> {
  if (followingUserIds.length === 0) return [];
  const rows = await db
    .select({
      userId: follows.followingId,
      cnt: count(),
    })
    .from(follows)
    .where(inArray(follows.followingId, followingUserIds))
    .groupBy(follows.followingId);
  return rows.map((r) => ({
    userId: r.userId,
    cnt: Number(r.cnt),
  }));
}

export async function selectFollowingCountRowsGroupedByFollowerId(
  db: RegistryDb,
  followerUserIds: string[]
): Promise<RegistryUserIdCountRow[]> {
  if (followerUserIds.length === 0) return [];
  const rows = await db
    .select({
      userId: follows.followerId,
      cnt: count(),
    })
    .from(follows)
    .where(inArray(follows.followerId, followerUserIds))
    .groupBy(follows.followerId);
  return rows.map((r) => ({
    userId: r.userId,
    cnt: Number(r.cnt),
  }));
}

export async function selectUsersForRegistryAllList(
  db: RegistryDb,
  params: { onChainOnly: boolean; search: string; limit: number }
): Promise<User[]> {
  const filters: SQL[] = [];
  if (params.onChainOnly) {
    filters.push(eq(users.onChainRegistered, true));
  }
  if (params.search) {
    const safe = params.search.replace(/[%_\\]/g, '').trim();
    if (safe.length > 0) {
      const pattern = `%${safe}%`;
      const searchCond = or(
        ilike(users.username, pattern),
        ilike(users.displayName, pattern),
        ilike(users.bio, pattern)
      );
      if (searchCond) {
        filters.push(searchCond);
      }
    }
  }

  const whereExpr =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters);

  if (whereExpr) {
    return db
      .select()
      .from(users)
      .where(whereExpr)
      .orderBy(desc(users.createdAt))
      .limit(params.limit);
  }

  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(params.limit);
}

export async function selectAgentPerformanceMetricsRowsForUserIds(
  db: RegistryDb,
  userIds: string[]
) {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(agentPerformanceMetrics)
    .where(inArray(agentPerformanceMetrics.userId, userIds));
}

export async function selectAllActorStateRows(db: RegistryDb) {
  return db.select().from(actorState);
}

export type RegistryNpcActorIdCountRow = { npcActorId: string; cnt: number };
export type RegistryActorIdCountRow = { actorId: string; cnt: number };

export async function selectPoolCountRowsGroupedByNpcActorId(
  db: RegistryDb,
  npcActorIds: string[]
): Promise<RegistryNpcActorIdCountRow[]> {
  if (npcActorIds.length === 0) return [];
  const rows = await db
    .select({
      npcActorId: pools.npcActorId,
      cnt: count(),
    })
    .from(pools)
    .where(inArray(pools.npcActorId, npcActorIds))
    .groupBy(pools.npcActorId);
  return rows.map((r) => ({
    npcActorId: r.npcActorId,
    cnt: Number(r.cnt),
  }));
}

export async function selectNpcTradeCountRowsGroupedByNpcActorId(
  db: RegistryDb,
  npcActorIds: string[]
): Promise<RegistryNpcActorIdCountRow[]> {
  if (npcActorIds.length === 0) return [];
  const rows = await db
    .select({
      npcActorId: npcTrades.npcActorId,
      cnt: count(),
    })
    .from(npcTrades)
    .where(inArray(npcTrades.npcActorId, npcActorIds))
    .groupBy(npcTrades.npcActorId);
  return rows.map((r) => ({
    npcActorId: r.npcActorId,
    cnt: Number(r.cnt),
  }));
}

export async function selectActorFollowerCountRowsGroupedByFollowingId(
  db: RegistryDb,
  actorIds: string[]
): Promise<RegistryActorIdCountRow[]> {
  if (actorIds.length === 0) return [];
  const rows = await db
    .select({
      actorId: actorFollows.followingId,
      cnt: count(),
    })
    .from(actorFollows)
    .where(inArray(actorFollows.followingId, actorIds))
    .groupBy(actorFollows.followingId);
  return rows.map((r) => ({
    actorId: r.actorId,
    cnt: Number(r.cnt),
  }));
}

export async function selectActorFollowingCountRowsGroupedByFollowerId(
  db: RegistryDb,
  actorIds: string[]
): Promise<RegistryActorIdCountRow[]> {
  if (actorIds.length === 0) return [];
  const rows = await db
    .select({
      actorId: actorFollows.followerId,
      cnt: count(),
    })
    .from(actorFollows)
    .where(inArray(actorFollows.followerId, actorIds))
    .groupBy(actorFollows.followerId);
  return rows.map((r) => ({
    actorId: r.actorId,
    cnt: Number(r.cnt),
  }));
}
