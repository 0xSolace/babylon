'use client';

import { formatCurrency } from '@babylon/shared';

import { useMemo } from 'react';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';

interface BalanceTabProps {
  userId: string;
}

interface Member {
  name: string;
  cash: number;
  openPositions: number;
  total: number;
}

export function BalanceTab({ userId }: BalanceTabProps) {
  const { balance, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const loading = balanceLoading || positionsLoading;

  const { members, totalBalance, agentsOnly } = useMemo(() => {
    let ownerPositionValue = 0;
    const agentPositionValues = new Map<string, number>();

    for (const pos of perpPositions) {
      const value = Math.abs(pos.unrealizedPnL) + pos.size;
      if (pos.isAgentPosition && pos.agentName) {
        agentPositionValues.set(
          pos.agentName,
          (agentPositionValues.get(pos.agentName) ?? 0) + value
        );
      } else {
        ownerPositionValue += value;
      }
    }

    for (const pos of predictionPositions) {
      const value = pos.currentValue ?? pos.shares * pos.currentPrice;
      if (pos.isAgentPosition && pos.agentName) {
        agentPositionValues.set(
          pos.agentName,
          (agentPositionValues.get(pos.agentName) ?? 0) + value
        );
      } else {
        ownerPositionValue += value;
      }
    }

    const memberList: Member[] = [
      {
        name: 'You',
        cash: balance,
        openPositions: ownerPositionValue,
        total: balance + ownerPositionValue,
      },
    ];

    let agentTotal = 0;
    for (const [agentName, posValue] of agentPositionValues) {
      memberList.push({
        name: agentName,
        cash: 0,
        openPositions: posValue,
        total: posValue,
      });
      agentTotal += posValue;
    }

    const total = balance + ownerPositionValue + agentTotal;

    return {
      members: memberList,
      totalBalance: total,
      agentsOnly: agentTotal,
    };
  }, [balance, perpPositions, predictionPositions]);

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

  const ownerCash = members[0]?.cash ?? 0;
  const ownerPositions = members[0]?.openPositions ?? 0;
  const agentMembers = members.slice(1);

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Total balance hero */}
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 md:p-5">
        <div className="mb-1 text-muted-foreground text-xs tracking-wide">
          Total Portfolio Value
        </div>
        <div className="font-bold text-3xl tracking-tight">
          {fmt(totalBalance)}
        </div>
      </div>

      {/* Breakdown cards */}
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
          <div className="font-semibold text-lg">
            {fmt(ownerPositions + agentsOnly)}
          </div>
        </div>
      </div>

      {/* Agents total inline with hero */}
      {agentsOnly > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 md:px-5 md:py-3">
          <span className="text-muted-foreground text-sm">Agents Total</span>
          <span className="font-semibold text-sm">{fmt(agentsOnly)}</span>
        </div>
      )}

      {/* Members breakdown */}
      <div>
        <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
          Members
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {/* Owner row */}
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
                  {fmt(members[0]?.total ?? 0)}
                </div>
                <div className="text-muted-foreground text-xs">
                  Positions {fmt(ownerPositions)}
                </div>
              </div>
            </div>
          </div>

          {/* Agent rows */}
          {agentMembers.map((agent) => {
            const pct =
              totalBalance > 0
                ? ((agent.total / totalBalance) * 100).toFixed(1)
                : '0.0';
            return (
              <div
                key={agent.name}
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
                      Positions {fmt(agent.openPositions)}
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
