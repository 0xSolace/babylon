'use client';

import type { UserPredictionPosition } from '@babylon/shared';
import {
  calculateUnrealizedPnL,
  cn,
  formatCurrency,
  logger,
} from '@babylon/shared';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type ClosePerpDetails,
  type SellPredictionDetails,
  TradeConfirmationDialog,
} from '@/components/markets/TradeConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { usePerpTrade } from '@/hooks/usePerpTrade';
import { usePredictionTrading } from '@/hooks/usePredictionTrading';
import { invalidatePerpMarketsCache } from '@/stores/perpMarketsStore';
import {
  invalidateUserPositions,
  useUserPositions,
  useUserPositionsStore,
} from '@/stores/userPositionsStore';
import { invalidateWalletBalance } from '@/stores/walletBalanceStore';
import type { DisplayPerpPosition } from '@/types/markets';

interface PositionsTabProps {
  userId: string;
}

type MemberFilter = 'all' | 'owner' | string;
type OutcomeFilter = 'all' | 'won' | 'lost';

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

interface ClosedPredictionPosition {
  id: string;
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  outcome: boolean | null;
  resolvedAt: string | null;
  createdAt: string | null;
  isAgentPosition: boolean;
  agentName: string | null;
}

const CLOSED_PAGE_SIZE = 20;

