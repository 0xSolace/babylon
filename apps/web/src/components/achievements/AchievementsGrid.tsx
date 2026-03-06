'use client';

import {
  Award,
  Lock,
  MessageSquare,
  Search,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AchievementWithProgress {
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
  unlockedAt: string | null;
}

const DEFAULT_TIER_STYLE = {
  border: 'border-amber-600/40',
  bg: 'bg-amber-600/10',
  text: 'text-amber-600',
  badge: 'bg-amber-600/20 text-amber-600',
};

const TIER_STYLES: Record<
  string,
  { border: string; bg: string; text: string; badge: string }
> = {
  bronze: {
    border: 'border-amber-600/40',
    bg: 'bg-amber-600/10',
    text: 'text-amber-600',
    badge: 'bg-amber-600/20 text-amber-600',
  },
  silver: {
    border: 'border-slate-400/40',
    bg: 'bg-slate-400/10',
    text: 'text-slate-400',
    badge: 'bg-slate-400/20 text-slate-400',
  },
  gold: {
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-500',
  },
};

const ICON_MAP: Record<string, typeof Trophy> = {
  trophy: Trophy,
  target: Target,
  zap: Zap,
  swords: Swords,
  users: Users,
  'message-square': MessageSquare,
  search: Search,
  'trending-up': TrendingUp,
  award: Award,
};

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading',
  agents: 'Agents',
  social: 'Social',
  exploration: 'Exploration',
};

function AchievementCard({
  achievement,
}: {
  achievement: AchievementWithProgress;
}) {
  const style = TIER_STYLES[achievement.tier] ?? DEFAULT_TIER_STYLE;
  const Icon = ICON_MAP[achievement.iconKey] ?? Award;
  const progressPct = Math.min(
    100,
    (achievement.progress / achievement.threshold) * 100
  );

  return (
    <div
      className={`relative rounded-lg border p-3 transition-all ${
        achievement.unlocked
          ? `${style.border} ${style.bg}`
          : 'border-border opacity-80'
      }`}
    >
      {/* Tier badge */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 font-medium text-xs capitalize ${style.badge}`}
        >
          {achievement.tier}
        </span>
        <span
          className={`font-bold text-xs ${achievement.unlocked ? 'text-green-500' : 'text-yellow-500'}`}
        >
          {achievement.unlocked ? 'Unlocked' : `+${achievement.pointsReward}`}
        </span>
      </div>

      {/* Icon + Name */}
      <div className="mb-1.5 flex items-center gap-2">
        <div
          className={
            achievement.unlocked ? style.text : 'text-muted-foreground'
          }
        >
          {achievement.unlocked ? (
            <Icon className="h-5 w-5" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
        </div>
        <h3
          className={`font-semibold text-sm ${achievement.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {achievement.name}
        </h3>
      </div>

      {/* Description */}
      <p className="mb-2 text-muted-foreground text-xs leading-relaxed">
        {achievement.description}
      </p>

      {/* Progress bar (only if not unlocked) */}
      {!achievement.unlocked && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {achievement.progress}/{achievement.threshold}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-1.5 rounded-full transition-all ${style.text.replace('text-', 'bg-')}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Unlocked date */}
      {achievement.unlocked && achievement.unlockedAt && (
        <p className="mt-1 text-muted-foreground text-xs">
          {new Date(achievement.unlockedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export function AchievementsGrid() {
  const { authenticated, getAccessToken } = useAuth();
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)];
  const filtered =
    filter === 'all'
      ? achievements
      : achievements.filter((a) => a.category === filter);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-500" />
          <h2 className="font-bold text-base text-foreground">Achievements</h2>
          <span className="text-muted-foreground text-xs">
            {unlockedCount}/{achievements.length}
          </span>
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`shrink-0 rounded-full px-3 py-1 font-medium text-xs transition-colors ${
              filter === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((a) => (
          <AchievementCard key={a.id} achievement={a} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No achievements in this category
        </div>
      )}
    </div>
  );
}
