/**
 * SQL for `packages/agents` Agent0 / ERC-8004 reputation cache and sync.
 */

import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import {
  agentPerformanceMetrics,
  type NewAgentPerformanceMetrics,
} from './tables/agent-performance-metrics';
import { feedbacks } from './tables/feedbacks';
import { gameConfigs, type NewGameConfig } from './tables/game-configs';
import { pointsTransactions } from './tables/points-transactions';
import { users } from './tables/user';
import type { JsonValue } from './types';

type RepDb = DrizzleClient | Transaction;

// --- agent0-reputation-cache ---

export type UserAgent0ReputationCacheRow = {
  id: string;
  agent0TokenId: number | null;
  isBanned: boolean;
  isScammer: boolean;
  isCSAM: boolean;
  earnedPoints: number;
  reputationPoints: number;
};

export async function selectUserAgent0ReputationCacheRowById(
  db: RepDb,
  userId: string
): Promise<UserAgent0ReputationCacheRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      isBanned: users.isBanned,
      isScammer: users.isScammer,
      isCSAM: users.isCSAM,
      earnedPoints: users.earnedPoints,
      reputationPoints: users.reputationPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type AgentPerformanceMetricsCacheSliceRow = {
  reputationScore: number;
  lastActivityAt: Date | null;
  updatedAt: Date;
};

export async function selectAgentPerformanceMetricsCacheSliceByUserId(
  db: RepDb,
  userId: string
): Promise<AgentPerformanceMetricsCacheSliceRow | undefined> {
  const [row] = await db
    .select({
      reputationScore: agentPerformanceMetrics.reputationScore,
      lastActivityAt: agentPerformanceMetrics.lastActivityAt,
      updatedAt: agentPerformanceMetrics.updatedAt,
    })
    .from(agentPerformanceMetrics)
    .where(eq(agentPerformanceMetrics.userId, userId))
    .limit(1);
  return row;
}

export async function selectAgentPerformanceMetricsReputationScoreOnlyByUserId(
  db: RepDb,
  userId: string
): Promise<{ reputationScore: number } | undefined> {
  const [row] = await db
    .select({ reputationScore: agentPerformanceMetrics.reputationScore })
    .from(agentPerformanceMetrics)
    .where(eq(agentPerformanceMetrics.userId, userId))
    .limit(1);
  return row;
}

export async function updateAgentPerformanceMetricsReputationStaleAt(
  db: RepDb,
  userId: string,
  staleAt: Date
): Promise<void> {
  await db
    .update(agentPerformanceMetrics)
    .set({ updatedAt: staleAt })
    .where(eq(agentPerformanceMetrics.userId, userId));
}

export type UserPointsOverspendingSliceRow = {
  earnedPoints: number;
  reputationPoints: number;
  invitePoints: number;
  bonusPoints: number;
};

