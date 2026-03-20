import {
  addPublicReadHeaders,
  getCacheOrFetch,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import type { NextRequest } from 'next/server';
import {
  buildStoriesFeed,
  enrichStoriesForUser,
  type StoriesPipelineResult,
} from './pipeline';

const PAGE_SIZE = 20;
const CACHE_TTL_S = 60;

// Stories are globally scored (not user-personalised), so all users share one
// cached snapshot. Per-user like/share state is applied after cache lookup.
const CACHE_KEY = 'feed:stories:v1:current';

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
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(PAGE_SIZE, Math.max(1, rawLimit))
    : PAGE_SIZE;

  const userId = user?.userId ?? null;

  const fullResult = await getCacheOrFetch<StoriesPipelineResult>(
    CACHE_KEY,
    buildStoriesFeed,
    { ttl: CACHE_TTL_S }
  );

  // Deep-clone stories before per-user enrichment to avoid mutating the shared
  // cached object. Without this, isLiked/isShared state from one user bleeds
  // into subsequent users' responses. Anonymous requests skip the clone since
  // enrichment is never applied.
  const needsEnrichment = userId && fullResult.postIds.length > 0;
  const stories = needsEnrichment
    ? structuredClone(fullResult.stories)
    : fullResult.stories;
  if (needsEnrichment) {
    await enrichStoriesForUser(stories, fullResult.postIds, userId);
  }

  const total = stories.length;
  const page = stories.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  const response = successResponse({
    success: true,
    topic: fullResult.topic,
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
