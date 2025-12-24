import type { FeedPost, FeedPostsApiResponse } from '@babylon/shared'
import { FeedPostsApiResponseSchema } from '@babylon/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useSSEChannel } from '@/hooks/useSSE'

const PAGE_SIZE = 20

interface UseFeedPostsOptions {
  enabled?: boolean
}

interface UseFeedPostsResult {
  posts: FeedPost[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  cursor: string | null
  error: Error | null
  fetchPosts: (cursor: string | null, append?: boolean) => Promise<void>
  refresh: () => Promise<void>
  addOptimisticPost: (post: FeedPost) => void
}

/**
 * Hook for fetching and managing the latest posts feed
 *
 * Features:
 * - Cursor-based pagination via react-query useInfiniteQuery
 * - SSE real-time updates
 * - Optimistic post support
 * - Race condition prevention handled by react-query
 */
export function useFeedPosts(
  options: UseFeedPostsOptions = {},
): UseFeedPostsResult {
  const { enabled = true } = options

  // Local optimistic posts (not yet returned from API)
  const [localPosts, setLocalPosts] = useState<FeedPost[]>([])

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', 'posts'] as const,
    queryFn: async ({
      pageParam,
    }: {
      pageParam: string | null
    }): Promise<FeedPostsApiResponse> => {
      const url = pageParam
        ? `/api/posts?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(pageParam)}`
        : `/api/posts?limit=${PAGE_SIZE}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`)
      }

      const json = await response.json()
      const parsed = FeedPostsApiResponseSchema.parse(json)
      return {
        posts: parsed.posts as FeedPost[],
        cursor: parsed.cursor,
        hasMore: parsed.hasMore,
      }
    },
    getNextPageParam: (lastPage: FeedPostsApiResponse) =>
      lastPage.hasMore && lastPage.cursor ? lastPage.cursor : undefined,
    initialPageParam: null as string | null,
    enabled,
  })

  // Flatten pages, deduplicate, and sort by timestamp
  const apiPosts = useMemo(() => {
    if (!data?.pages) return []
    const postMap = new Map<string, FeedPost>()
    for (const page of data.pages) {
      for (const post of page.posts) {
        // Type assertion needed because API returns string | undefined for type
        // but FeedPost expects PostType | undefined
        postMap.set(post.id, post as FeedPost)
      }
    }
    return Array.from(postMap.values()).sort((a, b) => {
      const aTime = new Date(a.timestamp ?? 0).getTime()
      const bTime = new Date(b.timestamp ?? 0).getTime()
      return bTime - aTime
    })
  }, [data?.pages])

  const addOptimisticPost = useCallback((post: FeedPost) => {
    setLocalPosts((prev) => [post, ...prev])
  }, [])

  const refresh = useCallback(async () => {
    // Clean up stale local posts on refresh
    setLocalPosts((prev) => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      return prev.filter((localPost) => {
        const postTime = new Date(localPost.timestamp).getTime()
        return postTime >= fiveMinutesAgo
      })
    })
    await refetch()
  }, [refetch])

  // fetchPosts for interface compatibility
  const fetchPosts = useCallback(
    async (requestCursor: string | null, append = false) => {
      if (append && requestCursor) {
        await fetchNextPage()
      } else {
        await refetch()
      }
    },
    [fetchNextPage, refetch],
  )

  // SSE real-time updates
  useSSEChannel('feed', () => {
    if (enabled) {
      void refetch()
    }
  })

  // Filter out local posts that now exist in API response
  const apiPostIds = useMemo(
    () => new Set(apiPosts.map((p) => p.id)),
    [apiPosts],
  )

  // Combine local optimistic posts with API posts
  const combinedPosts = useMemo(() => {
    const postMap = new Map<string, FeedPost>()
    // Add local posts first (optimistic)
    for (const post of localPosts) {
      if (!apiPostIds.has(post.id)) {
        postMap.set(post.id, post)
      }
    }
    // Add API posts
    for (const post of apiPosts) {
      if (!postMap.has(post.id)) {
        postMap.set(post.id, post)
      }
    }
    return Array.from(postMap.values()).sort((a, b) => {
      const aTime = new Date(a.timestamp ?? 0).getTime()
      const bTime = new Date(b.timestamp ?? 0).getTime()
      return bTime - aTime
    })
  }, [localPosts, apiPosts, apiPostIds])

  // Get current cursor from last page
  const currentCursor = data?.pages[data.pages.length - 1]?.cursor ?? null

  return {
    posts: combinedPosts,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    hasMore: hasNextPage ?? false,
    cursor: currentCursor,
    error: error ?? null,
    fetchPosts,
    refresh,
    addOptimisticPost,
  }
}
