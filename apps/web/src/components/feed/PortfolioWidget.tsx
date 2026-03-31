'use client';

import type { PortfolioBreakdownSnapshot } from '@babylon/engine/client';
import { cn } from '@babylon/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/shared/Skeleton';
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext';
import { useAuth } from '@/hooks/useAuth';
import {
  usePortfolioPnL,
  usePortfolioPnLPolling,
} from '@/hooks/usePortfolioPnL';
import { formatCurrencyDisplay } from '@/lib/format';
import { getWalletTabHref } from '@/lib/wallet-tabs';
import {
  useWalletBalance,
  useWalletBalancePolling,
} from '@/stores/walletBalanceStore';
import { useWidgetCacheStore } from '@/stores/widgetCacheStore';

export function PnLValue({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium text-xs',
        isPositive ? 'text-green-500' : 'text-red-500'
      )}
    >
      {isPositive ? '+' : ''}
      {formatCurrencyDisplay(value)}
    </span>
  );
}

export interface PortfolioWidgetContentProps {
  balance: number;
  lifetimePnL: number;
  data: PortfolioBreakdownSnapshot | null;
  loading: boolean;
  onViewWallet?: () => void;
}

export function PortfolioWidgetContent({
  balance,
  lifetimePnL,
  data,
  loading,
  onViewWallet,
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
            <div className="text-muted-foreground text-sm">Balance</div>
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
              <div className="text-muted-foreground text-sm">
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
              <div className="text-muted-foreground text-sm">Positions</div>
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
            onClick={onViewWallet}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted/50"
          >
            View Full Portfolio
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
  } = usePortfolioPnL({ userId });
  usePortfolioPnLPolling({ userId, intervalMs: 15_000 });
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

  const handleViewWallet = useCallback(() => {
    router.push(getWalletTabHref('balance'));
  }, [router]);

  if (!authenticated) {
    return null;
  }

  const data = portfolioData ?? cachedData;
  const loading = portfolioLoading && !data;

  return (
    <PortfolioWidgetContent
      balance={data?.wallet ?? balance}
      lifetimePnL={lifetimePnL}
      data={data}
      loading={loading}
      onViewWallet={handleViewWallet}
    />
  );
}
