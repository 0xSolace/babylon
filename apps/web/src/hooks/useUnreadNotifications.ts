'use client';

import { NotificationsCountApiResponseSchema } from '@babylon/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook for fetching and managing unread notifications count.
 *
 * Uses react-query for caching and automatic refetching.
 * Polls every 60 seconds when authenticated.
 *
 * @returns Object containing unread count, loading state, and refresh function
 *
 * @example
 * ```tsx
 * const { unreadCount, isLoading, refresh } = useUnreadNotifications();
 *
 * return (
 *   <Badge count={unreadCount}>
 *     <Bell />
 *   </Badge>
 * );
 * ```
 */
export function useUnreadNotifications() {
  const { authenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: async (): Promise<number> => {
      const token =
        typeof window !== 'undefined' ? window.__oauth3AccessToken : null;

      if (!token) {
        return 0;
      }

      const response = await fetch(
        '/api/notifications?unreadOnly=true&limit=1',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return 0;
      }

      const json: unknown = await response.json();
      const data = NotificationsCountApiResponseSchema.parse(json);
      return data.unreadCount;
    },
    enabled: authenticated && !!user,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Poll every 60 seconds
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['notifications', 'unread-count'],
    });
  }, [queryClient]);

  return {
    unreadCount,
    isLoading,
    refresh,
  };
}
