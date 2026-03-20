'use client';

import { POINTS } from '@babylon/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import type { AchievementFromApi } from './achievements-tab';
import { formatCountdown } from './challenges-tab';
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
  onViewAchievements: () => void;
  onViewChallenges: () => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function StreakCalendar({ currentStreak }: { currentStreak: number }) {
  const today = new Date().getDay();
  // Convert to Monday-based index (0=Mon, 6=Sun)
  const todayIdx = today === 0 ? 6 : today - 1;
  // How many days back does the streak go (capped at 7)
  const streakDays = Math.min(currentStreak, 7);

  return (
    <div className="flex items-end justify-between gap-1.5 sm:gap-2">
      {DAYS.map((day, i) => {
        const isToday = i === todayIdx;
        const isCompleted = i <= todayIdx && i > todayIdx - streakDays;

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

// TODO: remove mock data flag once APIs are populated
const USE_MOCK_DATA = true;

const MOCK_STREAK: StreakInfo = {
  currentStreak: 3,
  longestStreak: 5,
  nextReward: 125,
  daysUntilMilestone: 4,
  nextMilestone: 7,
  lastClaim: new Date().toISOString(),
  canClaim: false,
  totalDailyLogins: 12,
};

const MOCK_DAILY: DailyChallengesData = {
  challenges: [
    {
      id: 'd1',
      name: 'Join Discussion',
      description: "Reply to someone's comment",
      pointsReward: 40,
      threshold: 1,
      progress: 1,
      completed: true,
    },
    {
      id: 'd2',
      name: 'Post Comments',
      description: 'Leave 5 comments on posts',
      pointsReward: 60,
      threshold: 5,
      progress: 2,
      completed: false,
    },
    {
      id: 'd3',
      name: 'Agent Chat',
      description: 'Send a message to an agent',
      pointsReward: 35,
      threshold: 1,
      progress: 0,
      completed: false,
    },
  ],
  allCompletedBonus: 40,
  allCompleted: false,
  resetsAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
};

const MOCK_WEEKLY: WeeklyChallengesData = {
  challenges: [
    {
      id: 'w1',
      name: 'Bring a Friend',
      description: 'Refer someone who makes a trade',
      pointsReward: 250,
      threshold: 1,
      progress: 1,
      completed: true,
    },
    {
      id: 'w2',
      name: 'Trading Spree',
      description: 'Complete 10 trades this week',
      pointsReward: 170,
      threshold: 10,
      progress: 3,
      completed: false,
    },
  ],
  allCompletedBonus: 100,
  allCompleted: false,
  resetsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
};

const MOCK_ACHIEVEMENTS: AchievementFromApi[] = [
  {
    id: 'a1',
    name: 'First Prediction',
    description: 'Make your first prediction trade',
    category: 'trading',
    tier: 'bronze',
    pointsReward: 75,
    threshold: 1,
    progress: 1,
    unlocked: true,
    unlockedAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'a2',
    name: 'First Win',
    description: 'Win your first resolved prediction',
    category: 'trading',
    tier: 'silver',
    pointsReward: 150,
    threshold: 1,
    progress: 1,
    unlocked: true,
    unlockedAt: '2026-03-16T14:00:00Z',
  },
  {
    id: 'a3',
    name: 'Five Markets',
    description: 'Trade in 5 different markets',
    category: 'trading',
    tier: 'silver',
    pointsReward: 150,
    threshold: 5,
    progress: 3,
    unlocked: false,
    unlockedAt: null,
  },
  {
    id: 'a4',
    name: 'Agent Creator',
    description: 'Create your first agent',
    category: 'agents',
    tier: 'bronze',
    pointsReward: 100,
    threshold: 1,
    progress: 0,
    unlocked: false,
    unlockedAt: null,
  },
  {
    id: 'a5',
    name: 'Market Veteran',
    description: 'Trade in 25 different markets',
    category: 'trading',
    tier: 'gold',
    pointsReward: 300,
    threshold: 25,
    progress: 0,
    unlocked: false,
    unlockedAt: null,
  },
];

export function OverviewTab({
  onClaim,
  onViewAchievements,
  onViewChallenges,
}: OverviewTabProps) {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [dailyData, setDailyData] = useState<DailyChallengesData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyChallengesData | null>(
    null
  );
  const [achievements, setAchievements] = useState<AchievementFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ daily: '', weekly: '' });
  const [claiming, setClaiming] = useState(false);

  const fetchData = useCallback(async () => {
    if (USE_MOCK_DATA) {
      setStreak(MOCK_STREAK);
      setDailyData(MOCK_DAILY);
      setWeeklyData(MOCK_WEEKLY);
      setAchievements(MOCK_ACHIEVEMENTS);
      setLoading(false);
      return;
    }

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
      setAchievements(json.achievements ?? []);
    }

    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const nextReward = streak?.nextReward ?? POINTS.DAILY_LOGIN_DAY_1;
  const dailyCompleted =
    dailyData?.challenges.filter((c) => c.completed).length ?? 0;
  const dailyTotal = dailyData?.challenges.length ?? 0;
  const weeklyCompleted =
    weeklyData?.challenges.filter((c) => c.completed).length ?? 0;
  const weeklyTotal = weeklyData?.challenges.length ?? 0;
  const progressPercent = streak
    ? (Math.min(streak.currentStreak, streak.nextMilestone) /
        streak.nextMilestone) *
      100
    : 0;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalAchievements = achievements.length;
  const pointsEarned = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.pointsReward, 0);
  const achievementProgressPercent =
    totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;
  const challengePercent =
    dailyTotal + weeklyTotal > 0
      ? ((dailyCompleted + weeklyCompleted) / (dailyTotal + weeklyTotal)) * 100
      : 0;

  const animNextReward = useAnimatedCount(nextReward);
  const animBestStreak = useAnimatedCount(streak?.longestStreak ?? 0);
  const animTotalClaims = useAnimatedCount(streak?.totalDailyLogins ?? 0);
  const animPointsEarned = useAnimatedCount(pointsEarned);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-52 animate-pulse bg-muted" />
        <div className="h-28 animate-pulse bg-muted" />
        <div className="h-24 animate-pulse bg-muted" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* ── Hero: Daily Rewards ── */}
      <div className="-mx-4 -mt-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 pb-6 dark:from-primary/15 dark:via-primary/5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base text-foreground">
            Daily Rewards
          </h2>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 font-bold text-primary text-xs tabular-nums">
            {streak?.currentStreak ?? 0} day streak
          </span>
        </div>

        {/* Streak Calendar */}
        <div className="mt-4">
          <StreakCalendar currentStreak={streak?.currentStreak ?? 0} />
        </div>

        {/* Stats Row */}
        <div className="mt-5 flex gap-4 sm:gap-6">
          <div className="flex-1 bg-background/60 p-3 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[11px] text-muted-foreground">Next reward</p>
            <p className="font-bold text-foreground text-lg tabular-nums">
              +{animNextReward}
            </p>
          </div>
          <div className="flex-1 bg-background/60 p-3 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[11px] text-muted-foreground">Best streak</p>
            <p className="font-bold text-foreground text-lg tabular-nums">
              {animBestStreak}
              <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                d
              </span>
            </p>
          </div>
          <div className="flex-1 bg-background/60 p-3 backdrop-blur-sm dark:bg-background/40">
            <p className="text-[11px] text-muted-foreground">Total claims</p>
            <p className="font-bold text-foreground text-lg tabular-nums">
              {animTotalClaims}
            </p>
          </div>
        </div>

        {/* Milestone Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-foreground text-xs">
              {streak?.nextMilestone ?? 7}-day milestone
            </p>
            <span className="text-muted-foreground text-xs tabular-nums">
              {streak?.daysUntilMilestone ?? 7} days left
            </span>
          </div>
          <div className="relative mt-2 h-2 w-full overflow-visible bg-muted/60 backdrop-blur-sm">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Milestone markers */}
            {[25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className={`-translate-x-1/2 -translate-y-1/2 absolute top-1/2 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  progressPercent >= pct
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30'
                }`}
                style={{ left: `${pct}%` }}
              />
            ))}
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={handleClaim}
          disabled={!streak?.canClaim || claiming}
          className={`mt-5 flex w-full items-center justify-center py-3.5 font-semibold text-sm transition-all active:scale-[0.98] ${
            streak?.canClaim && !claiming
              ? 'animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-primary via-blue-500 to-primary text-white hover:shadow-depth'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {claiming
            ? 'Claiming...'
            : streak?.canClaim
              ? `Claim +${nextReward} Points`
              : 'Claimed Today ✓'}
        </button>
      </div>

      {/* ── Summaries: Challenges + Achievements ── */}
      <div className="mt-6 space-y-3">
        {/* Challenges Summary */}
        {(dailyData || weeklyData) && (
          <button
            onClick={onViewChallenges}
            className="block w-full animate-fadeIn border border-border bg-card p-4 text-left transition-all hover:border-emerald-500/30"
            style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground text-sm">
                Challenges
              </p>
              <span className="shrink-0 text-primary text-xs">View all →</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold text-emerald-500 text-sm tabular-nums">
                {dailyCompleted + weeklyCompleted}/{dailyTotal + weeklyTotal}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {countdown.daily}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-muted">
              <div
                className={`h-full transition-all duration-500 ${
                  challengePercent === 100
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                }`}
                style={{ width: `${challengePercent}%` }}
              />
            </div>
          </button>
        )}

        {/* Achievements Summary */}
        {achievements.length > 0 && (
          <button
            onClick={onViewAchievements}
            className="block w-full animate-fadeIn border border-border bg-card p-4 text-left transition-all hover:border-amber-500/30"
            style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground text-sm">
                Achievements
              </p>
              <span className="shrink-0 text-primary text-xs">View all →</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold text-amber-500 text-sm tabular-nums">
                {unlockedCount}/{totalAchievements}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {animPointsEarned} pts earned
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${achievementProgressPercent}%` }}
              />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
