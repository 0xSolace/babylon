/**
 * Achievement & Challenge Service
 *
 * Core engine for tracking achievements and challenges.
 *
 * - Achievements: permanent milestones, query-based progress from existing tables
 * - Challenges: time-bound rotating objectives, deterministic selection from pools
 *
 * All checkProgress calls are fire-and-forget from route handlers.
 */

import {
  achCountAgentMessagesForManager,
  achCountAgentsVisits,
  achCountAgentTradesForManager,
  achCountComments,
  achCountDistinctPredictionMarkets,
  achCountGroupMessages,
  achCountManagedAgents,
  achCountPerpTrades,
  achCountPredictionTrades,
  achCountPredictionWins,
  achCountTerminalVisits,
  achSelectLoginStreak,
  achWinActivityOnDate,
  achWinAgentMessages,
  achWinAgentsCreatedIds,
  achWinAgentTrades,
  achWinComments,
  achWinCountPerp,
  achWinCountPositions,
  achWinDistinctCommentedPosts,
  achWinDistinctLikedPosts,
  achWinDistinctMarkets,
  achWinDistinctTradeDays,
  achWinFollows,
  achWinGroupCreates,
  achWinGroupJoins,
  achWinGroupMessages,
  achWinMessagedAgentIds,
  achWinPerpRealizedPnlSum,
  achWinPosts,
  achWinPredictionPnlSum,
  achWinPredictionWinsResolved,
  achWinReactions,
  achWinReferralPlay,
  achWinSessionDays,
  achWinShares,
  achWinTopMarketUserTraded,
  countChallengeBonusRowsForPeriod,
  countUserCompletedChallengesForPeriod,
  generateSnowflakeId,
  insertChallengeBonusMarkerIfNew,
  insertUserAchievementIfNew,
  insertUserChallengeProgressIfNew,
  selectChallengeProgressRow,
  selectRecentUserAchievementRows,
  selectUnlockedAchievementIdsForUser,
  selectUserAchievementUnlockRows,
  selectUserChallengeProgressForPeriodKeys,
  updateChallengeProgressCompletedTransition,
  updateChallengeProgressInPlace,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementDef,
  type AchievementEvent,
  type AchievementEventType,
  ALL_CHALLENGE_DEFINITIONS,
  type ChallengeDef,
  DAILY_CHALLENGE_DEFINITIONS,
  EVENT_TO_TRACKING_TYPES,
  logger,
  POINTS,
  WEEKLY_CHALLENGE_DEFINITIONS,
} from '@babylon/shared';
import { createHash } from 'crypto';
import { broadcastToChannel } from '../sse/event-broadcaster';
import { createNotification } from './notification-service';
import { PointsService } from './points-service';

// ── Time Helpers ───────────────────────────────────────────────────

function getUTCDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // '2026-03-06'
}

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getStartOfUTCDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function getEndOfUTCDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  );
}

function getStartOfISOWeek(date: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7; // Monday=1, Sunday=7
  d.setUTCDate(d.getUTCDate() - day + 1); // Back to Monday
  return d;
}

function getEndOfISOWeek(date: Date = new Date()): Date {
  const start = getStartOfISOWeek(date);
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
}

// ── Deterministic Challenge Rotation ───────────────────────────────

function selectChallengeIds(
  pool: ChallengeDef[],
  pickCount: number,
  seed: string
): string[] {
  const hash = createHash('sha256').update(seed).digest();
  const selected: number[] = [];
  let offset = 0;

  while (selected.length < pickCount && offset <= hash.length - 4) {
    const idx = hash.readUInt32BE(offset) % pool.length;
    if (!selected.includes(idx)) {
      selected.push(idx);
    }
    offset += 4;
  }

  return selected.map((i) => pool[i]!.id);
}

export function getActiveDailyChallengeIds(date: Date = new Date()): string[] {
  return selectChallengeIds(
    DAILY_CHALLENGE_DEFINITIONS,
    3,
    `daily:${getUTCDateString(date)}`
  );
}

export function getActiveWeeklyChallengeIds(date: Date = new Date()): string[] {
  return selectChallengeIds(
    WEEKLY_CHALLENGE_DEFINITIONS,
    2,
    `weekly:${getISOWeekString(date)}`
  );
}

// ── Progress Resolvers (Achievements) ──────────────────────────────
// Each resolver counts lifetime progress for a tracking type.

