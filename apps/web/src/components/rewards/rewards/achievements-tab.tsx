'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AchievementCard } from './achievement-card';
import { AchievementsStats } from './achievements-stats';

type TierFilter = 'All' | 'Bronze' | 'Silver' | 'Gold';

interface AchievementFromApi {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold';
  iconKey: string;
  pointsReward: number;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

function mapTier(tier: string): 'Bronze' | 'Silver' | 'Gold' {
  if (tier === 'silver') return 'Silver';
  if (tier === 'gold') return 'Gold';
  return 'Bronze';
}

function mapStatus(
  a: AchievementFromApi
): 'completed' | 'in-progress' | 'locked' {
  if (a.unlocked) return 'completed';
  if (a.progress > 0) return 'in-progress';
  return 'locked';
}

export function AchievementsTab() {
  const { authenticated, getAccessToken } = useAuth();
  const [achievements, setAchievements] = useState<AchievementFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<TierFilter>('All');

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
      setAchievements(json.data?.achievements ?? json.achievements ?? []);
    }
    setLoading(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const filteredAchievements =
    activeFilter === 'All'
      ? achievements
      : achievements.filter((a) => mapTier(a.tier) === activeFilter);

  const completedCount = achievements.filter((a) => a.unlocked).length;
  const pointsEarned = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.pointsReward, 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AchievementsStats
        unlockedCount={completedCount}
        totalCount={achievements.length}
        pointsEarned={pointsEarned}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="space-y-3">
        {filteredAchievements.map((achievement) => (
          <AchievementCard
            key={achievement.id}
            title={achievement.name}
            description={achievement.description}
            points={achievement.pointsReward}
            tier={mapTier(achievement.tier)}
            status={mapStatus(achievement)}
            progress={
              !achievement.unlocked && achievement.threshold > 1
                ? {
                    current: achievement.progress,
                    total: achievement.threshold,
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
