'use client';

/**
 * Airdrop Status Widget
 *
 * Displays the user's airdrop status and prompts them to take action:
 * - Initial claim (10%)
 * - Daily drip (2% per 20 hours)
 * - Progress bar showing vesting progress
 * - Countdown to next available drip
 */

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  CheckCircle,
  Circle,
  Gift,
  Heart,
  MessageCircle,
  Send,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AirdropStatus {
  success: boolean;
  registered: boolean;
  allocation?: {
    total: string;
    totalFormatted: string;
    bonusMultiplier: number;
    isElizaHolder: boolean;
  };
  drip?: {
    dripsUnlocked: number;
    totalDrips: number;
    percentUnlocked: number;
    canDripNow: boolean;
    isInitialClaimed: boolean;
    nextDripTime: string | null;
    nextDripAmount: string;
    nextDripAmountFormatted: string;
    cooldownHours: number;
  };
  claim?: {
    totalClaimed: string;
    totalClaimedFormatted: string;
    claimable: string;
    claimableFormatted: string;
    registeredOnChain: boolean;
  };
  action?: {
    required: boolean;
    type: 'initial_claim' | 'daily_drip' | 'wait' | 'complete';
    message: string;
    ctaText?: string;
  };
  engagement?: {
    dateKey: string;
    socialTrack: {
      liked: boolean;
      commented: boolean;
      posted: boolean;
      actionsComplete: number;
      required: number;
      complete: boolean;
    };
    tradingTrack: {
      traded: boolean;
      complete: boolean;
    };
    qualifiedForDrip: boolean;
    nextResetTime: string;
    gracePeriodActive: boolean;
  };
  message?: string;
}

interface DripResponse {
  success: boolean;
  canDrip: boolean;
  dripDay: number;
  amount: string;
  amountFormatted: string;
  isInitialClaim: boolean;
  nextDripTime: string | null;
  percentUnlocked: number;
  message: string;
}

