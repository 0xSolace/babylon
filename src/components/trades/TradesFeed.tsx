'use client';

import { FeedSkeleton } from '@/components/shared/Skeleton';
import { Activity } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Trade, TradeCard } from './TradeCard';

const PAGE_SIZE = 20;
const SCROLL_THRESHOLD = 100; // pixels from top to consider "at top"
const POLL_INTERVAL = 10000; // 10 seconds

type TradesFeedProps = {
  userId?: string; // Optional: filter trades by user ID
  containerRef?: React.RefObject<HTMLDivElement | null>;
};

export function TradesFeed({ userId, containerRef }: TradesFeedProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [shouldPoll, setShouldPoll] = useState(true);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch trades from API
  const fetchTrades = useCallback(
    async (requestOffset: number, append = false) => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: requestOffset.toString(),
      });

      if (userId) {
        params.append('userId', userId);
      }

      const response = await fetch(`/api/trades?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch trades');

      const data = await response.json();
      const newTrades = data.trades || [];

      if (append) {
        setTrades((prev) => {
          // Deduplicate trades by ID
          const existingIds = new Set(prev.map((t) => t.id));
          const uniqueNewTrades = newTrades.filter((t: Trade) => !existingIds.has(t.id));
          return [...prev, ...uniqueNewTrades];
        });
        setLoadingMore(false);
      } else {
        setTrades(newTrades);
        setLoading(false);
      }

      setHasMore(data.hasMore || false);
      setOffset(requestOffset + newTrades.length);
    },
    [userId]
  );

  // Refresh trades (used by polling and pull-to-refresh)
  const refreshTrades = useCallback(async () => {
    // Silent refresh - don't show loading state
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: '0',
    });

    if (userId) {
      params.append('userId', userId);
    }

    const response = await fetch(`/api/trades?${params.toString()}`);
    if (!response.ok) return;

    const data = await response.json();
    const newTrades = data.trades || [];

    // Only update if we have new trades
    if (newTrades.length > 0) {
      setTrades(newTrades);
      setHasMore(data.hasMore || false);
      setOffset(newTrades.length);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchTrades(0, false);
  }, [fetchTrades]);

  // Handle scroll to detect if user is at top
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const isNearTop = scrollTop <= SCROLL_THRESHOLD;

      setIsAtTop(isNearTop);
      setShouldPoll(isNearTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  // Polling: refresh when at top
  useEffect(() => {
    if (!shouldPoll || !isAtTop) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Only poll if page is visible
    const pollIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshTrades();
      }
    };

    pollingIntervalRef.current = setInterval(pollIfVisible, POLL_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [shouldPoll, isAtTop, refreshTrades]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoadingMore(true);
          fetchTrades(offset, true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, offset, fetchTrades]);

  if (loading) {
    return (
      <div className="w-full">
        <FeedSkeleton count={5} />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
        <h3 className="mb-2 font-semibold text-foreground text-lg">No trades yet</h3>
        <p className="max-w-sm text-muted-foreground text-sm">
          {userId
            ? "This user hasn't made any trades yet."
            : 'No trades to display. Check back later!'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Polling indicator */}
      {!isAtTop && (
        <div className="sticky top-0 z-10 bg-primary/90 py-2 text-center text-primary-foreground text-sm backdrop-blur-sm">
          Scroll to top to see new trades
        </div>
      )}

      {/* Trades list */}
      <div className="space-y-0">
        {trades.map((trade) => (
          <TradeCard key={`${trade.type}-${trade.id}`} trade={trade} />
        ))}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8">
          {loadingMore && (
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2"></div>
            </div>
          )}
        </div>
      )}

      {/* End of list message */}
      {!hasMore && trades.length > 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">You've reached the end</div>
      )}
    </div>
  );
}
