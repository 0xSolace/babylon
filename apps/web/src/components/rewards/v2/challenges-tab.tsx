'use client';

import { POINTS } from '@babylon/shared';
import { Calendar, Clock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { ChallengeCard } from './challenge-card';

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

function BonusTracker({
  completed,
  total,
  bonus,
}: {
  completed: number;
  total: number;
  bonus: number;
}) {
  const label = total === 2 ? 'Complete both' : `Complete all ${total}`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < completed ? 'bg-[#5B5FC7]' : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {label} ({completed}/{total})
        </span>
      </div>
      <span className="text-sm text-muted-foreground">+{bonus} bonus</span>
    </div>
  );
}

export function ChallengesTab() {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [challengesData, setChallengesData] = useState<ChallengesData | null>(
    null
  );
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

    const res = await fetch('/api/challenges', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const json = await res.json();
      setChallengesData(json);
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
            className="h-16 animate-pulse rounded-lg border border-border bg-muted"
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
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Daily Challenges
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {countdown.daily}
          </span>
        </div>

        <div className="space-y-3">
          {challengesData.daily.challenges.map((c) => (
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
          <BonusTracker
            completed={dailyCompleted}
            total={challengesData.daily.challenges.length}
            bonus={POINTS.CHALLENGE_DAILY_ALL_BONUS}
          />
        </div>
      </div>

      {/* Weekly Challenges */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Weekly Challenges
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {countdown.weekly}
          </span>
        </div>

        <div className="space-y-3">
          {challengesData.weekly.challenges.map((c) => (
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
          <BonusTracker
            completed={weeklyCompleted}
            total={challengesData.weekly.challenges.length}
            bonus={POINTS.CHALLENGE_WEEKLY_ALL_BONUS}
          />
        </div>
      </div>

      {/* Footer Note */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Challenges rotate automatically — daily at midnight UTC and weekly on
          Monday. All challenges require play actions like trading, using agents,
          or chatting.
        </p>
      </div>
    </div>
  );
}