type ProgressResolver = (userId: string) => Promise<number>;

const ACHIEVEMENT_RESOLVERS: Record<string, ProgressResolver> = {
  prediction_trade_count: (userId) => achCountPredictionTrades(db, userId),

  perp_trade_count: (userId) => achCountPerpTrades(db, userId),

  total_trade_count: async (userId) => {
    const pred = await achCountPredictionTrades(db, userId);
    const perp = await achCountPerpTrades(db, userId);
    return pred + perp;
  },

  distinct_markets: (userId) => achCountDistinctPredictionMarkets(db, userId),

  prediction_win_count: (userId) => achCountPredictionWins(db, userId),

  agent_count: (userId) => achCountManagedAgents(db, userId),

  agent_message_count: (userId) => achCountAgentMessagesForManager(db, userId),

  agent_trade_count: (userId) => achCountAgentTradesForManager(db, userId),

  group_message_count: (userId) => achCountGroupMessages(db, userId),

  comment_count: (userId) => achCountComments(db, userId),

  terminal_visit_count: (userId) => achCountTerminalVisits(db, userId),

  agents_visit_count: (userId) => achCountAgentsVisits(db, userId),

  login_streak: (userId) => achSelectLoginStreak(db, userId),
};

// ── Progress Resolvers (Challenges — windowed) ─────────────────────
// Each resolver counts progress within a time window.

type WindowedResolver = (
  userId: string,
  start: Date,
  end: Date
) => Promise<number>;

