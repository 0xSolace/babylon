'use client';

import { Calendar, Clock } from 'lucide-react';
import { ReactNode } from 'react';

interface ChallengeSectionProps {
  title: string;
  timeRemaining: string;
  variant?: 'daily' | 'weekly';
  children: ReactNode;
}

export function ChallengeSection({
  title,
  timeRemaining,
  variant = 'daily',
  children,
}: ChallengeSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {variant === 'daily' ? (
            <Clock className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Calendar className="h-5 w-5 text-muted-foreground" />
          )}
          <h2 className="font-semibold text-foreground text-lg">{title}</h2>
        </div>
        <span className="text-muted-foreground text-sm">{timeRemaining}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
