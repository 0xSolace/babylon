'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginButton } from '@/components/auth/LoginButton';
import { BalanceTab } from '@/components/wallet/v2/balance-tab';
import { PnLTab } from '@/components/wallet/v2/pnl-tab';
import { PositionsTab } from '@/components/wallet/v2/positions-tab';
import { RightSidebar } from '@/components/wallet/v2/right-sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUserPositionsPolling } from '@/stores/userPositionsStore';
import { useWalletBalancePolling } from '@/stores/walletBalanceStore';

type PortfolioTab = 'balance' | 'pnl' | 'positions';

export default function WalletPage() {
  const router = useRouter();
  const { ready, authenticated, login, user } = useAuth();
  const [activeTab, setActiveTab] = useState<PortfolioTab>('positions');

  const userId = authenticated ? user?.id : undefined;

  // Start polling for wallet data when authenticated
  useWalletBalancePolling(userId ?? null, 15_000);
  useUserPositionsPolling(userId ?? null);

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
    <div className="flex min-h-screen bg-background">
      {/* Main Content Area */}
      <div className="flex-1 border-border border-r">
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
              className={`relative flex-1 py-4 text-center font-medium text-sm transition-colors ${
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
        <div className="p-6">
          {activeTab === 'balance' && <BalanceTab userId={userId} />}
          {activeTab === 'pnl' && <PnLTab userId={userId} />}
          {activeTab === 'positions' && <PositionsTab userId={userId} />}
        </div>
      </div>

      {/* Right Sidebar */}
      <RightSidebar userId={userId} />
    </div>
  );
}

function WalletPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-1 border-border border-r">
        {/* Tabs skeleton */}
        <div className="flex border-border border-b">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-1 justify-center py-4">
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
      {/* Right sidebar skeleton */}
      <div className="hidden w-80 space-y-6 p-5 lg:flex lg:flex-col">
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
          <div className="h-5 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
