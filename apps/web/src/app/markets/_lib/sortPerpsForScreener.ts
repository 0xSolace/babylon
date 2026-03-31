import type { PerpMarket } from '../../../types/markets';

export type SortKey =
  | 'volume24h'
  | 'asset'
  | 'change24h'
  | 'trending'
  | 'price'
  | 'openInterest'
  | 'funding';

export interface SortConfig {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function trendingScore(m: PerpMarket): number {
  return m.volume24h * Math.abs(m.changePercent24h);
}

function comparator(key: SortKey): (a: PerpMarket, b: PerpMarket) => number {
  switch (key) {
    case 'volume24h':
      return (a, b) => a.volume24h - b.volume24h;
    case 'asset':
      return (a, b) => a.ticker.localeCompare(b.ticker);
    case 'change24h':
      return (a, b) => a.changePercent24h - b.changePercent24h;
    case 'trending':
      return (a, b) => trendingScore(a) - trendingScore(b);
    case 'price':
      return (a, b) => a.currentPrice - b.currentPrice;
    case 'openInterest':
      return (a, b) => a.openInterest - b.openInterest;
    case 'funding':
      return (a, b) => a.fundingRate.rate - b.fundingRate.rate;
  }
}

export function sortPerpsForScreener(
  markets: PerpMarket[],
  sort: SortConfig,
  maxRows: number
): PerpMarket[] {
  const cmp = comparator(sort.key);
  const sorted = [...markets].sort((a, b) =>
    sort.dir === 'asc' ? cmp(a, b) : cmp(b, a)
  );
  return sorted.slice(0, maxRows);
}
