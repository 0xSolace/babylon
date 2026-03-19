'use client';

import { POINTS } from '@babylon/shared';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Gift,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { ChallengeCard } from './challenge-card';

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  nextReward: number;
  daysUntilMilestone: number;
  nextMilestone: number;
  lastClaim: string | null;
  canClaim: boolean;
  totalDailyLogins: number;
}

interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  pointsReward: number;
  threshold: number;
  progress: number;
  completed: boolean;
}

interface DailyChallengesData {
  challenges: ChallengeWithProgress[];
  allCompletedBonus: number;
  allCompleted: boolean;
  resetsAt: string;
}

interface WeeklyChallengesData {
  challenges: ChallengeWithProgress[];
  allCompletedBonus: number;
  allCompleted: boolean;
  resetsAt: string;
}

interface AchievementFromApi {
  id: string;
  name: string;
  tier: string;
  pointsReward: number;
  unlocked: boolean;
  progress: number;
  threshold: number;
}

interface OverviewTabProps {
  onClaim: () => Promise<boolean>;
  onViewAchievements: () => void;
}

function formatCountdown(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return 'Resetting...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d remaining`;
  }
  return `${hours}h remaining`;
}

function AchievementPreviewCard({
  name,
  tier,
  points,
  unlocked,
  progress,
  threshold,
}: {
  name: string;
  tier: string;
  points: number;
  unlocked: boolean;
  progress: number;
  threshold: number;
}) {
  const badgeColor =
    tier === 'silver' ? 'text-muted-foreground' : 'text-[#F59E0B]';
  const badgeBg = tier === 'silver' ? 'bg-muted' : 'bg-[#F59E0B]/10';
  const tierLabel =
    tier === 'bronze' ? 'Bronze' : tier === 'silver' ? 'Silver' : 'Gold';
  const hasProgress = !unlocked && threshold > 1 && progress > 0;
  const progressPercent = hasProgress ? (progress / threshold) * 100 : 0;

  return (
    <div
      className={`flex min-w-[160px] flex-col items-center rounded-xl border p-4 ${
        unlocked
          ? 'border-t-border border-r-border border-b-border border-l-4 border-l-[#10B981] bg-card'
          : 'border-border bg-card'
      }`}
    >
      {/* Icon Circle */}
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          unlocked ? 'border-[#F59E0B] border-[3px] bg-card' : 'bg-muted'
        }`}
      >
        {unlocked ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F59E0B]">
            <Check className="h-5 w-5 text-white" strokeWidth={3} />
          </div>
        ) : (
          <svg
            className="h-5 w-5 text-muted-foreground/40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
            <path d="M5 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
            <path d="M19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
          </svg>
        )}
      </div>

      {/* Title */}
      <h4
        className={`mt-3 text-center font-medium text-sm ${
          unlocked ? 'text-[#F59E0B]' : 'text-foreground'
        }`}
      >
        {name}
      </h4>

      {/* Badge + Points */}
      <div
        className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-[10px] ${badgeBg}`}
      >
        <span className={badgeColor}>{tierLabel}</span>
        <span className={badgeColor}>·</span>
        <span className={badgeColor}>+{points}</span>
      </div>

      {/* Progress Bar */}
      {hasProgress && (
        <div className="mt-3 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#5B5FC7]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            {progress}/{threshold}
          </p>
        </div>
      )}
    </div>
  );
}