export async function selectUserPointsOverspendingSliceById(
  db: RepDb,
  userId: string
): Promise<UserPointsOverspendingSliceRow | undefined> {
  const [row] = await db
    .select({
      earnedPoints: users.earnedPoints,
      reputationPoints: users.reputationPoints,
      invitePoints: users.invitePoints,
      bonusPoints: users.bonusPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectPointsTransferSentAmountsByUserId(
  db: RepDb,
  userId: string
): Promise<{ amount: number }[]> {
  return db
    .select({ amount: pointsTransactions.amount })
    .from(pointsTransactions)
    .where(
      and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.reason, 'transfer_sent')
      )
    );
}

export type UserAgent0ScoreCalcSliceRow = {
  id: string;
  isBanned: boolean;
  isScammer: boolean;
  isCSAM: boolean;
  earnedPoints: number;
};

export async function selectUserAgent0ScoreCalcSliceById(
  db: RepDb,
  userId: string
): Promise<UserAgent0ScoreCalcSliceRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      isBanned: users.isBanned,
      isScammer: users.isScammer,
      isCSAM: users.isCSAM,
      earnedPoints: users.earnedPoints,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export type AgentPerformanceMetricsActivitySliceRow = {
  gamesPlayed: number;
  totalFeedbackCount: number;
  averageFeedbackScore: number;
  normalizedPnL: number;
  lastActivityAt: Date | null;
};

export async function selectAgentPerformanceMetricsActivitySliceByUserId(
  db: RepDb,
  userId: string
): Promise<AgentPerformanceMetricsActivitySliceRow | undefined> {
  const [row] = await db
    .select({
      gamesPlayed: agentPerformanceMetrics.gamesPlayed,
      totalFeedbackCount: agentPerformanceMetrics.totalFeedbackCount,
      averageFeedbackScore: agentPerformanceMetrics.averageFeedbackScore,
      normalizedPnL: agentPerformanceMetrics.normalizedPnL,
      lastActivityAt: agentPerformanceMetrics.lastActivityAt,
    })
    .from(agentPerformanceMetrics)
    .where(eq(agentPerformanceMetrics.userId, userId))
    .limit(1);
  return row;
}

// --- agent0-reputation-sync ---

export async function selectAgentPerformanceMetricsFullRowByUserId(
  db: RepDb,
  userId: string
): Promise<typeof agentPerformanceMetrics.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(agentPerformanceMetrics)
    .where(eq(agentPerformanceMetrics.userId, userId))
    .limit(1);
  return row;
}

export async function updateAgentPerformanceMetricsOnChainFlagsReturningFull(
  db: RepDb,
  userId: string,
  params: { onChainReputationSync: boolean; lastSyncedAt: Date }
): Promise<typeof agentPerformanceMetrics.$inferSelect | undefined> {
  const [row] = await db
    .update(agentPerformanceMetrics)
    .set({
      onChainReputationSync: params.onChainReputationSync,
      lastSyncedAt: params.lastSyncedAt,
    })
    .where(eq(agentPerformanceMetrics.userId, userId))
    .returning();
  return row;
}

export async function insertAgentPerformanceMetricsOnChainInitReturningFull(
  db: RepDb,
  row: NewAgentPerformanceMetrics
): Promise<typeof agentPerformanceMetrics.$inferSelect | undefined> {
  const [created] = await db
    .insert(agentPerformanceMetrics)
    .values(row)
    .returning();
  return created;
}

export async function insertAgentPerformanceMetricsMinimalReturningFull(
  db: RepDb,
  row: NewAgentPerformanceMetrics
): Promise<typeof agentPerformanceMetrics.$inferSelect | undefined> {
  const [created] = await db
    .insert(agentPerformanceMetrics)
    .values(row)
    .returning();
  return created;
}

export type FeedbackAgent0SubmitRow = {
  id: string;
  score: number;
  comment: string | null;
  metadata: JsonValue;
  toUserId: string | null;
};

export async function selectFeedbackForAgent0SubmitById(
  db: RepDb,
  feedbackId: string
): Promise<FeedbackAgent0SubmitRow | undefined> {
  const [row] = await db
    .select({
      id: feedbacks.id,
      score: feedbacks.score,
      comment: feedbacks.comment,
      metadata: feedbacks.metadata,
      toUserId: feedbacks.toUserId,
    })
    .from(feedbacks)
    .where(eq(feedbacks.id, feedbackId))
    .limit(1);
  return row;
}

export async function selectUserAgent0RecipientSliceById(
  db: RepDb,
  userId: string
): Promise<
  | {
      id: string;
      agent0TokenId: number | null;
      nftTokenId: number | null;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      nftTokenId: users.nftTokenId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateFeedbackAgent0SubmittedMetadata(
  db: RepDb,
  feedbackId: string,
  params: { agent0TokenId: number; metadata: JsonValue }
): Promise<void> {
  await db
    .update(feedbacks)
    .set({
      agent0TokenId: params.agent0TokenId,
      metadata: params.metadata,
    })
    .where(eq(feedbacks.id, feedbackId));
}

export async function selectUsersWithAgent0TokenForPeriodicSync(
  db: RepDb,
  filterUserId?: string
): Promise<
  { id: string; agent0TokenId: number | null; nftTokenId: number | null }[]
> {
  const whereCondition = filterUserId
    ? and(isNotNull(users.agent0TokenId), eq(users.id, filterUserId))
    : isNotNull(users.agent0TokenId);

  return db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      nftTokenId: users.nftTokenId,
    })
    .from(users)
    .where(whereCondition);
}