const CHALLENGE_RESOLVERS: Record<string, WindowedResolver> = {
  daily_pred_trade: (userId, start, end) =>
    achWinCountPositions(db, userId, start, end),

  daily_perp_trade: (userId, start, end) =>
    achWinCountPerp(db, userId, start, end),

  daily_total_trade: async (userId, start, end) => {
    const pred = await achWinCountPositions(db, userId, start, end);
    const perp = await achWinCountPerp(db, userId, start, end);
    return pred + perp;
  },

  daily_distinct_markets: (userId, start, end) =>
    achWinDistinctMarkets(db, userId, start, end),

  daily_post: (userId, start, end) => achWinPosts(db, userId, start, end),

  daily_comment: (userId, start, end) => achWinComments(db, userId, start, end),

  daily_reaction: (userId, start, end) =>
    achWinReactions(db, userId, start, end),

  daily_group_message: (userId, start, end) =>
    achWinGroupMessages(db, userId, start, end),

  daily_agent_message: (userId, start, end) =>
    achWinAgentMessages(db, userId, start, end),

  daily_follow: (userId, start, end) => achWinFollows(db, userId, start, end),

  daily_share: (userId, start, end) => achWinShares(db, userId, start, end),

  daily_terminal_visit: (userId, start, _end) =>
    achWinActivityOnDate(db, userId, 'open_terminal', getStartOfUTCDay(start)),

  daily_agents_visit: (userId, start, _end) =>
    achWinActivityOnDate(db, userId, 'open_agents', getStartOfUTCDay(start)),

  daily_markets_visit: (userId, start, _end) =>
    achWinActivityOnDate(db, userId, 'open_terminal', getStartOfUTCDay(start)),

  daily_feed_visit: (userId, start, _end) =>
    achWinActivityOnDate(db, userId, 'open_feed', getStartOfUTCDay(start)),

  daily_leaderboard_visit: (userId, start, _end) =>
    achWinActivityOnDate(
      db,
      userId,
      'open_leaderboard',
      getStartOfUTCDay(start)
    ),

  daily_notifications_visit: (userId, start, _end) =>
    achWinActivityOnDate(
      db,
      userId,
      'open_notifications',
      getStartOfUTCDay(start)
    ),

  daily_market_detail_visit: (userId, start, _end) =>
    achWinActivityOnDate(
      db,
      userId,
      'open_market_detail',
      getStartOfUTCDay(start)
    ),

  daily_group_join: (userId, start, end) =>
    achWinGroupJoins(db, userId, start, end),

  daily_pred_and_perp: async (userId, start, end) => {
    const pred = await achWinCountPositions(db, userId, start, end);
    const perp = await achWinCountPerp(db, userId, start, end);
    return pred > 0 && perp > 0 ? 1 : 0;
  },

  weekly_pred_trade: (userId, start, end) =>
    achWinCountPositions(db, userId, start, end),

  weekly_perp_trade: (userId, start, end) =>
    achWinCountPerp(db, userId, start, end),

  weekly_total_trade: async (userId, start, end) => {
    const pred = await achWinCountPositions(db, userId, start, end);
    const perp = await achWinCountPerp(db, userId, start, end);
    return pred + perp;
  },

  weekly_distinct_markets: (userId, start, end) =>
    achWinDistinctMarkets(db, userId, start, end),

  weekly_trade_win: (userId, start, end) =>
    achWinPredictionWinsResolved(db, userId, start, end),

  weekly_post: (userId, start, end) => achWinPosts(db, userId, start, end),

  weekly_comment: (userId, start, end) =>
    achWinComments(db, userId, start, end),

  weekly_reaction: (userId, start, end) =>
    achWinReactions(db, userId, start, end),

  weekly_group_message: (userId, start, end) =>
    achWinGroupMessages(db, userId, start, end),

  weekly_agent_message: (userId, start, end) =>
    achWinAgentMessages(db, userId, start, end),

  weekly_agent_trade: (userId, start, end) =>
    achWinAgentTrades(db, userId, start, end),

  weekly_follow: (userId, start, end) => achWinFollows(db, userId, start, end),

  weekly_share: (userId, start, end) => achWinShares(db, userId, start, end),

  weekly_group_join: (userId, start, end) =>
    achWinGroupJoins(db, userId, start, end),

  weekly_group_create: (userId, start, end) =>
    achWinGroupCreates(db, userId, start, end),

  weekly_login_days: (userId, start, end) =>
    achWinSessionDays(db, userId, start, end),

  weekly_trade_days: (userId, start, end) =>
    achWinDistinctTradeDays(db, userId, start, end),

  weekly_pred_and_perp: async (userId, start, end) => {
    const pred = await achWinCountPositions(db, userId, start, end);
    const perp = await achWinCountPerp(db, userId, start, end);
    return pred > 0 && perp > 0 ? 1 : 0;
  },

  weekly_agent_and_group: async (userId, start, end) => {
    const hasAgent = await achWinAgentMessages(db, userId, start, end);
    const hasGroup = await achWinGroupMessages(db, userId, start, end);
    return hasAgent > 0 && hasGroup > 0 ? 1 : 0;
  },

  weekly_agent_interact: async (userId, start, end) => {
    const created = await achWinAgentsCreatedIds(db, userId, start, end);
    const messaged = await achWinMessagedAgentIds(db, userId, start, end);
    return new Set([...created, ...messaged]).size;
  },

  weekly_positive_pnl: async (userId, start, end) => {
    const predPnl = await achWinPredictionPnlSum(db, userId, start, end);
    const perpPnl = await achWinPerpRealizedPnlSum(db, userId, start, end);
    return Number(predPnl) + Number(perpPnl) > 0 ? 1 : 0;
  },

  weekly_feed_engage: async (userId, start, end) => {
    const liked = await achWinDistinctLikedPosts(db, userId, start, end);
    const commented = await achWinDistinctCommentedPosts(
      db,
      userId,
      start,
      end
    );
    return Math.min(liked, commented);
  },

  weekly_referral_play: async (userId, start, end) => {
    const c = await achWinReferralPlay(db, userId, start, end);
    return c > 0 ? 1 : 0;
  },

  weekly_top_market: (userId, start, end) =>
    achWinTopMarketUserTraded(db, userId, start, end),
};

// ── Achievement Engine ─────────────────────────────────────────────

/**
 * Check and potentially unlock achievements + advance challenges for a user.
 * This is the main entry point called from route handlers (fire-and-forget).
 */
