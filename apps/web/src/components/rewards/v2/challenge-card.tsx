'use client';

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
}: ChallengeCardProps) {
  const percentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div
      className={`border border-border p-3 transition-all ${
        completed ? 'border-emerald-500/20 bg-emerald-500/5' : 'bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={`font-semibold text-sm ${
              completed ? 'text-emerald-500' : 'text-foreground'
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
        {completed ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-[11px] text-emerald-500">
            +{points} ✓
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[11px] text-primary">
            +{points}
          </span>
        )}
      </div>

      {progress && !completed && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {progress.current} / {progress.total}
            </span>
            {percentage >= 75 && (
              <span className="font-medium text-[11px] text-amber-500">
                Almost there!
              </span>
            )}
          </div>
          <div className="mt-1 h-1.5 w-full bg-muted">
            <div
              className={`h-full transition-all ${
                percentage >= 67
                  ? 'bg-gradient-to-r from-primary to-amber-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
