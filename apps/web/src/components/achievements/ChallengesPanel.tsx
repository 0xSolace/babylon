'use client';

import { POINTS } from '@babylon/shared';
import { Clock, Flame, Target, Trophy, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  iconKey: string;
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

const CATEGORY_ICONS: Record<string, typeof Target> = {
  trading: Zap,
  social: Flame,
  exploration: Target,
  agents: Trophy,
};

function formatCountdown(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return 'Resetting...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function ChallengeItem({ challenge }: { challenge: ChallengeWithProgress }) {
  const Icon = CATEGORY_ICONS[challenge.category] ?? Target;
  const progressPct = Math.min(
    100,
    (challenge.progress / challenge.threshold) * 100
  );

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        challenge.completed
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 shrink-0 ${challenge.completed ? 'text-green-500' : 'text-muted-foreground'}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4
              className={`font-medium text-sm ${challenge.completed ? 'text-green-500' : 'text-foreground'}`}
            >
              {challenge.name}
            </h4>
            <span
              className={`shrink-0 font-bold text-xs ${challenge.completed ? 'text-green-500' : 'text-yellow-500'}`}
            >
              {challenge.completed ? '  Done' : `+${challenge.pointsReward}`}
            </span>
          </div>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {challenge.description}
          </p>
          {!challenge.completed && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {challenge.progress}/{challenge.threshold}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChallengesPanel() {
  const { authenticated, getAccessToken } = useAuth();
  const [data, setData] = useState<ChallengesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ daily: '', weekly: '' });

  const fetchChallenges = useCallback(async () => {
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
      setData(json.data ?? json);
    }
    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    const update = () => {
      setCountdown({
        daily: formatCountdown(data.daily.resetsAt),
        weekly: formatCountdown(data.weekly.resetsAt),
      });
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Daily Challenges */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="font-bold text-base text-foreground">
              Daily Challenges
            </h2>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            {countdown.daily}
          </div>
        </div>

        <div className="space-y-2">
          {data.daily.challenges.map((c) => (
            <ChallengeItem key={c.id} challenge={c} />
          ))}
        </div>

        {/* All-complete bonus */}
        <div
          className={`mt-3 rounded-lg border border-dashed p-2 text-center text-xs ${
            data.daily.allCompleted
              ? 'border-green-500/30 bg-green-500/5 text-green-500'
              : 'border-border text-muted-foreground'
          }`}
        >
          {data.daily.allCompleted
            ? `All 3 complete! +${POINTS.CHALLENGE_DAILY_ALL_BONUS} bonus earned`
            : `Complete all 3 for +${POINTS.CHALLENGE_DAILY_ALL_BONUS} bonus`}
        </div>
      </div>

      {/* Weekly Challenges */}
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-500" />
            <h2 className="font-bold text-base text-foreground">
              Weekly Challenges
            </h2>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            {countdown.weekly}
          </div>
        </div>

        <div className="space-y-2">
          {data.weekly.challenges.map((c) => (
            <ChallengeItem key={c.id} challenge={c} />
          ))}
        </div>

        {/* All-complete bonus */}
        <div
          className={`mt-3 rounded-lg border border-dashed p-2 text-center text-xs ${
            data.weekly.allCompleted
              ? 'border-green-500/30 bg-green-500/5 text-green-500'
              : 'border-border text-muted-foreground'
          }`}
        >
          {data.weekly.allCompleted
            ? `Both complete! +${POINTS.CHALLENGE_WEEKLY_ALL_BONUS} bonus earned`
            : `Complete both for +${POINTS.CHALLENGE_WEEKLY_ALL_BONUS} bonus`}
        </div>
      </div>
    </div>
  );
}
