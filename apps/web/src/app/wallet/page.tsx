'use client';

import { CHAIN } from '@babylon/shared';
import { useFundWallet } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NftPortfolio } from '@/components/wallet/NftPortfolio';
import { ReceiveModal } from '@/components/wallet/ReceiveModal';
import { SendModal } from '@/components/wallet/SendModal';
import { TokenList } from '@/components/wallet/TokenList';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { BalanceTab } from '@/components/wallet/v2/balance-tab';
import { PnLTab } from '@/components/wallet/v2/pnl-tab';
import { PositionsTab } from '@/components/wallet/v2/positions-tab';
import { WalletEmptyState } from '@/components/wallet/WalletEmptyState';
import { WalletHeader } from '@/components/wallet/WalletHeader';
import { WalletOverview } from '@/components/wallet/WalletOverview';
import { type WalletTab, WalletTabs } from '@/components/wallet/WalletTabs';
import { useAuth } from '@/hooks/useAuth';
import {
  useOnchainNfts,
  useOnchainTokens,
  useOnchainTransactions,
  useOnchainWalletPolling,
} from '@/stores/onchainWalletStore';
import { useUserPositionsPolling } from '@/stores/userPositionsStore';
import { useWalletBalancePolling } from '@/stores/walletBalanceStore';

type PortfolioSubTab = 'balance' | 'pnl' | 'positions';

export default function WalletPage() {
  const router = useRouter();
  const { ready, authenticated, embeddedWalletAddress, login, user } =
    useAuth();
  const [activeTab, setActiveTab] = useState<WalletTab>('portfolio');
  const [portfolioSubTab, setPortfolioSubTab] =
    useState<PortfolioSubTab>('balance');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const address = embeddedWalletAddress ?? null;
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

  // Fetch on-chain data (only when on-chain tabs are active or for overview)
  const {
    nativeBalance,
    tokens,
    loading: tokensLoading,
    error: tokensError,
    refresh: refreshTokens,
  } = useOnchainTokens(address);

  const {
    collections,
    totalCount: nftCount,
    loading: nftsLoading,
    error: nftsError,
    refresh: refreshNfts,
  } = useOnchainNfts(address);

  const {
    transactions,
    loading: txsLoading,
    error: txsError,
    refresh: refreshTxs,
  } = useOnchainTransactions(address);

  // Poll token balances every 30s
  useOnchainWalletPolling(address, 30_000);

  const { fundWallet } = useFundWallet();

  const handleFund = useCallback(() => {
    if (address) {
      fundWallet({
        address,
        options: { chain: CHAIN, asset: 'native-currency' },
      });
    }
  }, [address, fundWallet]);

  const handleSend = useCallback(() => {
    setSendOpen(true);
  }, []);

  if (!ready) {
    return <WalletPageSkeleton />;
  }

  if (!authenticated) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <WalletEmptyState
          title="Connect your wallet"
          description="Log in to access your wallet and manage your assets."
          action={{ label: 'Log In', onClick: login }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto border-border lg:border-l">
      <div className="w-full space-y-4 p-4 sm:p-6">
        {address && <WalletHeader address={address} />}

        <WalletTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="pb-8">
          {activeTab === 'portfolio' && userId && (
            <div>
              {/* Portfolio sub-tabs */}
              <div className="mb-6 flex gap-4 border-border border-b">
                {(
                  [
                    ['balance', 'Balance'],
                    ['pnl', 'P&L'],
                    ['positions', 'Positions'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPortfolioSubTab(key)}
                    className={`border-b-2 pb-2 font-medium text-sm transition-colors ${
                      portfolioSubTab === key
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {portfolioSubTab === 'balance' && <BalanceTab userId={userId} />}
              {portfolioSubTab === 'pnl' && <PnLTab userId={userId} />}
              {portfolioSubTab === 'positions' && (
                <PositionsTab userId={userId} />
              )}
            </div>
          )}

          {activeTab === 'overview' &&
            (address ? (
              <WalletOverview
                nativeBalance={nativeBalance}
                tokens={tokens}
                transactions={transactions}
                loading={tokensLoading}
                onNavigateTab={setActiveTab}
                onSend={() => handleSend()}
                onReceive={() => setReceiveOpen(true)}
              />
            ) : (
              <NoWalletMessage />
            ))}

          {activeTab === 'tokens' &&
            (address ? (
              <TokenList
                nativeBalance={nativeBalance}
                tokens={tokens}
                loading={tokensLoading}
                error={tokensError}
                onRefresh={refreshTokens}
                onSend={() => handleSend()}
                onFund={handleFund}
              />
            ) : (
              <NoWalletMessage />
            ))}

          {activeTab === 'nfts' &&
            (address ? (
              <NftPortfolio
                collections={collections}
                totalCount={nftCount}
                loading={nftsLoading}
                error={nftsError}
                onRefresh={refreshNfts}
              />
            ) : (
              <NoWalletMessage />
            ))}

          {activeTab === 'activity' &&
            (address ? (
              <TransactionHistory
                transactions={transactions}
                loading={txsLoading}
                error={txsError}
                onRefresh={refreshTxs}
                walletAddress={address}
              />
            ) : (
              <NoWalletMessage />
            ))}
        </div>
      </div>

      {address && (
        <>
          <ReceiveModal
            open={receiveOpen}
            onClose={() => setReceiveOpen(false)}
            address={address}
            chainName={CHAIN.name}
          />

          <SendModal
            open={sendOpen}
            onClose={() => setSendOpen(false)}
            nativeBalance={nativeBalance}
            tokens={tokens}
            senderAddress={address}
            onSuccess={() => {
              refreshTokens();
              refreshTxs();
            }}
          />
        </>
      )}
    </div>
  );
}

function NoWalletMessage() {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <p className="text-sm">
        No embedded wallet detected. On-chain features require a wallet.
      </p>
    </div>
  );
}

function WalletPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto border-border lg:border-l">
      <div className="w-full space-y-4 p-4 sm:p-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-4 border-border border-b pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 w-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="rounded-xl border border-border p-6">
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