export function AirdropStatusWidget() {
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState<string | null>(null);

  // Fetch airdrop status
  const {
    data: status,
    isLoading: loading,
    refetch: fetchStatus,
  } = useQuery({
    queryKey: ['airdrop', 'status'],
    queryFn: async (): Promise<AirdropStatus> => {
      const res = await fetch('/api/airdrop/status');
      return res.json() as Promise<AirdropStatus>;
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!status?.drip?.nextDripTime || status.drip.canDripNow) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const nextTime = new Date(status.drip!.nextDripTime!).getTime();
      const now = Date.now();
      const diff = Math.max(0, nextTime - now);

      if (diff === 0) {
        setCountdown(null);
        fetchStatus(); // Refresh status when cooldown ends
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [
    status?.drip?.nextDripTime,
    status?.drip?.canDripNow,
    fetchStatus,
    status?.drip,
  ]);

  // Claim drip mutation
  const claimMutation = useMutation({
    mutationFn: async (): Promise<DripResponse> => {
      const res = await fetch('/api/airdrop/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'visit' }),
      });
      return res.json() as Promise<DripResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.canDrip) {
        toast.success(data.message, {
          icon: data.isInitialClaim ? '🚀' : '💧',
          description: `${data.percentUnlocked}% of your airdrop is now unlocked!`,
        });
        queryClient.invalidateQueries({ queryKey: ['airdrop', 'status'] });
      } else {
        toast.info(data.message, {
          icon: '⏳',
        });
      }
    },
  });

  const handleClaim = () => {
    claimMutation.mutate();
  };

  const claiming = claimMutation.isPending;

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-border bg-card p-4">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="mt-3 h-4 w-full rounded bg-muted" />
        <div className="mt-2 h-10 w-full rounded bg-muted" />
      </div>
    );
  }

  if (!status?.success || !status.registered) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-amber-400" />
          <div>
            <p className="font-medium text-amber-300">BBLN Airdrop</p>
            <p className="text-muted-foreground text-sm">
              {status?.message ?? 'Register to claim your airdrop!'}
            </p>
          </div>
        </div>
        <a
          href="/rewards"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2 font-medium text-sm text-white transition-all hover:from-amber-600 hover:to-orange-600"
        >
          <Sparkles className="h-4 w-4" />
          View Airdrop Details
        </a>
      </div>
    );
  }

  const { allocation, drip, claim, action, engagement } = status;

  // Check if engagement is required for drip
  const needsEngagement =
    engagement && drip?.canDripNow && !engagement.qualifiedForDrip;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-amber-300">BBLN Airdrop</span>
        </div>
        {allocation?.isElizaHolder && (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-green-400 text-xs">
            ELIZA Holder
          </span>
        )}
      </div>

      {/* Allocation */}
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-muted-foreground text-sm">Total Allocation</span>
        <span className="font-bold text-lg">
          {allocation?.totalFormatted ?? '0 BBLN'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-muted-foreground">Vesting Progress</span>
          <span className="font-medium">{drip?.percentUnlocked ?? 0}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${Math.min(drip?.percentUnlocked ?? 0, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground text-xs">
          <span>
            Day {drip?.dripsUnlocked ?? 0} / {drip?.totalDrips ?? 46}
          </span>
          <span>{claim?.claimableFormatted ?? '0 BBLN'} claimable</span>
        </div>
      </div>

      {/* Engagement Tracking */}
      {engagement && (drip?.percentUnlocked ?? 0) < 100 && (
        <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-muted-foreground text-xs">
              Daily Engagement
            </span>
            {engagement.qualifiedForDrip ? (
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle className="h-3 w-3" />
                Qualified!
              </span>
            ) : (
              <span className="text-amber-400 text-xs">Complete 1 track</span>
            )}
          </div>

          {/* Social Track */}
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Social Track</span>
              <span
                className={
                  engagement.socialTrack.complete
                    ? 'text-green-400'
                    : 'text-muted-foreground'
                }
              >
                {engagement.socialTrack.actionsComplete}/
                {engagement.socialTrack.required}
              </span>
            </div>
            <div className="flex gap-2">
              <div
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  engagement.socialTrack.liked
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {engagement.socialTrack.liked ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <Heart className="h-3 w-3" />
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  engagement.socialTrack.commented
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {engagement.socialTrack.commented ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <MessageCircle className="h-3 w-3" />
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  engagement.socialTrack.posted
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {engagement.socialTrack.posted ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <Send className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Trading Track */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Trading Track</span>
              <span
                className={
                  engagement.tradingTrack.complete
                    ? 'text-green-400'
                    : 'text-muted-foreground'
                }
              >
                {engagement.tradingTrack.traded ? '1' : '0'}/1
              </span>
            </div>
            <div className="flex gap-2">
              <div
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  engagement.tradingTrack.traded
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-muted/50 text-muted-foreground'
                )}
              >
                {engagement.tradingTrack.traded ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <ArrowRightLeft className="h-3 w-3" />
                <span>Any Trade</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Area */}
      <div className="mt-4">
        {action?.type === 'complete' ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-400 text-sm">
            <TrendingUp className="h-4 w-4" />
            {action.message}
          </div>
        ) : needsEngagement ? (
          // Show engagement required message
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-amber-400 text-sm">
            <Sparkles className="h-4 w-4" />
            <span className="flex-1">
              Complete daily engagement above to unlock drip!
            </span>
          </div>
        ) : action?.required ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium text-sm text-white transition-all',
              action.type === 'initial_claim'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
              claiming && 'opacity-50'
            )}
          >
            {claiming ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Claiming...
              </>
            ) : (
              <>
                {action.type === 'initial_claim' ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Gift className="h-4 w-4" />
                )}
                {action.ctaText}
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-muted-foreground text-sm">
            <Timer className="h-4 w-4" />
            <span className="flex-1">{action?.message}</span>
            {countdown && (
              <span className="font-medium font-mono">{countdown}</span>
            )}
          </div>
        )}
      </div>

      {/* Next Drip Info */}
      {drip && !drip.canDripNow && (drip.percentUnlocked ?? 0) < 100 && (
        <p className="mt-2 text-center text-muted-foreground text-xs">
          Next: +{drip.nextDripAmountFormatted} (
          {drip.isInitialClaimed ? '2%' : '10%'})
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for nav/header
 */
export function AirdropStatusBadge() {
  const { data: status } = useQuery({
    queryKey: ['airdrop', 'status'],
    queryFn: async (): Promise<AirdropStatus> => {
      const res = await fetch('/api/airdrop/status');
      return res.json() as Promise<AirdropStatus>;
    },
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  if (!status?.registered || !status.drip?.canDripNow) {
    return null;
  }

  return (
    <a
      href="/rewards"
      className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1.5 text-amber-400 text-sm transition-colors hover:bg-amber-500/30"
    >
      <Gift className="h-4 w-4" />
      <span className="font-medium">
        {status.action?.type === 'initial_claim'
          ? 'Claim 10% Airdrop!'
          : 'Claim Daily 2%'}
      </span>
      <span className="animate-pulse">✨</span>
    </a>
  );
}
