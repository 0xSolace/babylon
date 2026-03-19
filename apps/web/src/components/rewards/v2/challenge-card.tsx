'use client';

import { Calendar, CheckCircle2, Clock } from 'lucide-react';

interface ChallengeCardProps {
  title: string;
  description?: string;
  points: number;
  completed: boolean;
  progress?: { current: number; total: number };
  variant?: 'daily' | 'weekly';
}

export function ChallengeCard({
  title,
  description,
  points,
  completed,
  progress,
  variant = 'daily',
}: ChallengeCardProps) {
  const percentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        completed
          ? 'border-[#10B981]/30 bg-[#10B981]/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {completed ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#10B981]" />
          ) : variant === 'daily' ? (
            <Clock className="mt-0.5 h-5 w-5 text-muted-foreground/40" />
          ) : (
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground/40" />
          )}
          <div>
            <h3
              className={`font-semibold text-sm ${
                completed ? 'text-[#10B981] line-through' : 'text-foreground'
              }`}
            >
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-muted-foreground text-xs">
                {description}
              </p>
            )}
          </div>
        </div>
        <span className="font-semibold text-[#10B981] text-sm">+{points}</span>
      </div>

      {progress && !completed && (
        <div className="mt-3 pl-8">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{percentage}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#5B5FC7]"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
