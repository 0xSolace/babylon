'use client';

import { cn, formatCurrency } from '@babylon/shared/utils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface TradeItem {
  id: string;
  type: string;
  timestamp: string;
  data: {
    tradeType: string;
    marketId: string | null;
    marketQuestion: string | null;
    amount: number;
    description: string | null;
  };
}

interface WalletHistoryProps {
  userId: string;
  mode?: 'sidebar' | 'page';
}

const TRADE_TYPE_LABELS: Record<string, string> = {
  pred_buy: 'Prediction Buy',
  pred_sell: 'Prediction Sell',
  perp_open: 'Perp Open',
  perp_close: 'Perp Close',
  perp_liquidation: 'Liquidation',
};

function TradeIcon({ tradeType }: { tradeType: string }) {
  switch (tradeType) {
    case 'pred_buy':
    case 'perp_open':
      return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
    case 'pred_sell':
    case 'perp_close':
      return <ArrowDownLeft className="h-3.5 w-3.5 text-sky-500" />;
    case 'perp_liquidation':
      return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
    default:
      return <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export function WalletHistory({ userId, mode = 'page' }: WalletHistoryProps) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getAccessToken } = useAuth();
  const controllerRef = useRef<AbortController | null>(null);
  const isSidebar = mode === 'sidebar';

  const fetchTrades = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `/api/users/${encodeURIComponent(userId)}/activity?type=trade&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      if (!response.ok) {
        setError('Failed to load history');
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (controller.signal.aborted) return;

      setTrades(data.data?.activities ?? data.activities ?? []);
      setLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setLoading(false);
    }
  }, [userId, getAccessToken]);

  useEffect(() => {
    void fetchTrades();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchTrades]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={() => void fetchTrades()}
          className="flex items-center gap-1 text-sky-500 text-sm hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p>No trading history yet</p>
        <p className="mt-1 text-sm">Your trades will appear here</p>
      </div>
    );
  }

  const fmt = (amount: number) =>
    formatCurrency(amount, { useThousandsSeparator: true });

  return (
    <div className={cn('space-y-0.5', isSidebar ? 'p-3' : 'p-4')}>
      {trades.map((trade) => (
        <div
          key={trade.id}
          className={cn(
            'flex items-center gap-3 rounded px-2',
            isSidebar ? 'py-2' : 'py-2.5'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <TradeIcon tradeType={trade.data.tradeType} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground text-sm">
                {TRADE_TYPE_LABELS[trade.data.tradeType] ??
                  trade.data.tradeType}
              </span>
              <span
                className={cn(
                  'shrink-0 font-semibold text-sm',
                  trade.data.tradeType.includes('buy') ||
                    trade.data.tradeType.includes('open')
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                )}
              >
                {trade.data.tradeType.includes('buy') ||
                trade.data.tradeType.includes('open')
                  ? '-'
                  : '+'}
                {fmt(trade.data.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground text-xs">
                {trade.data.marketQuestion ?? trade.data.description ?? 'Trade'}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {formatRelativeTime(trade.timestamp)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
