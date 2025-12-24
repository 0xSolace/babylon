import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/shared/Skeleton'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useSSEChannel } from '@/hooks/useSSE'
import { api, extractDataOrNull } from '@/lib/eden-client'
import { useWidgetCacheStore } from '@/stores/widgetCacheStore'

/**
 * Article item structure for latest news panel.
 */
interface ArticleItem {
  id: string
  title: string
  summary: string
  authorOrgName: string
  byline?: string | null
  sentiment?: string | number | null
  category?: string | null
  publishedAt: string
  slant?: string | null
  biasScore?: number | null
}

/**
 * Deduplicate articles based on similarity.
 * Removes duplicate articles about the same event.
 */
function deduplicateArticles(articles: ArticleItem[]): ArticleItem[] {
  const uniqueArticles: ArticleItem[] = []
  const seenTitles = new Set<string>()

  for (const article of articles) {
    const normalizedTitle = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle)
      uniqueArticles.push(article)
    }
  }

  return uniqueArticles
}

/**
 * Latest news panel component for displaying recent articles.
 * Fetches articles from API and displays in a compact format.
 */
export function LatestNewsPanel() {
  const { setLatestNews } = useWidgetCacheStore()
  const { registerRefresh } = useWidgetRefresh()

  const {
    data: articles = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['feed', 'latest-news'],
    queryFn: async (): Promise<ArticleItem[]> => {
      const response = await api.posts.get({ type: 'article', limit: '15' })
      const data = extractDataOrNull(response)

      if (!data?.posts) {
        return []
      }

      if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
        const articlesData: ArticleItem[] = data.posts
          .filter((post) => post.type === 'article')
          .map((post) => ({
            id: post.id,
            title: post.articleTitle || 'Untitled Article',
            summary: post.content,
            authorOrgName: post.authorName || post.authorId,
            byline: post.byline,
            sentiment: post.sentiment,
            category: post.category,
            publishedAt: post.timestamp,
            slant: post.slant,
            biasScore: post.biasScore,
          }))

        const uniqueArticles = deduplicateArticles(articlesData).slice(0, 5)
        setLatestNews(uniqueArticles)
        return uniqueArticles
      }

      return []
    },
    refetchInterval: 60000,
    staleTime: 30000,
  })

  // Register for SSE updates on feed channel
  useSSEChannel('feed', () => {
    refetch()
  })

  // Register for manual refresh
  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  registerRefresh('latest-news', handleRefresh)

  // Format relative time
  const formatTime = useMemo(
    () => (dateStr: string) => {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return `${diffDays}d ago`
    },
    [],
  )

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold text-foreground text-sm">
          Latest News
        </h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold text-foreground text-sm">
          Latest News
        </h3>
        <p className="text-muted-foreground text-sm">No articles available</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-semibold text-foreground text-sm">
        Latest News
      </h3>
      <div className="space-y-3">
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/post/${article.id}`}
            className="group block"
          >
            <div className="space-y-0.5">
              <h4 className="line-clamp-2 font-medium text-foreground text-sm transition-colors group-hover:text-primary">
                {article.title}
              </h4>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span>{article.authorOrgName}</span>
                <span>·</span>
                <span>{formatTime(article.publishedAt)}</span>
                {article.category && (
                  <>
                    <span>·</span>
                    <span className="text-primary">{article.category}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
