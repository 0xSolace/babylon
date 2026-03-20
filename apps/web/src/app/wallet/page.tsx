'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LoginButton } from '@/components/auth/LoginButton';
import { PageContainer } from '@/components/shared/PageContainer';
import { BalanceTab } from '@/components/wallet/v2/balance-tab';
import { PnLTab } from '@/components/wallet/v2/pnl-tab';
import { PositionsTab } from '@/components/wallet/v2/positions-tab';
import { useAuth } from '@/hooks/useAuth';
import { useTeamTradingSummary } from '@/hooks/useTeamTradingSummary';
import {
  useUserPositionsPolling,
  useUserPositionsStore,
} from '@/stores/userPositionsStore';
import {
  useWalletBalancePolling,
  useWalletBalanceStore,
} from '@/stores/walletBalanceStore';

const WidgetSidebar = dynamic(
  () =>
    import('@/components/shared/WidgetSidebar').then((m) => ({
      default: m.WidgetSidebar,
    })),
  {
    ssr: false,
    loading: () => <div className="hidden w-96 flex-none xl:block" />,
  }
);

type PortfolioTab = 'balance' | 'pnl' | 'positions';

export default function WalletPage() {
  const router = useRouter();
  const { ready, authenticated, login, user, getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<PortfolioTab>('positions');
  const teamSummaryRefreshKeyRef = useRef<string | null>(null);

  const userId = authenticated ? user?.id : undefined;

  // Start polling for wallet data when authenticated
  useWalletBalancePolling(userId ?? null, 15_000);
  useUserPositionsPolling(userId ?? null);
  const walletBalanceLastFetchedAt = useWalletBalanceStore(
    (state) => state.lastFetchedAt
  );
  const userPositionsLastFetchedAt = useUserPositionsStore(
    (state) => state.lastFetchedAt
  );

  const teamSummaryEnabled =
    Boolean(ready && authenticated && userId) &&
    (activeTab === 'balance' || activeTab === 'pnl');

  const {
    summary: teamSummary,
    loading: teamSummaryLoading,
    error: teamSummaryError,
    refresh: refreshTeamSummary,
  } = useTeamTradingSummary({
    ownerId: userId ?? null,
    ownerName: user?.displayName || user?.username || 'You',
    enabled: teamSummaryEnabled,
    getAccessToken,
  });

  useEffect(() => {
    if (!teamSummaryEnabled) {
      teamSummaryRefreshKeyRef.current = null;
      return;
    }

    const refreshKey = `${walletBalanceLastFetchedAt ?? 'none'}:${userPositionsLastFetchedAt ?? 'none'}`;
    if (teamSummaryRefreshKeyRef.current === null) {
      teamSummaryRefreshKeyRef.current = refreshKey;
      return;
    }
    if (teamSummaryRefreshKeyRef.current === refreshKey) {
      return;
    }

    teamSummaryRefreshKeyRef.current = refreshKey;
    void refreshTeamSummary();
  }, [
    teamSummaryEnabled,
    walletBalanceLastFetchedAt,
    userPositionsLastFetchedAt,
    refreshTeamSummary,
  ]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  if (!ready) {
    return <WalletPageSkeleton />;
  }

  if (!authenticated || !userId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted-foreground text-sm">
            Log in to view your portfolio
          </p>
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <PageContainer noPadding className="flex w-full flex-col pt-14 md:pt-0">
      <div className="relative flex flex-1">
        {/* Main wallet content */}
        <div className="flex min-w-0 flex-1 flex-col border-border lg:border-r lg:border-l">
          {/* Tab Navigation */}
          <div className="flex border-border border-b">
            {(
              [
                ['balance', 'Balance'],
                ['pnl', 'P&L'],
                ['positions', 'Positions'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex-1 py-3 text-center font-medium text-sm transition-colors ${
                  activeTab === key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {activeTab === key && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1a365d]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 pb-[calc(1rem+var(--bottom-nav-height))] md:p-6 md:pb-6">
            {activeTab === 'balance' && (
              <BalanceTab
                userId={userId}
                teamSummary={teamSummary}
                teamSummaryLoading={teamSummaryLoading}
                teamSummaryError={teamSummaryError}
              />
            )}
            {activeTab === 'pnl' && (
              <PnLTab
                userId={userId}
                teamSummary={teamSummary}
                teamSummaryLoading={teamSummaryLoading}
                teamSummaryError={teamSummaryError}
              />
            )}
            {activeTab === 'positions' && <PositionsTab userId={userId} />}
          </div>
        </div>

        {/* Same sidebar as feed/notifications — search, portfolio, positions, news, trending, markets */}
        <WidgetSidebar showPositions />
      </div>
    </PageContainer>
  );
}

function WalletPageSkeleton() {
  return (
    <PageContainer noPadding className="flex w-full flex-col pt-14 md:pt-0">
      <div className="relative flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col border-border lg:border-r lg:border-l">
          {/* Tabs skeleton */}
          <div className="flex border-border border-b">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-1 justify-center py-3">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="space-y-4 p-6">
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden w-96 flex-none xl:block" />
      </div>
    </PageContainer>
  );
}
