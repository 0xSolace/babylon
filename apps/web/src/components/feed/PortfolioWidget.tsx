'use client';

import type { PortfolioBreakdownSnapshot } from '@babylon/engine/client';
import { cn, getProfileUrl } from '@babylon/shared';
import {
  Bot,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/shared/Skeleton';
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioPnL } from '@/hooks/usePortfolioPnL';
import { formatCurrencyDisplay } from '@/lib/format';
import {
  useWalletBalance,
  useWalletBalancePolling,
} from '@/stores/walletBalanceStore';
import { useWidgetCacheStore } from '@/stores/widgetCacheStore';

export function PnLValue({ value }: { value: number }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium text-xs',
        isPositive ? 'text-green-500' : 'text-red-500'
      )}
    >
      {isPositive ? '+' : ''}
      {formatCurrencyDisplay(value)}
      <Icon className="h-3 w-3" />
    </span>
  );
}

export interface PortfolioWidgetContentProps {
  balance: number;
  lifetimePnL: number;
  data: PortfolioBreakdownSnapshot | null;
  loading: boolean;
  onViewProfile?: () => void;
}

export function PortfolioWidgetContent({
  balance,
  lifetimePnL,
  data,
  loading,
  onViewProfile,
}: PortfolioWidgetContentProps) {
  return (
    <div className="flex flex-col">
      <h2 className="mb-3 font-bold text-foreground text-lg">Portfolio</h2>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Balance */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="h-4 w-4" />
              Balance
            </div>
            <div className="text-right">
              <div className="font-semibold text-foreground text-sm">
                {formatCurrencyDisplay(balance)}
              </div>
              <PnLValue value={lifetimePnL} />
            </div>
          </div>

          {/* Agents */}
          {data && data.agentCount > 0 && (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Bot className="h-4 w-4" />
                Agents ({data.agentCount})
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground text-sm">
                  {formatCurrencyDisplay(data.agents)}
                </div>
                {data.totalPnL !== undefined && (
                  <PnLValue value={data.totalPnL} />
                )}
              </div>
            </div>
          )}

          {/* Positions */}
          {data && (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                Positions
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground text-sm">
                  {formatCurrencyDisplay(data.positions)}
                </div>
                <span className="text-muted-foreground text-xs">
                  Total {formatCurrencyDisplay(data.totalAssets)}
                </span>
              </div>
            </div>
          )}

          {/* View Full Portfolio */}
          <button
            type="button"
            onClick={onViewProfile}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted/50"
          >
            View Full Portfolio
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function PortfolioWidget() {
  const router = useRouter();
  const { user, authenticated } = useAuth();
  const userId = authenticated ? (user?.id ?? null) : null;
  const {
    data: portfolioData,
    loading: portfolioLoading,
    refresh: refreshPortfolio,
  } = usePortfolioPnL();
  const { balance, lifetimePnL } = useWalletBalance(userId);
  const getPortfolioWidget = useWidgetCacheStore(
    (state) => state.getPortfolioWidget
  );
  const setPortfolioWidget = useWidgetCacheStore(
    (state) => state.setPortfolioWidget
  );
  const { registerRefresh, unregisterRefresh } = useWidgetRefresh();

  const [cachedData, setCachedData] =
    useState<PortfolioBreakdownSnapshot | null>(null);

  // Enable balance polling every 15s
  useWalletBalancePolling(userId);

  useEffect(() => {
    if (!userId) {
      setCachedData(null);
      return;
    }

    setCachedData(getPortfolioWidget(userId));
  }, [userId, getPortfolioWidget]);

  useEffect(() => {
    if (portfolioData && userId) {
      setPortfolioWidget(userId, portfolioData);
      setCachedData(portfolioData);
    }
  }, [portfolioData, setPortfolioWidget, userId]);

  // Register with widget refresh context
  const handleRefresh = useCallback(() => {
    void refreshPortfolio();
  }, [refreshPortfolio]);

  useEffect(() => {
    registerRefresh('portfolio-widget', handleRefresh);
    return () => unregisterRefresh('portfolio-widget');
  }, [registerRefresh, unregisterRefresh, handleRefresh]);

  if (!authenticated) {
    return null;
  }

  const data = portfolioData ?? cachedData;
  const loading = portfolioLoading && !data;

  const handleViewProfile = useCallback(() => {
    if (user) {
      router.push(getProfileUrl(user.id, user.username));
    }
  }, [router, user]);

  return (
    <PortfolioWidgetContent
      balance={balance}
      lifetimePnL={lifetimePnL}
      data={data}
      loading={loading}
      onViewProfile={handleViewProfile}
    />
  );
}
