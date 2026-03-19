'use client';

import { CheckCircle2, Lock } from 'lucide-react';

interface AchievementCardProps {
  title: string;
  description: string;
  badge: 'Bronze' | 'Silver' | 'Gold';
  points: number;
  status: 'completed' | 'in-progress' | 'locked';
  progress?: { current: number; total: number };
}

export function AchievementCard({
  title,
  description,
  badge,
  points,
  status,
  progress,
}: AchievementCardProps) {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in-progress';
  const percentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const progressDotColor = badge === 'Bronze' ? 'bg-[#F59E0B]' : 'bg-[#5B5FC7]';

  const getBadgeStyles = () => {
    if (badge === 'Bronze') return 'bg-[#F59E0B]/10 text-[#F59E0B]';
    if (badge === 'Silver') return 'bg-muted text-muted-foreground';
    return 'bg-[#F59E0B]/20 text-[#D97706] dark:text-[#F59E0B]';
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCompleted
          ? 'border-[#10B981]/30 bg-[#10B981]/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 items-center justify-center">
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
            ) : isInProgress ? (
              <div className={`h-2.5 w-2.5 rounded-full ${progressDotColor}`} />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground/50" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`font-semibold text-sm ${
                  isCompleted
                    ? 'text-[#10B981]'
                    : isLocked
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                }`}
              >
                {title}
              </h3>
              <span
                className={`rounded px-1.5 py-0.5 font-medium text-[10px] ${getBadgeStyles()}`}
              >
                {badge}
              </span>
            </div>
            <p
              className={`mt-0.5 text-xs ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
            >
              {description}
            </p>
          </div>
        </div>
        {points > 0 && (
          <span
            className={`font-semibold text-sm ${
              isCompleted ? 'text-[#10B981]' : 'text-muted-foreground'
            }`}
          >
            +{points}
          </span>
        )}
      </div>

      {progress && isInProgress && (
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
