/**
 * SQL for GET /api/admin/users (paginated users + moderation aggregate counts).
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { positions } from './tables/positions';
import { reactions } from './tables/reactions';
import { reports } from './tables/reports';
import { users } from './tables/user';
import { userBlocks } from './tables/user-blocks';
import { userMutes } from './tables/user-mutes';
import { whitelist } from './tables/whitelist-entries';

type UsersAdminDb = DrizzleClient | Transaction;

export type AdminUsersListFilter =
  | 'all'
  | 'actors'
  | 'users'
  | 'banned'
  | 'admins';

export type AdminUsersListSortBy =
  | 'created'
  | 'balance'
  | 'reputation'
  | 'username'
  | 'reports_received'
  | 'blocks_received'
  | 'mutes_received'
  | 'report_ratio'
  | 'block_ratio'
  | 'bad_user_score';

export type AdminUsersListParams = {
  limit: number;
  offset: number;
  search?: string;
  filter: AdminUsersListFilter;
  sortBy: AdminUsersListSortBy;
  sortOrder: 'asc' | 'desc';
};

export type AdminUserListRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  walletAddress: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  bannedBy: string | null;
  virtualBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  lifetimePnL: string;
  reputationPoints: number;
  referralCount: number;
  onChainRegistered: boolean;
  nftTokenId: number | null;
  hasFarcaster: boolean;
  hasTwitter: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function escapeAdminUserSearch(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function buildAdminUsersWhere(params: AdminUsersListParams): SQL | undefined {
  const conditions: SQL[] = [];

  if (params.filter === 'actors') {
    conditions.push(eq(users.isActor, true));
  } else if (params.filter === 'users') {
    conditions.push(eq(users.isActor, false));
  } else if (params.filter === 'banned') {
    conditions.push(eq(users.isBanned, true));
  } else if (params.filter === 'admins') {
    conditions.push(eq(users.isAdmin, true));
  }

  if (params.search) {
    const escapedSearch = escapeAdminUserSearch(params.search);
    const searchPattern = `%${escapedSearch}%`;
    conditions.push(sql`(
      ${users.username} ILIKE ${searchPattern} ESCAPE '\\' OR
      ${users.displayName} ILIKE ${searchPattern} ESCAPE '\\' OR
      ${users.walletAddress} ILIKE ${searchPattern} ESCAPE '\\'
    )`);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildAdminUsersOrderBy(params: AdminUsersListParams): SQL | undefined {
  const sortFn = params.sortOrder === 'asc' ? asc : desc;
  if (params.sortBy === 'created') {
    return sortFn(users.createdAt);
  }
  if (params.sortBy === 'balance') {
    return sortFn(users.virtualBalance);
  }
  if (params.sortBy === 'reputation') {
    return sortFn(users.reputationPoints);
  }
  if (params.sortBy === 'username') {
    return sortFn(users.username);
  }
  return undefined;
}

async function safeSelectWhitelistedUserIds(
  db: UsersAdminDb,
  userIds: string[]
): Promise<{ userId: string }[]> {
  if (userIds.length === 0) {
    return [];
  }
  try {
    return await db
      .select({ userId: whitelist.userId })
      .from(whitelist)
      .where(
        and(inArray(whitelist.userId, userIds), isNull(whitelist.revokedAt))
      );
  } catch {
    return [];
  }
}

export async function fetchAdminUsersListBundle(
  db: UsersAdminDb,
  params: AdminUsersListParams
): Promise<{
  usersResult: AdminUserListRow[];
  total: number;
  commentCounts: { userId: string | null; count: number }[];
  reactionCounts: { userId: string | null; count: number }[];
  positionCounts: { userId: string | null; count: number }[];
  followerCounts: { userId: string | null; count: number }[];
  followingCounts: { userId: string | null; count: number }[];
  reportsReceived: { userId: string | null; count: number }[];
  blocksReceived: { userId: string | null; count: number }[];
  mutesReceived: { userId: string | null; count: number }[];
  reportsSent: { userId: string | null; count: number }[];
  whitelistedUsers: { userId: string }[];
}> {
  const whereClause = buildAdminUsersWhere(params);
  const orderByClause = buildAdminUsersOrderBy(params);

  const usersResultInner = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      walletAddress: users.walletAddress,
      profileImageUrl: users.profileImageUrl,
      isActor: users.isActor,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      bannedAt: users.bannedAt,
      bannedReason: users.bannedReason,
      bannedBy: users.bannedBy,
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      lifetimePnL: users.lifetimePnL,
      reputationPoints: users.reputationPoints,
      referralCount: users.referralCount,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
      hasFarcaster: users.hasFarcaster,
      hasTwitter: users.hasTwitter,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(orderByClause ?? desc(users.createdAt))
    .limit(params.limit)
    .offset(params.offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause);
  const totalInner = totalResult?.count ?? 0;

  const userIds = usersResultInner.map((u) => u.id);

  const [
    commentCountsInner,
    reactionCountsInner,
    positionCountsInner,
    followerCountsInner,
    followingCountsInner,
    reportsReceivedInner,
    blocksReceivedInner,
    mutesReceivedInner,
    reportsSentInner,
    whitelistedUsersInner,
  ] =
    userIds.length > 0
      ? await Promise.all([
          db
            .select({ userId: comments.authorId, count: count() })
            .from(comments)
            .where(inArray(comments.authorId, userIds))
            .groupBy(comments.authorId),
          db
            .select({ userId: reactions.userId, count: count() })
            .from(reactions)
            .where(inArray(reactions.userId, userIds))
            .groupBy(reactions.userId),
          db
            .select({ userId: positions.userId, count: count() })
            .from(positions)
            .where(inArray(positions.userId, userIds))
            .groupBy(positions.userId),
          db
            .select({ userId: follows.followingId, count: count() })
            .from(follows)
            .where(inArray(follows.followingId, userIds))
            .groupBy(follows.followingId),
          db
            .select({ userId: follows.followerId, count: count() })
            .from(follows)
            .where(inArray(follows.followerId, userIds))
            .groupBy(follows.followerId),
          db
            .select({ userId: reports.reportedUserId, count: count() })
            .from(reports)
            .where(inArray(reports.reportedUserId, userIds))
            .groupBy(reports.reportedUserId),
          db
            .select({ userId: userBlocks.blockedId, count: count() })
            .from(userBlocks)
            .where(inArray(userBlocks.blockedId, userIds))
            .groupBy(userBlocks.blockedId),
          db
            .select({ userId: userMutes.mutedId, count: count() })
            .from(userMutes)
            .where(inArray(userMutes.mutedId, userIds))
            .groupBy(userMutes.mutedId),
          db
            .select({ userId: reports.reporterId, count: count() })
            .from(reports)
            .where(inArray(reports.reporterId, userIds))
            .groupBy(reports.reporterId),
          safeSelectWhitelistedUserIds(db, userIds),
        ])
      : [[], [], [], [], [], [], [], [], [], []];

  return {
    usersResult: usersResultInner,
    total: totalInner,
    commentCounts: commentCountsInner,
    reactionCounts: reactionCountsInner,
    positionCounts: positionCountsInner,
    followerCounts: followerCountsInner,
    followingCounts: followingCountsInner,
    reportsReceived: reportsReceivedInner,
    blocksReceived: blocksReceivedInner,
    mutesReceived: mutesReceivedInner,
    reportsSent: reportsSentInner,
    whitelistedUsers: whitelistedUsersInner,
  };
}
