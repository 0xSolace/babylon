'use client';

import { cn } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { BouncingLogo } from '@/components/shared/BouncingLogo';
import { useAuth } from '@/hooks/useAuth';

interface Pool {
  id: string;
  name: string;
  description: string | null;
  npcActor: {
    id: string;
    name: string;
    description: string | null;
    tier: string | null;
    personality: string | null;
  };
  totalValue: number;
  totalDeposits: number;
  availableBalance: number;
  lifetimePnL: number;
  totalReturn: number;
  performanceFeeRate: number;
  totalFeesCollected: number;
  activeInvestors: number;
  totalTrades: number;
  openPositions: number;
  totalUnrealizedPnL: number;
  activeDepositsValue: number;
  openedAt: string;
  updatedAt: string;
}

interface PoolsApiResponse {
  pools?: Pool[];
}

interface PoolsListProps {
  onPoolClick: (pool: Pool) => void;
}

export function PoolsList({ onPoolClick }: PoolsListProps) {
  const { authenticated } = useAuth();
  const [sortBy, setSortBy] = useState<
    'performance' | 'volume' | 'tvl' | 'newest' | 'oldest'
  >('performance');

  const { data: pools = [], isLoading: loading } = useQuery({
    queryKey: ['pools'],
    queryFn: async (): Promise<Pool[]> => {
      const res = await fetch('/api/pools');
      if (!res.ok) {
        throw new Error('Failed to fetch pools');
      }
      const data: PoolsApiResponse = await res.json();
      return data.pools ?? [];
    },
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Refresh every 30s
  });

  const sortedPools = [...pools].sort((a, b) => {
    switch (sortBy) {
      case 'performance':
        return b.totalReturn - a.totalReturn;
      case 'tvl':
        return b.totalValue - a.totalValue;
      case 'volume':
        return b.totalTrades - a.totalTrades;
      case 'newest':
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case 'oldest':
        return (
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );
      default:
        return 0;
    }
  });

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getTierBadgeColor = (tier: string | null) => {
    const colors: Record<string, string> = {
      S_TIER: 'bg-purple-500/20 text-purple-400',
      A_TIER: 'bg-blue-500/20 text-blue-400',
      B_TIER: 'bg-green-500/20 text-green-400',
      C_TIER: 'bg-gray-500/20 text-gray-400',
    };
    return colors[tier || 'B_TIER'] || colors['B_TIER'];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <BouncingLogo size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Options */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto border-border border-b pb-2">
        <button
          onClick={() => setSortBy('performance')}
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs transition-all',
            sortBy === 'performance'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <TrendingUp className="mr-1 inline h-3 w-3" />
          Performance
        </button>
        <button
          onClick={() => setSortBy('tvl')}
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs transition-all',
            sortBy === 'tvl'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <DollarSign className="mr-1 inline h-3 w-3" />
          TVL
        </button>
        <button
          onClick={() => setSortBy('volume')}
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs transition-all',
            sortBy === 'volume'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <Activity className="mr-1 inline h-3 w-3" />
          Volume
        </button>
        <button
          onClick={() => setSortBy('newest')}
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs transition-all',
            sortBy === 'newest'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          Newest
        </button>
        <button
          onClick={() => setSortBy('oldest')}
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-xs transition-all',
            sortBy === 'oldest'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          Oldest
        </button>
      </div>

      {/* Pools Grid */}
      <div className="grid gap-3">
        {sortedPools.map((pool) => (
          <button
            key={pool.id}
            onClick={() => onPoolClick(pool)}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
          >
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-bold text-lg">{pool.name}</h3>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 font-medium text-xs',
                      getTierBadgeColor(pool.npcActor.tier)
                    )}
                  >
                    {pool.npcActor.tier?.replace('_TIER', '')}
                  </span>
                </div>
                <p className="line-clamp-1 text-muted-foreground text-sm">
                  {pool.description}
                </p>
              </div>
              <div className="ml-4 text-right">
                <div
                  className={cn(
                    'font-bold text-2xl',
                    pool.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatPercent(pool.totalReturn)}
                </div>
                <div className="text-muted-foreground text-xs">Return</div>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <DollarSign className="h-3 w-3" />
                  <span>Total Value</span>
                </div>
                <div className="font-semibold">
                  {formatCurrency(pool.totalValue)}
                </div>
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Users className="h-3 w-3" />
                  <span>Investors</span>
                </div>
                <div className="font-semibold">{pool.activeInvestors}</div>
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Activity className="h-3 w-3" />
                  <span>Open Positions</span>
                </div>
                <div className="font-semibold">{pool.openPositions}</div>
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  {pool.lifetimePnL >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span>Lifetime P&L</span>
                </div>
                <div
                  className={cn(
                    'font-semibold',
                    pool.lifetimePnL >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatCurrency(pool.lifetimePnL)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-border border-t pt-3">
              <div className="text-muted-foreground text-xs">
                {pool.totalTrades} trades • {pool.performanceFeeRate * 100}% fee
                on profits
              </div>
              {!authenticated && (
                <div className="font-medium text-primary text-xs">
                  Connect to invest →
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {pools.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No pools available yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Pools will be created by trader NPCs
          </p>
        </div>
      )}
    </div>
  );
}
