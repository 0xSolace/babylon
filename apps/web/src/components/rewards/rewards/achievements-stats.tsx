'use client';

import { cn } from '@babylon/shared/utils';

type TierFilter = 'All' | 'Bronze' | 'Silver' | 'Gold';

interface AchievementsStatsProps {
  unlockedCount: number;
  totalCount: number;
  pointsEarned: number;
  activeFilter: TierFilter;
  onFilterChange: (filter: TierFilter) => void;
}

export function AchievementsStats({
  unlockedCount,
  totalCount,
  pointsEarned,
  activeFilter,
  onFilterChange,
}: AchievementsStatsProps) {
  const filters: TierFilter[] = ['All', 'Bronze', 'Silver', 'Gold'];

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-8">
        <div>
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Unlocked
          </p>
          <p className="font-bold text-2xl">
            <span className="text-amber-500">{unlockedCount}</span>
            <span className="text-muted-foreground">/{totalCount}</span>
          </p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Points Earned
          </p>
          <p className="font-bold text-2xl text-foreground">{pointsEarned}</p>
        </div>
      </div>
      <div className="flex rounded-lg border border-border bg-card">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={cn(
              'px-4 py-2 font-medium text-sm transition-colors',
              activeFilter === filter
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              filter === 'All' && 'rounded-l-lg',
              filter === 'Gold' && 'rounded-r-lg'
            )}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}
