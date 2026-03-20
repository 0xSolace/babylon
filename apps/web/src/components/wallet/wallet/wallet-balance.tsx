'use client';

import { formatCurrency } from '@babylon/shared';
import { useMemo } from 'react';
import { useUserPositions } from '@/stores/userPositionsStore';
import { useWalletBalance } from '@/stores/walletBalanceStore';

interface WalletBalanceProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

interface Member {
  name: string;
  cash: number;
  openPositions: number;
  total: number;
  isOwner?: boolean;
}

export function WalletBalance({ userId, mode = 'page' }: WalletBalanceProps) {
  const { balance, loading: balanceLoading } = useWalletBalance(userId);
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const isSidebar = mode === 'sidebar';
  const loading = balanceLoading || positionsLoading;

  const { members, totalBalance, agentsOnly } = useMemo(() => {
    // Owner bucket
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

    // Build member rows
    const memberList: Member[] = [
      {
        name: 'You (Owner)',
        cash: balance,
        openPositions: ownerPositionValue,
        total: balance + ownerPositionValue,
        isOwner: true,
      },
    ];

    let agentTotal = 0;
    for (const [agentName, posValue] of agentPositionValues) {
      // Agents don't hold separate cash balances in current model
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
          <span className="font-bold text-2xl">{fmt(totalBalance)}</span>
        </div>
        {agentsOnly > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Agents Only</span>
            <span className="font-semibold text-lg">{fmt(agentsOnly)}</span>
          </div>
        )}
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
            {members.map((member) => (
              <tr
                key={member.name}
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
            {members.map((member) => (
              <tr
                key={member.name}
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
