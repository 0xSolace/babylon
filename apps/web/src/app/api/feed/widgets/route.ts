import { withErrorHandling } from '@babylon/api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const WIDGET_ROUTES = {
  trending: '/api/feed/widgets/trending',
  markets: '/api/feed/widgets/markets',
  stats: '/api/feed/widgets/stats',
  trendingPosts: '/api/feed/widgets/trending-posts',
  breakingNews: '/api/feed/widgets/breaking-news',
  upcomingEvents: '/api/feed/widgets/upcoming-events',
} as const;

async function fetchWidget(origin: string, path: string) {
  const response = await fetch(`${origin}${path}`);
  if (!response.ok) {
    throw new Error(`Widget request failed: ${path} (${response.status})`);
  }

  return response.json();
}

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const origin = request.nextUrl.origin;

  const [
    trending,
    markets,
    stats,
    trendingPosts,
    breakingNews,
    upcomingEvents,
  ] = await Promise.all([
    fetchWidget(origin, WIDGET_ROUTES.trending),
    fetchWidget(origin, WIDGET_ROUTES.markets),
    fetchWidget(origin, WIDGET_ROUTES.stats),
    fetchWidget(origin, WIDGET_ROUTES.trendingPosts),
    fetchWidget(origin, WIDGET_ROUTES.breakingNews),
    fetchWidget(origin, WIDGET_ROUTES.upcomingEvents),
  ]);

  return NextResponse.json({
    success: true,
    widgets: {
      trending,
      markets,
      stats,
      trendingPosts,
      breakingNews,
      upcomingEvents,
    },
  });
});
