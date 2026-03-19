'use client';

import { cn } from '@babylon/shared/utils';
import { Check, Lock } from 'lucide-react';
import { ProgressBar } from './progress-bar';

type AchievementTier = 'Bronze' | 'Silver' | 'Gold';
type AchievementStatus = 'completed' | 'in-progress' | 'locked';

interface AchievementCardProps {
  title: string;
  description: string;
  points: number;
  tier: AchievementTier;
  status: AchievementStatus;
  progress?: { current: number; total: number };
}

export function AchievementCard({
  title,
  description,
  points,
  tier,
  status,
  progress,
}: AchievementCardProps) {
  const hasProgress =
    progress && progress.total > 0 && status === 'in-progress';
  const progressPercent = hasProgress
    ? (progress.current / progress.total) * 100
    : 0;

  const tierColor: Record<AchievementTier, string> = {
    Bronze: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    Silver: 'bg-muted text-muted-foreground',
    Gold: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        status === 'completed'
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {status === 'completed' ? (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-4 w-4 text-white" />
            </div>
          ) : status === 'in-progress' ? (
            <div className="mt-0.5 flex h-3 w-3 rounded-full bg-amber-400" />
          ) : (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground">
              <Lock className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  'font-semibold',
                  status === 'completed'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : status === 'locked'
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                )}
              >
                {title}
              </h3>
              <span
                className={cn(
                  'rounded px-2 py-0.5 font-medium text-xs',
                  tierColor[tier]
                )}
              >
                {tier}
              </span>
            </div>
            <p className="mt-0.5 text-muted-foreground text-sm">
              {description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'rounded-md px-2.5 py-1 font-semibold text-sm',
            status === 'completed'
              ? 'bg-card text-emerald-500'
              : status === 'locked'
                ? 'text-muted-foreground'
                : 'bg-emerald-500/10 text-emerald-500'
          )}
        >
          +{points}
        </span>
      </div>
      {hasProgress && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-muted-foreground text-sm">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <ProgressBar progress={progressPercent} variant="indigo" />
        </div>
      )}
    </div>
  );
}
