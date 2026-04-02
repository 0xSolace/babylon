'use client';

/**
 * Prediction screener table: lists active markets from props (already fetched).
 *
 * WHY sort in `useMemo` here, not in the parent fetch: reordering columns must not
 * call `/api/markets/predictions` again — that wastes quota and risks 429 under
 * public read limits. Data is complete for sort keys (text, YES % from CPMM,
 * volume as totalShares).
 *
 * WHY props `sort` / `onSortChange`: matches `TrendingScreenerTable` so the page
 * can persist the user's last prediction sort in `localStorage` next to perp sort.
 */

import { PredictionPricing } from '@babylon/core/markets/prediction/client';
import { cn } from '@babylon/shared';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useMemo, useState } from 'react';
import type { TopPrediction } from '@/app/markets/_hooks';
import { formatVolume } from '@/app/markets/_lib/formatters';
import type { PredictionMarket } from '@/types/markets';

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

export type PredictionSortKey = 'market' | 'yesPercent' | 'volume';
export type PredictionSortDir = 'asc' | 'desc';

export interface PredictionSort {
  key: PredictionSortKey;
  dir: PredictionSortDir;
}

export const DEFAULT_PREDICTION_SORT: PredictionSort = {
  key: 'volume',
  dir: 'desc',
};

const DEFAULT_DIR: Record<PredictionSortKey, PredictionSortDir> = {
  market: 'asc',
  yesPercent: 'desc',
  volume: 'desc',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function predictionHref(p: PredictionMarket): string {
  const q = new URLSearchParams({
    marketKind: 'prediction',
    marketId: String(p.id),
    filter: 'prediction',
  });
  return `/markets?${q.toString()}`;
}

function yesPercent(p: TopPrediction): number {
  const yes = p.yesShares ?? 0;
  const no = p.noShares ?? 0;
  return PredictionPricing.getCurrentPrice(yes, no, 'yes') * 100;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: PredictionSortKey | null;
  label: string;
  align: 'left' | 'right';
  sticky?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'market', label: 'Market', align: 'left', sticky: true },
  { key: 'yesPercent', label: 'YES %', align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
  { key: null, label: 'Predict', align: 'right' },
];

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: PredictionSortDir;
}) {
  if (!active)
    return (
      <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/th:opacity-60" />
    );
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-foreground" />
  ) : (
    <ArrowDown className="h-3 w-3 text-foreground" />
  );
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortableHeader({
  col,
  sort,
  onSort,
}: {
  col: ColumnDef;
  sort: PredictionSort;
  onSort: (key: PredictionSortKey) => void;
}) {
  const sortable = col.key !== null;
  const active = sortable && sort.key === col.key;

  const alignment =
    col.align === 'right'
      ? 'justify-end text-right'
      : 'justify-start text-left';

  const inner = (
    <>
      <span className={cn(active && 'text-foreground')}>{col.label}</span>
      {sortable && <SortIcon active={active} dir={sort.dir} />}
    </>
  );

  return (
    <th
      className={cn(
        'group/th whitespace-nowrap px-3 py-2 font-medium',
        col.sticky &&
          'sticky left-0 z-[12] border-border border-r bg-background/95 backdrop-blur md:static md:z-auto md:border-r-0 md:bg-transparent'
      )}
      aria-sort={
        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
      }
    >
      {sortable && col.key ? (
        <button
          type="button"
          className={cn(
            'inline-flex w-full cursor-pointer select-none items-center gap-1',
            alignment
          )}
          onClick={() => onSort(col.key!)}
        >
          {inner}
        </button>
      ) : (
        <div className={cn('inline-flex items-center gap-1', alignment)}>
          {inner}
        </div>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export interface PredictionsScreenerTableProps {
  predictions: TopPrediction[];
  predictionsTotalCount: number;
  activePredictionsCount: number;
  predictionsLoading: boolean;
  sort: PredictionSort;
  onSortChange: (sort: PredictionSort) => void;
}

export const PredictionsScreenerTable = memo(function PredictionsScreenerTable({
  predictions,
  predictionsTotalCount,
  activePredictionsCount,
  predictionsLoading,
  sort,
  onSortChange,
}: PredictionsScreenerTableProps) {
  const router = useRouter();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const handleSort = useCallback(
    (key: PredictionSortKey) => {
      if (sort.key === key) {
        onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
      } else {
        onSortChange({ key, dir: DEFAULT_DIR[key] });
      }
    },
    [sort, onSortChange]
  );

  const sorted = useMemo(() => {
    const copy = [...predictions];
    const dir = sort.dir === 'asc' ? 1 : -1;

    copy.sort((a, b) => {
      switch (sort.key) {
        case 'market':
          return dir * a.text.localeCompare(b.text);
        case 'yesPercent':
          return dir * (yesPercent(a) - yesPercent(b));
        case 'volume':
          return dir * (a.totalShares - b.totalShares);
        default:
          return 0;
      }
    });
    return copy;
  }, [predictions, sort]);

  const handleRowClick = useCallback(
    (p: TopPrediction) => {
      setNavigatingId(String(p.id));
      router.push(predictionHref(p));
    },
    [router]
  );

  const initialLoad = predictionsLoading && predictionsTotalCount === 0;
  const noActive = !predictionsLoading && activePredictionsCount === 0;
  const noFilterMatch =
    !predictionsLoading &&
    activePredictionsCount > 0 &&
    predictions.length === 0;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card/40"
      data-testid="markets-trending-predictions"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
            <tr className="text-muted-foreground text-xs uppercase tracking-wide">
              {COLUMNS.map((col) => (
                <SortableHeader
                  key={col.label}
                  col={col}
                  sort={sort}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {initialLoad ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  Loading predictions…
                </td>
              </tr>
            ) : noActive ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No active predictions.
                </td>
              </tr>
            ) : noFilterMatch ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No predictions match your filter.
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                const vol = (p.yesShares ?? 0) + (p.noShares ?? 0);
                const y = yesPercent(p);
                const href = predictionHref(p);
                const isNavigating = navigatingId === String(p.id);
                return (
                  <tr
                    key={String(p.id)}
                    onClick={() => handleRowClick(p)}
                    className={cn(
                      'cursor-pointer border-border border-b border-b-border/50 transition-colors active:bg-primary/10',
                      isNavigating ? 'bg-primary/5' : 'hover:bg-muted/20'
                    )}
                  >
                    <td className="sticky left-0 z-[11] max-w-md border-border border-r bg-card/95 px-3 py-2 backdrop-blur-sm md:static md:z-auto md:border-r-0 md:bg-transparent">
                      <div className="line-clamp-2 font-medium text-foreground text-sm">
                        {p.text}
                      </div>
                      {p.scenario && (
                        <div className="text-muted-foreground text-xs">
                          Scenario {p.scenario}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-green-600 text-xs">
                      {y.toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {formatVolume(vol)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'inline-flex h-9 items-center justify-center rounded-md px-3 font-semibold text-sm text-white transition-all active:scale-95',
                          isNavigating
                            ? 'bg-[#0052CC]'
                            : 'bg-[#0066FF] hover:bg-[#0052CC]'
                        )}
                      >
                        {isNavigating ? 'Opening…' : 'Predict'}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
