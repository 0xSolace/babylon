'use client';

import { POINTS } from '@babylon/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { BonusCard } from './bonus-card';
import { ChallengeCard } from './challenge-card';
import { ChallengeSection } from './challenge-section';
import { DailyRewardsCard } from './daily-rewards-card';

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

interface OverviewTabProps {
  onClaim: () => Promise<boolean>;
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

export function OverviewTab({ onClaim }: OverviewTabProps) {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [dailyData, setDailyData] = useState<DailyChallengesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
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
    }

    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when SSE notifies of challenge completion
  const handleSSE = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === 'challenge_completed' || type === 'challenge_bonus') {
        fetchData();
      }
    },
    [fetchData]
  );

  const channel =
    authenticated && user?.id ? (`notifications:${user.id}` as const) : null;
  useSSEChannel(channel, handleSSE);

  // Countdown timer for daily challenges
  useEffect(() => {
    if (!dailyData) return;
    const update = () => {
      setCountdown(formatCountdown(dailyData.resetsAt));
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [dailyData]);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    const success = await onClaim();
    if (success) {
      // Refresh streak data after claim
      await fetchData();
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
            />
          ))}
        </div>
      </div>
    );
  }

  const dailyCompleted =
    dailyData?.challenges.filter((c) => c.completed).length ?? 0;

  return (
    <div className="space-y-8">
      <DailyRewardsCard
        dayStreak={streak?.currentStreak ?? 0}
        nextReward={streak?.nextReward ?? POINTS.DAILY_LOGIN_DAY_1}
        bestStreak={streak?.longestStreak ?? 0}
        totalClaims={streak?.totalDailyLogins ?? 0}
        weeklyGoal={{
          current: streak?.currentStreak
            ? Math.min(streak.currentStreak, streak?.nextMilestone ?? 7)
            : 0,
          target: streak?.nextMilestone ?? 7,
          daysLeft: streak?.daysUntilMilestone ?? 7,
        }}
        onClaim={handleClaim}
        canClaim={streak?.canClaim ?? false}
        claiming={claiming}
      />

      {dailyData && (
        <div className="space-y-3">
          <ChallengeSection
            title="Daily Challenges"
            timeRemaining={countdown}
            variant="daily"
          >
            {dailyData.challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                title={c.name}
                description={c.description}
                points={c.pointsReward}
                isCompleted={c.completed}
                progress={
                  !c.completed && c.threshold > 1
                    ? { current: c.progress, total: c.threshold }
                    : undefined
                }
              />
            ))}
          </ChallengeSection>
          <BonusCard
            completedCount={dailyCompleted}
            totalCount={dailyData.challenges.length}
            bonusPoints={POINTS.CHALLENGE_DAILY_ALL_BONUS}
          />
        </div>
      )}
    </div>
  );
}
