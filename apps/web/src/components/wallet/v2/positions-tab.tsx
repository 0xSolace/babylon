'use client';

import type { UserPredictionPosition } from '@babylon/shared';
import {
  calculateUnrealizedPnL,
  cn,
  formatCurrency,
  logger,
} from '@babylon/shared';
import { usePrivy } from '@privy-io/react-auth';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type ClosePerpDetails,
  type SellPredictionDetails,
  TradeConfirmationDialog,
} from '@/components/markets/TradeConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { usePerpTrade } from '@/hooks/usePerpTrade';
import { invalidatePerpMarketsCache } from '@/stores/perpMarketsStore';
import {
  invalidateUserPositions,
  useUserPositions,
  useUserPositionsStore,
} from '@/stores/userPositionsStore';
import { invalidateWalletBalance } from '@/stores/walletBalanceStore';
import type {
  ApiErrorResponse,
  DisplayPerpPosition,
  SellSharesSuccessResponse,
} from '@/types/markets';

interface PositionsTabProps {
  userId: string;
}

type MemberFilter = 'all' | 'owner' | string;

type PendingTrade =
  | {
      kind: 'close-perp';
      position: DisplayPerpPosition;
      currentPrice: number;
      pnl: number;
      pnlPercent: number;
    }
  | {
      kind: 'sell-prediction';
      position: UserPredictionPosition;
      expectedValue: number;
      unrealizedPnL: number;
      unrealizedPnLPercent: number;
    };

interface ClosedPerpPosition {
  id: string;
  ticker: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  realizedPnL: number;
  closedAt: string | null;
  isAgentPosition: boolean;
  agentName: string | null;
}

