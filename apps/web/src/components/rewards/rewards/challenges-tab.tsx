'use client';

import { POINTS } from '@babylon/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { AchievementPreview } from './achievement-preview';
import { BonusCard } from './bonus-card';
import { ChallengeCard } from './challenge-card';
import { ChallengeSection } from './challenge-section';

interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  pointsReward: number;
  threshold: number;
  progress: number;
  completed: boolean;
  completedAt: string | null;
}

interface ChallengesData {
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

interface AchievementFromApi {
  id: string;
  unlocked: boolean;
}

interface ChallengesTabProps {
  onViewAchievements: () => void;
}

export function formatCountdown(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return 'Resetting...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d remaining`;
  }
  return `${hours}h remaining`;
}

export function ChallengesTab({ onViewAchievements }: ChallengesTabProps) {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [challengesData, setChallengesData] = useState<ChallengesData | null>(
    null
  );
  const [achievementPreviews, setAchievementPreviews] = useState<
    { id: string; isCompleted: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ daily: '', weekly: '' });

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

    const [challengesRes, achievementsRes] = await Promise.all([
      fetch('/api/challenges', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('/api/achievements', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (challengesRes.ok) {
      const json = await challengesRes.json();
      setChallengesData(json);
    }

    if (achievementsRes.ok) {
      const json = await achievementsRes.json();
      const achievements: AchievementFromApi[] = json.achievements ?? [];
      setAchievementPreviews(
        achievements.slice(0, 4).map((a) => ({
          id: a.id,
          isCompleted: a.unlocked,
        }))
      );
    }

    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when SSE notifies of challenge/achievement completion
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

  // Countdown timer
  useEffect(() => {
    if (!challengesData) return;
    const update = () => {
      setCountdown({
        daily: formatCountdown(challengesData.daily.resetsAt),
        weekly: formatCountdown(challengesData.weekly.resetsAt),
      });
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [challengesData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
          />
        ))}
      </div>
    );
  }

  if (!challengesData) return null;

  const dailyCompleted = challengesData.daily.challenges.filter(
    (c) => c.completed
  ).length;
  const weeklyCompleted = challengesData.weekly.challenges.filter(
    (c) => c.completed
  ).length;

  return (
    <div className="space-y-8">
      {/* Daily Challenges */}
      <div className="space-y-3">
        <ChallengeSection
          title="Daily Challenges"
          timeRemaining={countdown.daily}
          variant="daily"
        >
          {challengesData.daily.challenges.map((c) => (
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
          totalCount={challengesData.daily.challenges.length}
          bonusPoints={POINTS.CHALLENGE_DAILY_ALL_BONUS}
        />
      </div>

      {/* Weekly Challenges */}
      <div className="space-y-3">
        <ChallengeSection
          title="Weekly Challenges"
          timeRemaining={countdown.weekly}
          variant="weekly"
        >
          {challengesData.weekly.challenges.map((c) => (
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
              variant="weekly"
            />
          ))}
        </ChallengeSection>
        <BonusCard
          completedCount={weeklyCompleted}
          totalCount={challengesData.weekly.challenges.length}
          bonusPoints={POINTS.CHALLENGE_WEEKLY_ALL_BONUS}
        />
      </div>

      {/* Achievements Preview */}
      <AchievementPreview
        achievements={achievementPreviews}
        onViewAll={onViewAchievements}
      />
    </div>
  );
}
