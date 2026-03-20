'use client';

import { formatCurrency } from '@babylon/shared';
import { useMemo } from 'react';
import { calculateWalletPortfolioSummary } from '@/components/wallet/shared/portfolioBreakdown';
import { usePortfolioPnL } from '@/hooks/usePortfolioPnL';
import { useUserPositions } from '@/stores/userPositionsStore';

interface BalanceTabProps {
  userId: string;
}

export function BalanceTab({ userId }: BalanceTabProps) {
  const { data: portfolioData, loading: portfolioLoading } = usePortfolioPnL({
    userId,
    pollingIntervalMs: 15_000,
  });
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const loading = portfolioLoading || positionsLoading;

  const walletSummary = useMemo(() => {
    if (!portfolioData) {
      return null;
    }

    return calculateWalletPortfolioSummary({
      userId,
      snapshot: portfolioData,
      perpPositions,
      predictionPositions,
    });
  }, [portfolioData, predictionPositions, perpPositions, userId]);

  const fmt = (amount: number) =>
    formatCurrency(amount, { useThousandsSeparator: true });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-8">
        <div className="flex items-center justify-between py-3">
          <span className="text-foreground text-sm">Total Balance</span>
          <span className="font-bold text-2xl">
            {fmt(walletSummary?.summary.totalBalance ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between border-border border-b py-3">
          <span className="text-foreground text-sm">Wallet</span>
          <span className="font-semibold text-lg">
            {fmt(walletSummary?.summary.wallet ?? 0)}
          </span>
        </div>
        {walletSummary && walletSummary.summary.agentCount > 0 && (
          <div className="flex items-center justify-between border-border border-b py-3">
            <span className="text-foreground text-sm">Agents</span>
            <span className="font-semibold text-lg">
              {fmt(walletSummary.summary.agents)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-border border-b py-3">
          <span className="text-foreground text-sm">Positions</span>
          <span className="font-semibold text-lg">
            {fmt(walletSummary?.summary.positions ?? 0)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div>
        <div className="grid grid-cols-4 gap-4 py-3 text-muted-foreground text-xs">
          <div>Member</div>
          <div className="text-right">Cash</div>
          <div className="text-right">Open Positions</div>
          <div className="text-right">Total</div>
        </div>
        {(walletSummary?.members ?? []).map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-4 items-center gap-4 border-border border-t py-4"
          >
            <div className="font-medium text-sm">{row.name}</div>
            <div className="text-right text-muted-foreground text-sm">
              {fmt(row.cash)}
            </div>
            <div className="text-right text-muted-foreground text-sm">
              {fmt(row.openPositions)}
            </div>
            <div className="text-right font-bold text-sm">{fmt(row.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
