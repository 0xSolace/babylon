'use client';

import { FEE_CONFIG } from '@babylon/engine/config/fees';
import { BABYLON_POINTS_SYMBOL, cn } from '@babylon/shared';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatPrice, formatVolume } from '@/app/markets/_lib/formatters';
import { AssetTradesFeed } from '@/components/markets/AssetTradesFeed';
import { PerpPositionsList } from '@/components/markets/PerpPositionsList';
import { PerpPriceChart } from '@/components/markets/PerpPriceChart';
import {
  type OpenPerpDetails,
  TradeConfirmationDialog,
} from '@/components/markets/TradeConfirmationDialog';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { usePerpHistory } from '@/hooks/usePerpHistory';
import {
  type PerpTradeSSE,
  usePerpMarketStream,
} from '@/hooks/usePerpMarketStream';
import { usePerpTrade } from '@/hooks/usePerpTrade';
import { useMarketTracking } from '@/hooks/usePostHog';
import {
  invalidatePerpMarketsCache,
  usePerpMarket,
  usePerpMarketsRealtime,
} from '@/stores/perpMarketsStore';
import {
  invalidateUserPositions,
  usePerpPositions,
  useUserPositionsPolling,
} from '@/stores/userPositionsStore';
import {
  invalidateWalletBalance,
  useWalletBalance,
} from '@/stores/walletBalanceStore';
import type { MarketTimeRange } from '@/types/markets';

