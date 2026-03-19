'use client';

import { Gift, Sparkles, Trophy } from 'lucide-react';
import { ProgressBar } from './progress-bar';

interface DailyRewardsCardProps {
  dayStreak: number;
  nextReward: number;
  bestStreak: number;
  totalClaims: number;
  weeklyGoal: { current: number; target: number; daysLeft: number };
  onClaim: () => void;
  canClaim?: boolean;
  claiming?: boolean;
}

export function DailyRewardsCard({
  dayStreak,
  nextReward,
  bestStreak,
  totalClaims,
  weeklyGoal,
  onClaim,
  canClaim = true,
  claiming = false,
}: DailyRewardsCardProps) {
  const progressPercent = (weeklyGoal.current / weeklyGoal.target) * 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-indigo-500" />
          <div>
            <h2 className="font-bold text-foreground text-xl">Daily Rewards</h2>
            <p className="text-muted-foreground text-sm">
              Maintain your streak to unlock higher tiers
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2">
          <div className="flex items-center gap-1">
            <span className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">
              {dayStreak}
            </span>
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="font-medium text-indigo-500 dark:text-indigo-400 text-xs uppercase tracking-wide">
            Day Streak
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div>
          <p className="text-muted-foreground text-sm">Next Reward</p>
          <p className="font-bold text-2xl text-indigo-500">
            +{nextReward}{' '}
            <span className="font-normal text-muted-foreground text-sm">
              PTS
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Best Streak</p>
          <p className="font-bold text-2xl text-foreground">
            {bestStreak}{' '}
            <span className="font-normal text-muted-foreground text-sm">
              DAYS
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Total Claims</p>
          <p className="font-bold text-2xl text-foreground">
            {totalClaims}{' '}
            <span className="font-normal text-muted-foreground text-sm">
              TIMES
            </span>
          </p>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Weekly Goal
            </p>
            <p className="font-semibold text-base text-foreground">
              {weeklyGoal.target}-day milestone
            </p>
          </div>
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-medium text-indigo-600 text-sm dark:text-indigo-400">
            {weeklyGoal.daysLeft} days left
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar progress={progressPercent} variant="indigo" />
        </div>
      </div>

      {/* Claim Button */}
      <button
        onClick={onClaim}
        disabled={!canClaim || claiming}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-base text-white transition-colors ${
          canClaim && !claiming
            ? 'bg-indigo-500 hover:bg-indigo-600'
            : 'cursor-not-allowed bg-indigo-300'
        }`}
      >
        <Gift className="h-5 w-5" />
        {claiming
          ? 'Claiming...'
          : canClaim
            ? `Claim +${nextReward} Points`
            : 'Already Claimed Today'}
      </button>
    </div>
  );
}
