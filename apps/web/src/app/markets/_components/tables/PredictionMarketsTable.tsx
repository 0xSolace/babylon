'use client';

import { cn, formatNumberWithSeparators } from '@babylon/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PredictionMarketWithPosition } from '@/types/markets';
import { type SortConfig, useTableSort } from '../../_hooks/useTableSort';
import { calculateSharePercentages, getDaysLeft } from '../../_lib/formatters';

import { Star } from 'lucide-react';
import { useWatchlistStore } from '../../_hooks/useWatchlistStore';
import { PredictionSparkline } from '@/components/markets/PredictionSparkline';

interface PredictionMarketsTableProps {
  predictions: PredictionMarketWithPosition[];
  onPredictionClick: (prediction: PredictionMarketWithPosition) => void;
  onTradeAction?: (prediction: PredictionMarketWithPosition, side: 'yes' | 'no') => void;
  selectedPredictionId?: string | number | null;
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
  currentSort: SortConfig<PredictionMarketWithPosition>;
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

export function PredictionMarketsTable({
  predictions,
  onPredictionClick,
  onTradeAction,
  selectedPredictionId,
}: PredictionMarketsTableProps) {
  const { toggleFavorite, isFavorite } = useWatchlistStore();

  // Custom sorters needed for derived values like liqudity/shares
  const customSorters = {
    shares: (
      a: PredictionMarketWithPosition,
      b: PredictionMarketWithPosition
    ) => {
      const aTotal = calculateSharePercentages(
        a.yesShares,
        a.noShares
      ).totalShares;
      const bTotal = calculateSharePercentages(
        b.yesShares,
        b.noShares
      ).totalShares;
      return aTotal - bTotal;
    },
    ends: (
      a: PredictionMarketWithPosition,
      b: PredictionMarketWithPosition
    ) => {
      const timeA = a.resolutionDate ? new Date(a.resolutionDate).getTime() : 0;
      const timeB = b.resolutionDate ? new Date(b.resolutionDate).getTime() : 0;
      return timeA - timeB;
    },
  };

  const { sortedData, sortConfig, handleSort } = useTableSort(
    predictions,
    {
      key: 'shares',
      direction: 'desc',
    },
    customSorters
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-white/5 bg-background/40 backdrop-blur-sm">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
            <TableRow className="h-10 border-b border-white/5 hover:bg-transparent">
              {/* Star Column */}
              <TableHead className="w-[40px]"></TableHead>
              <SortHeader
                label="Question"
                sortKey="text"
                currentSort={sortConfig}
                onSort={handleSort}
                className="w-[35%]"
              />
              <TableHead>Probabilities</TableHead>
              <SortHeader
                label="Shares"
                sortKey="shares"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden text-right sm:table-cell"
              />
              <SortHeader
                label="Ends"
                sortKey="ends"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden text-right md:table-cell"
              />
              <TableHead className="hidden text-right md:table-cell">History</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {sortedData.map((market) => {
            const marketId = String(market.id);
            const marketIdNumber =
              typeof market.id === 'number' ? market.id : Number(market.id);
            const marketIdPhase = Number.isFinite(marketIdNumber)
              ? marketIdNumber
              : 0;
            const { yesPercent, noPercent, totalShares } =
              calculateSharePercentages(market.yesShares, market.noShares);
            const daysLeft = getDaysLeft(market.resolutionDate);

              return (
                <TableRow
                  key={market.id}
                  className={cn(
                    'group h-12 cursor-pointer border-b border-white/5 transition-colors hover:bg-muted/50',
                    selectedPredictionId !== null &&
                    selectedPredictionId !== undefined &&
                    String(selectedPredictionId) === marketId &&
                    'bg-muted/60'
                  )}
                  onClick={() => onPredictionClick(market)}
                >
                  <TableCell className="py-2 pl-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(marketId);
                      }}
                      className="text-muted-foreground/50 transition-colors hover:text-yellow-400 focus:outline-none"
                    >
                      <Star
                        size={16}
                        fill={isFavorite(marketId) ? 'currentColor' : 'none'}
                        className={cn("transition-all", isFavorite(marketId) ? 'text-yellow-400 scale-110' : '')}
                      />
                    </button>
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate py-2 font-medium sm:max-w-none"
                    title={market.text}
                  >
                    <span className="text-sm">{market.text}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex rounded-md bg-green-500/10 px-2 py-0.5 font-bold text-green-500 tabular-nums">
                        {yesPercent.toFixed(0)}% YES
                      </span>
                      <span className="inline-flex rounded-md bg-red-500/10 px-2 py-0.5 font-bold text-red-500 tabular-nums">
                        {noPercent.toFixed(0)}% NO
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden py-2 text-right font-mono text-sm tabular-nums text-muted-foreground sm:table-cell">
                    {formatNumberWithSeparators(totalShares)}
                  </TableCell>
                  <TableCell className="hidden py-2 text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                    {daysLeft !== null ? `${daysLeft}d` : 'Soon'}
                  </TableCell>
                  <TableCell className="hidden py-2 pl-4 md:table-cell">
                    <div className="flex justify-end">
                      <PredictionSparkline
                        data={[
                          ...Array.from({ length: 20 }, (_, i) => ({
                            time: (Date.now() - (19 - i) * 3600),
                            yesPrice:
                              yesPercent / 100 +
                              Math.sin(i + marketIdPhase) * 0.05,
                            noPrice:
                              noPercent / 100 -
                              Math.sin(i + marketIdPhase) * 0.05,
                          })),
                        ]}
                        width={100}
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
                        onClick={() => onTradeAction?.(market, 'yes')}
                      >
                        Buy YES
                      </button>
                      <button
                        className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1 font-bold text-red-500 text-xs transition-colors hover:border-red-500/40 hover:bg-red-500/20"
                        onClick={() => onTradeAction?.(market, 'no')}
                      >
                        Buy NO
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No prediction markets found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
