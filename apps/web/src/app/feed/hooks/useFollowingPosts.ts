import type { FeedPost } from '@babylon/shared';
import { FeedPostsApiResponseSchema } from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

const PAGE_SIZE = 20;

interface UseFollowingPostsOptions {
  enabled?: boolean;
}

interface UseFollowingPostsResult {
  posts: FeedPost[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

async function fetchFollowingPosts(
  userId: string,
  getAccessToken: () => Promise<string | null>
): Promise<FeedPost[]> {
  const token = await getAccessToken();

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(
    `/api/posts?following=true&userId=${userId}&limit=${PAGE_SIZE}&offset=0`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch following posts: ${response.status}`);
  }

  const json: unknown = await response.json();
  const data = FeedPostsApiResponseSchema.parse(json);
  return data.posts as FeedPost[];
}

/**
 * Hook for fetching posts from followed users/actors
 *
 * Requires authentication - returns empty if not logged in
 */
export function useFollowingPosts(
  options: UseFollowingPostsOptions = {}
): UseFollowingPostsResult {
  const { enabled = true } = options;

  const { authenticated, getAccessToken } = useAuth();
  const { user } = useAuthStore();
  const userId = user?.id;

  const {
    data: posts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['feed', 'following', userId],
    queryFn: () => fetchFollowingPosts(userId!, getAccessToken),
    enabled: enabled && authenticated && !!userId,
  });

  const refresh = async () => {
    await refetch();
  };

  return {
    posts,
    loading: isLoading,
    error: error as Error | null,
    refresh,
  };
}
