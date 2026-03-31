'use client';

/**
 * Markets browse-first route (`/markets/trending`).
 *
 * WHY a separate page: `MarketsTradingTerminal` optimizes for execution (chart +
 * order flow). Discovery needs a dense, sortable list first; row actions deep-link
 * to `/markets` with `marketKind` / `marketId` / `filter` so selection matches
 * `parseSelected()` — one URL contract, no duplicate selection state.
 *
 * WHY shared search: `useMarketsPageData` owns `deferredSearchQuery` so both tabs
 * share one debounced filter without double-fetching or divergent filter logic.
 *
 * WHY localStorage (`screener:*` keys): Users expect tab + sort to stick across
 * refresh and return visits. Keys are validated after read so bad data never
 * crashes the page. See `docs/markets/trending-screener.md`.
 */
import { cn } from '@babylon/shared';
import { Filter } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { TopPrediction } from '@/app/markets/_hooks';
import { useMarketsPageData } from '@/app/markets/_hooks';
import { PageContainer } from '@/components/shared/PageContainer';
import { Input } from '@/components/ui/input';
import { usePerpMarketsPolling } from '@/stores/perpMarketsStore';
import type { PredictionMarketWithPosition } from '@/types/markets';
import {
  DEFAULT_PREDICTION_SORT,
  type PredictionSort,
  type PredictionSortDir,
  type PredictionSortKey,
  PredictionsScreenerTable,
} from './_components/PredictionsScreenerTable';
import { TrendingScreenerTable } from './_components/TrendingScreenerTable';
import {
  type ScreenerSort,
  type ScreenerSortKey,
  type SortDirection,
  sortPerpsForScreener,
} from './_lib/sortPerpsForScreener';

const SCREENER_MAX_PERPS = 100;
const SCREENER_MAX_PREDICTIONS = 100;

/** Namespace `screener:` avoids collisions with other app keys. */
const LS_KEY_TAB = 'screener:assetTab';
const LS_KEY_PERP_SORT = 'screener:perpSort';
const LS_KEY_PRED_SORT = 'screener:predSort';

const VALID_PERP_SORT_KEYS = new Set<ScreenerSortKey>([
  'asset',
  'price',
  'change24h',
  'openInterest',
  'volume24h',
  'funding',
  'trending',
]);
const VALID_SORT_DIRS = new Set<string>(['asc', 'desc']);
const VALID_PRED_SORT_KEYS = new Set<PredictionSortKey>([
  'market',
  'yesPercent',
  'volume',
]);

const DEFAULT_PERP_SORT: ScreenerSort = { key: 'trending', dir: 'desc' };

function readStoredTab(): AssetTab {
  try {
    const v = localStorage.getItem(LS_KEY_TAB);
    if (v === 'perps' || v === 'predictions') return v;
  } catch {}
  return 'perps';
}

function readStoredPerpSort(): ScreenerSort {
  try {
    const raw = localStorage.getItem(LS_KEY_PERP_SORT);
    if (!raw) return DEFAULT_PERP_SORT;
    const parsed = JSON.parse(raw) as { key?: string; dir?: string };
    if (
      VALID_PERP_SORT_KEYS.has(parsed.key as ScreenerSortKey) &&
      VALID_SORT_DIRS.has(parsed.dir as string)
    ) {
      return {
        key: parsed.key as ScreenerSortKey,
        dir: parsed.dir as SortDirection,
      };
    }
  } catch {}
  return DEFAULT_PERP_SORT;
}

function readStoredPredSort(): PredictionSort {
  try {
    const raw = localStorage.getItem(LS_KEY_PRED_SORT);
    if (!raw) return DEFAULT_PREDICTION_SORT;
    const parsed = JSON.parse(raw) as { key?: string; dir?: string };
    if (
      VALID_PRED_SORT_KEYS.has(parsed.key as PredictionSortKey) &&
      VALID_SORT_DIRS.has(parsed.dir as string)
    ) {
      return {
        key: parsed.key as PredictionSortKey,
        dir: parsed.dir as PredictionSortDir,
      };
    }
  } catch {}
  return DEFAULT_PREDICTION_SORT;
}

function isPredictionActiveForScreener(
  p: PredictionMarketWithPosition
): boolean {
  if (p.status !== 'active') return false;
  if (!p.resolutionDate) return true;
  return new Date(p.resolutionDate).getTime() > Date.now();
}

