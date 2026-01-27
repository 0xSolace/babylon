'use client';

import { cn } from '@babylon/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PerpMarket } from '@/types/markets';
import { type SortConfig, useTableSort } from '../../_hooks/useTableSort';
import { formatPrice, formatVolume } from '../../_lib/formatters';
import { Star } from 'lucide-react';
import { useWatchlistStore } from '../../_hooks/useWatchlistStore';
import { PerpSparkline } from '../PerpSparkline';

interface PerpMarketsTableProps {
  markets: PerpMarket[];
  onMarketClick: (market: PerpMarket) => void;
  onTradeAction?: (market: PerpMarket, side: 'long' | 'short') => void;
  selectedMarketTicker?: string | null;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: SortConfig<PerpMarket>;
  onSort: (key: string) => void;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:text-foreground',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {currentSort.key === sortKey &&
          (currentSort.direction === 'asc' ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          ))}
      </div>
    </TableHead>
  );
}

export function PerpMarketsTable({
  markets,
  onMarketClick,
  onTradeAction,
  selectedMarketTicker,
}: PerpMarketsTableProps) {
  const { toggleFavorite, isFavorite } = useWatchlistStore();
  const { sortedData, sortConfig, handleSort } = useTableSort(markets, {
    key: 'volume24h',
    direction: 'desc',
  });

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-white/5 bg-background/40 backdrop-blur-sm">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
            <TableRow className="h-10 border-b border-white/5 hover:bg-transparent">
              {/* Star Column */}
              <TableHead className="w-[40px]"></TableHead>
              <SortHeader
                label="Market"
                sortKey="ticker"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortHeader
                label="Price"
                sortKey="currentPrice"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortHeader
                label="24h Change"
                sortKey="changePercent24h"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortHeader
                label="Volume"
                sortKey="volume24h"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortHeader
                label="Open Interest"
                sortKey="openInterest"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden text-right md:table-cell"
              />
              <SortHeader
                label="Funding"
                sortKey="fundingRate.rate"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden text-right lg:table-cell"
              />
              <TableHead className="hidden text-right md:table-cell">Trend (7d)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((market) => (
              <TableRow
                key={market.ticker}
                className={cn(
                  'h-12 cursor-pointer border-b border-white/5 transition-colors hover:bg-muted/50',
                  selectedMarketTicker === market.ticker &&
                  'bg-muted/60'
                )}
                onClick={() => onMarketClick(market)}
              >
                <TableCell className="py-2 pl-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(market.ticker);
                    }}
                    className="text-muted-foreground/50 transition-colors hover:text-yellow-400 focus:outline-none"
                  >
                    <Star
                      size={16}
                      fill={isFavorite(market.ticker) ? "currentColor" : "none"}
                      className={cn("transition-all", isFavorite(market.ticker) ? "text-yellow-400 scale-110" : "")}
                    />
                  </button>
                </TableCell>
                <TableCell className="py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{market.ticker}</span>
                    <span className="hidden font-normal text-muted-foreground text-xs sm:inline">
                      {market.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-sm tabular-nums text-foreground/90">
                  {formatPrice(market.currentPrice)}
                </TableCell>
                <TableCell
                  className={cn(
                    'py-2 text-right'
                  )}
                >
                  <div className={cn(
                    "inline-flex items-center justify-end rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                    market.changePercent24h >= 0
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  )}>
                    {market.changePercent24h >= 0 ? '+' : ''}
                    {market.changePercent24h.toFixed(2)}%
                  </div>
                </TableCell>
                <TableCell className="hidden py-2 text-right font-mono text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {formatVolume(market.volume24h)}
                </TableCell>
                <TableCell className="hidden py-2 text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                  {formatVolume(market.openInterest)}
                </TableCell>
                <TableCell
                  className="hidden py-2 text-right lg:table-cell"
                >
                  <span className={cn(
                    "font-mono text-sm tabular-nums",
                    market.fundingRate.rate >= 0
                      ? 'text-orange-400'
                      : 'text-blue-400'
                  )}>
                    {(market.fundingRate.rate * 100).toFixed(4)}%
                  </span>
                </TableCell>
                <TableCell className="hidden py-2 pl-4 md:table-cell">
                  <div className="flex justify-end">
                    <PerpSparkline
                      currentPrice={market.currentPrice}
                      changePercent={market.changePercent24h}
                      width={100}
                      height={32}
                    />
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right pr-4">
                  <div
                    className="flex justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="rounded border border-green-500/20 bg-green-500/5 px-2 py-1 font-bold text-green-500 text-xs transition-colors hover:border-green-500/40 hover:bg-green-500/20"
                      onClick={() => onTradeAction?.(market, 'long')}
                    >
                      LONG
                    </button>
                    <button
                      className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1 font-bold text-red-500 text-xs transition-colors hover:border-red-500/40 hover:bg-red-500/20"
                      onClick={() => onTradeAction?.(market, 'short')}
                    >
                      SHORT
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No markets found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
