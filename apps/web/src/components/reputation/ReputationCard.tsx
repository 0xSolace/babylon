/**
 * ReputationCard Component
 *
 * Displays comprehensive reputation information for a user
 * - Overall reputation score and trust level
 * - Feedback statistics
 * - Performance metrics
 * - Trade and game statistics
 *
 * Uses react-query for proper caching and automatic refetching.
 */

'use client';

import { cn } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { Shield, Star, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { ReputationBadge, ReputationScore } from './ReputationBadge';
import { TrustLevelBadge } from './TrustLevelBadge';

interface ReputationData {
  reputationPoints: number;
  averageFeedbackScore: number; // 0-100
  totalFeedbackReceived: number;
  gamesPlayed: number;
  gamesWon: number;
  averageGameScore: number; // 0-100
  winRate: number; // 0-100
  recentTrend: number; // percentage change
  trustLevel: 'newcomer' | 'trusted' | 'veteran' | 'elite';
  rank: number | null;
  totalUsers: number;
}

interface ReputationApiResponse {
  success: boolean;
  reputationPoints?: number;
  averageFeedbackScore?: number;
  totalFeedbackReceived?: number;
  performance?: {
    gamesPlayed?: number;
    gamesWon?: number;
    averageGameScore?: number;
    winRate?: number;
  };
  recentTrend?: number;
  trustLevel?: 'newcomer' | 'trusted' | 'veteran' | 'elite';
  rank?: number | null;
  totalUsers?: number;
}

interface ReputationCardProps {
  userId: string;
  className?: string;
}

/**
 * Fetches and transforms reputation data from the API.
 */
async function fetchReputationData(userId: string): Promise<ReputationData> {
  const response = await fetch(`/api/reputation/${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch reputation: ${response.status}`);
  }

  const data: ReputationApiResponse = await response.json();

  if (!data.success) {
    throw new Error('Reputation API returned unsuccessful response');
  }

  return {
    reputationPoints: data.reputationPoints ?? 1000,
    averageFeedbackScore: data.averageFeedbackScore ?? 0,
    totalFeedbackReceived: data.totalFeedbackReceived ?? 0,
    gamesPlayed: data.performance?.gamesPlayed ?? 0,
    gamesWon: data.performance?.gamesWon ?? 0,
    averageGameScore: data.performance?.averageGameScore ?? 0,
    winRate: data.performance?.winRate ?? 0,
    recentTrend: data.recentTrend ?? 0,
    trustLevel: data.trustLevel ?? 'newcomer',
    rank: data.rank ?? null,
    totalUsers: data.totalUsers ?? 0,
  };
}

export function ReputationCard({
  userId,
  className = '',
}: ReputationCardProps) {
  const {
    data: reputation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reputation', userId],
    queryFn: () => fetchReputationData(userId),
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Poll every 60 seconds
  });

  // Show error state
  if (error) {
    return (
      <div className={cn('rounded-lg bg-sidebar p-4', className)}>
        <div className="text-muted-foreground text-sm">
          Failed to load reputation
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('rounded-lg bg-sidebar p-4', className)}>
        <div className="text-muted-foreground text-sm">
          Loading reputation...
        </div>
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className={cn('rounded-lg bg-sidebar p-4', className)}>
        <div className="text-muted-foreground text-sm">
          Reputation data unavailable
        </div>
      </div>
    );
  }

  const starRating =
    Math.round((reputation.averageFeedbackScore / 100) * 5 * 10) / 10;

  return (
    <div
      data-testid="reputation-card"
      className={cn('space-y-4 rounded-lg bg-sidebar p-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-foreground text-xl">
          <Shield className="h-5 w-5 text-[#0066FF]" />
          Reputation
        </h2>
        {reputation.rank && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Trophy className="h-3 w-3" />
            <span>
              #{reputation.rank} of {reputation.totalUsers.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Trust Level Badge with Progress */}
      <TrustLevelBadge
        reputationPoints={reputation.reputationPoints}
        size="md"
        showProgress={true}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Reputation Points */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-1 text-muted-foreground text-xs">Reputation</div>
          <ReputationScore
            reputationPoints={reputation.reputationPoints}
            size="sm"
            showChange={true}
            change={Math.round(
              (reputation.reputationPoints * reputation.recentTrend) / 100
            )}
          />
        </div>

        {/* Average Feedback */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-1 text-muted-foreground text-xs">Avg Rating</div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
            <span className="font-bold text-foreground text-lg">
              {starRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-xs">/5</span>
          </div>
          <div className="mt-0.5 text-muted-foreground text-xs">
            {reputation.totalFeedbackReceived} review
            {reputation.totalFeedbackReceived !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Games Won */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-1 text-muted-foreground text-xs">Games Won</div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-lg">
              {reputation.gamesWon}
            </span>
            <span className="text-muted-foreground text-xs">
              / {reputation.gamesPlayed}
            </span>
          </div>
          <div className="mt-0.5 text-muted-foreground text-xs">
            {reputation.winRate.toFixed(0)}% win rate
          </div>
        </div>

        {/* Average Score */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="mb-1 text-muted-foreground text-xs">Avg Score</div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-foreground text-lg">
              {reputation.averageGameScore.toFixed(0)}
            </span>
            <span className="text-muted-foreground text-xs">/100</span>
          </div>
          {reputation.averageGameScore >= 70 ? (
            <div className="mt-0.5 flex items-center gap-1 text-green-500 text-xs">
              <TrendingUp className="h-3 w-3" />
              <span>Excellent</span>
            </div>
          ) : reputation.averageGameScore >= 50 ? (
            <div className="mt-0.5 text-blue-500 text-xs">Good</div>
          ) : (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-yellow-500">
              <TrendingDown className="h-3 w-3" />
              <span>Keep trying!</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Trend Indicator */}
      {reputation.recentTrend !== 0 && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-2 font-medium text-sm',
            reputation.recentTrend > 0
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          )}
        >
          {reputation.recentTrend > 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span>
            {reputation.recentTrend > 0 ? '+' : ''}
            {reputation.recentTrend.toFixed(1)}% this week
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ReputationCardMini Component
 *
 * Compact version for inline display.
 * Uses the same query key as ReputationCard for shared caching.
 */
interface ReputationCardMiniProps {
  userId: string;
  className?: string;
}

export function ReputationCardMini({
  userId,
  className = '',
}: ReputationCardMiniProps) {
  const { data: reputation, isLoading } = useQuery({
    queryKey: ['reputation', userId],
    queryFn: () => fetchReputationData(userId),
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading || !reputation) return null;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <ReputationBadge
        reputationPoints={reputation.reputationPoints}
        size="sm"
        showLabel={false}
      />
      <span className="font-medium text-foreground text-sm">
        {reputation.reputationPoints.toLocaleString()}
      </span>
    </div>
  );
}
