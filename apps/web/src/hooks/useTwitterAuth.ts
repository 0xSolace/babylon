import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Represents the current Twitter authentication status.
 */
interface TwitterAuthStatus {
  /** Whether Twitter is currently connected */
  connected: boolean;
  /** Twitter screen name/username */
  screenName?: string;
  /** When the connection was established */
  connectedAt?: Date;
}

/**
 * Return type for the useTwitterAuth hook.
 */
interface UseTwitterAuthReturn {
  /** Current Twitter auth status, or null if not checked yet */
  authStatus: TwitterAuthStatus | null;
  /** Whether auth status is currently loading */
  loading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Function to initiate Twitter OAuth connection */
  connectTwitter: (returnPath?: string) => void;
  /** Function to disconnect Twitter account */
  disconnectTwitter: () => Promise<void>;
  /** Function to manually refresh auth status */
  refreshStatus: () => Promise<void>;
}

declare global {
  interface Window {
    __oauth3AccessToken?: string | null;
  }
}

/**
 * Hook for managing Twitter OAuth authentication for posting posts.
 *
 * Provides functionality to connect and disconnect Twitter accounts via
 * OAuth 2.0. Automatically checks auth status on mount and when the user
 * changes. Handles OAuth callback redirects automatically.
 *
 * @returns Twitter authentication state and control functions.
 *
 * @example
 * ```tsx
 * const { authStatus, connectTwitter, disconnectTwitter } = useTwitterAuth();
 *
 * if (!authStatus?.connected) {
 *   return <button onClick={() => connectTwitter()}>Connect Twitter</button>;
 * }
 *
 * return (
 *   <div>
 *     Connected as @{authStatus.screenName}
 *     <button onClick={disconnectTwitter}>Disconnect</button>
 *   </div>
 * );
 * ```
 */
export function useTwitterAuth(): UseTwitterAuthReturn {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const {
    data: authStatus = null,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['twitterAuthStatus', user?.id],
    queryFn: async (): Promise<TwitterAuthStatus | null> => {
      const token =
        typeof window !== 'undefined' ? window.__oauth3AccessToken : null;
      if (!token) {
        return null;
      }

      const response = await fetch('/api/twitter/auth-status', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as TwitterAuthStatus;
        return data;
      }
      return null;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const twitterAuth = urlParams.get('twitter_auth');

    if (twitterAuth === 'success') {
      void queryClient.invalidateQueries({
        queryKey: ['twitterAuthStatus', user?.id],
      });

      const url = new URL(window.location.href);
      url.searchParams.delete('twitter_auth');
      window.history.replaceState({}, '', url.toString());
    }
  }, [queryClient, user?.id]);

  const disconnectMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const token =
        typeof window !== 'undefined' ? window.__oauth3AccessToken : null;
      if (!token) return;

      const response = await fetch('/api/twitter/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Twitter');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['twitterAuthStatus', user?.id],
      });
    },
  });

  const connectTwitter = useCallback(
    (_returnPath?: string) => {
      if (!user?.id) {
        return;
      }
      window.location.href = '/api/auth/twitter/initiate';
    },
    [user?.id]
  );

  const disconnectTwitter = useCallback(async () => {
    if (!user?.id) return;
    await disconnectMutation.mutateAsync();
  }, [user?.id, disconnectMutation]);

  const refreshStatus = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['twitterAuthStatus', user?.id],
    });
  }, [queryClient, user?.id]);

  const error = queryError
    ? (queryError as Error).message
    : disconnectMutation.error
      ? (disconnectMutation.error as Error).message
      : !user?.id && authStatus === null
        ? null
        : null;

  return {
    authStatus,
    loading: isLoading,
    error,
    connectTwitter,
    disconnectTwitter,
    refreshStatus,
  };
}
