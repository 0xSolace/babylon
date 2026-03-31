'use client';

/**
 * Tiny in-row price path for the screener.
 *
 * Why IntersectionObserver: mounting `usePerpHistory` for every row on first paint
 * would multiply API/SSE work by row count. We defer until the row is near the
 * viewport, then disconnect (one-shot) to avoid churn while scrolling.
 *
 * Why SVG instead of Lightweight Charts: sparklines are static polylines; pulling
 * the full chart library per cell would bloat bundle and init cost.
 */
import { cn } from '@babylon/shared';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { usePerpHistory } from '@/hooks/usePerpHistory';
import type { MarketTimeRange } from '@/types/markets';

function SparklineSvg({
  prices,
  className,
}: {
  prices: number[];
  className?: string;
}) {
  const up = useMemo(() => {
    if (prices.length < 2) return true;
    return prices[prices.length - 1]! >= prices[0]!;
  }, [prices]);

  if (prices.length < 2) {
    return (
      <div
        className={cn('h-8 w-[72px] rounded bg-muted/40', className)}
        aria-hidden
      />
    );
  }

  // Clamp to IQR-based bounds so outlier spikes don't crush the visible range.
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  const fence = iqr * 1.5 || q3 * 0.25 || 1;
  const lo = Math.max(q1 - fence, sorted[0]!);
  const hi = Math.min(q3 + fence, sorted[sorted.length - 1]!);
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v));

  const pad = 2;
  const w = 72;
  const h = 28;
  const span = hi - lo || 1;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = h - pad - ((clamp(p) - lo) / span) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <polyline
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={up ? 'rgb(22 163 74)' : 'rgb(220 38 38)'}
        points={pts.join(' ')}
      />
    </svg>
  );
}

const MountedSparkline = memo(function MountedSparkline({
  ticker,
  timeRange,
  currentPrice,
}: {
  ticker: string;
  timeRange: MarketTimeRange;
  currentPrice: number;
}) {
  const { history, loading } = usePerpHistory(ticker, {
    range: timeRange,
    limit: 80,
    seed: { currentPrice },
  });

  const prices = useMemo(
    () =>
      history.map((h) => h.price).filter((p) => Number.isFinite(p) && p > 0),
    [history]
  );

  if (loading && prices.length < 2) {
    return <div className="h-8 w-[72px] animate-pulse rounded bg-muted/50" />;
  }

  return (
    <SparklineSvg
      prices={prices.length >= 2 ? prices : [currentPrice, currentPrice]}
    />
  );
});

export const PerpSparklineCell = memo(function PerpSparklineCell({
  ticker,
  timeRange,
  currentPrice,
}: {
  ticker: string;
  timeRange: MarketTimeRange;
  currentPrice: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '80px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex h-8 w-[72px] items-center justify-center"
      data-testid={`screener-sparkline-${ticker}`}
    >
      {visible ? (
        <MountedSparkline
          ticker={ticker}
          timeRange={timeRange}
          currentPrice={currentPrice}
        />
      ) : (
        <div className="h-8 w-[72px] rounded bg-muted/30" aria-hidden />
      )}
    </div>
  );
});
