/**
 * ReputationCard Component
 *
 * Displays comprehensive reputation information for a user
 * - Overall reputation score and trust level
 * - Feedback statistics
 * - Performance metrics
 * - Trade and game statistics
 *
 * Pattern based on: ProfileWidget.tsx
 */

'use client';

import { Shield, Star, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useWidgetCacheStore } from '@/stores/widgetCacheStore';
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

interface ReputationCardProps {
  userId: string;
  className?: string;
}

export function ReputationCard({
  userId,
  className = '',
}: ReputationCardProps) {
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const widgetCache = useWidgetCacheStore();

  useEffect(() => {
    if (!userId) return;

    const fetchReputationData = async (skipCache = false) => {
      // Check cache first
      if (!skipCache) {
        const cached = widgetCache.getReputationWidget(
          userId
        ) as ReputationData | null;
        if (cached) {
          setReputation(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      try {
        // Fetch reputation data from API
        const response = await fetch(
          `/api/reputation/${encodeURIComponent(userId)}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const reputationData: ReputationData = {
            reputationPoints: data.reputationPoints || 1000,
            averageFeedbackScore: data.averageFeedbackScore || 0,
            totalFeedbackReceived: data.totalFeedbackReceived || 0,
            gamesPlayed: data.performance?.gamesPlayed || 0,
            gamesWon: data.performance?.gamesWon || 0,
            averageGameScore: data.performance?.averageGameScore || 0,
            winRate: data.performance?.winRate || 0,
            recentTrend: data.recentTrend || 0,
            trustLevel: data.trustLevel || 'newcomer',
            rank: data.rank || null,
            totalUsers: data.totalUsers || 0,
          };

          setReputation(reputationData);

          // Cache the result
          widgetCache.setReputationWidget(userId, reputationData);
        }
      } catch (error) {
        console.error('Failed to fetch reputation data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReputationData();

    // Refresh every 60 seconds
    const interval = setInterval(() => fetchReputationData(true), 60000);
    return () => clearInterval(interval);
  }, [userId, widgetCache]);

  if (loading) {
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
 * Compact version for inline display
 */
interface ReputationCardMiniProps {
  userId: string;
  className?: string;
}

export function ReputationCardMini({
  userId,
  className = '',
}: ReputationCardMiniProps) {
  const [reputationPoints, setReputationPoints] = useState<number>(1000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReputation = async () => {
      try {
        const response = await fetch(
          `/api/reputation/${encodeURIComponent(userId)}`
        );
        const data = await response.json();

        if (data.success) {
          setReputationPoints(data.reputationPoints || 1000);
        }
      } catch (error) {
        console.error('Failed to fetch reputation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReputation();
  }, [userId]);

  if (loading) return null;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <ReputationBadge
        reputationPoints={reputationPoints}
        size="sm"
        showLabel={false}
      />
      <span className="font-medium text-foreground text-sm">
        {reputationPoints.toLocaleString()}
      </span>
    </div>
  );
}
