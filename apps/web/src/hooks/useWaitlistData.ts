'use client';

import { logger } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type {
  LeaderboardTab,
  TopUser,
  WaitlistData,
} from '@/components/waitlist/types';
import { useAuth } from '@/hooks/useAuth';

interface UseWaitlistDataOptions {
  authenticated: boolean;
  userId: string | undefined;
  profileComplete: boolean | undefined;
  username: string | undefined;
}

interface UseWaitlistDataReturn {
  waitlistData: WaitlistData | null;
  topUsers: TopUser[];
  leaderboardPage: number;
  leaderboardTotalPages: number;
  leaderboardTab: LeaderboardTab;
  showRankImprovement: boolean;
  setLeaderboardPage: (page: number) => void;
  setLeaderboardTab: (tab: LeaderboardTab) => void;
  fetchWaitlistPosition: (
    userId: string,
    skipLeaderboard?: boolean
  ) => Promise<boolean>;
  fetchLeaderboardPage: (
    page: number,
    tab?: LeaderboardTab
  ) => Promise<boolean>;
  refreshWaitlistData: () => Promise<void>;
}

interface WaitlistPositionResponse {
  position: number | null;
  leaderboardRank: number;
  waitlistPosition: number;
  totalAhead: number;
  totalCount: number;
  percentile: number;
  inviteCode: string;
  points: number;
  pointsBreakdown: {
    total: number;
    invite: number;
    earned: number;
    bonus: number;
    base: number;
  };
  referralCount: number;
  weeklyReferralCount?: number;
  weeklyLimit?: number;
  invitedCount?: number;
  qualifiedCount?: number;
  totalReferralPoints?: number;
}

interface LeaderboardResponse {
  leaderboard?: TopUser[];
  totalPages?: number;
}

export function useWaitlistData({
  authenticated,
  userId,
  profileComplete,
  username,
}: UseWaitlistDataOptions): UseWaitlistDataReturn {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTab, setLeaderboardTab] =
    useState<LeaderboardTab>('leaderboard');
  const [previousRank, setPreviousRank] = useState<number | null>(null);
  const [showRankImprovement, setShowRankImprovement] = useState(false);

  const getPointsTypeForTab = useCallback(
    (tab: LeaderboardTab) => (tab === 'leaderboard' ? 'total' : 'invite'),
    []
  );

  // Query for waitlist position
  const { data: waitlistData = null, refetch: refetchPosition } = useQuery({
    queryKey: ['waitlistPosition', userId],
    queryFn: async (): Promise<WaitlistData | null> => {
      const token = await getAccessToken();

      const response = await fetch('/api/waitlist/position', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          'Failed to fetch waitlist position',
          { userId, status: response.status, errorText },
          'useWaitlistData'
        );
        return null;
      }

      const data = (await response.json()) as WaitlistPositionResponse;

      if (data.position === null) {
        return null;
      }

      // Check if rank improved
      if (previousRank !== null && data.leaderboardRank < previousRank) {
        setShowRankImprovement(true);
        setTimeout(() => setShowRankImprovement(false), 5000);
      }
      setPreviousRank(data.leaderboardRank);

      return {
        position: data.position,
        leaderboardRank: data.leaderboardRank,
        waitlistPosition: data.waitlistPosition,
        totalAhead: data.totalAhead,
        totalCount: data.totalCount,
        percentile: data.percentile,
        inviteCode: data.inviteCode,
        points: data.points,
        pointsBreakdown: data.pointsBreakdown,
        referralCount: data.referralCount,
        weeklyReferralCount: data.weeklyReferralCount,
        weeklyLimit: data.weeklyLimit,
        invitedCount: data.invitedCount,
        qualifiedCount: data.qualifiedCount,
        totalReferralPoints: data.totalReferralPoints,
      };
    },
    enabled: authenticated && !!userId && profileComplete && !!username,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Query for leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard', leaderboardPage, leaderboardTab],
    queryFn: async (): Promise<{ topUsers: TopUser[]; totalPages: number }> => {
      const pointsType = getPointsTypeForTab(leaderboardTab);
      const response = await fetch(
        `/api/waitlist/leaderboard?page=${leaderboardPage}&limit=10&pointsType=${pointsType}`
      );

      if (!response.ok) {
        logger.warn(
          'Failed to fetch leaderboard page',
          { page: leaderboardPage, status: response.status },
          'useWaitlistData'
        );
        return { topUsers: [], totalPages: 10 };
      }

      const data = (await response.json()) as LeaderboardResponse;
      return {
        topUsers: data.leaderboard ?? [],
        totalPages: data.totalPages ?? 10,
      };
    },
    enabled: authenticated && !!userId && profileComplete && !!username,
    staleTime: 300000, // 5 minutes
  });

  const fetchWaitlistPosition = useCallback(
    async (
      _fetchUserId: string,
      _skipLeaderboard = false
    ): Promise<boolean> => {
      const result = await refetchPosition();
      return result.data !== null;
    },
    [refetchPosition]
  );

  const fetchLeaderboardPage = useCallback(
    async (
      page: number,
      tab: LeaderboardTab = leaderboardTab
    ): Promise<boolean> => {
      setLeaderboardPage(page);
      if (tab !== leaderboardTab) {
        setLeaderboardTab(tab);
      }
      await queryClient.invalidateQueries({
        queryKey: ['leaderboard', page, tab],
      });
      return true;
    },
    [leaderboardTab, queryClient]
  );

  const refreshWaitlistData = useCallback(async () => {
    if (userId) {
      await queryClient.invalidateQueries({
        queryKey: ['waitlistPosition', userId],
      });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  }, [queryClient, userId]);

  return {
    waitlistData,
    topUsers: leaderboardData?.topUsers ?? [],
    leaderboardPage,
    leaderboardTotalPages: leaderboardData?.totalPages ?? 10,
    leaderboardTab,
    showRankImprovement,
    setLeaderboardPage,
    setLeaderboardTab,
    fetchWaitlistPosition,
    fetchLeaderboardPage,
    refreshWaitlistData,
  };
}
