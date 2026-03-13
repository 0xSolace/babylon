'use client';

import { cn } from '@babylon/shared';
import { Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { LoginButton } from '@/components/auth/LoginButton';
import { useAuth } from '@/hooks/useAuth';
import { useUserPositionsPolling } from '@/stores/userPositionsStore';
import { useWalletBalancePolling } from '@/stores/walletBalanceStore';
import { WalletBalance } from './wallet-balance';
import { WalletPnL } from './wallet-pnl';
import { WalletPositions } from './wallet-positions';
import { WalletTabs } from './wallet-tabs';

interface WalletContentProps {
  mode?: 'sidebar' | 'page';
}

export function WalletContent({ mode = 'page' }: WalletContentProps) {
  const [activeTab, setActiveTab] = useState('Balance');
  const { ready, authenticated, user } = useAuth();
  const userId = authenticated ? user?.id : undefined;

  // Start polling for wallet data when authenticated
  useWalletBalancePolling(userId ?? null, 15_000);
  useUserPositionsPolling(userId ?? null);

  if (!ready) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Log in to view your portfolio
        </p>
        <LoginButton />
      </div>
    );
  }

  const isSidebar = mode === 'sidebar';

  return (
    <div className="flex-1">
      {isSidebar && (
        <div className="flex items-center justify-between border-border border-b px-3 py-2">
          <span className="font-semibold text-foreground text-sm">
            Portfolio
          </span>
          <Link
            href="/wallet"
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
            title="Open full wallet page"
          >
            <Maximize2 className="h-3 w-3" />
            Full page
          </Link>
        </div>
      )}
      <WalletTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={cn('overflow-y-auto', isSidebar && 'max-h-[60vh]')}>
        {activeTab === 'Balance' && (
          <WalletBalance userId={user.id} mode={mode} />
        )}
        {activeTab === 'P&L' && <WalletPnL userId={user.id} mode={mode} />}
        {activeTab === 'Positions' && (
          <WalletPositions userId={user.id} mode={mode} />
        )}
      </div>
    </div>
  );
}