export function PositionsTab({ userId }: PositionsTabProps) {
  const { perpPositions, predictionPositions, loading } =
    useUserPositions(userId);
  const { getAccessToken } = useAuth();
  const { getAccessToken: getPrivyToken } = usePrivy();
  const { closePosition: closePerpPosition } = usePerpTrade({
    getAccessToken,
  });

  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<PendingTrade | null>(null);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [closedPerps, setClosedPerps] = useState<ClosedPerpPosition[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);

  // Fetch closed perpetuals
  useEffect(() => {
    let cancelled = false;
    async function fetchClosed() {
      setClosedLoading(true);
      try {
        const res = await fetch(
          `/api/markets/positions/${encodeURIComponent(userId)}?status=closed&type=perps`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const positions = (data?.perpetuals?.positions ?? []).map(
          (p: Record<string, unknown>) => ({
            id: p.id as string,
            ticker: p.ticker as string,
            side: p.side as 'long' | 'short',
            entryPrice: Number(p.entryPrice ?? 0),
            currentPrice: Number(p.currentPrice ?? 0),
            size: Number(p.size ?? 0),
            leverage: Number(p.leverage ?? 1),
            realizedPnL: Number(p.realizedPnL ?? 0),
            closedAt: (p.closedAt as string) ?? null,
            isAgentPosition: (p.isAgentPosition as boolean) ?? false,
            agentName: (p.agentName as string) ?? null,
          })
        );
        setClosedPerps(positions);
      } catch {
        // silently fail for closed positions
      } finally {
        if (!cancelled) setClosedLoading(false);
      }
    }
    fetchClosed();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live prices for perp positions
  const tickers = useMemo(
    () => perpPositions.map((pos) => pos.ticker),
    [perpPositions]
  );
  const livePrices = useMarketPrices(tickers);

  // Pre-calculate PnL for perp positions
  const perpsWithPnL = useMemo(
    () =>
      perpPositions.map((position) => {
        const livePrice = livePrices.get(position.ticker)?.price;
        const currentPrice = livePrice ?? position.currentPrice;
        const { pnl, pnlPercent } = calculateUnrealizedPnL(
          position.entryPrice,
          currentPrice,
          position.side,
          position.size
        );
        return { position, currentPrice, pnl, pnlPercent };
      }),
    [perpPositions, livePrices]
  );

  // Build member list for filter dropdown
  const memberOptions = useMemo(() => {
    const agents = new Set<string>();
    for (const pos of perpPositions) {
      if (pos.isAgentPosition && pos.agentName) agents.add(pos.agentName);
    }
    for (const pos of predictionPositions) {
      if (pos.isAgentPosition && pos.agentName) agents.add(pos.agentName);
    }
    return ['all', 'owner', ...Array.from(agents)] as string[];
  }, [perpPositions, predictionPositions]);

  const memberFilterLabel =
    memberFilter === 'all'
      ? 'All Members'
      : memberFilter === 'owner'
        ? 'You (Owner)'
        : memberFilter;

  // Filter positions by member
  const filteredPerps = useMemo(() => {
    if (memberFilter === 'all') return perpsWithPnL;
    if (memberFilter === 'owner')
      return perpsWithPnL.filter((p) => !p.position.isAgentPosition);
    return perpsWithPnL.filter((p) => p.position.agentName === memberFilter);
  }, [perpsWithPnL, memberFilter]);

  const filteredPredictions = useMemo(() => {
    const open = predictionPositions.filter((p) => !p.resolved);
    if (memberFilter === 'all') return open;
    if (memberFilter === 'owner') return open.filter((p) => !p.isAgentPosition);
    return open.filter((p) => p.agentName === memberFilter);
  }, [predictionPositions, memberFilter]);

  const filteredClosedPerps = useMemo(() => {
    if (memberFilter === 'all') return closedPerps;
    if (memberFilter === 'owner')
      return closedPerps.filter((p) => !p.isAgentPosition);
    return closedPerps.filter((p) => p.agentName === memberFilter);
  }, [closedPerps, memberFilter]);

  // Close perp handlers
  const handleCloseClick = useCallback(
    (
      position: DisplayPerpPosition,
      currentPrice: number,
      pnl: number,
      pnlPercent: number
    ) => {
      setPendingTrade({
        kind: 'close-perp',
        position,
        currentPrice,
        pnl,
        pnlPercent,
      });
      setConfirmDialogOpen(true);
    },
    []
  );

  const handleConfirmClose = useCallback(async () => {
    if (!pendingTrade || pendingTrade.kind !== 'close-perp') return;

    const closingPosition = pendingTrade.position;
    const positionId = closingPosition.id;

    setClosingIds((prev) => new Set(prev).add(positionId));
    setConfirmDialogOpen(false);
    setPendingTrade(null);

    try {
      const data = await closePerpPosition(positionId);
      const pnl =
        typeof data?.pnl === 'number'
          ? data.pnl
          : typeof data?.realizedPnL === 'number'
            ? data.realizedPnL
            : 0;

      const pnlSign = pnl >= 0 ? '+' : '-';
      toast.success('Position closed!', {
        description: `${closingPosition.ticker}: ${pnlSign}${formatCurrency(
          Math.abs(pnl),
          { useThousandsSeparator: true }
        )} PnL`,
      });

      useUserPositionsStore.getState().removePerpPosition(positionId);
      invalidatePerpMarketsCache();
      invalidateWalletBalance();
    } catch (err) {
      toast.error('Failed to close position', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred',
      });
    } finally {
      setClosingIds((prev) => {
        const next = new Set(prev);
        next.delete(positionId);
        return next;
      });
    }
  }, [closePerpPosition, pendingTrade]);

  // Sell prediction handlers
  const handleSellClick = useCallback((position: UserPredictionPosition) => {
    const currentValue =
      position.currentValue ?? position.shares * position.currentPrice;
    const costBasis = position.costBasis ?? position.shares * position.avgPrice;
    const unrealizedPnL = position.unrealizedPnL ?? currentValue - costBasis;
    const pnlPercent = costBasis !== 0 ? (unrealizedPnL / costBasis) * 100 : 0;

    setPendingTrade({
      kind: 'sell-prediction',
      position,
      expectedValue: currentValue,
      unrealizedPnL,
      unrealizedPnLPercent: pnlPercent,
    });
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmSell = useCallback(async () => {
    if (!pendingTrade || pendingTrade.kind !== 'sell-prediction') return;

    const position = pendingTrade.position;
    setSellingId(position.id);
    setConfirmDialogOpen(false);

    const token = await getPrivyToken();
    if (!token) {
      toast.error('Authentication required. Please log in.');
      setSellingId(null);
      setPendingTrade(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/markets/predictions/${position.marketId}/sell`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            shares: position.shares,
            positionId: position.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        const errorMessage =
          typeof errorData.error === 'object'
            ? (errorData.error.message ?? 'Failed to sell shares')
            : (errorData.error ?? errorData.message ?? 'Failed to sell shares');
        toast.error(errorMessage);
        return;
      }

      const data: SellSharesSuccessResponse = await response.json();
      const pnl = data.pnl;
      const pnlSign = pnl >= 0 ? '+' : '-';
      toast.success('Shares sold!', {
        description: `Sold ${position.shares.toFixed(2)} ${position.side} shares for ${pnlSign}${formatCurrency(
          Math.abs(pnl),
          { useThousandsSeparator: true }
        )} PnL`,
      });

      invalidateUserPositions();
      invalidateWalletBalance();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sell shares';
      logger.error(
        'Failed to sell prediction shares',
        { marketId: position.marketId, positionId: position.id, error: err },
        'PositionsTab'
      );
      toast.error(message);
    } finally {
      setSellingId(null);
      setPendingTrade(null);
    }
  }, [getPrivyToken, pendingTrade]);

  const handleConfirm = useCallback(async () => {
    if (!pendingTrade) return;
    if (pendingTrade.kind === 'close-perp') {
      await handleConfirmClose();
    } else {
      await handleConfirmSell();
    }
  }, [pendingTrade, handleConfirmClose, handleConfirmSell]);

  const fmt = (amount: number) =>
    formatCurrency(amount, { useThousandsSeparator: true });

  const fmtPrediction = (price: number) =>
    formatCurrency(price, { decimals: 3, useThousandsSeparator: true });

  // Build trade details for confirmation dialog
  const tradeDetails = (() => {
    if (!pendingTrade) return null;
    if (pendingTrade.kind === 'close-perp') {
      return {
        type: 'close-perp' as const,
        ticker: pendingTrade.position.ticker,
        side: pendingTrade.position.side,
        size: pendingTrade.position.size,
        leverage: pendingTrade.position.leverage,
        entryPrice: pendingTrade.position.entryPrice,
        currentPrice: pendingTrade.currentPrice,
        unrealizedPnL: pendingTrade.pnl,
        unrealizedPnLPercent: pendingTrade.pnlPercent,
      } as ClosePerpDetails;
    }
    return {
      type: 'sell-prediction' as const,
      question: pendingTrade.position.question,
      side: pendingTrade.position.side,
      shares: pendingTrade.position.shares,
      avgPrice: pendingTrade.position.avgPrice,
      currentPrice: pendingTrade.position.currentPrice,
      expectedValue: pendingTrade.expectedValue,
      unrealizedPnL: pendingTrade.unrealizedPnL,
      unrealizedPnLPercent: pendingTrade.unrealizedPnLPercent,
    } as SellPredictionDetails;
  })();

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const hasPositions =
    filteredPerps.length > 0 ||
    filteredPredictions.length > 0 ||
    filteredClosedPerps.length > 0;

  return (
    <div>
      {/* Header with member filter */}
      <div className="relative mb-6 inline-block">
        <button
          className="flex items-center gap-2 font-semibold text-xl"
          onClick={() => setMemberDropdownOpen((prev) => !prev)}
        >
          {memberFilterLabel}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        {memberDropdownOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-md border border-border bg-background py-1 shadow-lg">
            {memberOptions.map((opt) => {
              const label =
                opt === 'all'
                  ? 'All Members'
                  : opt === 'owner'
                    ? 'You (Owner)'
                    : opt;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    setMemberFilter(opt as MemberFilter);
                    setMemberDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    memberFilter === opt && 'bg-muted font-medium'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!hasPositions && (
        <div className="py-8 text-center text-muted-foreground">
          <p>No positions found</p>
          <p className="mt-1 text-sm">
            Open a position on the Terminal to get started
          </p>
        </div>
      )}

      {/* Open Perpetuals */}
      {filteredPerps.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Open Perpetuals
          </h3>
          <div className="space-y-6">
            {filteredPerps.map(
              ({ position, currentPrice, pnl, pnlPercent }) => {
                const isClosing = closingIds.has(position.id);
                return (
                  <div
                    key={position.id}
                    className="flex items-start justify-between py-2"
                  >
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          ${position.ticker}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium text-xs ${
                            position.side === 'long'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {position.side.toUpperCase()}
                        </span>
                      </div>
                      <div className="mb-2 text-muted-foreground text-sm">
                        {position.isAgentPosition
                          ? (position.agentName ?? 'Agent')
                          : 'Owner'}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Entry {fmt(position.entryPrice)} &rarr; Now{' '}
                        {fmt(currentPrice)} &middot; Size {fmt(position.size)}{' '}
                        &middot; Liq {fmt(position.liquidationPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={`font-medium text-sm ${
                            pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {fmt(pnl)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            pnl >= 0
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleCloseClick(
                            position,
                            currentPrice,
                            pnl,
                            pnlPercent
                          )
                        }
                        disabled={isClosing}
                        className="mt-1 text-muted-foreground text-sm hover:text-foreground disabled:opacity-50"
                      >
                        {isClosing ? 'Closing...' : 'Close'}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Open Predictions */}
      {filteredPredictions.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Open Predictions
          </h3>
          <div className="space-y-6">
            {filteredPredictions.map((position) => {
              const currentValue =
                position.currentValue ??
                position.shares * position.currentPrice;
              const costBasis =
                position.costBasis ?? position.shares * position.avgPrice;
              const unrealizedPnL =
                position.unrealizedPnL ?? currentValue - costBasis;
              const pnlPercent =
                costBasis !== 0 ? (unrealizedPnL / costBasis) * 100 : 0;
              const isSelling = sellingId === position.id;

              return (
                <div
                  key={position.id}
                  className="flex items-start justify-between py-2"
                >
                  <div>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {position.question.length > 40
                          ? `${position.question.slice(0, 40)}...`
                          : position.question}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium text-xs ${
                          position.side === 'YES'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {position.side}
                      </span>
                    </div>
                    <div className="mb-2 text-muted-foreground text-sm">
                      {position.isAgentPosition
                        ? (position.agentName ?? 'Agent')
                        : 'Owner'}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Size {position.shares.toFixed(2)} shares &middot; Avg{' '}
                      {fmtPrediction(position.avgPrice)} &middot; Now{' '}
                      {fmtPrediction(position.currentPrice)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`font-medium text-sm ${
                          unrealizedPnL >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        }`}
                      >
                        {unrealizedPnL >= 0 ? '+' : ''}
                        {fmtPrediction(unrealizedPnL)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          unrealizedPnL >= 0
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {unrealizedPnL >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(1)}%
                      </span>
                    </div>
                    <button
                      onClick={() => handleSellClick(position)}
                      disabled={isSelling || position.shares < 0.01}
                      className="mt-1 text-muted-foreground text-sm hover:text-foreground disabled:opacity-50"
                    >
                      {isSelling
                        ? 'Selling...'
                        : position.shares < 0.01
                          ? 'Too Small'
                          : 'Sell'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed Perpetuals */}
      {filteredClosedPerps.length > 0 && (
        <div>
          <h3 className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Closed Perpetuals
          </h3>
          <div className="space-y-6">
            {filteredClosedPerps.map((position) => {
              const pnl = position.realizedPnL;
              const pnlPercent =
                position.size !== 0 ? (pnl / position.size) * 100 : 0;
              return (
                <div
                  key={position.id}
                  className="flex items-start justify-between py-2"
                >
                  <div>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        ${position.ticker}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium text-xs ${
                          position.side === 'long'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {position.side.toUpperCase()}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600 text-xs">
                        CLOSED
                      </span>
                    </div>
                    {position.agentName && (
                      <div className="mb-2 text-muted-foreground text-sm">
                        {position.agentName}
                      </div>
                    )}
                    <div className="text-muted-foreground text-sm">
                      Entry {fmt(position.entryPrice)} &rarr; Exit{' '}
                      {fmt(position.currentPrice)} &middot; Size{' '}
                      {fmt(position.size)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`font-medium text-sm ${
                          pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {fmt(pnl)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          pnl >= 0
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(1)}%
                      </span>
                    </div>
                    {position.closedAt && (
                      <div className="mt-1 text-muted-foreground text-sm">
                        {new Date(position.closedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closedLoading && filteredClosedPerps.length === 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Closed Perpetuals
          </h3>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )}

      <TradeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirm}
        isSubmitting={
          (pendingTrade?.kind === 'close-perp' &&
            closingIds.has(pendingTrade.position.id)) ||
          sellingId !== null
        }
        tradeDetails={tradeDetails}
      />
    </div>
  );
}
