import {
  addPublicReadHeaders,
  getCacheOrFetch,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NarrativeStory } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { buildForYouFeed } from './pipeline';

const PAGE_SIZE = 20;
const RANKED_CACHE_TTL_S = 300; // 5-minute per-user ranked snapshot

export const GET = withErrorHandling(async (request: NextRequest) => {
  const {
    error: rateLimitError,
    user,
    rateLimitInfo,
  } = await publicRateLimit(request, 'read');
  if (rateLimitError) {
    return rateLimitError;
  }

  const { searchParams } = request.nextUrl;
  const rawOffset = Number(searchParams.get('offset') ?? 0);
  const rawLimit = Number(searchParams.get('limit') ?? PAGE_SIZE);
  // Guard against NaN from non-numeric query params to avoid silent slice(0, 20) fallback.
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(PAGE_SIZE, Math.max(1, rawLimit))
    : PAGE_SIZE;

  const userId = user?.userId ?? null;
  // Per-user ranked snapshot cached for 5 minutes. Anonymous users share one
  // snapshot; authenticated users each get their own personalised slice.
  const cacheKey = userId
    ? `feed:for-you:ranked:v1:${userId}`
    : 'feed:for-you:ranked:v1:anon';

  const fullResult = await getCacheOrFetch<{
    stories: NarrativeStory[];
    generatedAt: string;
  }>(cacheKey, () => buildForYouFeed(userId), { ttl: RANKED_CACHE_TTL_S });

  const total = fullResult.stories.length;
  const page = fullResult.stories.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  const response = successResponse({
    success: true,
    stories: page,
    total,
    hasMore,
    generatedAt: fullResult.generatedAt,
  });

  if (rateLimitInfo) {
    if (userId) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      response.headers.set(
        'X-RateLimit-Remaining',
        rateLimitInfo.remaining.toString()
      );
      response.headers.set(
        'X-RateLimit-Reset',
        rateLimitInfo.resetAt.toISOString()
      );
    } else {
      addPublicReadHeaders(response, rateLimitInfo);
    }
  }

  return response;
});
