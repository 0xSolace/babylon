'use client';

/**
 * Perpetual markets table for `/markets/trending`.
 *
 * **WHY formatting imports:** OI, 24h vol, price, 24h %, and funding use `@/app/markets/_lib/formatters`
 * so non-finite data and oversized notionals never blow column width (see `docs/markets/trending-screener.md`).
 *
 * **WHY `Avatar` for Asset:** Org logos live at `/images/organizations/{organizationId}.jpg`; initials-only
 * tiles looked like missing branding. `type="business"` + `rounded-md` matches a square screener tile;
 * numeric-only org ids skip static filenames by design inside `Avatar`.
 */

import { cn } from '@babylon/shared';
import { ArrowDown, ArrowUp, ArrowUpDown, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useState } from 'react';
import {
  formatChange24h,
  formatFundingApr,
  formatPrice,
  formatVolume,
} from '@/app/markets/_lib/formatters';
import { Avatar } from '@/components/shared/Avatar';
import { Tooltip } from '@/components/ui/tooltip';
import type { PerpMarket } from '@/types/markets';
import {
  DEFAULT_SORT_DIR,
  type ScreenerSort,
  type ScreenerSortKey,
} from '../_lib/sortPerpsForScreener';
import { PerpSparklineCell } from './PerpSparklineCell';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: ScreenerSortKey | null;
  label: string;
  hint?: string;
  align: 'left' | 'right';
  sticky?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'asset', label: 'Asset', align: 'left', sticky: true },
  {
    key: null,
    label: 'Chart',
    align: 'left',
    hint: 'Mini price path (24h). Not the same window as 24h %.',
  },
  { key: 'price', label: 'Price', align: 'right' },
  {
    key: 'change24h',
    label: '24h %',
    align: 'right',
    hint: 'Change vs 24 hours ago from the market snapshot.',
  },
  {
    key: 'openInterest',
    label: 'OI',
    align: 'right',
    hint: 'Open interest: total notional size of open positions in this market (Babylon points).',
  },
  { key: 'volume24h', label: '24h Vol', align: 'right' },
  {
    key: 'funding',
    label: 'Fund.',
    align: 'right',
    hint: 'Perpetual funding rate as APR (synthetic vAMM; sign shows long vs short pressure).',
  },
  { key: null, label: 'Trade', align: 'right' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tradeHref(m: PerpMarket): string {
  const q = new URLSearchParams({
    marketKind: 'perp',
    marketId: m.ticker,
    filter: 'perp',
  });
  return `/markets?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
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

function SortableHeader({
  col,
  sort,
  onSort,
}: {
  col: ColumnDef;
  sort: ScreenerSort;
  onSort: (key: ScreenerSortKey) => void;
}) {
  const sortable = col.key !== null;
  const active = sortable && sort.key === col.key;

  const inner = (
    <>
      <span className={cn(active && 'text-foreground')}>{col.label}</span>
      {col.hint && (
        <Tooltip content={col.hint}>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={col.hint}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
      {sortable && <SortIcon active={active} dir={sort.dir} />}
    </>
  );

  const alignment =
    col.align === 'right'
      ? 'justify-end text-right'
      : 'justify-start text-left';

  return (
    <th
      className={cn(
        'group/th whitespace-nowrap px-3 py-2 font-medium',
        col.sticky &&
          'sticky left-0 z-[12] border-border border-r bg-background/95 backdrop-blur md:static md:z-auto md:border-r-0 md:bg-transparent',
        !col.sticky && col.key === null && 'px-2'
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
          // Note: Non-null assertion reflects confidence `col.key` is truthy after the prior check.
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

export interface TrendingScreenerTableProps {
  rows: PerpMarket[];
  perpLoading: boolean;
  sort: ScreenerSort;
  onSortChange: (sort: ScreenerSort) => void;
}

export const TrendingScreenerTable = memo(function TrendingScreenerTable({
  rows,
  perpLoading,
  sort,
  onSortChange,
}: TrendingScreenerTableProps) {
  const router = useRouter();
  const [navigatingTicker, setNavigatingTicker] = useState<string | null>(null);

  const handleSort = useCallback(
    (key: ScreenerSortKey) => {
      if (sort.key === key) {
        onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
      } else {
        onSortChange({ key, dir: DEFAULT_SORT_DIR[key] });
      }
    },
    [sort, onSortChange]
  );

  const handleRowClick = useCallback(
    (m: PerpMarket) => {
      setNavigatingTicker(m.ticker);
      router.push(tradeHref(m));
    },
    [router]
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card/40"
      data-testid="markets-trending-screener"
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
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
            {perpLoading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  Loading markets…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No markets match your filter.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const finiteChange = Number.isFinite(m.changePercent24h);
                const up = finiteChange && m.changePercent24h >= 0;
                const href = tradeHref(m);
                const isNavigating = navigatingTicker === m.ticker;
                return (
                  <tr
                    key={m.ticker}
                    onClick={() => handleRowClick(m)}
                    className={cn(
                      'cursor-pointer border-border border-b border-b-border/50 transition-colors active:bg-primary/10',
                      isNavigating ? 'bg-primary/5' : 'hover:bg-muted/20'
                    )}
                  >
                    <td className="sticky left-0 z-[11] max-w-[200px] border-border border-r bg-card/95 px-3 py-2 backdrop-blur-sm md:static md:z-auto md:border-r-0 md:bg-transparent">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2"
                      >
                        {/* Avatar defaults to rounded-full; !rounded-md matches the screener tile (square with radius). */}
                        <div
                          className={cn(
                            'h-9 w-9 shrink-0 overflow-hidden rounded-md',
                            isNavigating &&
                              'animate-pulse ring-2 ring-primary/30'
                          )}
                        >
                          <Avatar
                            type="business"
                            id={m.organizationId}
                            name={m.name}
                            alt=""
                            size="sm"
                            className="h-full w-full rounded-md"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            ${m.ticker}
                          </div>
                          <div className="truncate text-muted-foreground text-xs">
                            {m.name}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <PerpSparklineCell
                        ticker={m.ticker}
                        timeRange="1D"
                        currentPrice={m.currentPrice}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
                      {formatPrice(m.currentPrice)}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-xs',
                        !finiteChange && 'text-muted-foreground',
                        finiteChange && up && 'text-green-600',
                        finiteChange && !up && 'text-red-600'
                      )}
                    >
                      {formatChange24h(m.changePercent24h)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {formatVolume(m.openInterest)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {formatVolume(m.volume24h)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-muted-foreground text-xs">
                      {formatFundingApr(m.fundingRate.rate)}
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
                        {isNavigating ? 'Opening…' : 'Trade'}
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