export async function checkProgress(
  userId: string,
  event: AchievementEvent
): Promise<void> {
  const eventType = event.type as AchievementEventType;
  const relevantTrackingTypes = EVENT_TO_TRACKING_TYPES[eventType];
  if (!relevantTrackingTypes || relevantTrackingTypes.length === 0) return;

  try {
    await Promise.all([
      checkAchievements(userId, relevantTrackingTypes),
      checkChallenges(userId, event, relevantTrackingTypes),
    ]);
  } catch (error) {
    // Log but don't rethrow — checkProgress is fire-and-forget
    logger.error(
      'checkProgress failed',
      {
        userId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'AchievementService'
    );
  }
}

async function checkAchievements(
  userId: string,
  relevantTrackingTypes: string[]
): Promise<void> {
  // Find achievement definitions whose trackingType matches
  const relevantAchievements = ACHIEVEMENT_DEFINITIONS.filter((a) =>
    relevantTrackingTypes.includes(a.trackingType)
  );
  if (relevantAchievements.length === 0) return;

  const unlockedIds = await selectUnlockedAchievementIdsForUser(
    db,
    userId,
    relevantAchievements.map((a) => a.id)
  );
  const unlockedSet = new Set(unlockedIds);

  // Check each non-unlocked achievement
  for (const achievement of relevantAchievements) {
    if (unlockedSet.has(achievement.id)) continue;

    const resolver = ACHIEVEMENT_RESOLVERS[achievement.trackingType];
    if (!resolver) {
      logger.warn(
        `No achievement resolver for trackingType: ${achievement.trackingType}`,
        undefined,
        'AchievementService'
      );
      continue;
    }

    const progress = await resolver(userId);
    if (progress >= achievement.threshold) {
      await unlockAchievement(userId, achievement);
    }
  }
}

async function unlockAchievement(
  userId: string,
  achievement: AchievementDef
): Promise<void> {
  const inserted = await insertUserAchievementIfNew(db, {
    id: await generateSnowflakeId(),
    userId,
    achievementId: achievement.id,
    pointsAwarded: achievement.pointsReward,
    unlockedAt: new Date(),
  });

  if (!inserted) return;

  // Award points
  await PointsService.awardPoints(
    userId,
    achievement.pointsReward,
    'achievement_unlock',
    {
      achievementId: achievement.id,
      achievementName: achievement.name,
      tier: achievement.tier,
    }
  );

  // Create notification + SSE broadcast (both required)
  await createNotification({
    userId,
    type: 'achievement_unlocked',
    title: `Achievement Unlocked: ${achievement.name}`,
    message: `+${achievement.pointsReward} points`,
  });

  await broadcastToChannel(`notifications:${userId}`, {
    type: 'achievement_unlocked',
    achievementId: achievement.id,
    name: achievement.name,
    tier: achievement.tier,
    pointsReward: achievement.pointsReward,
    iconKey: achievement.iconKey,
  });

  logger.info(
    `Achievement unlocked: ${achievement.id} for user ${userId}`,
    {
      achievementId: achievement.id,
      tier: achievement.tier,
      points: achievement.pointsReward,
    },
    'AchievementService'
  );
}

// ── Challenge Engine ───────────────────────────────────────────────

async function checkChallenges(
  userId: string,
  _event: AchievementEvent,
  relevantTrackingTypes: string[]
): Promise<void> {
  const now = new Date();
  const dailyIds = getActiveDailyChallengeIds(now);
  const weeklyIds = getActiveWeeklyChallengeIds(now);

  // Find active challenge definitions whose trackingType matches
  const allActiveIds = [...dailyIds, ...weeklyIds];
  const relevantChallenges = ALL_CHALLENGE_DEFINITIONS.filter(
    (c) =>
      allActiveIds.includes(c.id) &&
      relevantTrackingTypes.includes(c.trackingType)
  );
  if (relevantChallenges.length === 0) return;

  for (const challenge of relevantChallenges) {
    try {
      const isDaily = challenge.pool === 'daily';
      const periodKey = isDaily ? getUTCDateString(now) : getISOWeekString(now);
      const start = isDaily ? getStartOfUTCDay(now) : getStartOfISOWeek(now);
      const end = isDaily ? getEndOfUTCDay(now) : getEndOfISOWeek(now);

      const existingRow = await selectChallengeProgressRow(
        db,
        userId,
        challenge.id,
        periodKey
      );

      if (existingRow?.completed === 1) continue;

      // Resolve current progress
      const resolver = CHALLENGE_RESOLVERS[challenge.trackingType];
      if (!resolver) {
        logger.warn(
          `No challenge resolver for trackingType: ${challenge.trackingType}`,
          undefined,
          'AchievementService'
        );
        continue;
      }

      const progress = await resolver(userId, start, end);
      const completed = progress >= challenge.threshold ? 1 : 0;
      const completedAt = completed ? new Date() : null;

      // Track whether this request actually transitioned to completed
      let didComplete = false;

      if (existingRow) {
        if (completed && !existingRow.completed) {
          const updated = await updateChallengeProgressCompletedTransition(
            db,
            existingRow.id,
            {
              progress,
              completed,
              completedAt,
              pointsAwarded: challenge.pointsReward,
            }
          );
          didComplete = !!updated;
        } else {
          await updateChallengeProgressInPlace(db, existingRow.id, {
            progress,
            completed,
            completedAt,
          });
        }
      } else {
        const inserted = await insertUserChallengeProgressIfNew(db, {
          id: await generateSnowflakeId(),
          userId,
          challengeId: challenge.id,
          periodKey,
          progress,
          completed,
          completedAt,
          pointsAwarded: completed ? challenge.pointsReward : 0,
        });
        didComplete = completed === 1 && !!inserted;
      }

      // Award points only if this request actually transitioned to completed
      if (didComplete) {
        await PointsService.awardPoints(
          userId,
          challenge.pointsReward,
          'challenge_complete',
          {
            challengeId: challenge.id,
            challengeName: challenge.name,
            periodKey,
          }
        );

        await createNotification({
          userId,
          type: 'challenge_completed',
          title: `Challenge Complete: ${challenge.name}`,
          message: `+${challenge.pointsReward} points`,
        });

        await broadcastToChannel(`notifications:${userId}`, {
          type: 'challenge_completed',
          challengeId: challenge.id,
          name: challenge.name,
          pointsReward: challenge.pointsReward,
          iconKey: challenge.iconKey,
        });

        // Check for all-complete bonus
        await checkCompletionBonus(
          userId,
          challenge.pool,
          periodKey,
          isDaily ? dailyIds : weeklyIds
        );
      }
    } catch (error) {
      logger.error(
        `Challenge check failed for ${challenge.id}`,
        {
          userId,
          challengeId: challenge.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'AchievementService'
      );
    }
  }
}

async function checkCompletionBonus(
  userId: string,
  pool: 'daily' | 'weekly',
  periodKey: string,
  activeIds: string[]
): Promise<void> {
  const target = pool === 'daily' ? 3 : 2;
  const completedCount = await countUserCompletedChallengesForPeriod(
    db,
    userId,
    periodKey,
    activeIds
  );
  if (completedCount !== target) return;

  const bonusPeriodKey = `${periodKey}:bonus`;
  const bonusExisting = await countChallengeBonusRowsForPeriod(
    db,
    userId,
    bonusPeriodKey
  );
  if (bonusExisting > 0) return;

  const bonus =
    pool === 'daily'
      ? POINTS.CHALLENGE_DAILY_ALL_BONUS
      : POINTS.CHALLENGE_WEEKLY_ALL_BONUS;

  const insertedBonus = await insertChallengeBonusMarkerIfNew(db, {
    id: await generateSnowflakeId(),
    userId,
    challengeId: `${pool}_all_bonus`,
    periodKey: bonusPeriodKey,
    progress: target,
    completed: 1,
    completedAt: new Date(),
    pointsAwarded: bonus,
  });

  if (!insertedBonus) return;

  await PointsService.awardPoints(userId, bonus, 'challenge_complete', {
    type: `${pool}_all_bonus`,
    periodKey,
  });

  await broadcastToChannel(`notifications:${userId}`, {
    type: 'challenge_bonus',
    pool,
    bonus,
  });

  logger.info(
    `${pool} completion bonus awarded to user ${userId}: +${bonus}`,
    { pool, periodKey, bonus },
    'AchievementService'
  );
}

// ── Query Methods (for API endpoints) ──────────────────────────────

export interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  iconKey: string;
  pointsReward: number;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: Date | null;
}

export async function getUserAchievements(
  userId: string
): Promise<AchievementWithProgress[]> {
  const unlocked = await selectUserAchievementUnlockRows(db, userId);

  const unlockedMap = new Map(
    unlocked.map((u) => [u.achievementId, u.unlockedAt])
  );

  // Build result with progress for each achievement
  const results: AchievementWithProgress[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const isUnlocked = unlockedMap.has(def.id);
    let progress = 0;

    if (isUnlocked) {
      progress = def.threshold; // Already done
    } else {
      const resolver = ACHIEVEMENT_RESOLVERS[def.trackingType];
      if (resolver) {
        progress = await resolver(userId);
      }
    }

    results.push({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      tier: def.tier,
      iconKey: def.iconKey,
      pointsReward: def.pointsReward,
      threshold: def.threshold,
      progress: Math.min(progress, def.threshold),
      unlocked: isUnlocked,
      unlockedAt: unlockedMap.get(def.id) ?? null,
    });
  }

  return results;
}

export interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  iconKey: string;
  pointsReward: number;
  threshold: number;
  progress: number;
  completed: boolean;
  completedAt: Date | null;
}

