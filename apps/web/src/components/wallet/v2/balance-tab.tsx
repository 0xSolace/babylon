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
        name: 'You (Owner)',
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
          <span className="font-bold text-2xl">{fmt(totalBalance)}</span>
        </div>
        {agentsOnly > 0 && (
          <div className="flex items-center justify-between border-border border-b py-3">
            <span className="text-foreground text-sm">Agents Only</span>
            <span className="font-semibold text-lg">{fmt(agentsOnly)}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div>
        <div className="grid grid-cols-4 gap-4 py-3 text-muted-foreground text-xs">
          <div>Member</div>
          <div className="text-right">Cash</div>
          <div className="text-right">Open Positions</div>
          <div className="text-right">Total</div>
        </div>
        {members.map((row) => (
          <div
            key={row.name}
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
