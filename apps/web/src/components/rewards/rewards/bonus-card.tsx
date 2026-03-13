'use client';

import { cn } from '@babylon/shared/utils';

interface BonusCardProps {
  completedCount: number;
  totalCount: number;
  bonusPoints: number;
}

export function BonusCard({
  completedCount,
  totalCount,
  bonusPoints,
}: BonusCardProps) {
  const dots = Array.from({ length: totalCount }, (_, i) => i < completedCount);
  const label = totalCount === 2 ? 'both' : `all ${totalCount}`;

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {dots.map((filled, idx) => (
            <div
              key={idx}
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                filled ? 'bg-indigo-500' : 'bg-gray-300'
              )}
            />
          ))}
        </div>
        <span className="text-foreground text-sm">
          Complete {label} ({completedCount}/{totalCount})
        </span>
      </div>
      <span className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-foreground text-sm">
        +{bonusPoints} bonus
      </span>
    </div>
  );
}