export default function PerpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authenticated, login, getAccessToken } = useAuth();
  const ticker = params.ticker as string;
  const { trackMarketView } = useMarketTracking();
  const from = searchParams.get('from');

  // Use shared perp markets store
  const { market, loading, refetch, initialLoadComplete } =
    usePerpMarket(ticker);

  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<MarketTimeRange>('ALL');
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  // Use centralized positions store for better caching and performance
  const { positions: perpPositions, refresh: refreshUserPositions } =
    usePerpPositions(authenticated ? user?.id : null);

  // Enable polling for positions when authenticated
  useUserPositionsPolling(authenticated ? user?.id : null);

  const userPositions = useMemo(
    () => perpPositions.filter((position) => position.ticker === ticker),
    [perpPositions, ticker]
  );
  const { openPosition } = usePerpTrade({
    getAccessToken,
  });
  const {
    balance,
    refresh: refreshWalletBalance,
  } = useWalletBalance(authenticated ? user?.id : null);

  const trackedTicker = market?.ticker ?? ticker;
  const livePrices = useMarketPrices(trackedTicker ? [trackedTicker] : []);
  const livePrice = trackedTicker ? livePrices.get(trackedTicker) : undefined;
  const displayPrice = livePrice?.price ?? market?.currentPrice ?? 0;

  // Fetch real price history from API
  const { history: priceHistory, refresh: refreshPriceHistory } =
    usePerpHistory(ticker, {
      limit: 1000,
      seed: market ? { currentPrice: market.currentPrice } : undefined,
      range: timeRange,
    });

  // Subscribe to real-time trade and price updates for all perp markets
  usePerpMarketsRealtime();

  // Subscribe to real-time trade events for this specific ticker
  // Note: Price history updates are handled internally by usePerpHistory hook
  // via its own SSE subscription to perp_trade events (calls appendPricePoint)
  usePerpMarketStream(ticker, {
    onTrade: useCallback(
      (event: PerpTradeSSE) => {
        // Refresh positions and market data when a trade occurs
        // Price history is updated automatically by usePerpHistory hook
        if (event.action === 'open' || event.action === 'close') {
          refreshUserPositions();
          refetch();
        }
      },
      [refreshUserPositions, refetch]
    ),
  });

  // Track market view
  useEffect(() => {
    if (ticker && market) {
      trackMarketView(ticker, 'perp');
    }
  }, [ticker, market, trackMarketView]);

  // Redirect if market not found after initial load is complete
  useEffect(() => {
    // Only redirect once the initial fetch has completed AND market still not found
    if (initialLoadComplete && !loading && !market) {
      toast.error('Market not found');
      router.push(from === 'dashboard' ? '/markets' : '/markets?tab=perps');
    }
  }, [initialLoadComplete, loading, market, router, from]);

  const handlePositionClosed = useCallback(async () => {
    // Invalidate caches to ensure fresh data on next fetch
    invalidatePerpMarketsCache();
    invalidateUserPositions();
    invalidateWalletBalance();
    await Promise.all([
      refreshUserPositions(),
      refreshWalletBalance(),
      refetch(),
      refreshPriceHistory(),
    ]);
  }, [
    refreshUserPositions,
    refreshWalletBalance,
    refetch,
    refreshPriceHistory,
  ]);

  const handleSubmit = () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!market || !user) return;

    const sizeNum = Number.parseFloat(size) || 0;
    if (sizeNum < market.minOrderSize) {
      toast.error(
        `Minimum order size is ${BABYLON_POINTS_SYMBOL}${market.minOrderSize}`
      );
      return;
    }

    if (authenticated && showBalanceWarning) {
      toast.error('Insufficient balance for margin + fees');
      return;
    }

    // Open confirmation dialog
    setConfirmDialogOpen(true);
  };

  const handleConfirmOpen = async () => {
    if (!market) return;

    const sizeNum = Number.parseFloat(size) || 0;
    setSubmitting(true);
    setConfirmDialogOpen(false);

    await openPosition({
      ticker: market.ticker,
      side,
      size: sizeNum,
      leverage,
    })
      .then(async () => {
        // Show appropriate success message based on action type
        if (rebalanceInfo) {
          const messages = {
            add: {
              title: 'Position increased!',
              description: `Added ${formatPrice(sizeNum)} to your ${side.toUpperCase()} position`,
            },
            reduce: {
              title: 'Position reduced!',
              description: `Reduced your position by ${formatPrice(sizeNum)}`,
            },
            close: {
              title: 'Position closed!',
              description: `Closed your ${existingPosition?.side?.toUpperCase()} position`,
            },
            flip: {
              title: 'Position flipped!',
              description: `Flipped to ${leverage}x ${side.toUpperCase()} on ${market.ticker}`,
            },
          };
          const msg = messages[rebalanceInfo.type];
          toast.success(msg.title, { description: msg.description });
        } else {
          toast.success('Position opened!', {
            description: `Opened ${leverage}x ${side} on ${market.ticker} at ${formatPrice(displayPrice)}`,
          });
        }

        // Invalidate caches to ensure fresh data
        invalidatePerpMarketsCache();
        invalidateUserPositions();
        invalidateWalletBalance();
        await Promise.all([
          refetch(),
          refreshUserPositions(),
          refreshWalletBalance(),
          refreshPriceHistory(),
        ]);
      })
      .catch((error: Error) => {
        toast.error(error.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const sizeNum = Number.parseFloat(size) || 0;
  const baseMargin = sizeNum > 0 ? sizeNum / leverage : 0;
  const estimatedFee = sizeNum > 0 ? sizeNum * FEE_CONFIG.TRADING_FEE_RATE : 0;
  const totalRequired = sizeNum > 0 ? baseMargin + estimatedFee : 0;
  const hasSufficientBalance = !authenticated || balance >= totalRequired;
  const showBalanceWarning =
    authenticated && sizeNum > 0 && !hasSufficientBalance;

  // Check if user already has an open position on this ticker
  const existingPosition = userPositions.find((p) => !p.closedAt);

  // Determine the rebalance action type if position exists
  const rebalanceInfo = useMemo(() => {
    if (!existingPosition) return null;

    const isSameSide = existingPosition.side === side;
    const newTotalSize = existingPosition.size + sizeNum;

    if (isSameSide) {
      // Adding to position
      const avgEntryPrice =
        (existingPosition.size * existingPosition.entryPrice +
          sizeNum * displayPrice) /
        newTotalSize;
      return {
        type: 'add' as const,
        label: 'Add to Position',
        description: `Adding ${formatPrice(sizeNum)} to your ${existingPosition.side.toUpperCase()} position`,
        newSize: newTotalSize,
        avgEntryPrice,
      };
    } else {
      // Opposite side - reduce, close, or flip
      if (sizeNum < existingPosition.size) {
        return {
          type: 'reduce' as const,
          label: 'Reduce Position',
          description: `Reducing your ${existingPosition.side.toUpperCase()} by ${formatPrice(sizeNum)}`,
          newSize: existingPosition.size - sizeNum,
        };
      } else if (Math.abs(sizeNum - existingPosition.size) < 0.01) {
        return {
          type: 'close' as const,
          label: 'Close Position',
          description: `Closing your ${existingPosition.side.toUpperCase()} position`,
          newSize: 0,
        };
      } else {
        const flipSize = sizeNum - existingPosition.size;
        return {
          type: 'flip' as const,
          label: 'Flip Position',
          description: `Closing ${existingPosition.side.toUpperCase()} and opening ${side.toUpperCase()} ${formatPrice(flipSize)}`,
          newSize: flipSize,
        };
      }
    }
  }, [existingPosition, side, sizeNum, displayPrice]);

  const liquidationPrice =
    side === 'long'
      ? displayPrice * (1 - 0.9 / leverage)
      : displayPrice * (1 + 0.9 / leverage);

  const liquidationDistance =
    side === 'long'
      ? ((displayPrice - liquidationPrice) / displayPrice) * 100
      : ((liquidationPrice - displayPrice) / displayPrice) * 100;

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="w-full max-w-md space-y-4 px-4 text-center">
            <Skeleton className="mx-auto h-12 w-48" />
            <Skeleton className="mx-auto h-4 w-64" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="mx-auto h-8 w-3/4" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!market) return null;

  return (
    <PageContainer noPadding className="flex h-[calc(100vh-theme(spacing.16))] flex-col bg-background/20">
      {/* 1. Compact Header Bar (Ticker Tape Style) */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/5 bg-background/40 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              if (from === 'dashboard') {
                router.push('/markets');
              } else {
                router.push('/markets?tab=perps');
              }
            }}
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg tracking-tight">${market.ticker}</h1>
            <span className="text-muted-foreground text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/5">Perp</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-lg text-foreground">
              {formatPrice(displayPrice)}
            </span>
            <span
              className={cn(
                'font-mono text-xs font-medium',
                market.change24h >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {market.change24h >= 0 ? '+' : ''}{market.changePercent24h.toFixed(2)}%
            </span>
          </div>

          {/* Quick Stats in Header */}
          <div className="hidden lg:flex items-center gap-6 text-xs text-muted-foreground">
            <div>
              <span className="block opacity-50 text-[10px] uppercase">24h Vol</span>
              <span className="text-foreground">{formatVolume(market.volume24h)}</span>
            </div>
            <div>
              <span className="block opacity-50 text-[10px] uppercase">Funding (8h)</span>
              <span className={market.fundingRate.rate >= 0 ? 'text-orange-400' : 'text-blue-400'}>
                {(market.fundingRate.rate * 100).toFixed(4)}%
              </span>
            </div>
            <div>
              <span className="block opacity-50 text-[10px] uppercase">OI</span>
              <span className="text-foreground">{formatVolume(market.openInterest)}</span>
            </div>
          </div>
        </div>

        {/* Right Header Actions (Wallet/Account snippet) */}
        {authenticated && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Available:</span>
            <span className="font-mono font-medium text-foreground">{formatPrice(balance)}</span>
          </div>
        )}
      </div>

      {/* 2. Main Grid Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Column: Main Chart (Flexible width) */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-white/5 bg-background/10">
          <div className="flex-1 relative min-h-0 p-1">
            {/* Chart Container - Maximized */}
            <div className="h-full w-full rounded-md border border-white/5 bg-background/20 backdrop-blur-sm overflow-hidden">
              <PerpPriceChart
                data={priceHistory}
                currentPrice={displayPrice}
                ticker={ticker}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
              // Need to ensure chart component takes 100% height
              />
            </div>
          </div>

          {/* Bottom Panel: Positions (Collapsible or Tabbed in future, fixed height for now) */}
          <div className="h-[250px] flex-shrink-0 border-t border-white/5 bg-background/20 backdrop-blur-md overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center gap-4">
              <button className="text-xs font-bold text-primary border-b-2 border-primary pb-2 -mb-2.5">Positions ({userPositions.length})</button>
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground pb-2 -mb-2">Open Orders (0)</button>
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground pb-2 -mb-2">History</button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              {userPositions.length > 0 ? (
                <PerpPositionsList
                  positions={userPositions}
                  onPositionClosed={handlePositionClosed}
                />
              ) : (
                <div className="flex justify-center items-center h-full text-muted-foreground text-xs">
                  No open positions
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Order Entry & Trades (Fixed width) */}
        <div className="w-[360px] flex flex-col border-l border-white/5 bg-background/30 backdrop-blur-md overflow-y-auto overflow-x-hidden">

          {/* Order Entry Section */}
          <div className="p-4 border-b border-white/5">
            <div className="flex gap-1 mb-4 p-1 bg-muted/20 rounded-lg">
              <button
                onClick={() => setSide('long')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                  side === 'long'
                    ? 'bg-green-600/20 text-green-500 shadow-sm border border-green-600/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                LONG
              </button>
              <button
                onClick={() => setSide('short')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold rounded-md transition-all',
                  side === 'short'
                    ? 'bg-red-600/20 text-red-500 shadow-sm border border-red-600/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                SHORT
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Size (PTS)</label>
                  <span className="text-[10px] text-muted-foreground">Max leverage: {market.maxLeverage}x</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    min={market.minOrderSize}
                    step="10"
                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USD</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Leverage</label>
                  <span className="text-[10px] font-mono text-foreground">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={market.maxLeverage}
                  value={leverage}
                  onChange={(e) => setLeverage(Number.parseInt(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="p-3 rounded bg-white/5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-mono">{formatPrice(baseMargin)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fees</span>
                  <span className="font-mono">{formatPrice(estimatedFee)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/5 mt-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono font-bold">{formatPrice(totalRequired)}</span>
                </div>
              </div>

              {showBalanceWarning && (
                <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded">
                  Insufficient balance ({formatPrice(balance)})
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || (authenticated && showBalanceWarning)}
                className={cn(
                  "w-full py-3 rounded font-bold text-sm transition-all text-white shadow-lg",
                  side === 'long'
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-green-900/20'
                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/20',
                  (submitting || (authenticated && showBalanceWarning)) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {startCaseAction(submitting ? 'Processing...' : (!authenticated ? 'Log In to Trade' : `Place ${side.toUpperCase()} Order`))}
              </button>
            </div>
          </div>

          {/* Trades Feed (Orderbook replacement for now) */}
          <div className="flex-1 flex flex-col min-h-0 bg-background/10">
            <div className="px-4 py-2 border-b border-white/5 bg-white/5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Trades</h3>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto">
                <AssetTradesFeed
                  marketType="perp"
                  assetId={ticker}
                  containerRef={pageContainerRef}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <TradeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirmOpen}
        isSubmitting={submitting}
        tradeDetails={
          market
            ? ({
              type: 'open-perp',
              ticker: market.ticker,
              side,
              size: sizeNum,
              leverage,
              entryPrice: displayPrice,
              margin: baseMargin,
              estimatedFee,
              liquidationPrice,
              liquidationDistance,
            } as OpenPerpDetails)
            : null
        }
      />
    </PageContainer>
  );
}

function startCaseAction(str: string) {
  return str; // Placeholder helper formatting if needed
}
