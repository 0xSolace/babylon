/**
 * Column-based perp screener sorting (pure functions, safe for unit tests).
 *
 * Supports clicking any column header to sort asc/desc, plus a composite
 * "trending" score (70% volume + 30% |change|) for the default view.
 */
import type { PerpMarket } from '@/types/markets';

/** Sortable column identifiers. */
export type ScreenerSortKey =
  | 'asset'
  | 'price'
  | 'change24h'
  | 'openInterest'
  | 'volume24h'
  | 'funding'
  | 'trending';

export type SortDirection = 'asc' | 'desc';

export interface ScreenerSort {
  key: ScreenerSortKey;
  dir: SortDirection;
}

/** Default sort for each column when first clicked. */
export const DEFAULT_SORT_DIR: Record<ScreenerSortKey, SortDirection> = {
  asset: 'asc',
  price: 'desc',
  change24h: 'desc',
  openInterest: 'desc',
  volume24h: 'desc',
  funding: 'desc',
  trending: 'desc',
};

/** Same 70/30 split as the dashboard trending computation. */
const TRENDING_WEIGHTS = { VOLUME: 70, CHANGE: 30 } as const;

function trendingScore(
  market: PerpMarket,
  maxVolume: number,
  maxChange: number
): number {
  const volumeScore = (market.volume24h / maxVolume) * TRENDING_WEIGHTS.VOLUME;
  const changeScore =
    (Math.abs(market.changePercent24h) / maxChange) * TRENDING_WEIGHTS.CHANGE;
  return volumeScore + changeScore;
}

function numericAccessor(
  key: ScreenerSortKey,
  m: PerpMarket,
  maxVolume: number,
  maxChange: number
): number {
  switch (key) {
    case 'price':
      return m.currentPrice;
    case 'change24h':
      return m.changePercent24h;
    case 'openInterest':
      return m.openInterest;
    case 'volume24h':
      return m.volume24h;
    case 'funding':
      return m.fundingRate.rate;
    case 'trending':
      return trendingScore(m, maxVolume, maxChange);
    default:
      return 0;
  }
}

/**
 * Sort and cap perp markets for the screener table.
 * Caller supplies already-filtered markets (e.g. search); this module only orders.
 */
export function sortPerpsForScreener(
  markets: PerpMarket[],
  sort: ScreenerSort,
  maxRows: number
): PerpMarket[] {
  if (markets.length === 0) return [];

  const maxVolume = Math.max(...markets.map((m) => m.volume24h), 1);
  const maxChange = Math.max(
    ...markets.map((m) => Math.abs(m.changePercent24h)),
    1
  );

  const copy = [...markets];
  const dir = sort.dir === 'asc' ? 1 : -1;

  if (sort.key === 'asset') {
    copy.sort((a, b) => dir * a.ticker.localeCompare(b.ticker));
  } else {
    copy.sort((a, b) => {
      const va = numericAccessor(sort.key, a, maxVolume, maxChange);
      const vb = numericAccessor(sort.key, b, maxVolume, maxChange);
      if (va !== vb) return dir * (va - vb);
      return a.ticker.localeCompare(b.ticker);
    });
  }

  return copy.slice(0, maxRows);
}

// ---------------------------------------------------------------------------
// Legacy preset helpers (backwards compat for any callers)
// ---------------------------------------------------------------------------

/** @deprecated Use ScreenerSort instead. */
export type ScreenerPerpMode = 'top' | 'trending' | 'surge' | 'all' | 'pump';

const MODE_TO_SORT: Record<ScreenerPerpMode, ScreenerSort> = {
  top: { key: 'volume24h', dir: 'desc' },
  trending: { key: 'trending', dir: 'desc' },
  surge: { key: 'change24h', dir: 'desc' },
  all: { key: 'asset', dir: 'asc' },
  pump: { key: 'change24h', dir: 'desc' },
};

/** @deprecated Convert old mode to new sort config. */
export function modeToSort(mode: ScreenerPerpMode): ScreenerSort {
  return MODE_TO_SORT[mode];
}
