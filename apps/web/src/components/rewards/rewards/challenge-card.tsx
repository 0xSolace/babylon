'use client';

import { cn } from '@babylon/shared/utils';
import { Calendar, Check, Clock } from 'lucide-react';
import { ProgressBar } from './progress-bar';

interface ChallengeCardProps {
  title: string;
  description?: string;
  points: number;
  isCompleted?: boolean;
  progress?: { current: number; total: number };
  variant?: 'daily' | 'weekly';
}

export function ChallengeCard({
  title,
  description,
  points,
  isCompleted = false,
  progress,
  variant = 'daily',
}: ChallengeCardProps) {
  const hasProgress = progress && progress.total > 0;
  const progressPercent = hasProgress
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        isCompleted
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-200 bg-white'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {isCompleted ? (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-4 w-4 text-white" />
            </div>
          ) : variant === 'daily' ? (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
            </div>
          ) : (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border-2 border-indigo-400 text-indigo-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          )}
          <div>
            <h3
              className={cn(
                'font-semibold',
                isCompleted ? 'text-emerald-600' : 'text-foreground'
              )}
            >
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-muted-foreground text-sm">
                {description}
              </p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'rounded-md px-2.5 py-1 font-semibold text-sm',
            isCompleted
              ? 'bg-white text-emerald-500'
              : 'bg-emerald-50 text-emerald-500'
          )}
        >
          +{points}
        </span>
      </div>
      {hasProgress && !isCompleted && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-muted-foreground text-sm">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <ProgressBar progress={progressPercent} />
        </div>
      )}
    </div>
  );
}