export interface ChallengesResponse {
  daily: {
    challenges: ChallengeWithProgress[];
    allCompletedBonus: number;
    allCompleted: boolean;
    resetsAt: string;
  };
  weekly: {
    challenges: ChallengeWithProgress[];
    allCompletedBonus: number;
    allCompleted: boolean;
    resetsAt: string;
  };
}

export async function getUserChallenges(
  userId: string
): Promise<ChallengesResponse> {
  const now = new Date();
  const dailyPeriodKey = getUTCDateString(now);
  const weeklyPeriodKey = getISOWeekString(now);

  const dailyIds = getActiveDailyChallengeIds(now);
  const weeklyIds = getActiveWeeklyChallengeIds(now);

  const progressRows = await selectUserChallengeProgressForPeriodKeys(
    db,
    userId,
    [dailyPeriodKey, weeklyPeriodKey]
  );

  const progressMap = new Map(progressRows.map((r) => [r.challengeId, r]));

  const buildChallenges = async (
    ids: string[],
    pool: ChallengeDef[],
    _periodKey: string
  ): Promise<ChallengeWithProgress[]> => {
    const results: ChallengeWithProgress[] = [];

    for (const id of ids) {
      const def = pool.find((c) => c.id === id);
      if (!def) continue;

      const existing = progressMap.get(id);
      let progress = existing?.progress ?? 0;
      const completed = existing?.completed === 1;

      // If not completed and we have a resolver, get fresh progress
      if (!completed) {
        const isDaily = def.pool === 'daily';
        const start = isDaily ? getStartOfUTCDay(now) : getStartOfISOWeek(now);
        const end = isDaily ? getEndOfUTCDay(now) : getEndOfISOWeek(now);
        const resolver = CHALLENGE_RESOLVERS[def.trackingType];
        if (resolver) {
          progress = await resolver(userId, start, end);
        }
      }

      results.push({
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        iconKey: def.iconKey,
        pointsReward: def.pointsReward,
        threshold: def.threshold,
        progress: Math.min(progress, def.threshold),
        completed,
        completedAt: existing?.completedAt ?? null,
      });
    }

    return results;
  };

  const dailyChallenges = await buildChallenges(
    dailyIds,
    DAILY_CHALLENGE_DEFINITIONS,
    dailyPeriodKey
  );
  const weeklyChallenges = await buildChallenges(
    weeklyIds,
    WEEKLY_CHALLENGE_DEFINITIONS,
    weeklyPeriodKey
  );

  const dailyAllCompleted =
    dailyChallenges.length === 3 && dailyChallenges.every((c) => c.completed);
  const weeklyAllCompleted =
    weeklyChallenges.length === 2 && weeklyChallenges.every((c) => c.completed);

  // Calculate reset times
  const dailyResetsAt = getEndOfUTCDay(now).toISOString();
  const weeklyResetsAt = getEndOfISOWeek(now).toISOString();

  return {
    daily: {
      challenges: dailyChallenges,
      allCompletedBonus: POINTS.CHALLENGE_DAILY_ALL_BONUS,
      allCompleted: dailyAllCompleted,
      resetsAt: dailyResetsAt,
    },
    weekly: {
      challenges: weeklyChallenges,
      allCompletedBonus: POINTS.CHALLENGE_WEEKLY_ALL_BONUS,
      allCompleted: weeklyAllCompleted,
      resetsAt: weeklyResetsAt,
    },
  };
}

export async function getRecentAchievements(
  userId: string,
  limit = 5
): Promise<AchievementWithProgress[]> {
  const recent = await selectRecentUserAchievementRows(db, userId, limit);

  return recent.map((r) => {
    const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.id === r.achievementId);
    if (!def) {
      return {
        id: r.achievementId,
        name: 'Unknown',
        description: '',
        category: '',
        tier: 'bronze',
        iconKey: 'award',
        pointsReward: 0,
        threshold: 1,
        progress: 1,
        unlocked: true,
        unlockedAt: r.unlockedAt,
      };
    }
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      tier: def.tier,
      iconKey: def.iconKey,
      pointsReward: def.pointsReward,
      threshold: def.threshold,
      progress: def.threshold,
      unlocked: true,
      unlockedAt: r.unlockedAt,
    };
  });
}
