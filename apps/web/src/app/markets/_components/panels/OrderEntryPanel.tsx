import { cn } from '@babylon/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type {
  MarketTimeRange,
  PerpHistoryPoint,
  PerpMarket,
  PredictionMarketWithPosition,
} from '@/types/markets';
import { calculateSharePercentages, formatPrice, formatVolume } from '../../_lib/formatters';
import { PerpPriceChart } from '@/components/markets/PerpPriceChart';
import { generateMockHistory } from '../../_lib/mockData';


export type SelectedMarket =
  | { type: 'perp'; market: PerpMarket; side?: 'long' | 'short' }
  | {
    type: 'prediction';
    market: PredictionMarketWithPosition;
    side?: 'yes' | 'no';
  }
  | null;

interface OrderEntryPanelProps {
  selectedMarket: SelectedMarket;
  onTradeClick: (side?: string) => void;
  onClose: () => void;
  className?: string;
}

export function OrderEntryPanel({
  selectedMarket,
  onTradeClick,
  onClose,
  className,
}: OrderEntryPanelProps) {
  const [timeRange, setTimeRange] = useState<MarketTimeRange>('1D');

  // Generate chart data based on selected market and time range
  const chartData: PerpHistoryPoint[] = useMemo(() => {
    if (!selectedMarket || selectedMarket.type !== 'perp') return [];

    // Adjust mock parameters based on time range
    let points = 50;
    let intervalMinutes = 60; // 1H default for 1D view

    switch (timeRange) {
      case '1H':
        points = 60;
        intervalMinutes = 1;
        break;
      case '4H':
        points = 48;
        intervalMinutes = 5;
        break;
      case '1D':
        points = 24;
        intervalMinutes = 60;
        break;
      case '1W':
        points = 28;
        intervalMinutes = 360;
        break; // 6h intervals
      case 'ALL':
        points = 50;
        intervalMinutes = 1440;
        break; // Daily
    }

    return generateMockHistory(
      selectedMarket.market.currentPrice,
      selectedMarket.market.changePercent24h,
      points,
      intervalMinutes
    ).map((point) => ({
      time:
        (typeof point.time === 'number' ? point.time : Number(point.time)) *
        1000,
      price: point.value,
    }));
  }, [selectedMarket, timeRange]);

  if (!selectedMarket) {
    return (
      <div className={cn('flex h-full flex-col p-6', className)}>
        <div className="flex h-full flex-col items-center justify-center space-y-4 rounded-xl border border-white/5 bg-muted/10 p-8 text-center">
          <div className="rounded-full bg-muted/20 p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-muted-foreground/50"
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <h3 className="font-bold text-muted-foreground text-xl">
            No Market Selected
          </h3>
          <p className="max-w-[200px] text-muted-foreground/60 text-sm">
            Select a market from the list to start trading
          </p>
        </div>
      </div>
    );
  }

  const { type, market } = selectedMarket;
  const side = 'side' in selectedMarket ? selectedMarket.side : undefined;

  return (
    <div className={cn('flex h-full flex-col p-6', className)}>
      <div className="mb-4 rounded-xl border border-white/5 bg-gradient-to-br from-background to-muted/20 p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="mb-1 font-bold text-2xl tracking-tight">
              {type === 'perp' ? `$${market.ticker}` : market.text}
            </h2>
            <p className="font-medium text-muted-foreground text-sm">
              {type === 'perp' ? market.name : 'Prediction Market'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {side && (
              <span
                className={cn(
                  'rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wide',
                  side === 'long' || side === 'yes'
                    ? 'bg-green-500/10 text-green-500 ring-1 ring-green-500/20'
                    : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
                )}
              >
                {side.toUpperCase()}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-auto flex flex-col gap-4">
        {type === 'perp' ? (
          <>
            {/* Chart Section */}
            <div className="rounded-xl border border-white/5 bg-muted/5 p-2 overflow-hidden h-[250px]">
              <PerpPriceChart
                data={chartData}
                currentPrice={market.currentPrice}
                ticker={market.ticker}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/5 p-3">
                <span className="mb-1 block text-muted-foreground text-xs">
                  Mark Price
                </span>
                <span className="font-mono text-sm">
                  {formatPrice(market.currentPrice)}
                </span>
              </div>
              <div className="rounded-lg bg-muted/5 p-3">
                <span className="mb-1 block text-muted-foreground text-xs">
                  24h Volume
                </span>
                <span className="font-mono text-sm">
                  {formatVolume(market.volume24h)}
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="mb-2 block font-bold text-muted-foreground text-xs uppercase tracking-wider">
                  Order Size (USD)
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <input
                    type="text"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-white/10 bg-muted/10 py-4 pr-4 pl-8 font-mono text-2xl placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-green-500/10 bg-green-500/5 p-4">
                <span className="font-bold text-green-500">YES</span>
                <div className="text-right">
                  <div className="font-bold font-mono text-2xl text-foreground">
                    {calculateSharePercentages(
                      market.yesShares,
                      market.noShares
                    ).yesPercent.toFixed(1)}
                    %
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Probability
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 p-4">
                <span className="font-bold text-red-500">NO</span>
                <div className="text-right">
                  <div className="font-bold font-mono text-2xl text-foreground">
                    {calculateSharePercentages(
                      market.yesShares,
                      market.noShares
                    ).noPercent.toFixed(1)}
                    %
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Probability
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8">
        <Button
          className={cn(
            'h-14 w-full font-bold text-lg shadow-lg transition-all',
            side === 'long' || side === 'yes'
              ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-900/20 hover:from-green-500 hover:to-green-400'
              : side === 'short' || side === 'no'
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-red-900/20 hover:from-red-500 hover:to-red-400'
                : 'bg-primary hover:bg-primary/90'
          )}
          onClick={() => onTradeClick(side)}
        >
          {side ? `PLACE ${side.toUpperCase()} ORDER` : 'TRADE'}
        </Button>
      </div>
    </div>
  );
}
