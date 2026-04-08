/**
 * Achievement / challenge progress reads and writes for `achievement-service`.
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { agentMessages } from './tables/agent-messages';
import { agentTrades } from './tables/agent-trades';
import { chats } from './tables/chats';
import { comments } from './tables/comments';
import { follows } from './tables/follows';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { perpPositions } from './tables/perp-positions';
import { positions } from './tables/positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { referrals } from './tables/referrals';
import { shares } from './tables/shares';
import { users } from './tables/user';
import { userAchievements } from './tables/user-achievements';
import { userActivityLogs } from './tables/user-activity-logs';
import { userChallengeProgress } from './tables/user-challenge-progress';

type AchDb = DrizzleClient | Transaction;

// ── Lifetime achievement counts ────────────────────────────────────

export async function achCountPredictionTrades(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(positions)
    .where(eq(positions.userId, userId));
  return row?.c ?? 0;
}

export async function achCountPerpTrades(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(perpPositions)
    .where(eq(perpPositions.userId, userId));
  return row?.c ?? 0;
}

export async function achCountDistinctPredictionMarkets(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${positions.marketId})` })
    .from(positions)
    .where(eq(positions.userId, userId));
  return Number(row?.c ?? 0);
}

export async function achCountPredictionWins(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.outcome, true)));
  return row?.c ?? 0;
}

export async function achCountManagedAgents(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(users)
    .where(and(eq(users.managedBy, userId), eq(users.isAgent, true)));
  return row?.c ?? 0;
}

export async function achCountAgentMessagesForManager(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(agentMessages)
    .innerJoin(users, eq(agentMessages.agentUserId, users.id))
    .where(eq(users.managedBy, userId));
  return row?.c ?? 0;
}

export async function achCountAgentTradesForManager(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(agentTrades)
    .innerJoin(users, eq(agentTrades.agentUserId, users.id))
    .where(eq(users.managedBy, userId));
  return row?.c ?? 0;
}

export async function achCountGroupMessages(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(messages.senderId, userId), eq(chats.isGroup, true)));
  return row?.c ?? 0;
}

export async function achCountComments(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(comments)
    .where(and(eq(comments.authorId, userId), isNull(comments.deletedAt)));
  return row?.c ?? 0;
}

export async function achCountTerminalVisits(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(userActivityLogs)
    .where(
      and(
        eq(userActivityLogs.userId, userId),
        eq(userActivityLogs.activityType, 'open_terminal')
      )
    );
  return row?.c ?? 0;
}

export async function achCountAgentsVisits(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(userActivityLogs)
    .where(
      and(
        eq(userActivityLogs.userId, userId),
        eq(userActivityLogs.activityType, 'open_agents')
      )
    );
  return row?.c ?? 0;
}

export async function achSelectLoginStreak(
  db: AchDb,
  userId: string
): Promise<number> {
  const [row] = await db
    .select({ streak: users.dailyLoginStreak })
    .from(users)
    .where(eq(users.id, userId));
  return row?.streak ?? 0;
}

// ── Windowed counts (challenges) ───────────────────────────────────

export async function achWinCountPositions(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        gte(positions.createdAt, start),
        lt(positions.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinCountPerp(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.userId, userId),
        gte(perpPositions.openedAt, start),
        lt(perpPositions.openedAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinDistinctMarkets(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${positions.marketId})` })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        gte(positions.createdAt, start),
        lt(positions.createdAt, end)
      )
    );
  return Number(r?.c ?? 0);
}

export async function achWinPosts(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, userId),
        gte(posts.timestamp, start),
        lt(posts.timestamp, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinComments(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(comments)
    .where(
      and(
        eq(comments.authorId, userId),
        isNull(comments.deletedAt),
        gte(comments.createdAt, start),
        lt(comments.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinReactions(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        gte(reactions.createdAt, start),
        lt(reactions.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinGroupMessages(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(
      and(
        eq(messages.senderId, userId),
        eq(chats.isGroup, true),
        gte(messages.createdAt, start),
        lt(messages.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinAgentMessages(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(agentMessages)
    .innerJoin(users, eq(agentMessages.agentUserId, users.id))
    .where(
      and(
        eq(users.managedBy, userId),
        gte(agentMessages.createdAt, start),
        lt(agentMessages.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinFollows(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, userId),
        gte(follows.createdAt, start),
        lt(follows.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinShares(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(shares)
    .where(
      and(
        eq(shares.userId, userId),
        gte(shares.createdAt, start),
        lt(shares.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinActivityOnDate(
  db: AchDb,
  userId: string,
  activityType: string,
  dateOnly: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(userActivityLogs)
    .where(
      and(
        eq(userActivityLogs.userId, userId),
        eq(userActivityLogs.activityType, activityType),
        eq(userActivityLogs.activityDate, dateOnly)
      )
    );
  return r?.c ?? 0;
}

export async function achWinGroupJoins(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        gte(groupMembers.joinedAt, start),
        lt(groupMembers.joinedAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinPredictionWinsResolved(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.outcome, true),
        gte(positions.resolvedAt, start),
        lt(positions.resolvedAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinAgentTrades(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(agentTrades)
    .innerJoin(users, eq(agentTrades.agentUserId, users.id))
    .where(
      and(
        eq(users.managedBy, userId),
        gte(agentTrades.executedAt, start),
        lt(agentTrades.executedAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinGroupCreates(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(groups)
    .where(
      and(
        eq(groups.createdById, userId),
        gte(groups.createdAt, start),
        lt(groups.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinSessionDays(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(userActivityLogs)
    .where(
      and(
        eq(userActivityLogs.userId, userId),
        eq(userActivityLogs.activityType, 'session'),
        gte(userActivityLogs.activityDate, start),
        lt(userActivityLogs.activityDate, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinDistinctTradeDays(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({
      c: sql<number>`COUNT(DISTINCT DATE(${positions.createdAt}))`,
    })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        gte(positions.createdAt, start),
        lt(positions.createdAt, end)
      )
    );
  return Number(r?.c ?? 0);
}

export async function achWinAgentsCreatedIds(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.managedBy, userId),
        eq(users.isAgent, true),
        gte(users.createdAt, start),
        lt(users.createdAt, end)
      )
    );
  return rows.map((x) => x.id);
}

export async function achWinMessagedAgentIds(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<string[]> {
  const rows = await db
    .select({ agentId: agentMessages.agentUserId })
    .from(agentMessages)
    .innerJoin(users, eq(agentMessages.agentUserId, users.id))
    .where(
      and(
        eq(users.managedBy, userId),
        gte(agentMessages.createdAt, start),
        lt(agentMessages.createdAt, end)
      )
    )
    .groupBy(agentMessages.agentUserId);
  return rows.map((r) => r.agentId);
}

export async function achWinPredictionPnlSum(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<string> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${positions.pnl}), '0')` })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        isNotNull(positions.resolvedAt),
        gte(positions.resolvedAt, start),
        lt(positions.resolvedAt, end)
      )
    );
  return row?.total ?? '0';
}

export async function achWinPerpRealizedPnlSum(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<string> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${perpPositions.realizedPnL}), '0')`,
    })
    .from(perpPositions)
    .where(
      and(
        eq(perpPositions.userId, userId),
        isNotNull(perpPositions.closedAt),
        gte(perpPositions.closedAt, start),
        lt(perpPositions.closedAt, end)
      )
    );
  return row?.total ?? '0';
}

export async function achWinDistinctLikedPosts(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${reactions.postId})` })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        isNotNull(reactions.postId),
        gte(reactions.createdAt, start),
        lt(reactions.createdAt, end)
      )
    );
  return Number(row?.c ?? 0);
}

export async function achWinDistinctCommentedPosts(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${comments.postId})` })
    .from(comments)
    .where(
      and(
        eq(comments.authorId, userId),
        isNull(comments.deletedAt),
        gte(comments.createdAt, start),
        lt(comments.createdAt, end)
      )
    );
  return Number(row?.c ?? 0);
}

export async function achWinReferralPlay(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const [r] = await db
    .select({ c: count() })
    .from(referrals)
    .innerJoin(positions, eq(referrals.referredUserId, positions.userId))
    .where(
      and(
        eq(referrals.referrerId, userId),
        gte(positions.createdAt, start),
        lt(positions.createdAt, end)
      )
    );
  return r?.c ?? 0;
}

export async function achWinTopMarketUserTraded(
  db: AchDb,
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const topMarket = await db
    .select({ marketId: positions.marketId, vol: count() })
    .from(positions)
    .where(and(gte(positions.createdAt, start), lt(positions.createdAt, end)))
    .groupBy(positions.marketId)
    .orderBy(desc(count()))
    .limit(1);
  if (!topMarket[0]) return 0;
  const [userTrade] = await db
    .select({ c: count() })
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.marketId, topMarket[0].marketId),
        gte(positions.createdAt, start),
        lt(positions.createdAt, end)
      )
    );
  return (userTrade?.c ?? 0) > 0 ? 1 : 0;
}

// ── User achievement / challenge mutations & reads ─────────────────

export async function selectUnlockedAchievementIdsForUser(
  db: AchDb,
  userId: string,
  achievementIds: string[]
): Promise<string[]> {
  if (achievementIds.length === 0) return [];
  const rows = await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, userId),
        inArray(userAchievements.achievementId, achievementIds)
      )
    );
  return rows.map((r) => r.achievementId);
}

export type UserAchievementInsertRow = {
  id: string;
  userId: string;
  achievementId: string;
  pointsAwarded: number;
  unlockedAt: Date;
};

export async function insertUserAchievementIfNew(
  db: AchDb,
  row: UserAchievementInsertRow
): Promise<{ id: string } | undefined> {
  const [inserted] = await db
    .insert(userAchievements)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: userAchievements.id });
  return inserted;
}

export async function selectUserAchievementUnlockRows(
  db: AchDb,
  userId: string
): Promise<Array<{ achievementId: string; unlockedAt: Date | null }>> {
  return db
    .select({
      achievementId: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
}

export async function selectRecentUserAchievementRows(
  db: AchDb,
  userId: string,
  limit: number
): Promise<Array<{ achievementId: string; unlockedAt: Date | null }>> {
  return db
    .select({
      achievementId: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt))
    .limit(limit);
}

export async function selectChallengeProgressRow(
  db: AchDb,
  userId: string,
  challengeId: string,
  periodKey: string
): Promise<
  | {
      id: string;
      completed: number;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: userChallengeProgress.id,
      completed: userChallengeProgress.completed,
    })
    .from(userChallengeProgress)
    .where(
      and(
        eq(userChallengeProgress.userId, userId),
        eq(userChallengeProgress.challengeId, challengeId),
        eq(userChallengeProgress.periodKey, periodKey)
      )
    );
  return row;
}

export async function updateChallengeProgressCompletedTransition(
  db: AchDb,
  progressRowId: string,
  patch: {
    progress: number;
    completed: number;
    completedAt: Date | null;
    pointsAwarded: number;
  }
): Promise<{ id: string } | undefined> {
  const [updated] = await db
    .update(userChallengeProgress)
    .set(patch)
    .where(
      and(
        eq(userChallengeProgress.id, progressRowId),
        eq(userChallengeProgress.completed, 0)
      )
    )
    .returning({ id: userChallengeProgress.id });
  return updated;
}

export async function updateChallengeProgressInPlace(
  db: AchDb,
  progressRowId: string,
  patch: {
    progress: number;
    completed: number;
    completedAt: Date | null;
  }
): Promise<void> {
  await db
    .update(userChallengeProgress)
    .set(patch)
    .where(eq(userChallengeProgress.id, progressRowId));
}

export type UserChallengeProgressInsertRow = {
  id: string;
  userId: string;
  challengeId: string;
  periodKey: string;
  progress: number;
  completed: number;
  completedAt: Date | null;
  pointsAwarded: number;
};

export async function insertUserChallengeProgressIfNew(
  db: AchDb,
  row: UserChallengeProgressInsertRow
): Promise<{ id: string } | undefined> {
  const [inserted] = await db
    .insert(userChallengeProgress)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: userChallengeProgress.id });
  return inserted;
}

export async function countUserCompletedChallengesForPeriod(
  db: AchDb,
  userId: string,
  periodKey: string,
  activeChallengeIds: string[]
): Promise<number> {
  if (activeChallengeIds.length === 0) return 0;
  const [row] = await db
    .select({ c: count() })
    .from(userChallengeProgress)
    .where(
      and(
        eq(userChallengeProgress.userId, userId),
        eq(userChallengeProgress.periodKey, periodKey),
        inArray(userChallengeProgress.challengeId, activeChallengeIds),
        eq(userChallengeProgress.completed, 1)
      )
    );
  return row?.c ?? 0;
}

export async function countChallengeBonusRowsForPeriod(
  db: AchDb,
  userId: string,
  bonusPeriodKey: string
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(userChallengeProgress)
    .where(
      and(
        eq(userChallengeProgress.userId, userId),
        eq(userChallengeProgress.periodKey, bonusPeriodKey)
      )
    );
  return row?.c ?? 0;
}

export async function insertChallengeBonusMarkerIfNew(
  db: AchDb,
  row: UserChallengeProgressInsertRow
): Promise<{ id: string } | undefined> {
  const [inserted] = await db
    .insert(userChallengeProgress)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: userChallengeProgress.id });
  return inserted;
}

export async function selectUserChallengeProgressForPeriodKeys(
  db: AchDb,
  userId: string,
  periodKeys: string[]
): Promise<(typeof userChallengeProgress.$inferSelect)[]> {
  if (periodKeys.length === 0) return [];
  return db
    .select()
    .from(userChallengeProgress)
    .where(
      and(
        eq(userChallengeProgress.userId, userId),
        inArray(userChallengeProgress.periodKey, periodKeys)
      )
    );
}
