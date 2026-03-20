'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginButton } from '@/components/auth/LoginButton';
import { PageContainer } from '@/components/shared/PageContainer';
// ⚠️ DEV MOCK — remove before production (see /WALLET-DEV-REMINDER.md)
import { useWalletMockData } from '@/components/wallet/__dev__/useWalletMockData';
import { WALLET_MOCK_ENABLED } from '@/components/wallet/__dev__/wallet-mock-data';
// END DEV MOCK
import { BalanceTab } from '@/components/wallet/v2/balance-tab';
import { PnLTab } from '@/components/wallet/v2/pnl-tab';
import { PositionsTab } from '@/components/wallet/v2/positions-tab';
import { useAuth } from '@/hooks/useAuth';
import { useUserPositionsPolling } from '@/stores/userPositionsStore';
import { useWalletBalancePolling } from '@/stores/walletBalanceStore';

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
  const { ready, authenticated, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState<PortfolioTab>('positions');

  // ⚠️ DEV MOCK — when enabled, use a fake userId and skip auth gate
  const mockUserId = WALLET_MOCK_ENABLED ? 'mock-user' : undefined;
  const userId = mockUserId ?? (authenticated ? user?.id : undefined);
  useWalletMockData(mockUserId);
  // END DEV MOCK

  // Start polling for wallet data when authenticated (skipped when mock overrides stores)
  useWalletBalancePolling(
    WALLET_MOCK_ENABLED ? null : (userId ?? null),
    15_000
  );
  useUserPositionsPolling(WALLET_MOCK_ENABLED ? null : (userId ?? null));

  // Redirect unauthenticated users
  useEffect(() => {
    if (WALLET_MOCK_ENABLED) return; // ⚠️ DEV MOCK — skip redirect
    if (!ready || authenticated) return;
    router.push('/feed');
    const timer = setTimeout(() => login(), 500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, router, login]);

  if (!WALLET_MOCK_ENABLED && !ready) {
    return <WalletPageSkeleton />;
  }

  if (!WALLET_MOCK_ENABLED && (!authenticated || !userId)) {
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
            {activeTab === 'balance' && userId && (
              <BalanceTab userId={userId} />
            )}
            {activeTab === 'pnl' && userId && <PnLTab userId={userId} />}
            {activeTab === 'positions' && userId && (
              <PositionsTab userId={userId} />
            )}
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
