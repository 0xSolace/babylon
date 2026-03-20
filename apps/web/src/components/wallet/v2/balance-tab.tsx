'use client';

import { formatCurrency } from '@babylon/shared';
import { useMemo } from 'react';
import { calculateWalletPortfolioSummary } from '@/components/wallet/shared/portfolioBreakdown';
import {
  usePortfolioPnL,
  usePortfolioPnLPolling,
} from '@/hooks/usePortfolioPnL';
import { useUserPositions } from '@/stores/userPositionsStore';

interface BalanceTabProps {
  userId: string;
}

export function BalanceTab({ userId }: BalanceTabProps) {
  const {
    data: portfolioData,
    error: portfolioError,
    loading: portfolioLoading,
  } = usePortfolioPnL({
    userId,
  });
  usePortfolioPnLPolling({ userId, intervalMs: 15_000 });

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
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!walletSummary && portfolioError) {
    return (
      <div className="rounded-xl border border-border py-10 text-center">
        <p className="text-muted-foreground">Failed to load portfolio</p>
        <p className="mt-1 text-muted-foreground text-sm">{portfolioError}</p>
      </div>
    );
  }

  const members = walletSummary?.members ?? [];
  const owner = members.find((member) => member.isOwner) ?? members[0] ?? null;
  const agentMembers = members.filter((member) => !member.isOwner);
  const ownerCash = owner?.cash ?? 0;
  const ownerPositions = owner?.openPositions ?? 0;
  const totalBalance = walletSummary?.summary.totalBalance ?? 0;
  const openPositionsTotal = walletSummary?.summary.positions ?? 0;
  const agentsOnlyTotal = agentMembers.reduce(
    (sum, member) => sum + member.total,
    0
  );

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 md:p-5">
        <div className="mb-1 text-muted-foreground text-xs tracking-wide">
          Total Portfolio Value
        </div>
        <div className="font-bold text-3xl tracking-tight">
          {fmt(totalBalance)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
          <div className="mb-2 text-muted-foreground text-xs tracking-wide">
            Cash
          </div>
          <div className="font-semibold text-lg">{fmt(ownerCash)}</div>
        </div>
        <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
          <div className="mb-2 text-muted-foreground text-xs tracking-wide">
            Open Positions
          </div>
          <div className="font-semibold text-lg">{fmt(openPositionsTotal)}</div>
        </div>
      </div>

      {agentsOnlyTotal > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 md:px-5 md:py-3">
          <span className="text-muted-foreground text-sm">Agents Total</span>
          <span className="font-semibold text-sm">{fmt(agentsOnlyTotal)}</span>
        </div>
      )}

      <div>
        <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
          Members
        </div>
        <div className="space-y-1.5 md:space-y-2">
          <div className="rounded-xl border border-border px-3 py-2.5 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <div>
                  <div className="font-medium text-sm">You</div>
                  <div className="text-muted-foreground text-xs">
                    Cash {fmt(ownerCash)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">
                  {fmt(owner?.total ?? 0)}
                </div>
                <div className="text-muted-foreground text-xs">
                  Positions {fmt(ownerPositions)}
                </div>
              </div>
            </div>
          </div>

          {agentMembers.map((agent) => {
            const pct =
              totalBalance > 0
                ? ((agent.total / totalBalance) * 100).toFixed(1)
                : '0.0';

            return (
              <div
                key={agent.id}
                className="rounded-xl border border-border px-3 py-2.5 md:p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div>
                      <div className="flex items-center gap-2 font-medium text-sm">
                        {agent.name}
                        <span className="rounded bg-muted px-1 pt-0 pb-0.5 font-normal text-[10px] text-muted-foreground leading-tight">
                          agent
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {pct}% of portfolio
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      {fmt(agent.total)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Cash {fmt(agent.cash)} · Positions{' '}
                      {fmt(agent.openPositions)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
