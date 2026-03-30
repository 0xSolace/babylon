'use client';

import type { UserPredictionPosition } from '@babylon/shared';
import {
  calculateUnrealizedPnL,
  cn,
  formatCurrency,
  logger,
} from '@babylon/shared';
import { Bot, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type ClosePerpDetails,
  type SellPredictionDetails,
  TradeConfirmationDialog,
} from '@/components/markets/TradeConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
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

interface WalletPositionsProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

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

export function WalletPositions({
  userId,
  mode = 'page',
}: WalletPositionsProps) {
  const { perpPositions, predictionPositions, loading } =
    useUserPositions(userId);
  const { getAccessToken } = useAuth();
  const {
    claimPrediction,
    loading: predictionTradeLoading,
    sellPrediction,
  } = usePredictionTrading();
  const { closePosition: closePerpPosition } = usePerpTrade({
    getAccessToken,
  });

  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const [predictionActionId, setPredictionActionId] = useState<string | null>(
    null
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<PendingTrade | null>(null);

  const isSidebar = mode === 'sidebar';

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
        onChainMarketId: position.onChainMarketId,
        side: position.side,
        shares: position.shares,
        positionId: position.id,
      });

      if (result.mode === 'onchain') {
        toast.success('Position switched on-chain', {
          description: `Swapped ${result.sharesIn.toFixed(2)} ${position.side} shares into ${result.sharesOut.toFixed(2)} ${result.receivedSide} shares.`,
        });
      } else {
        const pnlSign = result.pnl >= 0 ? '+' : '-';
        toast.success('Shares sold!', {
          description: `Sold ${position.shares.toFixed(2)} ${position.side} shares for ${pnlSign}${formatCurrency(
            Math.abs(result.pnl),
            { useThousandsSeparator: true }
          )} PnL`,
        });
      }

      invalidateUserPositions();
      invalidateWalletBalance();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to sell shares';
      logger.error(
        'Failed to sell prediction shares',
        { marketId: position.marketId, positionId: position.id, error: err },
        'WalletPositions'
      );
      toast.error(message);
    } finally {
      setPredictionActionId(null);
      setPendingTrade(null);
    }
  }, [pendingTrade, sellPrediction]);

  const handleClaimPrediction = useCallback(
    async (position: UserPredictionPosition) => {
      if (!position.onChainMarketId) {
        return;
      }

      setPredictionActionId(position.id);

      try {
        const result = await claimPrediction({
          marketId: position.marketId,
          onChainMarketId: position.onChainMarketId,
        });

        toast.success('Winnings claimed on-chain', {
          description: `${formatCurrency(result.payout, {
            useThousandsSeparator: true,
          })} credited to your wallet.`,
        });

        invalidateUserPositions();
        invalidateWalletBalance();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to claim winnings';
        logger.error(
          'Failed to claim prediction winnings',
          { marketId: position.marketId, positionId: position.id, error: err },
          'WalletPositions'
        );
        toast.error(message);
      } finally {
        setPredictionActionId(null);
        setPendingTrade(null);
      }
    },
    [claimPrediction]
  );

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
  const visiblePredictionPositions = predictionPositions.filter(
    (position) => !position.resolved || Boolean(position.onChainMarketId)
  );

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const hasPositions =
    perpPositions.length > 0 || visiblePredictionPositions.length > 0;

  if (!hasPositions) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>No open positions</p>
        <p className="mt-1 text-sm">
          Open a position on the Terminal to get started
        </p>
      </div>
    );
  }

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
      mode: pendingTrade.position.onChainMarketId ? 'switch' : 'sell',
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

  if (isSidebar) {
    // Compact card layout for sidebar
    return (
      <div className="space-y-1.5 p-3">
        {/* Perp positions */}
        {perpsWithPnL.map(({ position, currentPrice, pnl, pnlPercent }) => {
          const isClosing = closingIds.has(position.id);
          return (
            <div key={position.id} className="rounded bg-muted/40 p-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-bold text-[10px]',
                      position.side === 'long'
                        ? 'bg-green-600/20 text-green-600'
                        : 'bg-red-600/20 text-red-600'
                    )}
                  >
                    {position.side === 'long' ? (
                      <TrendingUp size={9} />
                    ) : (
                      <TrendingDown size={9} />
                    )}
                    {position.side.toUpperCase()}
                  </span>
                  <span className="font-bold text-foreground text-xs">
                    ${position.ticker}
                  </span>
                  {position.isAgentPosition && (
                    <span className="flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      <Bot size={9} />
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'font-bold text-xs',
                    pnl >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {pnl >= 0 ? '+' : ''}
                  {fmt(pnl)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {fmt(position.entryPrice)} → {fmt(currentPrice)}
                </span>
                <button
                  onClick={() =>
                    handleCloseClick(position, currentPrice, pnl, pnlPercent)
                  }
                  disabled={isClosing}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/80 disabled:opacity-50"
                >
                  {isClosing ? '...' : 'Close'}
                </button>
              </div>
            </div>
          );
        })}

        {/* Prediction positions */}
        {visiblePredictionPositions.map((position) => {
          const currentValue =
            position.currentValue ?? position.shares * position.currentPrice;
          const costBasis =
            position.costBasis ?? position.shares * position.avgPrice;
          const unrealizedPnL =
            position.unrealizedPnL ?? currentValue - costBasis;
          const isSubmitting = predictionActionId === position.id;
          const isOnchainPosition = Boolean(position.onChainMarketId);
          const requiresClaim = isOnchainPosition && position.resolved;

          return (
            <div key={position.id} className="rounded bg-muted/40 p-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      'shrink-0 rounded px-1 py-0.5 font-bold text-[10px]',
                      position.side === 'YES'
                        ? 'bg-green-600/20 text-green-600'
                        : 'bg-red-600/20 text-red-600'
                    )}
                  >
                    {position.side}
                  </span>
                  {position.isAgentPosition && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      <Bot size={9} />
                    </span>
                  )}
                  <span className="truncate text-foreground text-xs">
                    {position.question}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-bold text-xs',
                    unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {unrealizedPnL >= 0 ? '+' : ''}
                  {fmtPrediction(unrealizedPnL)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {position.shares.toFixed(1)} shares
                </span>
                <button
                  onClick={() =>
                    requiresClaim
                      ? void handleClaimPrediction(position)
                      : handleSellClick(position)
                  }
                  disabled={isSubmitting || position.shares < 0.01}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/80 disabled:opacity-50"
                >
                  {isSubmitting
                    ? requiresClaim
                      ? '...'
                      : isOnchainPosition
                        ? '...'
                        : '...'
                    : requiresClaim
                      ? 'Claim'
                      : isOnchainPosition
                        ? 'Switch'
                        : 'Sell'}
                </button>
              </div>
            </div>
          );
        })}

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

  // Full table layout for page mode
  return (
    <div className="p-4">
      {perpPositions.length > 0 && (
        <>
          <h3 className="mb-2 font-semibold text-foreground text-sm">
            Perpetuals
          </h3>
          <div className="mb-4 space-y-2">
            {perpsWithPnL.map(({ position, currentPrice, pnl, pnlPercent }) => {
              const isClosing = closingIds.has(position.id);
              return (
                <div key={position.id} className="rounded bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 font-bold text-[11px]',
                          position.side === 'long'
                            ? 'bg-green-600/20 text-green-600'
                            : 'bg-red-600/20 text-red-600'
                        )}
                      >
                        {position.side === 'long' ? (
                          <TrendingUp size={10} />
                        ) : (
                          <TrendingDown size={10} />
                        )}
                        {position.leverage}x {position.side.toUpperCase()}
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        ${position.ticker}
                      </span>
                      {position.isAgentPosition && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-medium text-[11px] text-muted-foreground">
                          <Bot size={10} />
                          {position.agentName || 'Agent'}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-bold text-xs',
                        pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {fmt(pnl)}{' '}
                      <span className="font-normal text-[11px]">
                        ({pnl >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                      <span className="font-medium text-foreground">
                        {fmt(position.entryPrice)}
                        <span className="mx-0.5 text-muted-foreground">
                          &rarr;
                        </span>
                        {fmt(currentPrice)}
                      </span>
                      <span className="text-muted-foreground/40">&middot;</span>
                      <span>
                        Size{' '}
                        <span className="font-medium text-foreground">
                          {fmt(position.size)}
                        </span>
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
                      className="shrink-0 rounded-full bg-muted px-3 py-0.5 font-medium text-foreground text-xs hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isClosing ? 'Closing...' : 'Close'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {visiblePredictionPositions.length > 0 && (
        <>
          <h3 className="mb-2 font-semibold text-foreground text-sm">
            Predictions
          </h3>
          <div className="space-y-2">
            {visiblePredictionPositions.map((position) => {
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
              const isOnchainPosition = Boolean(position.onChainMarketId);
              const requiresClaim = isOnchainPosition && position.resolved;

              return (
                <div key={position.id} className="rounded bg-muted/40 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 font-bold text-[11px]',
                          position.side === 'YES'
                            ? 'bg-green-600/20 text-green-600'
                            : 'bg-red-600/20 text-red-600'
                        )}
                      >
                        {position.side}
                      </span>
                      {position.isAgentPosition && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-medium text-[11px] text-muted-foreground">
                          <Bot size={10} />
                          {position.agentName || 'Agent'}
                        </span>
                      )}
                      <span className="truncate font-medium text-foreground text-xs">
                        {position.question}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-bold text-xs',
                        unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {unrealizedPnL >= 0 ? '+' : ''}
                      {fmtPrediction(unrealizedPnL)}{' '}
                      <span className="font-normal text-[11px]">
                        ({unrealizedPnL >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
                      <span>
                        {position.shares.toFixed(2)}{' '}
                        <span className="font-medium text-foreground">
                          shares
                        </span>
                      </span>
                      <span className="text-muted-foreground/40">&middot;</span>
                      <span>
                        Avg{' '}
                        <span className="font-medium text-foreground">
                          {fmtPrediction(position.avgPrice)}
                        </span>
                      </span>
                      <span className="text-muted-foreground/40">&middot;</span>
                      <span>
                        Val{' '}
                        <span className="font-medium text-foreground">
                          {fmtPrediction(currentValue)}
                        </span>
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        requiresClaim
                          ? void handleClaimPrediction(position)
                          : handleSellClick(position)
                      }
                      disabled={isSubmitting || position.shares < 0.01}
                      className="shrink-0 rounded-full bg-muted px-3 py-0.5 font-medium text-foreground text-xs hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting
                        ? requiresClaim
                          ? 'Claiming...'
                          : isOnchainPosition
                            ? 'Switching...'
                            : 'Selling...'
                        : position.shares < 0.01
                          ? 'Too Small'
                          : requiresClaim
                            ? 'Claim'
                            : isOnchainPosition
                              ? 'Switch'
                              : 'Sell'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
