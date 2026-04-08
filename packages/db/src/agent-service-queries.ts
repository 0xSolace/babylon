/**
 * SQL for `packages/agents` AgentServiceV2 (lifecycle, balances, logs, messages).
 */

import { and, desc, eq, gte, lt } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type {
  AgentLog,
  AgentMessage,
  AgentTrade,
  Market,
  NewAgentLog,
  NewAgentPointsTransaction,
  NewUser,
  NewUserAgentConfig,
  PerpPosition,
  Position,
  Post,
  User,
} from './model-types';
import { agentLogs } from './tables/agent-logs';
import { agentMessages } from './tables/agent-messages';
import { agentPointsTransactions } from './tables/agent-points-transactions';
import { agentTrades } from './tables/agent-trades';
import { markets } from './tables/markets';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { users } from './tables/user';
import { userAgentConfigs } from './tables/user-agent-configs';

type AsvDb = DrizzleClient | Transaction;

export async function selectUserIdExistsForUsername(
  db: AsvDb,
  username: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row !== undefined;
}

export async function insertUserReturningFull(
  db: AsvDb,
  row: NewUser
): Promise<User> {
  const [created] = await db.insert(users).values(row).returning();
  if (!created) {
    throw new Error('insertUserReturningFull: expected row');
  }
  return created;
}

export async function insertUserAgentConfigRow(
  db: AsvDb,
  row: NewUserAgentConfig
): Promise<void> {
  await db.insert(userAgentConfigs).values(row);
}

export async function updateUserVirtualBalanceAndUpdatedAt(
  db: AsvDb,
  userId: string,
  virtualBalance: string,
  updatedAt: Date
): Promise<void> {
  await db
    .update(users)
    .set({ virtualBalance, updatedAt })
    .where(eq(users.id, userId));
}

export async function updateUserVirtualBalanceTotalDeposited(
  db: AsvDb,
  userId: string,
  params: {
    virtualBalance: string;
    totalDeposited: string;
    updatedAt: Date;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      virtualBalance: params.virtualBalance,
      totalDeposited: params.totalDeposited,
      updatedAt: params.updatedAt,
    })
    .where(eq(users.id, userId));
}

export async function updateUserVirtualBalanceTotalWithdrawn(
  db: AsvDb,
  userId: string,
  params: {
    virtualBalance: string;
    totalWithdrawn: string;
    updatedAt: Date;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      virtualBalance: params.virtualBalance,
      totalWithdrawn: params.totalWithdrawn,
      updatedAt: params.updatedAt,
    })
    .where(eq(users.id, userId));
}

export async function selectAgentsManagedByOrderCreatedDesc(
  db: AsvDb,
  managerUserId: string
): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(and(eq(users.isAgent, true), eq(users.managedBy, managerUserId)))
    .orderBy(desc(users.createdAt));
}

export async function selectAgentsManagedByAutonomousTradingOrderCreatedDesc(
  db: AsvDb,
  managerUserId: string,
  autonomousTrading: boolean
): Promise<User[]> {
  const results = await db
    .select({ user: users })
    .from(users)
    .innerJoin(userAgentConfigs, eq(users.id, userAgentConfigs.userId))
    .where(
      and(
        eq(users.isAgent, true),
        eq(users.managedBy, managerUserId),
        eq(userAgentConfigs.autonomousTrading, autonomousTrading)
      )
    )
    .orderBy(desc(users.createdAt));

  return results.map((r) => r.user);
}

export async function updateUserColumnsById(
  db: AsvDb,
  userId: string,
  patch: Partial<{
    displayName: string;
    bio: string;
    profileImageUrl: string | null;
    coverImageUrl: string | null;
    updatedAt: Date;
  }>
): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, userId));
}

export type UserVirtualBalanceRow = { virtualBalance: string | null };

