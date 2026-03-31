'use client';

import { formatCurrency } from '@babylon/shared';
import { useMemo } from 'react';
import { calculateWalletPortfolioSummary } from '@/components/wallet/shared/portfolioBreakdown';
import {
  usePortfolioPnL,
  usePortfolioPnLPolling,
} from '@/hooks/usePortfolioPnL';
import { useUserPositions } from '@/stores/userPositionsStore';

interface WalletBalanceProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

export function WalletBalance({ userId, mode = 'page' }: WalletBalanceProps) {
  const { data: portfolioData, loading: portfolioLoading } = usePortfolioPnL({
    userId,
  });
  usePortfolioPnLPolling({ userId, intervalMs: 15_000 });
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const isSidebar = mode === 'sidebar';
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
      <div className="space-y-4 p-4">
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
    <div className="p-4">
      {/* Summary */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Total Balance</span>
          <span className="font-bold text-2xl">
            {fmt(walletSummary?.summary.totalBalance ?? 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Wallet</span>
          <span className="font-semibold text-lg">
            {fmt(walletSummary?.summary.wallet ?? 0)}
          </span>
        </div>
        {walletSummary && walletSummary.summary.agentCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Agents</span>
            <span className="font-semibold text-lg">
              {fmt(walletSummary.summary.agents)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Positions</span>
          <span className="font-semibold text-lg">
            {fmt(walletSummary?.summary.positions ?? 0)}
          </span>
        </div>
      </div>

      {/* Table */}
      {isSidebar ? (
        // Compact: show Member + Total only
        <table className="w-full">
          <thead>
            <tr className="border-border border-b text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Member</th>
              <th className="pb-3 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {(walletSummary?.members ?? []).map((member) => (
              <tr
                key={member.id}
                className="border-border border-b last:border-0"
              >
                <td className="py-3 font-medium text-sm">{member.name}</td>
                <td className="py-3 text-right font-semibold text-sm">
                  {fmt(member.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Full table
        <table className="w-full">
          <thead>
            <tr className="border-border border-b text-left text-muted-foreground text-xs">
              <th className="pb-3 font-normal">Member</th>
              <th className="pb-3 text-right font-normal">Cash</th>
              <th className="pb-3 text-right font-normal">Open Positions</th>
              <th className="pb-3 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {(walletSummary?.members ?? []).map((member) => (
              <tr
                key={member.id}
                className="border-border border-b last:border-0"
              >
                <td className="py-4 font-medium text-sm">{member.name}</td>
                <td className="py-4 text-right text-muted-foreground text-sm">
                  {fmt(member.cash)}
                </td>
                <td className="py-4 text-right text-muted-foreground text-sm">
                  {fmt(member.openPositions)}
                </td>
                <td className="py-4 text-right font-semibold text-sm">
                  {fmt(member.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