export function OverviewTab({ onClaim, onViewAchievements }: OverviewTabProps) {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [dailyData, setDailyData] = useState<DailyChallengesData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyChallengesData | null>(
    null
  );
  const [achievementPreviews, setAchievementPreviews] = useState<
    AchievementFromApi[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ daily: '', weekly: '' });
  const [claiming, setClaiming] = useState(false);

  const fetchData = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const [streakRes, challengesRes, achievementsRes] = await Promise.all([
      fetch('/api/users/daily-login', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/challenges', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/achievements', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (streakRes.ok) {
      const json = await streakRes.json();
      setStreak(json);
    }

    if (challengesRes.ok) {
      const json = await challengesRes.json();
      setDailyData(json.daily);
      setWeeklyData(json.weekly);
    }

    if (achievementsRes.ok) {
      const json = await achievementsRes.json();
      setAchievementPreviews((json.achievements ?? []).slice(0, 4));
    }

    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch on SSE events
  const handleSSE = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string;
      if (
        type === 'challenge_completed' ||
        type === 'challenge_bonus' ||
        type === 'achievement_unlocked'
      ) {
        fetchData();
      }
    },
    [fetchData]
  );

  const channel =
    authenticated && user?.id ? (`notifications:${user.id}` as const) : null;
  useSSEChannel(channel, handleSSE);

  // Countdown timers
  useEffect(() => {
    if (!dailyData && !weeklyData) return;
    const update = () => {
      setCountdown({
        daily: dailyData ? formatCountdown(dailyData.resetsAt) : '',
        weekly: weeklyData ? formatCountdown(weeklyData.resetsAt) : '',
      });
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [dailyData, weeklyData]);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    const success = await onClaim();
    if (success) {
      await fetchData();
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-xl border border-border bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  const nextReward = streak?.nextReward ?? POINTS.DAILY_LOGIN_DAY_1;
  const dailyCompleted =
    dailyData?.challenges.filter((c) => c.completed).length ?? 0;
  const weeklyCompleted =
    weeklyData?.challenges.filter((c) => c.completed).length ?? 0;
  const progressPercent = streak
    ? (Math.min(streak.currentStreak, streak.nextMilestone) /
        streak.nextMilestone) *
      100
    : 0;

  return (
    <div className="space-y-6">
      {/* Daily Rewards Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#5B5FC7]" />
              <h2 className="font-semibold text-foreground text-lg">
                Daily Rewards
              </h2>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              Maintain your streak to unlock higher tiers
            </p>
          </div>

          {/* Day Streak Badge */}
          <div className="flex flex-col items-center rounded-lg border border-[#5B5FC7]/20 bg-[#5B5FC7]/5 px-4 py-2">
            <div className="flex items-center gap-1">
              <span className="font-bold text-2xl text-foreground">
                {streak?.currentStreak ?? 0}
              </span>
              <svg
                className="h-5 w-5 text-[#5B5FC7]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
                <path d="M5 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
                <path d="M19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
              </svg>
            </div>
            <span className="font-semibold text-[#5B5FC7] text-[10px] tracking-wider">
              DAY STREAK
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex gap-12">
          <div>
            <p className="text-muted-foreground text-xs">Next Reward</p>
            <p className="mt-1">
              <span className="font-bold text-2xl text-foreground">
                +{nextReward}
              </span>
              <span className="ml-1 text-muted-foreground text-xs">PTS</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Best Streak</p>
            <p className="mt-1">
              <span className="font-bold text-2xl text-foreground">
                {streak?.longestStreak ?? 0}
              </span>
              <span className="ml-1 text-muted-foreground text-xs">DAYS</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Claims</p>
            <p className="mt-1">
              <span className="font-bold text-2xl text-foreground">
                {streak?.totalDailyLogins ?? 0}
              </span>
              <span className="ml-1 text-muted-foreground text-xs">TIMES</span>
            </p>
          </div>
        </div>

        {/* Weekly Goal */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[10px] text-muted-foreground tracking-wider">
                WEEKLY GOAL
              </p>
              <p className="font-medium text-foreground text-sm">
                {streak?.nextMilestone ?? 7}-day milestone
              </p>
            </div>
            <span className="rounded-full bg-[#5B5FC7]/10 px-3 py-1 font-medium text-[#5B5FC7] text-xs">
              {streak?.daysUntilMilestone ?? 7} days left
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#5B5FC7] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={!streak?.canClaim || claiming}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-4 font-semibold text-sm text-white transition-colors ${
            streak?.canClaim && !claiming
              ? 'bg-[#5B5FC7] hover:bg-[#4a4eb3]'
              : 'cursor-not-allowed bg-[#5B5FC7]/50'
          }`}
        >
          <Gift className="h-5 w-5" />
          {claiming
            ? 'Claiming...'
            : streak?.canClaim
              ? `Claim +${nextReward} Points`
              : 'Already Claimed Today'}
        </button>
      </div>

      {/* Daily Challenges Section */}
      {dailyData && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground text-sm">
                Daily Challenges
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              {countdown.daily}
            </span>
          </div>

          <div className="space-y-3">
            {dailyData.challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                title={c.name}
                description={c.description}
                points={c.pointsReward}
                completed={c.completed}
                variant="daily"
                progress={
                  !c.completed && c.threshold > 1
                    ? { current: c.progress, total: c.threshold }
                    : undefined
                }
              />
            ))}

            {/* Bonus Tracker */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {dailyData.challenges.map((c, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < dailyCompleted
                          ? 'bg-[#5B5FC7]'
                          : 'bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">
                  Complete all {dailyData.challenges.length} ({dailyCompleted}/
                  {dailyData.challenges.length})
                </span>
              </div>
              <span className="text-muted-foreground text-sm">
                +{POINTS.CHALLENGE_DAILY_ALL_BONUS} bonus
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Challenges Section */}
      {weeklyData && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground text-sm">
                Weekly Challenges
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              {countdown.weekly}
            </span>
          </div>

          <div className="space-y-3">
            {weeklyData.challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                title={c.name}
                description={c.description}
                points={c.pointsReward}
                completed={c.completed}
                variant="weekly"
                progress={
                  !c.completed && c.threshold > 1
                    ? { current: c.progress, total: c.threshold }
                    : undefined
                }
              />
            ))}

            {/* Bonus Tracker */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {weeklyData.challenges.map((c, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < weeklyCompleted
                          ? 'bg-[#5B5FC7]'
                          : 'bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground text-sm">
                  Complete{' '}
                  {weeklyData.challenges.length === 2
                    ? 'both'
                    : `all ${weeklyData.challenges.length}`}{' '}
                  ({weeklyCompleted}/{weeklyData.challenges.length})
                </span>
              </div>
              <span className="text-muted-foreground text-sm">
                +{POINTS.CHALLENGE_WEEKLY_ALL_BONUS} bonus
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Preview Section */}
      {achievementPreviews.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#F59E0B]" />
              <span className="font-semibold text-foreground text-sm">
                Achievements
              </span>
            </div>
            <button
              onClick={onViewAchievements}
              className="flex items-center gap-1 font-medium text-[#5B5FC7] text-xs hover:text-[#4a4eb3]"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Achievement Cards Row */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {achievementPreviews.map((a) => (
              <AchievementPreviewCard
                key={a.id}
                name={a.name}
                tier={a.tier}
                points={a.pointsReward}
                unlocked={a.unlocked}
                progress={a.progress}
                threshold={a.threshold}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
