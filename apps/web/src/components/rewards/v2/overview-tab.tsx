'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { ChallengeCard } from './challenge-card';
import { useAnimatedCount } from './use-animated-count';

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
  hint?: string;
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

interface OverviewTabProps {
  onClaim: () => Promise<boolean>;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Day checkpoints (1..n) along the bar; one marker per day for short milestones, subsampled for long ones. */
function milestoneMarkerDays(nextMilestone: number): number[] {
  if (nextMilestone <= 0) return [];
  if (nextMilestone <= 20) {
    return Array.from({ length: nextMilestone }, (_, i) => i + 1);
  }
  const maxMarkers = 10;
  const step = Math.max(1, Math.round(nextMilestone / maxMarkers));
  const days: number[] = [];
  for (let d = step; d < nextMilestone; d += step) {
    days.push(d);
  }
  days.push(nextMilestone);
  return [...new Set(days)].sort((a, b) => a - b);
}

function StreakCalendar({
  currentStreak,
  canClaim,
}: {
  currentStreak: number;
  canClaim: boolean;
}) {
  const todayDow = new Date().getDay();
  const streakDays = Math.min(currentStreak, 7);

  return (
    <div className="flex items-end justify-between gap-1.5 sm:gap-2">
      {Array.from({ length: 7 }).map((_, i) => {
        const daysAgo = 6 - i;
        const dow = (((todayDow - daysAgo) % 7) + 7) % 7;
        const day = DAY_LABELS[dow];
        const isToday = daysAgo === 0;
        const isCompleted = canClaim
          ? daysAgo >= 1 && daysAgo <= streakDays
          : daysAgo < streakDays;

        return (
          <div key={i}>
            <div
              className={`flex items-center justify-center transition-all duration-300 ${
                isToday ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-8 w-8 sm:h-9 sm:w-9'
              } rounded-full ${
                isCompleted
                  ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,102,255,0.3)]'
                  : 'border border-border bg-transparent text-muted-foreground'
              } ${isToday && !isCompleted ? 'border-2 border-primary/50' : ''}`}
            >
              {isCompleted ? (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="font-medium text-[11px]">{day}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OverviewTab({ onClaim }: OverviewTabProps) {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [dailyData, setDailyData] = useState<DailyChallengesData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyChallengesData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const autoClaimedRef = useRef(false);

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

    const [streakRes, challengesRes] = await Promise.all([
      fetch('/api/users/daily-login', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/challenges', {
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

    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-claim daily reward on load
  useEffect(() => {
    if (!streak?.canClaim || autoClaimedRef.current) return;
    autoClaimedRef.current = true;
    void onClaim().then((success) => {
      if (success) {
        fetchData();
      }
    });
  }, [streak?.canClaim, onClaim, fetchData]);

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

  const nextReward = streak?.nextReward ?? 50;
  const progressPercent = streak
    ? (Math.min(streak.currentStreak, streak.nextMilestone) /
        streak.nextMilestone) *
      100
    : 0;

  const animNextReward = useAnimatedCount(nextReward);
  const animBestStreak = useAnimatedCount(streak?.longestStreak ?? 0);
  const animTotalClaims = useAnimatedCount(streak?.totalDailyLogins ?? 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Daily Rewards ── */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 dark:from-primary/15 dark:via-primary/5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            Daily Rewards
          </h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary text-xs tabular-nums">
            {streak?.currentStreak ?? 0} day streak
          </span>
        </div>

        {/* Streak Calendar */}
        <div className="mt-3">
          <StreakCalendar
            currentStreak={streak?.currentStreak ?? 0}
            canClaim={streak?.canClaim ?? false}
          />
        </div>

        {/* Stats Row */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-lg bg-background/60 p-2.5 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[10px] text-muted-foreground">Next reward</p>
            <p className="font-bold text-foreground tabular-nums">
              +{animNextReward}
            </p>
          </div>
          <div className="flex-1 rounded-lg bg-background/60 p-2.5 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[10px] text-muted-foreground">Best streak</p>
            <p className="font-bold text-foreground tabular-nums">
              {animBestStreak}
              <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                d
              </span>
            </p>
          </div>
          <div className="flex-1 rounded-lg bg-background/60 p-2.5 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[10px] text-muted-foreground">Total claims</p>
            <p className="font-bold text-foreground tabular-nums">
              {animTotalClaims}
            </p>
          </div>
        </div>

        {/* Milestone Progress */}
        {streak && streak.nextMilestone > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-foreground">
                {streak.nextMilestone}-day milestone
              </p>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {streak.daysUntilMilestone} days left
              </span>
            </div>
            <div className="relative mt-1.5 h-1.5 w-full overflow-visible rounded-full bg-muted/60 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
              {milestoneMarkerDays(streak.nextMilestone).map((day) => {
                const pct = (day / streak.nextMilestone) * 100;
                return (
                  <div
                    key={day}
                    className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background ${
                      progressPercent >= pct
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                    }`}
                    style={{ left: `${pct}%` }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Challenges (combined daily + weekly) ── */}
      {(dailyData?.challenges.length || weeklyData?.challenges.length) && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold text-foreground text-sm">
            Challenges
          </h3>
          <div className="space-y-2">
            {dailyData?.challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                title={c.name}
                description={c.description}
                hint={c.hint}
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
            {weeklyData?.challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                title={c.name}
                description={c.description}
                hint={c.hint}
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
          </div>
        </div>
      )}
    </div>
  );
}
