/**
 * Drizzle for `@babylon/api` `whitelist-service` (access, CRUD, config, cron).
 */

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftSnapshot } from './tables/nft-snapshot';
import { users } from './tables/user';
import { whitelistConfig } from './tables/whitelist-config';
import { whitelist } from './tables/whitelist-entries';

type WlDb = DrizzleClient | Transaction;

export type WhitelistSourceValue =
  | 'snapshot_first_100'
  | 'admin_manual'
  | 'leaderboard';

export async function selectActiveWhitelistExists(
  client: WlDb,
  userId: string
): Promise<boolean> {
  const [row] = await client
    .select({ id: whitelist.id })
    .from(whitelist)
    .where(and(eq(whitelist.userId, userId), isNull(whitelist.revokedAt)))
    .limit(1);
  return Boolean(row);
}

export type WhitelistLeaderboardUserSlice = {
  id: string;
  reputationPoints: number;
  invitePoints: number;
  createdAt: Date;
  isActor: boolean;
  isAgent: boolean;
};

export async function selectUserSliceForWhitelistLeaderboard(
  client: WlDb,
  userId: string
): Promise<WhitelistLeaderboardUserSlice | undefined> {
  const [user] = await client
    .select({
      id: users.id,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      createdAt: users.createdAt,
      isActor: users.isActor,
      isAgent: users.isAgent,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user;
}

export async function countUsersStrictlyAheadForWhitelistRank(
  client: WlDb,
  ref: {
    reputationPoints: number;
    invitePoints: number;
    createdAt: Date;
    id: string;
  }
): Promise<number> {
  const [result] = await client
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.isActor, false),
        eq(users.isAgent, false),
        or(
          gt(users.reputationPoints, ref.reputationPoints),
          and(
            eq(users.reputationPoints, ref.reputationPoints),
            gt(users.invitePoints, ref.invitePoints)
          ),
          and(
            eq(users.reputationPoints, ref.reputationPoints),
            eq(users.invitePoints, ref.invitePoints),
            lt(users.createdAt, ref.createdAt)
          ),
          and(
            eq(users.reputationPoints, ref.reputationPoints),
            eq(users.invitePoints, ref.invitePoints),
            eq(users.createdAt, ref.createdAt),
            lt(users.id, ref.id)
          )
        )
      )
    );
  return Number(result?.count ?? 0);
}

export async function selectWhitelistEntrySourceRevoked(
  client: WlDb,
  userId: string
): Promise<{ source: string; revokedAt: Date | null } | undefined> {
  const [entry] = await client
    .select({ source: whitelist.source, revokedAt: whitelist.revokedAt })
    .from(whitelist)
    .where(eq(whitelist.userId, userId))
    .limit(1);
  return entry;
}