export async function selectAgentPerformanceMetricsLastSyncedByUserIds(
  db: RepDb,
  userIds: string[]
): Promise<{ userId: string; lastSyncedAt: Date | null }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: agentPerformanceMetrics.userId,
      lastSyncedAt: agentPerformanceMetrics.lastSyncedAt,
    })
    .from(agentPerformanceMetrics)
    .where(inArray(agentPerformanceMetrics.userId, userIds));
}

export async function selectUserAgent0TokenSliceByUserId(
  db: RepDb,
  userId: string
): Promise<
  { agent0TokenId: number | null; nftTokenId: number | null } | undefined
> {
  const [row] = await db
    .select({
      agent0TokenId: users.agent0TokenId,
      nftTokenId: users.nftTokenId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectLatestPerformanceMetricsLastSyncedAt(
  db: RepDb
): Promise<{ lastSyncedAt: Date } | undefined> {
  const [row] = await db
    .select({ lastSyncedAt: agentPerformanceMetrics.lastSyncedAt })
    .from(agentPerformanceMetrics)
    .where(isNotNull(agentPerformanceMetrics.lastSyncedAt))
    .orderBy(desc(agentPerformanceMetrics.lastSyncedAt))
    .limit(1);
  if (!row?.lastSyncedAt) return undefined;
  return { lastSyncedAt: row.lastSyncedAt };
}

// --- blockchain-reputation (viem) ---

export async function updateAgentPerformanceMetricsOnChainScoresReturningFull(
  db: RepDb,
  userId: string,
  params: {
    onChainReputationSync: boolean;
    lastSyncedAt: Date;
    onChainTrustScore: number;
    onChainAccuracyScore: number;
  }
): Promise<typeof agentPerformanceMetrics.$inferSelect | undefined> {
  const [row] = await db
    .update(agentPerformanceMetrics)
    .set({
      onChainReputationSync: params.onChainReputationSync,
      lastSyncedAt: params.lastSyncedAt,
      onChainTrustScore: params.onChainTrustScore,
      onChainAccuracyScore: params.onChainAccuracyScore,
    })
    .where(eq(agentPerformanceMetrics.userId, userId))
    .returning();
  return row;
}

// --- blockchain-reputation-impl ---

export async function updateUsersAgent0TrustAndFeedbackCount(
  db: RepDb,
  userId: string,
  params: { agent0TrustScore: number; agent0FeedbackCount: number }
): Promise<void> {
  await db
    .update(users)
    .set({
      agent0TrustScore: params.agent0TrustScore,
      agent0FeedbackCount: params.agent0FeedbackCount,
    })
    .where(eq(users.id, userId));
}

// --- erc8004-sync ---

export async function selectUserErc8004LocalSyncSliceById(
  db: RepDb,
  userId: string
): Promise<
  | {
      id: string;
      agent0TokenId: number | null;
      username: string | null;
      displayName: string | null;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateAgentPerformanceMetricsReputationScoreByUserId(
  db: RepDb,
  userId: string,
  params: { reputationScore: number; updatedAt: Date }
): Promise<void> {
  await db
    .update(agentPerformanceMetrics)
    .set({
      reputationScore: params.reputationScore,
      updatedAt: params.updatedAt,
    })
    .where(eq(agentPerformanceMetrics.userId, userId));
}

export async function insertAgentPerformanceMetricsReputationRow(
  db: RepDb,
  row: NewAgentPerformanceMetrics
): Promise<void> {
  await db.insert(agentPerformanceMetrics).values(row);
}

export async function selectUsersNotBannedForErc8004Batch(
  db: RepDb,
  limit: number
): Promise<
  {
    id: string;
    agent0TokenId: number | null;
    isBanned: boolean;
    isScammer: boolean;
    isCSAM: boolean;
  }[]
> {
  return db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      isBanned: users.isBanned,
      isScammer: users.isScammer,
      isCSAM: users.isCSAM,
    })
    .from(users)
    .where(eq(users.isBanned, false))
    .limit(limit);
}

// --- erc8004-reputation-sync ---

export async function selectUserErc8004ReputationUserSliceById(
  db: RepDb,
  userId: string
): Promise<
  | {
      id: string;
      agent0TokenId: number | null;
      username: string | null;
      displayName: string | null;
      isBanned: boolean;
      isScammer: boolean;
      isCSAM: boolean;
      createdAt: Date;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      username: users.username,
      displayName: users.displayName,
      isBanned: users.isBanned,
      isScammer: users.isScammer,
      isCSAM: users.isCSAM,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectAgentPerformanceMetricsReputationActivitySliceByUserId(
  db: RepDb,
  userId: string
): Promise<
  | {
      reputationScore: number;
      updatedAt: Date;
      lastActivityAt: Date | null;
    }
  | undefined
> {
  const [row] = await db
    .select({
      reputationScore: agentPerformanceMetrics.reputationScore,
      updatedAt: agentPerformanceMetrics.updatedAt,
      lastActivityAt: agentPerformanceMetrics.lastActivityAt,
    })
    .from(agentPerformanceMetrics)
    .where(eq(agentPerformanceMetrics.userId, userId))
    .limit(1);
  return row;
}

export async function selectUserWalletAddressById(
  db: RepDb,
  userId: string
): Promise<{ walletAddress: string | null } | undefined> {
  const [row] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectUsersForBatchErc8004ReputationSync(
  db: RepDb,
  params: {
    prioritizeNew: boolean;
    sevenDaysAgo: Date;
    limit: number;
    offset: number;
  }
): Promise<{ id: string; agent0TokenId: number | null; createdAt: Date }[]> {
  const whereCondition = params.prioritizeNew
    ? and(
        isNotNull(users.agent0TokenId),
        gte(users.createdAt, params.sevenDaysAgo)
      )
    : isNotNull(users.agent0TokenId);

  const q = db
    .select({
      id: users.id,
      agent0TokenId: users.agent0TokenId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereCondition);

  if (params.prioritizeNew) {
    return q
      .orderBy(desc(users.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }
  return q
    .orderBy(asc(users.createdAt))
    .limit(params.limit)
    .offset(params.offset);
}

export async function selectGameConfigCreatedAtByKeyOrderDesc(
  db: RepDb,
  key: string
): Promise<{ createdAt: Date } | undefined> {
  const [row] = await db
    .select({ createdAt: gameConfigs.createdAt })
    .from(gameConfigs)
    .where(eq(gameConfigs.key, key))
    .orderBy(desc(gameConfigs.createdAt))
    .limit(1);
  return row;
}

export async function selectGameConfigRowByKey(
  db: RepDb,
  key: string
): Promise<typeof gameConfigs.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(gameConfigs)
    .where(eq(gameConfigs.key, key))
    .limit(1);
  return row;
}

export async function updateGameConfigValueByKey(
  db: RepDb,
  key: string,
  params: { value: JsonValue; updatedAt: Date }
): Promise<void> {
  await db
    .update(gameConfigs)
    .set({
      value: params.value,
      updatedAt: params.updatedAt,
    })
    .where(eq(gameConfigs.key, key));
}

export async function insertGameConfigRow(
  db: RepDb,
  row: NewGameConfig
): Promise<void> {
  await db.insert(gameConfigs).values(row);
}
