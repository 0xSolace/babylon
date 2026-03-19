'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSSEChannel } from '@/hooks/useSSE';
import { useAuthStore } from '@/stores/authStore';
import { AchievementCard } from './achievement-card';

export interface AchievementFromApi {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold';
  pointsReward: number;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export function mapTier(tier: string): 'Bronze' | 'Silver' | 'Gold' {
  if (tier === 'silver') return 'Silver';
  if (tier === 'gold') return 'Gold';
  return 'Bronze';
}

export function mapStatus(
  a: AchievementFromApi
): 'completed' | 'in-progress' | 'locked' {
  if (a.unlocked) return 'completed';
  if (a.progress > 0) return 'in-progress';
  return 'locked';
}

type TierFilter = 'All' | 'Bronze' | 'Silver' | 'Gold';

export function AchievementsTab() {
  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const [achievements, setAchievements] = useState<AchievementFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TierFilter>('All');

  const fetchAchievements = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const res = await fetch('/api/achievements', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setAchievements(json.achievements ?? []);
    }
    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Re-fetch when SSE notifies of achievement unlock
  const handleSSE = useCallback(
    (data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === 'achievement_unlocked') {
        fetchAchievements();
      }
    },
    [fetchAchievements]
  );

  const channel =
    authenticated && user?.id ? (`notifications:${user.id}` as const) : null;
  useSSEChannel(channel, handleSSE);

  const filters: TierFilter[] = ['All', 'Bronze', 'Silver', 'Gold'];

  const filteredAchievements =
    filter === 'All'
      ? achievements
      : achievements.filter((a) => mapTier(a.tier) === filter);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const pointsEarned = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.pointsReward, 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Stats and Filter Row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-semibold text-[10px] text-muted-foreground tracking-wider">
              UNLOCKED
            </p>
            <p className="font-bold text-lg">
              <span className="text-foreground">{unlockedCount}</span>
              <span className="text-muted-foreground">/{totalCount}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="font-semibold text-[10px] text-muted-foreground tracking-wider">
              POINTS EARNED
            </p>
            <p className="font-bold text-foreground text-lg">{pointsEarned}</p>
          </div>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
                filter === f
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Achievement Cards */}
      <div className="space-y-3">
        {filteredAchievements.map((a) => (
          <AchievementCard
            key={a.id}
            title={a.name}
            description={a.description}
            badge={mapTier(a.tier)}
            points={a.pointsReward}
            status={mapStatus(a)}
            progress={
              !a.unlocked && a.threshold > 1
                ? { current: a.progress, total: a.threshold }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
