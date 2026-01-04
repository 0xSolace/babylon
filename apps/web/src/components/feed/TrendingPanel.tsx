import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { Skeleton } from '@/components/shared/Skeleton'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useSSEChannel } from '@/hooks/useSSE'
import { api, extractDataOrNull } from '@/lib/eden-client'
import { useRouter } from '@/lib/navigation'
import {
  type TrendingItem,
  useWidgetCacheStore,
} from '@/stores/widgetCacheStore'

/**
 * Trending panel component for displaying trending topics.
 *
 * Displays a list of trending topics/hashtags with post counts and summaries.
 * Uses widget cache for performance and supports manual refresh via
 * WidgetRefreshContext. Navigates to trending detail page on click.
 *
 * Features:
 * - Trending topics list
 * - Post count display
 * - Category and summary
 * - Widget caching
 * - Manual refresh support
 * - Loading states
 *
 * @returns Trending panel element
 */
export function TrendingPanel() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { getTrending, setTrending: cacheTrending } = useWidgetCacheStore()
  const { registerRefresh, unregisterRefresh } = useWidgetRefresh()

  const { data: trending = [], isLoading } = useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: async (): Promise<TrendingItem[]> => {
      const response = await api.feed.widgets.trending.get()
      const data = extractDataOrNull(response)
      if (!data?.success || !data.trending) {
        return []
      }
      cacheTrending(data.trending)
      return data.trending
    },
    initialData: () => {
      const cached = getTrending()
      return cached && cached.length > 0 ? cached : undefined
    },
    staleTime: (cached) =>
      Array.isArray(cached) && cached.length > 0 ? 30000 : 0,
  })

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feed', 'trending'] })
  }, [queryClient])

  // Register refresh function
  useEffect(() => {
    registerRefresh('trending', refetch)
    return () => unregisterRefresh('trending')
  }, [registerRefresh, unregisterRefresh, refetch])

  // Real-time refresh on feed events
  useSSEChannel('feed', refetch)

  const handleTrendingClick = (item: TrendingItem) => {
    // Handle undefined or empty tagSlugs
    const tagSlugs = Array.isArray(item.tagSlugs) ? item.tagSlugs : []

    if (tagSlugs.length === 0) {
      // No tags, navigate to feed
      router.push('/feed')
      return
    }

    // If multiple tags, navigate to grouped view; otherwise single tag view
    if (tagSlugs.length > 1) {
      // Navigate to grouped trending view with multiple tag slugs
      const tagSlugsParam = tagSlugs.join(',')
      router.push(`/trending/group?tags=${encodeURIComponent(tagSlugsParam)}`)
    } else {
      // Single tag - use existing route
      router.push(`/trending/${tagSlugs[0]}`)
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl bg-sidebar p-4">
      <h2 className="mb-3 text-left font-bold text-foreground text-lg">
        Trending
      </h2>
      {isLoading ? (
        <div className="flex-1 space-y-3 pl-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : trending.length === 0 ? (
        <div className="flex-1 pl-3 text-muted-foreground text-sm">
          No trending topics at the moment.
        </div>
      ) : (
        <div className="flex-1 space-y-2 pl-3">
          {trending.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => handleTrendingClick(item)}
              className="-ml-1.5 flex w-full cursor-pointer items-start gap-3 rounded-lg p-1.5 text-left transition-colors duration-200 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                {/* Category and status */}
                <p className="text-muted-foreground text-xs">
                  {item.category || 'Trending'} · Trending
                </p>
                {/* Tag name(s) - show all tags if grouped, handle undefined tags */}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    item.tags.map((tag, idx) => (
                      <span key={`${item.id}-tag-${tag}`}>
                        <span className="font-semibold text-foreground text-sm leading-snug">
                          {tag}
                        </span>
                        {idx < item.tags.length - 1 && (
                          <span className="mx-1 text-muted-foreground text-xs">
                            •
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="font-semibold text-foreground text-sm leading-snug">
                      {item.summary || 'Trending topic'}
                    </span>
                  )}
                </div>
                {/* Summary */}
                {item.summary && (
                  <p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                    {item.summary}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
