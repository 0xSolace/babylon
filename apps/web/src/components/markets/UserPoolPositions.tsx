'use client';

import { cn } from '@babylon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BouncingLogo } from '@/components/shared/BouncingLogo';
import { useAuth } from '@/hooks/useAuth';
import type { UserPoolDeposit, UserPoolSummary } from '@/types/pools';

interface PoolDepositsResponse {
  activeDeposits?: UserPoolDeposit[];
  summary?: UserPoolSummary;
}

interface WithdrawResponse {
  withdrawalAmount: number;
  pnl: number;
  performanceFee: number;
  reputationChange: number;
  error?: string;
}

interface UserPoolPositionsProps {
  onWithdraw?: () => void;
}

export function UserPoolPositions({ onWithdraw }: UserPoolPositionsProps) {
  const { user, authenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['pool-deposits', user?.id],
    queryFn: async (): Promise<{
      deposits: UserPoolDeposit[];
      summary: UserPoolSummary | null;
    }> => {
      const res = await fetch(
        `/api/pools/deposits/${encodeURIComponent(user!.id)}`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch pool deposits');
      }
      const data: PoolDepositsResponse = await res.json();
      return {
        deposits: data.activeDeposits ?? [],
        summary: data.summary ?? null,
      };
    },
    enabled: authenticated && !!user,
    staleTime: 30000, // 30 seconds
  });

  const deposits = data?.deposits ?? [];
  const summary = data?.summary ?? null;

  const withdrawMutation = useMutation({
    mutationFn: async ({
      depositId,
      poolId,
    }: {
      depositId: string;
      poolId: string;
    }): Promise<WithdrawResponse> => {
      const res = await fetch(`/api/pools/${poolId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.id,
          depositId,
        }),
      });

      const data: WithdrawResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Withdrawal failed');
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Withdrew $${data.withdrawalAmount.toFixed(2)}! Profit: $${data.pnl.toFixed(2)}, Fee: $${data.performanceFee.toFixed(2)}, Reputation: ${data.reputationChange >= 0 ? '+' : ''}${data.reputationChange}`
      );
      void queryClient.invalidateQueries({ queryKey: ['pool-deposits'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      onWithdraw?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleWithdraw = (depositId: string, poolId: string) => {
    if (!user) return;

    const confirmed = confirm(
      'Are you sure you want to withdraw from this pool? Performance fees will be calculated.'
    );
    if (!confirmed) return;

    withdrawMutation.mutate({ depositId, poolId });
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  if (!authenticated) {
    return (
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-muted-foreground text-sm">
          Log in to see your pool positions
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <BouncingLogo size={24} />
      </div>
    );
  }

  if (deposits.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="rounded-lg bg-muted p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Total Invested
              </div>
              <div className="font-bold text-xl">
                {formatCurrency(summary.totalInvested)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Current Value
              </div>
              <div className="font-bold text-xl">
                {formatCurrency(summary.totalCurrentValue)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Total P&L
              </div>
              <div
                className={cn(
                  'font-bold text-xl',
                  summary.totalUnrealizedPnL >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {formatCurrency(summary.totalUnrealizedPnL)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Total Return
              </div>
              <div
                className={cn(
                  'font-bold text-xl',
                  summary.totalReturnPercent >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {formatPercent(summary.totalReturnPercent)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Deposits */}
      <div className="space-y-2">
        {deposits.map((deposit) => (
          <div
            key={deposit.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="font-semibold">{deposit.poolName}</div>
                <div className="text-muted-foreground text-xs">
                  {deposit.npcActor.name} •{' '}
                  {deposit.npcActor.tier?.replace('_TIER', '')}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'font-bold',
                    deposit.unrealizedPnL >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {formatCurrency(deposit.unrealizedPnL)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {formatPercent(deposit.returnPercent)}
                </div>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Invested</div>
                <div className="font-medium">
                  {formatCurrency(deposit.amount)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Current</div>
                <div className="font-medium">
                  {formatCurrency(deposit.currentValue)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Shares</div>
                <div className="font-medium">{deposit.shares.toFixed(2)}</div>
              </div>
            </div>

            <button
              onClick={() => handleWithdraw(deposit.id, deposit.poolId)}
              disabled={
                withdrawMutation.isPending &&
                withdrawMutation.variables?.depositId === deposit.id
              }
              className="w-full rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {withdrawMutation.isPending &&
              withdrawMutation.variables?.depositId === deposit.id
                ? 'Withdrawing...'
                : 'Withdraw'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
