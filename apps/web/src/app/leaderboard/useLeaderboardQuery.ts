'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { LeaderboardTab } from '@/components/shared/LeaderboardToggle';
import {
  fetchLeaderboardData,
  type LeaderboardData,
} from './fetchLeaderboardData';

// Leaderboard data changes every ~15 minutes (points recompute cron).
// Show stale data instantly, revalidate in background.
const STALE_TIME = 2 * 60 * 1000; // 2 min — matches server cache TTL
const GC_TIME = 10 * 60 * 1000; // 10 min — keep old pages in memory for instant back-nav
const REFETCH_INTERVAL = 2 * 60 * 1000; // 2 min background poll

const POSITION_STALE_TIME = 5 * 60 * 1000; // 5 min — rank changes only on points recompute
const POSITION_GC_TIME = 15 * 60 * 1000; // 15 min

/**
 * React Query hook for paginated leaderboard data.
 *
 * Provides client-side caching so that:
 * - Page 1 → 2 → 1 is instant on the return trip (cached)
 * - Wallet → Team → Wallet is instant on return (cached)
 * - Tab focus triggers background revalidation
 * - Previous page data stays visible while loading the next page (placeholderData)
 */
export function useLeaderboardQuery({
  page,
  pageSize,
  tab,
  userId,
  authToken,
}: {
  page: number;
  pageSize: number;
  tab: LeaderboardTab;
  userId?: string;
  authToken?: string | null;
}) {
  return useQuery({
    queryKey: ['leaderboard', tab, page, pageSize],
    queryFn: ({ signal }) =>
      fetchLeaderboardData({
        currentPage: page,
        pageSize,
        selectedTab: tab,
        userId,
        authToken,
        signal,
      }),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    // Keep previous page data visible while loading the new page
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Separate query for the authenticated user's leaderboard position.
 *
 * Cached independently from page data so that:
 * - "Jump to My Position" is instant (position is already known)
 * - Switching pages doesn't re-fetch the position
 * - Longer staleTime (5 min) since rank only changes on points recompute
 */
export function useMyLeaderboardPosition({
  tab,
  pageSize,
  userId,
  authToken,
}: {
  tab: LeaderboardTab;
  pageSize: number;
  userId?: string;
  authToken?: string | null;
}) {
  return useQuery({
    queryKey: ['leaderboard-position', tab, userId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        type: tab,
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/leaderboard/me?${params.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.currentUser ?? null) as {
        rank: number;
        page: number;
        entry: LeaderboardData['leaderboard'][0];
      } | null;
    },
    enabled: !!userId && !!authToken,
    staleTime: POSITION_STALE_TIME,
    gcTime: POSITION_GC_TIME,
    refetchOnWindowFocus: true,
  });
}

/**
 * Prefetches the next leaderboard page in the background.
 * Call this in a useEffect after data loads — the next page will be
 * instant when the user clicks "Next".
 */
export function usePrefetchNextPage({
  currentPage,
  totalPages,
  pageSize,
  tab,
  userId,
  authToken,
}: {
  currentPage: number;
  totalPages: number | undefined;
  pageSize: number;
  tab: LeaderboardTab;
  userId?: string;
  authToken?: string | null;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (totalPages === undefined) return;
    if (currentPage >= totalPages) return;

    const nextPage = currentPage + 1;
    queryClient.prefetchQuery({
      queryKey: ['leaderboard', tab, nextPage, pageSize],
      queryFn: ({ signal }) =>
        fetchLeaderboardData({
          currentPage: nextPage,
          pageSize,
          selectedTab: tab,
          userId,
          authToken,
          signal,
        }),
      staleTime: STALE_TIME,
    });
  }, [currentPage, totalPages, pageSize, tab, userId, authToken, queryClient]);
}
