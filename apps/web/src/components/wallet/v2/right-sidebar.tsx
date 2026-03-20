'use client';

import { calculateUnrealizedPnL, formatCurrency } from '@babylon/shared';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';

export function WalletPreviewWidget() {
  const { authenticated, user } = useAuth();
  const userId = authenticated ? (user?.id ?? null) : null;

  const { balance, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const loading = balanceLoading || positionsLoading;

  // Live prices
  const tickers = useMemo(
    () => perpPositions.map((pos) => pos.ticker),
    [perpPositions]
  );
  const livePrices = useMarketPrices(tickers);

  // Compute totals
  const { totalBalance, agentsOnly } = useMemo(() => {
    let ownerPositionValue = 0;
    let agentTotal = 0;

    for (const pos of perpPositions) {
      const value = Math.abs(pos.unrealizedPnL) + pos.size;
      if (pos.isAgentPosition) {
        agentTotal += value;
      } else {
        ownerPositionValue += value;
      }
    }

    for (const pos of predictionPositions) {
      const value = pos.currentValue ?? pos.shares * pos.currentPrice;
      if (pos.isAgentPosition) {
        agentTotal += value;
      } else {
        ownerPositionValue += value;
      }
    }

    return {
      totalBalance: balance + ownerPositionValue + agentTotal,
      agentsOnly: agentTotal,
    };
  }, [balance, perpPositions, predictionPositions]);

  // Top 3 positions by PnL magnitude
  const latestPositions = useMemo(() => {
    const perpItems = perpPositions.map((position) => {
      const livePrice = livePrices.get(position.ticker)?.price;
      const currentPrice = livePrice ?? position.currentPrice;
      const { pnl } = calculateUnrealizedPnL(
        position.entryPrice,
        currentPrice,
        position.side,
        position.size
      );
      return {
        id: position.id,
        label: `$${position.ticker}`,
        type: position.side.toUpperCase() as string,
        owner: position.isAgentPosition
          ? (position.agentName ?? 'Agent')
          : 'You (Owner)',
        pnl,
        isPerp: true,
      };
    });

    const predItems = predictionPositions
      .filter((p) => !p.resolved)
      .map((position) => {
        const currentValue =
          position.currentValue ?? position.shares * position.currentPrice;
        const costBasis =
          position.costBasis ?? position.shares * position.avgPrice;
        const pnl = position.unrealizedPnL ?? currentValue - costBasis;
        return {
          id: position.id,
          label:
            position.question.length > 30
              ? `${position.question.slice(0, 30)}...`
              : position.question,
          type: position.side,
          owner: position.isAgentPosition
            ? (position.agentName ?? 'Agent')
            : 'You (Owner)',
          pnl,
          isPerp: false,
        };
      });

    return [...perpItems, ...predItems]
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .slice(0, 3);
  }, [perpPositions, predictionPositions, livePrices]);

  const fmt = (amount: number) =>
    formatCurrency(amount, { useThousandsSeparator: true });

  if (!authenticated) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-4 font-semibold text-base">Wallet Preview</h2>
          <div className="space-y-2">
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div>
          <h2 className="mb-4 font-semibold text-base">Latest Positions</h2>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Wallet Preview */}
      <div>
        <h2 className="mb-4 font-semibold text-base">Wallet Preview</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Total Balance</span>
            <span className="font-bold text-base">{fmt(totalBalance)}</span>
          </div>
          {agentsOnly > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Agents Only</span>
              <span className="font-semibold text-sm">{fmt(agentsOnly)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Latest Positions */}
      {latestPositions.length > 0 && (
        <div>
          <h2 className="mb-4 font-semibold text-base">Latest Positions</h2>
          <div className="space-y-4">
            {latestPositions.map((position) => (
              <div
                key={position.id}
                className="flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {position.label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium text-xs ${
                        position.type === 'LONG' || position.type === 'YES'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {position.type}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {position.owner}
                  </span>
                </div>
                <span
                  className={`font-medium text-sm ${
                    position.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {position.pnl >= 0 ? '+' : ''}
                  {fmt(position.pnl)}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/wallet"
            className="mt-4 flex items-center gap-1 text-foreground text-sm hover:underline"
          >
            See More <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
