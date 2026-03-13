'use client';

import { cn } from '@babylon/shared/utils';

interface ProgressBarProps {
  progress: number;
  className?: string;
  variant?: 'default' | 'indigo';
}

export function ProgressBar({
  progress,
  className,
  variant = 'default',
}: ProgressBarProps) {
  const bgColor = variant === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500';

  return (
    <div className={cn('h-1.5 w-full rounded-full bg-gray-200', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          bgColor
        )}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
