import { useJejuAuth } from '@babylon/auth/client';
import { UnreadMessagesApiResponseSchema } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

/**
 * Represents unread message counts.
 */
interface UnreadCounts {
  /** Number of pending DM requests from anonymous users */
  pendingDMs: number;
  /** Whether there are new messages in existing chats */
  hasNewMessages: boolean;
}

/**
 * Hook for efficiently polling unread and pending message counts.
 *
 * Polls the API every 30 seconds to check for:
 * - Pending DM requests from anonymous users
 * - New messages in existing chats
 *
 * Returns counts suitable for displaying notification badges. Only polls
 * when the user is authenticated. Automatically stops polling on unmount
 * or when user logs out.
 *
 * @returns An object containing:
 * - `pendingDMs`: Number of pending DM requests
 * - `hasNewMessages`: Whether there are new messages in existing chats
 * - `totalUnread`: Combined unread count (pendingDMs + 1 if hasNewMessages)
 * - `isLoading`: Whether counts are currently being fetched
 *
 * @example
 * ```tsx
 * const { pendingDMs, hasNewMessages, totalUnread } = useUnreadMessages();
 *
 * return (
 *   <Badge>
 *     {totalUnread > 0 && totalUnread}
 *   </Badge>
 * );
 * ```
 */
export function useUnreadMessages() {
  const { authenticated } = useAuth();
  const { getAccessToken } = useJejuAuth();

  const { data: counts = { pendingDMs: 0, hasNewMessages: false }, isLoading } =
    useQuery({
      queryKey: ['unreadMessages'],
      queryFn: async (): Promise<UnreadCounts> => {
        const token = await getAccessToken();
        if (!token) {
          return { pendingDMs: 0, hasNewMessages: false };
        }

        const response = await fetch('/api/chats/unread-count', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch unread count: ${response.status}`);
        }

        const json: unknown = await response.json();
        const data = UnreadMessagesApiResponseSchema.parse(json);

        return {
          pendingDMs: data.pendingDMs,
          hasNewMessages: data.hasNewMessages,
        };
      },
      enabled: authenticated,
      refetchInterval: 30000,
      staleTime: 15000,
    });

  return {
    ...counts,
    totalUnread: counts.pendingDMs + (counts.hasNewMessages ? 1 : 0),
    isLoading,
  };
}
