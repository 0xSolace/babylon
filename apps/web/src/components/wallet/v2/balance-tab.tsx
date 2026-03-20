'use client';

import { formatCurrency } from '@babylon/shared';
import { useMemo } from 'react';
import type { TeamTradingSummary } from '@/hooks/useTeamTradingSummary';
import { useUserPositions } from '@/stores/userPositionsStore';

interface BalanceTabProps {
  userId: string;
  teamSummary: TeamTradingSummary | null;
  teamSummaryLoading: boolean;
  teamSummaryError: string | null;
}

interface Member {
  id: string;
  kind: 'owner' | 'agent';
  name: string;
  cash: number;
  openPositions: number;
  total: number;
}

export function BalanceTab({
  userId,
  teamSummary,
  teamSummaryLoading,
  teamSummaryError,
}: BalanceTabProps) {
  const {
    perpPositions,
    predictionPositions,
    loading: positionsLoading,
  } = useUserPositions(userId);

  const loading = teamSummaryLoading || positionsLoading;

  const { members, totalBalance, agentsOnly } = useMemo(() => {
    if (!teamSummary) {
      return {
        members: [] as Member[],
        totalBalance: 0,
        agentsOnly: 0,
      };
    }

    const positionValues = new Map<string, number>();

    for (const pos of perpPositions) {
      const value = Math.abs(pos.unrealizedPnL) + pos.size;
      const memberId = pos.isAgentPosition
        ? (pos.agentId ?? teamSummary.ownerId)
        : teamSummary.ownerId;
      positionValues.set(memberId, (positionValues.get(memberId) ?? 0) + value);
    }

    for (const pos of predictionPositions) {
      const value = pos.currentValue ?? pos.shares * pos.currentPrice;
      const memberId = pos.isAgentPosition
        ? (pos.agentId ?? teamSummary.ownerId)
        : teamSummary.ownerId;
      positionValues.set(memberId, (positionValues.get(memberId) ?? 0) + value);
    }

    const memberList: Member[] = teamSummary.members.map((member) => {
      const openPositions = positionValues.get(member.id) ?? 0;
      const cash = member.walletBalance;
      return {
        id: member.id,
        kind: member.entityType,
        name: member.entityType === 'owner' ? 'You' : member.name,
        cash,
        openPositions,
        total: cash + openPositions,
      };
    });

    const total = memberList.reduce((sum, member) => sum + member.total, 0);
    const agentTotal = memberList
      .filter((member) => member.kind === 'agent')
      .reduce((sum, member) => sum + member.total, 0);

    return {
      members: memberList,
      totalBalance: total,
      agentsOnly: agentTotal,
    };
  }, [teamSummary, perpPositions, predictionPositions]);

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

  if (!teamSummary && teamSummaryError) {
    return (
      <div className="rounded-xl border border-border py-10 text-center">
        <p className="text-muted-foreground">Failed to load team balances</p>
        <p className="mt-1 text-muted-foreground text-sm">{teamSummaryError}</p>
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
