'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Activity, AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FeedSkeleton } from '@/components/shared/Skeleton';
import { type Trade, TradeCard } from './TradeCard';

/**
 * Page size for pagination in trades feed.
 */
const PAGE_SIZE = 20;
/**
 * Scroll threshold in pixels from top to consider "at top" for auto-polling.
 */
const SCROLL_THRESHOLD = 100; // pixels from top to consider "at top"
/**
 * Polling interval for fetching new trades (10 seconds).
 */
const POLL_INTERVAL = 10000; // 10 seconds

/**
 * Trades API response structure.
 */
interface TradesResponse {
  trades: Trade[];
  hasMore: boolean;
}

/**
 * Trades feed component for displaying paginated list of trades.
 *
 * Displays a feed of trades with pagination, auto-polling when scrolled
 * to top, and pull-to-refresh support. Supports filtering by user ID.
 * Automatically deduplicates trades and handles loading states.
 *
 * Features:
 * - Paginated trade feed
 * - Auto-polling when at top
 * - Pull-to-refresh support
 * - User filtering
 * - Trade deduplication
 * - Loading states
 * - Empty state handling
 *
 * @param props - TradesFeed component props
 * @returns Trades feed element
 *
 * @example
 * ```tsx
 * <TradesFeed
 *   userId="user-123"
 *   containerRef={scrollContainerRef}
 * />
 * ```
 */
interface TradesFeedProps {
  userId?: string; // Optional: filter trades by user ID
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function TradesFeed({ userId, containerRef }: TradesFeedProps) {
  const [isAtTop, setIsAtTop] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
    error,
    refetch: _refetch,
  } = useInfiniteQuery({
    queryKey: ['trades', 'feed', userId],
    queryFn: async ({ pageParam = 0 }): Promise<TradesResponse> => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: pageParam.toString(),
      });

      if (userId) {
        params.append('userId', userId);
      }

      const response = await fetch(`/api/trades?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load trades: ${response.status}`);
      }

      return response.json() as Promise<TradesResponse>;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + page.trades.length, 0);
    },
    initialPageParam: 0,
    refetchInterval: isAtTop ? POLL_INTERVAL : false,
  });

  // Flatten all pages into a single array of trades, deduplicating by ID
  const trades =
    data?.pages.reduce<Trade[]>((acc, page) => {
      const existingIds = new Set(acc.map((t) => t.id));
      const uniqueTrades = page.trades.filter((t) => !existingIds.has(t.id));
      return [...acc, ...uniqueTrades];
    }, []) ?? [];

  // Handle scroll to detect if user is at top
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const isNearTop = scrollTop <= SCROLL_THRESHOLD;
      setIsAtTop(isNearTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchNextPage]);

  if (loading) {
    return (
      <div className="w-full">
        <FeedSkeleton count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="mb-2 font-semibold text-foreground text-lg">
          Failed to load trades
        </h3>
        <p className="mb-4 max-w-sm text-muted-foreground text-sm">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <button
          onClick={() => retryTrades()}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
        <h3 className="mb-2 font-semibold text-foreground text-lg">
          No trades yet
        </h3>
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
              <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            </div>
          )}
        </div>
      )}

      {/* End of list message */}
      {!hasMore && trades.length > 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          You've reached the end
        </div>
      )}
    </div>
  );
}