export function PositionsTab({ userId }: PositionsTabProps) {
  const { perpPositions, predictionPositions, loading } =
    useUserPositions(userId);
  const { getAccessToken } = useAuth();
  const { loading: predictionTradeLoading, sellPrediction } =
    usePredictionTrading();
  const { closePosition: closePerpPosition } = usePerpTrade({
    getAccessToken,
  });

  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const [predictionActionId, setPredictionActionId] = useState<string | null>(
    null
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<PendingTrade | null>(null);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Closed positions state
  const [closedPerps, setClosedPerps] = useState<ClosedPerpPosition[]>([]);
  const [closedPredictions, setClosedPredictions] = useState<
    ClosedPredictionPosition[]
  >([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedPerpsPage, setClosedPerpsPage] = useState(1);
  const [closedPredictionsPage, setClosedPredictionsPage] = useState(1);
  const [closedPerpsHasMore, setClosedPerpsHasMore] = useState(false);
  const [closedPredictionsHasMore, setClosedPredictionsHasMore] =
    useState(false);
  const [loadingMorePerps, setLoadingMorePerps] = useState(false);
  const [loadingMorePredictions, setLoadingMorePredictions] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  // Fetch closed positions (both perps and predictions)
  useEffect(() => {
    let cancelled = false;
    async function fetchClosed() {
      setClosedLoading(true);
      try {
        const [perpsRes, predsRes] = await Promise.all([
          fetch(
            `/api/markets/positions/${encodeURIComponent(userId)}?status=closed&type=perps&limit=${CLOSED_PAGE_SIZE}&page=1`
          ),
          fetch(
            `/api/markets/positions/${encodeURIComponent(userId)}?status=closed&type=predictions&limit=${CLOSED_PAGE_SIZE}&page=1`
          ),
        ]);

        if (cancelled) return;

        if (perpsRes.ok) {
          const data = await perpsRes.json();
          if (!cancelled) {
            setClosedPerps(parseClosedPerps(data?.perpetuals?.positions ?? []));
            setClosedPerpsHasMore(data?.perpetuals?.hasMore ?? false);
            setClosedPerpsPage(1);
          }
        }

        if (predsRes.ok) {
          const data = await predsRes.json();
          if (!cancelled) {
            setClosedPredictions(
              parseClosedPredictions(data?.predictions?.positions ?? [])
            );
            setClosedPredictionsHasMore(data?.predictions?.hasMore ?? false);
            setClosedPredictionsPage(1);
          }
        }
      } catch (err) {
        logger.warn(
          'Failed to fetch closed positions',
          { userId, error: err },
          'PositionsTab'
        );
      } finally {
        if (!cancelled) setClosedLoading(false);
      }
    }
    fetchClosed();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Load more handlers
  const loadMoreClosedPerps = useCallback(async () => {
    const nextPage = closedPerpsPage + 1;
    setLoadingMorePerps(true);
    try {
      const res = await fetch(
        `/api/markets/positions/${encodeURIComponent(userId)}?status=closed&type=perps&limit=${CLOSED_PAGE_SIZE}&page=${nextPage}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const newPositions = parseClosedPerps(data?.perpetuals?.positions ?? []);
      setClosedPerps((prev) => [...prev, ...newPositions]);
      setClosedPerpsHasMore(data?.perpetuals?.hasMore ?? false);
      setClosedPerpsPage(nextPage);
    } catch (err) {
      logger.warn(
        'Failed to load more closed perps',
        { userId, error: err },
        'PositionsTab'
      );
    } finally {
      setLoadingMorePerps(false);
    }
  }, [userId, closedPerpsPage]);

  const loadMoreClosedPredictions = useCallback(async () => {
    const nextPage = closedPredictionsPage + 1;
    setLoadingMorePredictions(true);
    try {
      const res = await fetch(
        `/api/markets/positions/${encodeURIComponent(userId)}?status=closed&type=predictions&limit=${CLOSED_PAGE_SIZE}&page=${nextPage}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const newPositions = parseClosedPredictions(
        data?.predictions?.positions ?? []
      );
      setClosedPredictions((prev) => [...prev, ...newPositions]);
      setClosedPredictionsHasMore(data?.predictions?.hasMore ?? false);
      setClosedPredictionsPage(nextPage);
    } catch (err) {
      logger.warn(
        'Failed to load more closed predictions',
        { userId, error: err },
        'PositionsTab'
      );
    } finally {
      setLoadingMorePredictions(false);
    }
  }, [userId, closedPredictionsPage]);

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
    for (const pos of closedPerps) {
      if (pos.isAgentPosition && pos.agentName) agents.add(pos.agentName);
    }
    for (const pos of closedPredictions) {
      if (pos.isAgentPosition && pos.agentName) agents.add(pos.agentName);
    }
    return ['all', 'owner', ...Array.from(agents)] as string[];
  }, [perpPositions, predictionPositions, closedPerps, closedPredictions]);

  useOnClickOutside(memberDropdownRef, () => {
    setMemberDropdownOpen(false);
  });

  const memberFilterLabel =
    memberFilter === 'all'
      ? 'All Members'
      : memberFilter === 'owner'
        ? 'You'
        : memberFilter;

  // Filter positions by member
  const filteredPerps = useMemo(() => {
    if (memberFilter === 'all') return perpsWithPnL;
    if (memberFilter === 'owner')
      return perpsWithPnL.filter((p) => !p.position.isAgentPosition);
    return perpsWithPnL.filter((p) => p.position.agentName === memberFilter);
  }, [perpsWithPnL, memberFilter]);

  const visiblePredictionPositions = predictionPositions.filter(
    (position) => !position.resolved
  );

  const filteredPredictions = useMemo(() => {
    const open = visiblePredictionPositions;
    if (memberFilter === 'all') return open;
    if (memberFilter === 'owner') return open.filter((p) => !p.isAgentPosition);
    return open.filter((p) => p.agentName === memberFilter);
  }, [visiblePredictionPositions, memberFilter]);

  // Filter closed positions by member and outcome
  const filteredClosedPerps = useMemo(() => {
    let filtered = closedPerps;
    if (memberFilter === 'owner')
      filtered = filtered.filter((p) => !p.isAgentPosition);
    else if (memberFilter !== 'all')
      filtered = filtered.filter((p) => p.agentName === memberFilter);

    if (outcomeFilter === 'won')
      filtered = filtered.filter((p) => p.realizedPnL >= 0);
    else if (outcomeFilter === 'lost')
      filtered = filtered.filter((p) => p.realizedPnL < 0);

    return filtered;
  }, [closedPerps, memberFilter, outcomeFilter]);

  const filteredClosedPredictions = useMemo(() => {
    let filtered = closedPredictions;
    if (memberFilter === 'owner')
      filtered = filtered.filter((p) => !p.isAgentPosition);
    else if (memberFilter !== 'all')
      filtered = filtered.filter((p) => p.agentName === memberFilter);

    if (outcomeFilter === 'won') filtered = filtered.filter((p) => p.pnl >= 0);
    else if (outcomeFilter === 'lost')
      filtered = filtered.filter((p) => p.pnl < 0);

    return filtered;
  }, [closedPredictions, memberFilter, outcomeFilter]);

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
    setPredictionActionId(position.id);
    setConfirmDialogOpen(false);

    try {
      const result = await sellPrediction({
        marketId: position.marketId,
        side: position.side,
        shares: position.shares,
        positionId: position.id,
      });

      const pnlSign = result.pnl >= 0 ? '+' : '-';
      toast.success('Shares sold!', {
        description: `Sold ${position.shares.toFixed(2)} ${position.side} shares for ${pnlSign}${formatCurrency(
          Math.abs(result.pnl),
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
      setPredictionActionId(null);
      setPendingTrade(null);
    }
  }, [pendingTrade, sellPrediction]);

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
      mode: 'sell',
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
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const hasOpenPositions =
    filteredPerps.length > 0 || filteredPredictions.length > 0;
  const hasClosedPositions =
    filteredClosedPerps.length > 0 || filteredClosedPredictions.length > 0;
  const hasPositions = hasOpenPositions || hasClosedPositions;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header with member filter */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-base">Positions</h2>
        <div className="relative inline-block" ref={memberDropdownRef}>
          <button
            className="flex items-center gap-1.5 font-semibold text-base"
            onClick={() => setMemberDropdownOpen((prev) => !prev)}
          >
            {memberFilterLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {memberDropdownOpen && (
            <div className="absolute top-full right-0 z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
              {memberOptions.map((opt) => {
                const label =
                  opt === 'all' ? 'All Members' : opt === 'owner' ? 'You' : opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      setMemberFilter(opt as MemberFilter);
                      setMemberDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors',
                      memberFilter === opt
                        ? 'bg-muted font-medium'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!hasPositions && !closedLoading && (
        <div className="rounded-xl border border-border py-10 text-center">
          <p className="text-muted-foreground">No positions found</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Open a position on the Terminal to get started
          </p>
        </div>
      )}

      {/* ── Open Perpetuals ── */}
      {filteredPerps.length > 0 && (
        <div>
          <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
            Open Perpetuals ({filteredPerps.length})
          </div>
          <div className="space-y-1.5 md:space-y-2">
            {filteredPerps.map(
              ({ position, currentPrice, pnl, pnlPercent }) => {
                const isClosing = closingIds.has(position.id);
                return (
                  <div
                    key={position.id}
                    className="rounded-xl border border-border px-3 py-3 md:px-4 md:py-3.5"
                  >
                    {/* Row 1: Ticker + badge + PnL */}
                    <div className="flex items-center justify-between whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          ${position.ticker}
                        </span>
                        <span
                          className={cn(
                            'rounded px-1 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                            position.side === 'long'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-red-500/15 text-red-500'
                          )}
                        >
                          {position.side.toUpperCase()} {position.leverage}X
                        </span>
                        {position.isAgentPosition && (
                          <span className="text-muted-foreground text-xs">
                            {position.agentName ?? 'Agent'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            'font-semibold text-sm',
                            pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                          )}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {fmt(pnl)}
                        </span>
                        <span
                          className={cn(
                            'text-xs',
                            pnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                          )}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Details grid + action */}
                    <div className="mt-2 flex items-end justify-between whitespace-nowrap">
                      <div className="flex gap-4 text-xs md:gap-6">
                        <div>
                          <div className="text-muted-foreground">Entry</div>
                          <div className="font-medium text-foreground">
                            {fmt(position.entryPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Now</div>
                          <div className="font-medium text-foreground">
                            {fmt(currentPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Size</div>
                          <div className="font-medium text-foreground">
                            {fmt(position.size)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Liq</div>
                          <div className="font-medium text-foreground">
                            {fmt(position.liquidationPrice)}
                          </div>
                        </div>
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
                        className="shrink-0 rounded-md border border-border px-3 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
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

      {/* ── Open Predictions ── */}
      {filteredPredictions.length > 0 && (
        <div>
          <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
            Open Predictions ({filteredPredictions.length})
          </div>
          <div className="space-y-1.5 md:space-y-2">
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
              const isSubmitting = predictionActionId === position.id;

              return (
                <div
                  key={position.id}
                  className="rounded-xl border border-border px-3 py-3 md:px-4 md:py-3.5"
                >
                  {/* Row 1: Question + badge + PnL */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-semibold text-sm leading-tight">
                        {position.question}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          'font-semibold text-sm',
                          unrealizedPnL >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        )}
                      >
                        {unrealizedPnL >= 0 ? '+' : ''}
                        {fmtPrediction(unrealizedPnL)}
                      </div>
                      <div
                        className={cn(
                          'text-xs',
                          unrealizedPnL >= 0
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        )}
                      >
                        {unrealizedPnL >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {position.isAgentPosition && (
                    <div className="mt-1 text-muted-foreground text-xs">
                      {position.agentName ?? 'Agent'}
                    </div>
                  )}

                  {/* Row 2: Details grid + action */}
                  <div className="mt-2 flex items-end justify-between whitespace-nowrap">
                    <div className="flex gap-4 text-xs md:gap-6">
                      <div>
                        <div className="text-muted-foreground">Shares</div>
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          {position.shares.toFixed(2)}
                          <span
                            className={cn(
                              'rounded px-1 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                              position.side === 'YES'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-red-500/15 text-red-500'
                            )}
                          >
                            {position.side}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg</div>
                        <div className="font-medium text-foreground">
                          {fmtPrediction(position.avgPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Now</div>
                        <div className="font-medium text-foreground">
                          {fmtPrediction(position.currentPrice)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSellClick(position)}
                      disabled={isSubmitting || position.shares < 0.01}
                      className="shrink-0 rounded-md border border-border px-3 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {isSubmitting
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

      {/* ── Closed Positions Section ── */}
      {(hasClosedPositions || closedLoading) && (
        <div className="space-y-4 md:space-y-5">
          {/* Section header with outcome filter */}
          <div className="flex items-center justify-between border-border border-t pt-4 md:pt-5">
            <div className="font-semibold text-muted-foreground text-sm">
              Closed Positions
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              {(['all', 'won', 'lost'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOutcomeFilter(filter)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium text-xs transition-colors',
                    outcomeFilter === filter
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter === 'all' ? 'All' : filter === 'won' ? 'Won' : 'Lost'}
                </button>
              ))}
            </div>
          </div>

          {/* Closed Perpetuals */}
          {filteredClosedPerps.length > 0 && (
            <div>
              <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
                Closed Perpetuals ({filteredClosedPerps.length})
              </div>
              <div className="space-y-1.5 md:space-y-2">
                {filteredClosedPerps.map((position) => {
                  const pnl = position.realizedPnL;
                  const pnlPercent =
                    position.size !== 0 ? (pnl / position.size) * 100 : 0;
                  const won = pnl >= 0;
                  return (
                    <div
                      key={position.id}
                      className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 md:px-4 md:py-3.5"
                    >
                      {/* Row 1: Ticker + badges + PnL */}
                      <div className="flex items-center justify-between whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-muted-foreground text-sm">
                            ${position.ticker}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                              position.side === 'long'
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-red-500/15 text-red-500'
                            )}
                          >
                            {position.side.toUpperCase()} {position.leverage}X
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                              won
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : 'bg-red-500/15 text-red-500'
                            )}
                          >
                            {won ? 'Won' : 'Lost'}
                          </span>
                          {position.agentName && (
                            <span className="text-muted-foreground/70 text-xs">
                              {position.agentName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              'font-semibold text-sm',
                              won ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {fmt(pnl)}
                          </span>
                          <span
                            className={cn(
                              'text-xs',
                              won ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {pnlPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Details */}
                      <div className="mt-2 flex items-end justify-between whitespace-nowrap">
                        <div className="flex gap-4 text-xs md:gap-6">
                          <div>
                            <div className="text-muted-foreground/70">
                              Entry
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {fmt(position.entryPrice)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/70">Exit</div>
                            <div className="font-medium text-muted-foreground">
                              {fmt(position.currentPrice)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/70">Size</div>
                            <div className="font-medium text-muted-foreground">
                              {fmt(position.size)}
                            </div>
                          </div>
                        </div>
                        {position.closedAt && (
                          <div className="text-muted-foreground/70 text-xs">
                            {new Date(position.closedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {closedPerpsHasMore && (
                <button
                  onClick={loadMoreClosedPerps}
                  disabled={loadingMorePerps}
                  className="mt-2 w-full rounded-lg border border-border py-2 text-center text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {loadingMorePerps ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}

          {/* Closed Predictions */}
          {filteredClosedPredictions.length > 0 && (
            <div>
              <div className="mb-2 text-muted-foreground text-xs tracking-wide md:mb-3">
                Closed Predictions ({filteredClosedPredictions.length})
              </div>
              <div className="space-y-1.5 md:space-y-2">
                {filteredClosedPredictions.map((position) => {
                  const pnl = position.pnl;
                  const won = pnl >= 0;
                  const costBasis = position.shares * position.avgPrice;
                  const pnlPercent =
                    costBasis !== 0 ? (pnl / costBasis) * 100 : 0;

                  return (
                    <div
                      key={position.id}
                      className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 md:px-4 md:py-3.5"
                    >
                      {/* Row 1: Question + badges + PnL */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-2 font-semibold text-muted-foreground text-sm leading-tight">
                              {position.question}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded px-1 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                                position.side === 'YES'
                                  ? 'bg-emerald-500/15 text-emerald-500'
                                  : 'bg-red-500/15 text-red-500'
                              )}
                            >
                              {position.side}
                            </span>
                            <span
                              className={cn(
                                'rounded px-1.5 pt-0 pb-0.5 font-medium text-[10px] leading-tight',
                                won
                                  ? 'bg-emerald-500/15 text-emerald-500'
                                  : 'bg-red-500/15 text-red-500'
                              )}
                            >
                              {won ? 'Won' : 'Lost'}
                            </span>
                            {position.agentName && (
                              <span className="text-muted-foreground/70 text-xs">
                                {position.agentName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className={cn(
                              'font-semibold text-sm',
                              won ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {fmtPrediction(pnl)}
                          </div>
                          <div
                            className={cn(
                              'text-xs',
                              won ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {pnlPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Details */}
                      <div className="mt-2 flex items-end justify-between whitespace-nowrap">
                        <div className="flex gap-4 text-xs md:gap-6">
                          <div>
                            <div className="text-muted-foreground/70">
                              Shares
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {position.shares.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/70">
                              Avg Price
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {fmtPrediction(position.avgPrice)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground/70">
                              Exit Price
                            </div>
                            <div className="font-medium text-muted-foreground">
                              {fmtPrediction(position.currentPrice)}
                            </div>
                          </div>
                        </div>
                        {position.resolvedAt && (
                          <div className="text-muted-foreground/70 text-xs">
                            {new Date(position.resolvedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {closedPredictionsHasMore && (
                <button
                  onClick={loadMoreClosedPredictions}
                  disabled={loadingMorePredictions}
                  className="mt-2 w-full rounded-lg border border-border py-2 text-center text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {loadingMorePredictions ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}

          {/* Loading skeleton for closed positions */}
          {closedLoading && !hasClosedPositions && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs tracking-wide">
                Closed Positions
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          )}

          {/* Empty state for outcome filter */}
          {!closedLoading &&
            hasClosedPositions &&
            filteredClosedPerps.length === 0 &&
            filteredClosedPredictions.length === 0 &&
            outcomeFilter !== 'all' && (
              <div className="rounded-xl border border-border/60 py-6 text-center">
                <p className="text-muted-foreground text-sm">
                  No {outcomeFilter === 'won' ? 'winning' : 'losing'} positions
                  found
                </p>
              </div>
            )}
        </div>
      )}

      <TradeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirm}
        isSubmitting={
          (pendingTrade?.kind === 'close-perp' &&
            closingIds.has(pendingTrade.position.id)) ||
          predictionTradeLoading ||
          predictionActionId !== null
        }
        tradeDetails={tradeDetails}
      />
    </div>
  );
}

// ── Parsers ──

function parseClosedPerps(
  raw: Record<string, unknown>[]
): ClosedPerpPosition[] {
  return raw.map((p) => ({
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
  }));
}

function parseClosedPredictions(
  raw: Record<string, unknown>[]
): ClosedPredictionPosition[] {
  return raw.map((p) => ({
    id: p.id as string,
    marketId: p.marketId as string,
    question: (p.question as string) ?? '',
    side: (p.side as 'YES' | 'NO') ?? 'YES',
    shares: Number(p.shares ?? 0),
    avgPrice: Number(p.avgPrice ?? 0),
    currentPrice: Number(p.currentPrice ?? 0),
    pnl: Number(p.pnl ?? p.unrealizedPnL ?? 0),
    outcome: (p.outcome as boolean | null) ?? null,
    resolvedAt: (p.resolvedAt as string) ?? null,
    createdAt: (p.createdAt as string) ?? null,
    isAgentPosition: (p.isAgentPosition as boolean) ?? false,
    agentName: (p.agentName as string) ?? null,
  }));
}