export async function upsertWhitelistEntryActiveOrRevive(
  client: WlDb,
  input: {
    newRowId: string;
    userId: string;
    source: WhitelistSourceValue;
    reason: string | null;
    grantedBy: string | null;
    grantedAt: Date;
    nowISO: string;
  }
): Promise<{ id: string } | undefined> {
  const { newRowId, userId, source, reason, grantedBy, grantedAt, nowISO } =
    input;
  const [result] = await client
    .insert(whitelist)
    .values({
      id: newRowId,
      userId,
      source,
      reason,
      grantedBy,
      grantedAt,
    })
    .onConflictDoUpdate({
      target: whitelist.userId,
      set: {
        id: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN ${newRowId} ELSE ${whitelist.id} END`,
        source: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN ${source} ELSE ${whitelist.source} END`,
        reason: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN ${reason} ELSE ${whitelist.reason} END`,
        grantedBy: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN ${grantedBy} ELSE ${whitelist.grantedBy} END`,
        grantedAt: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN ${nowISO}::timestamp ELSE ${whitelist.grantedAt} END`,
        revokedAt: sql`CASE WHEN ${whitelist.revokedAt} IS NOT NULL THEN NULL ELSE ${whitelist.revokedAt} END`,
      },
    })
    .returning({ id: whitelist.id });
  return result;
}

export async function selectWhitelistEntryIdRevoked(
  client: WlDb,
  userId: string
): Promise<{ id: string; revokedAt: Date | null } | undefined> {
  const [entry] = await client
    .select({ id: whitelist.id, revokedAt: whitelist.revokedAt })
    .from(whitelist)
    .where(eq(whitelist.userId, userId))
    .limit(1);
  return entry;
}

export async function updateWhitelistEntryRevokedAt(
  client: WlDb,
  whitelistRowId: string,
  revokedAt: Date
): Promise<void> {
  await client
    .update(whitelist)
    .set({ revokedAt })
    .where(eq(whitelist.id, whitelistRowId));
}

export type WhitelistListEntryRow = {
  id: string;
  userId: string;
  source: string;
  reason: string | null;
  grantedBy: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
  username: string | null;
  displayName: string | null;
  walletAddress: string | null;
  profileImageUrl: string | null;
};

export type WhitelistListFilter = {
  source?: WhitelistSourceValue;
  includeRevoked?: boolean;
};

export async function listWhitelistEntriesJoinedUsers(
  client: WlDb,
  filter: WhitelistListFilter
): Promise<WhitelistListEntryRow[]> {
  const conditions = [];
  if (filter.source) {
    conditions.push(eq(whitelist.source, filter.source));
  }
  if (!filter.includeRevoked) {
    conditions.push(isNull(whitelist.revokedAt));
  }
  const wherePart = conditions.length > 0 ? and(...conditions) : undefined;

  const base = client
    .select({
      id: whitelist.id,
      userId: whitelist.userId,
      source: whitelist.source,
      reason: whitelist.reason,
      grantedBy: whitelist.grantedBy,
      grantedAt: whitelist.grantedAt,
      revokedAt: whitelist.revokedAt,
      username: users.username,
      displayName: users.displayName,
      walletAddress: users.walletAddress,
      profileImageUrl: users.profileImageUrl,
    })
    .from(whitelist)
    .leftJoin(users, eq(whitelist.userId, users.id));

  if (wherePart) {
    return base.where(wherePart).orderBy(desc(whitelist.grantedAt));
  }
  return base.orderBy(desc(whitelist.grantedAt));
}

export async function selectWhitelistActiveCountsBySource(client: WlDb) {
  return client
    .select({
      source: whitelist.source,
      count: sql<number>`count(*)`,
    })
    .from(whitelist)
    .where(isNull(whitelist.revokedAt))
    .groupBy(whitelist.source);
}

export async function selectWhitelistConfigById(
  client: WlDb,
  configId: string
): Promise<typeof whitelistConfig.$inferSelect | undefined> {
  const [config] = await client
    .select()
    .from(whitelistConfig)
    .where(eq(whitelistConfig.id, configId))
    .limit(1);
  return config;
}

export async function upsertWhitelistConfigRow(
  client: WlDb,
  input: {
    id: string;
    leaderboardRankThreshold: number | null;
    leaderboardCategory?: string;
    updatedAt: Date;
    updatedBy: string | null;
  }
): Promise<void> {
  const {
    id,
    leaderboardRankThreshold,
    leaderboardCategory,
    updatedAt,
    updatedBy,
  } = input;
  await client
    .insert(whitelistConfig)
    .values({
      id,
      leaderboardRankThreshold,
      leaderboardCategory: leaderboardCategory ?? 'all',
      updatedAt,
      updatedBy,
    })
    .onConflictDoUpdate({
      target: whitelistConfig.id,
      set: {
        leaderboardRankThreshold,
        ...(leaderboardCategory !== undefined && { leaderboardCategory }),
        updatedAt,
        updatedBy,
      },
    });
}

export async function selectTopNonActorUserIdsByLeaderboard(
  client: WlDb,
  limit: number
): Promise<{ id: string }[]> {
  return client
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isActor, false), eq(users.isAgent, false)))
    .orderBy(
      desc(users.reputationPoints),
      desc(users.invitePoints),
      asc(users.createdAt),
      asc(users.id)
    )
    .limit(limit);
}

/** Resolve user by exact id or case-insensitive username (admin whitelist POST). */
export async function selectUserIdUsernameForWhitelistAdminResolve(
  client: WlDb,
  identifier: string
): Promise<{ id: string; username: string | null } | undefined> {
  const [row] = await client
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(
      or(
        eq(users.id, identifier),
        sql`lower(${users.username}) = lower(${identifier})`
      )
    )
    .limit(1);
  return row;
}

export async function selectNftSnapshotUserIdsIn(
  client: WlDb,
  userIds: string[]
): Promise<{ userId: string }[]> {
  if (userIds.length === 0) return [];
  return client
    .select({ userId: nftSnapshot.userId })
    .from(nftSnapshot)
    .where(inArray(nftSnapshot.userId, userIds));
}

export async function selectWhitelistUserRevokedForUserIds(
  client: WlDb,
  userIds: string[]
): Promise<{ userId: string; revokedAt: Date | null }[]> {
  if (userIds.length === 0) return [];
  return client
    .select({ userId: whitelist.userId, revokedAt: whitelist.revokedAt })
    .from(whitelist)
    .where(inArray(whitelist.userId, userIds));
}

export async function insertWhitelistRowsIgnoreDuplicateUser(
  client: WlDb,
  rows: (typeof whitelist.$inferInsert)[]
): Promise<{ userId: string }[]> {
  if (rows.length === 0) return [];
  return client
    .insert(whitelist)
    .values(rows)
    .onConflictDoNothing({ target: whitelist.userId })
    .returning({ userId: whitelist.userId });
}