type AssetTab = 'perps' | 'predictions';

export default function MarketsTrendingPage() {
  const {
    filteredPerpMarkets,
    perpLoading,
    predictions,
    predictionsLoading,
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
  } = useMarketsPageData();

  // WHY 30 s polling: SSE handles real-time trade/price events, but the
  // screener also needs periodic full refreshes (e.g. 24h stats rotation,
  // SSE reconnection gaps, markets added/removed). 30 s matches the store's
  // default and keeps DB load low.
  usePerpMarketsPolling(30_000);

  const [assetTab, setAssetTab] = useState<AssetTab>(readStoredTab);
  const [perpSort, setPerpSort] = useState<ScreenerSort>(readStoredPerpSort);
  const [predSort, setPredSort] = useState<PredictionSort>(readStoredPredSort);

  const handleTabChange = useCallback((tab: AssetTab) => {
    setAssetTab(tab);
    try {
      localStorage.setItem(LS_KEY_TAB, tab);
    } catch {}
  }, []);

  const handlePerpSortChange = useCallback((sort: ScreenerSort) => {
    setPerpSort(sort);
    try {
      localStorage.setItem(LS_KEY_PERP_SORT, JSON.stringify(sort));
    } catch {}
  }, []);

  const handlePredSortChange = useCallback((sort: PredictionSort) => {
    setPredSort(sort);
    try {
      localStorage.setItem(LS_KEY_PRED_SORT, JSON.stringify(sort));
    } catch {}
  }, []);

  const perpRows = useMemo(
    () =>
      sortPerpsForScreener(filteredPerpMarkets, perpSort, SCREENER_MAX_PERPS),
    [filteredPerpMarkets, perpSort]
  );

  const activePredictionsCount = useMemo(
    () => predictions.filter(isPredictionActiveForScreener).length,
    [predictions]
  );

  /** Filter + cap only; column sort runs client-side in PredictionsScreenerTable (no API). */
  const predictionScreenerRows = useMemo((): TopPrediction[] => {
    const q = deferredSearchQuery.toLowerCase().trim();
    const active = predictions.filter(isPredictionActiveForScreener);
    const filtered = !q
      ? active
      : active.filter((p) => p.text.toLowerCase().includes(q));
    return filtered
      .map((p) => ({
        ...p,
        totalShares: (p.yesShares ?? 0) + (p.noShares ?? 0),
      }))
      .slice(0, SCREENER_MAX_PREDICTIONS);
  }, [predictions, deferredSearchQuery]);

  return (
    <PageContainer className="mt-14 flex min-h-0 flex-1 flex-col pb-20 md:mt-0 md:pb-6">
      {/* Tabs + search */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => handleTabChange('perps')}
            className={cn(
              'rounded-md px-4 py-1.5 font-medium text-sm transition-colors',
              assetTab === 'perps'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Perpetuals
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('predictions')}
            className={cn(
              'rounded-md px-4 py-1.5 font-medium text-sm transition-colors',
              assetTab === 'predictions'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Predictions
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 shadow-sm transition-[border-color,background-color,box-shadow] focus-within:border-foreground/20 focus-within:bg-background/70 focus-within:shadow-md dark:focus-within:border-foreground/25">
          <Filter
            className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground opacity-80"
            aria-hidden
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              assetTab === 'perps'
                ? 'Filter by ticker or name…'
                : 'Filter predictions by question…'
            }
            className="h-8 w-full min-w-0 border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            aria-label={
              assetTab === 'perps'
                ? 'Filter perpetual markets'
                : 'Filter prediction markets'
            }
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex min-h-[min(70vh,720px)] min-w-0 flex-1 flex-col">
        {assetTab === 'perps' ? (
          <TrendingScreenerTable
            rows={perpRows}
            perpLoading={perpLoading}
            sort={perpSort}
            onSortChange={handlePerpSortChange}
          />
        ) : (
          <PredictionsScreenerTable
            predictions={predictionScreenerRows}
            predictionsTotalCount={predictions.length}
            activePredictionsCount={activePredictionsCount}
            predictionsLoading={predictionsLoading}
            sort={predSort}
            onSortChange={handlePredSortChange}
          />
        )}
      </div>
    </PageContainer>
  );
}
