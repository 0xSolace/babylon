/**
 * Agent performance metrics, feedback rows, and leaderboard SQL for
 * `reputation-calculation-service`.
 *
 * **Why here:** reads/writes use **`asSystem`**; scoring formulas stay in engine.
 */

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { asSystem } from './db';
import { agentPerformanceMetrics } from './tables/agent-performance-metrics';
import { feedbacks } from './tables/feedbacks';
import { users } from './tables/user';

export type AgentPerformanceMetricsRow =
  typeof agentPerformanceMetrics.$inferSelect;
export type NewAgentPerformanceMetricsRow =
  typeof agentPerformanceMetrics.$inferInsert;

export type AgentPerformanceMetricsPatch = Partial<
  Omit<NewAgentPerformanceMetricsRow, 'id' | 'userId'>
>;

export async function fetchAgentPerformanceMetricsByUserId(
  userId: string
): Promise<AgentPerformanceMetricsRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(agentPerformanceMetrics)
      .where(eq(agentPerformanceMetrics.userId, userId))
      .limit(1);
    return row;
  }, 'reputation-metrics-by-user');
}

export async function insertAgentPerformanceMetricsRow(
  row: NewAgentPerformanceMetricsRow
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(agentPerformanceMetrics).values(row);
  }, 'reputation-metrics-insert');
}

export async function updateAgentPerformanceMetricsByUserId(
  userId: string,
  patch: AgentPerformanceMetricsPatch
): Promise<void> {
  await asSystem(async (c) => {
    await c
      .update(agentPerformanceMetrics)
      .set({
        ...patch,
        updatedAt: patch.updatedAt ?? new Date(),
      })
      .where(eq(agentPerformanceMetrics.userId, userId));
  }, 'reputation-metrics-update');
}

export async function fetchUserLifetimePnLAndDeposited(userId: string): Promise<
  | {
      lifetimePnL: string | null;
      totalDeposited: string | null;
    }
  | undefined
> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        lifetimePnL: users.lifetimePnL,
        totalDeposited: users.totalDeposited,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row;
  }, 'reputation-user-pnl-deposits');
}

export type NewFeedbackRow = typeof feedbacks.$inferInsert;

export async function insertFeedbackRow(row: NewFeedbackRow): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(feedbacks).values(row);
  }, 'reputation-feedback-insert');
}

export async function fetchFeedbackById(
  feedbackId: string
): Promise<typeof feedbacks.$inferSelect | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.id, feedbackId))
      .limit(1);
    return row;
  }, 'reputation-feedback-by-id');
}

export type ReputationLeaderboardAgentRow = {
  userId: string;
  reputationScore: number;
  trustLevel: string;
  confidenceScore: number;
  gamesPlayed: number;
  winRate: number;
  normalizedPnL: number;
};

export async function listReputationLeaderboardAgentRows(
  minGames: number,
  limit: number,
  activeSince: Date | null | undefined
): Promise<ReputationLeaderboardAgentRow[]> {
  return asSystem(async (c) => {
    const filters = [gte(agentPerformanceMetrics.gamesPlayed, minGames)];
    if (activeSince) {
      filters.push(gte(agentPerformanceMetrics.lastActivityAt, activeSince));
    }

    return c
      .select({
        userId: agentPerformanceMetrics.userId,
        reputationScore: agentPerformanceMetrics.reputationScore,
        trustLevel: agentPerformanceMetrics.trustLevel,
        confidenceScore: agentPerformanceMetrics.confidenceScore,
        gamesPlayed: agentPerformanceMetrics.gamesPlayed,
        winRate: agentPerformanceMetrics.winRate,
        normalizedPnL: agentPerformanceMetrics.normalizedPnL,
      })
      .from(agentPerformanceMetrics)
      .where(and(...filters))
      .orderBy(desc(agentPerformanceMetrics.reputationScore))
      .limit(limit);
  }, 'reputation-leaderboard-agents');
}

export type LeaderboardUserProfileRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean | null;
};

export async function listUsersLeaderboardProfilesByIds(
  userIds: string[]
): Promise<LeaderboardUserProfileRow[]> {
  if (userIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          profileImageUrl: users.profileImageUrl,
          isActor: users.isActor,
        })
        .from(users)
        .where(inArray(users.id, userIds)),
    'reputation-leaderboard-users'
  );
}