export async function selectUserVirtualBalanceById(
  db: AsvDb,
  userId: string
): Promise<UserVirtualBalanceRow | undefined> {
  const [row] = await db
    .select({ virtualBalance: users.virtualBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserVirtualBalanceTotalDepositedRow = {
  virtualBalance: string | null;
  totalDeposited: string | null;
};

export async function selectUserVirtualBalanceTotalDepositedById(
  db: AsvDb,
  userId: string
): Promise<UserVirtualBalanceTotalDepositedRow | undefined> {
  const [row] = await db
    .select({
      virtualBalance: users.virtualBalance,
      totalDeposited: users.totalDeposited,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type UserVirtualBalanceTotalWithdrawnRow = {
  virtualBalance: string | null;
  totalWithdrawn: string | null;
};

export async function selectUserVirtualBalanceTotalWithdrawnById(
  db: AsvDb,
  userId: string
): Promise<UserVirtualBalanceTotalWithdrawnRow | undefined> {
  const [row] = await db
    .select({
      virtualBalance: users.virtualBalance,
      totalWithdrawn: users.totalWithdrawn,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function deleteUserAgentConfigByUserId(
  db: AsvDb,
  userId: string
): Promise<void> {
  await db.delete(userAgentConfigs).where(eq(userAgentConfigs.userId, userId));
}

export async function deleteUserById(db: AsvDb, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export type AgentDeductionLockRow = {
  virtualBalance: string | null;
  managedBy: string | null;
};

export async function selectUserVirtualBalanceManagedByForUpdate(
  db: AsvDb,
  userId: string
): Promise<AgentDeductionLockRow | undefined> {
  const [row] = await db
    .select({
      virtualBalance: users.virtualBalance,
      managedBy: users.managedBy,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for('update');
  return row;
}

export async function updateUserVirtualBalanceReturningVirtualBalance(
  db: AsvDb,
  userId: string,
  params: { virtualBalance: string; updatedAt: Date }
): Promise<{ virtualBalance: string | null } | undefined> {
  const [row] = await db
    .update(users)
    .set({
      virtualBalance: params.virtualBalance,
      updatedAt: params.updatedAt,
    })
    .where(eq(users.id, userId))
    .returning({ virtualBalance: users.virtualBalance });
  return row;
}

export async function insertAgentPointsTransactionRow(
  db: AsvDb,
  row: NewAgentPointsTransaction
): Promise<void> {
  await db.insert(agentPointsTransactions).values(row);
}

export async function selectAgentTradesByAgentUserIdAll(
  db: AsvDb,
  agentUserId: string
): Promise<AgentTrade[]> {
  return db
    .select()
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId));
}

export async function selectAgentTradesByAgentUserIdOrderExecutedDescLimit(
  db: AsvDb,
  agentUserId: string,
  limit: number
): Promise<AgentTrade[]> {
  return db
    .select()
    .from(agentTrades)
    .where(eq(agentTrades.agentUserId, agentUserId))
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export type AgentLogWindowRow = Pick<
  typeof agentLogs.$inferSelect,
  'type' | 'level' | 'createdAt'
>;

export async function selectAgentLogTypeLevelCreatedAtSinceOrderCreatedDescLimit(
  db: AsvDb,
  agentUserId: string,
  since: Date,
  limit: number
): Promise<AgentLogWindowRow[]> {
  return db
    .select({
      type: agentLogs.type,
      level: agentLogs.level,
      createdAt: agentLogs.createdAt,
    })
    .from(agentLogs)
    .where(
      and(
        eq(agentLogs.agentUserId, agentUserId),
        gte(agentLogs.createdAt, since)
      )
    )
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);
}

export type AgentTradeWindowSliceRow = Pick<
  AgentTrade,
  'marketType' | 'action' | 'pnl' | 'executedAt'
>;

export async function selectAgentTradesWindowSliceByAgentSinceExecutedDescLimit(
  db: AsvDb,
  agentUserId: string,
  since: Date,
  limit: number
): Promise<AgentTradeWindowSliceRow[]> {
  return db
    .select({
      marketType: agentTrades.marketType,
      action: agentTrades.action,
      pnl: agentTrades.pnl,
      executedAt: agentTrades.executedAt,
    })
    .from(agentTrades)
    .where(
      and(
        eq(agentTrades.agentUserId, agentUserId),
        gte(agentTrades.executedAt, since)
      )
    )
    .orderBy(desc(agentTrades.executedAt))
    .limit(limit);
}

export type AgentAuthorPostSummary = Pick<Post, 'id' | 'content' | 'createdAt'>;

export async function selectPostSummariesByAuthorIdOrderCreatedDescLimit(
  db: AsvDb,
  authorId: string,
  limit: number
): Promise<AgentAuthorPostSummary[]> {
  return db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function selectPositionsByUserIdLimit(
  db: AsvDb,
  userId: string,
  limit: number
): Promise<Position[]> {
  return db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId))
    .limit(limit);
}

export async function selectPerpPositionsByUserIdLimit(
  db: AsvDb,
  userId: string,
  limit: number
): Promise<PerpPosition[]> {
  return db
    .select()
    .from(perpPositions)
    .where(eq(perpPositions.userId, userId))
    .limit(limit);
}

export async function selectUnresolvedMarketsOrderCreatedDescLimit(
  db: AsvDb,
  limit: number
): Promise<Market[]> {
  return db
    .select()
    .from(markets)
    .where(eq(markets.resolved, false))
    .orderBy(desc(markets.createdAt))
    .limit(limit);
}

export type TopicDiversityPostSeedRow = Pick<
  Post,
  'authorId' | 'content' | 'timestamp'
>;

export async function selectPostsForTopicDiversitySinceOrderTimestampDescLimit(
  db: AsvDb,
  params: { since: Date; limit: number }
): Promise<TopicDiversityPostSeedRow[]> {
  return db
    .select({
      authorId: posts.authorId,
      content: posts.content,
      timestamp: posts.timestamp,
    })
    .from(posts)
    .where(gte(posts.timestamp, params.since))
    .orderBy(desc(posts.timestamp))
    .limit(params.limit);
}

export async function selectAgentMessagesForChatHistory(
  db: AsvDb,
  params: {
    agentUserId: string;
    limit: number;
    cursorCreatedBefore?: Date;
  }
): Promise<AgentMessage[]> {
  const { agentUserId, limit, cursorCreatedBefore } = params;
  if (cursorCreatedBefore) {
    return db
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.agentUserId, agentUserId),
          lt(agentMessages.createdAt, cursorCreatedBefore)
        )
      )
      .orderBy(desc(agentMessages.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.agentUserId, agentUserId))
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);
}

export async function selectAgentLogSystemCreatedAtMetadataRecent(
  db: AsvDb,
  agentUserId: string,
  limit: number
): Promise<Array<Pick<AgentLog, 'createdAt' | 'metadata'>>> {
  return db
    .select({
      createdAt: agentLogs.createdAt,
      metadata: agentLogs.metadata,
    })
    .from(agentLogs)
    .where(
      and(eq(agentLogs.agentUserId, agentUserId), eq(agentLogs.type, 'system'))
    )
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);
}

export async function selectAgentLogsFiltered(
  db: AsvDb,
  params: {
    agentUserId: string;
    type?: string;
    level?: string;
    limit: number;
  }
): Promise<AgentLog[]> {
  const conditions = [eq(agentLogs.agentUserId, params.agentUserId)];
  if (params.type) {
    conditions.push(eq(agentLogs.type, params.type));
  }
  if (params.level) {
    conditions.push(eq(agentLogs.level, params.level));
  }
  return db
    .select()
    .from(agentLogs)
    .where(and(...conditions))
    .orderBy(desc(agentLogs.createdAt))
    .limit(params.limit);
}

export async function insertAgentLogReturningRow(
  db: AsvDb,
  row: NewAgentLog
): Promise<AgentLog> {
  const [created] = await db.insert(agentLogs).values(row).returning();
  if (!created) {
    throw new Error('insertAgentLogReturningRow: expected row');
  }
  return created;
}

export type { AgentLog, AgentMessage } from './model-types';
