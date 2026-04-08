/**
 * Admin Content Moderation Queue API
 *
 * @route GET /api/admin/content-queue - Get flagged content for review
 * @access Admin
 *
 * @description
 * Returns posts and comments that have been reported for moderation review.
 * Supports filtering by content type and status.
 *
 * PERFORMANCE: Uses JOIN with GROUP BY for report counts instead of subqueries
 * to avoid N+1 query patterns at scale.
 */

import { requireAdmin, successResponse, withErrorHandling } from '@babylon/api';
import { fetchAdminContentQueueBundle } from '@babylon/db';
import { asSystem } from '@babylon/db/engine-storage';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// Allowed image URL domains for content moderation display
const ALLOWED_IMAGE_DOMAINS = [
  'images.unsplash.com',
  'picsum.photos',
  'cloudinary.com',
  'res.cloudinary.com',
  'babylon-storage.s3.amazonaws.com',
  'storage.googleapis.com',
  'cdn.babylon.market',
];

/**
 * Validate and sanitize image URL
 * Returns null for invalid/non-HTTPS/non-allowlisted URLs to prevent XSS/SSRF attacks
 */
function sanitizeImageUrl(url: string | null): string | null {
  if (!url) return null;

  const parsed = new URL(url); // Let it throw on invalid URL - handled at API boundary

  if (parsed.protocol !== 'https:') {
    logger.warn('Non-HTTPS image URL rejected', { url }, 'sanitizeImageUrl');
    return null;
  }

  const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(
    (domain) =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowedDomain) {
    logger.warn(
      `Image URL from non-allowlisted domain rejected: ${parsed.hostname}`,
      { url },
      'sanitizeImageUrl'
    );
    return null; // Enforce allowlist for security
  }

  return url;
}

const ContentQueueQuerySchema = z.object({
  type: z.enum(['all', 'posts', 'comments']).default('all'),
  status: z.enum(['pending', 'resolved']).default('pending'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).max(1000).default(0), // Max offset prevents scanning entire dataset
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);

  // Validate query parameters with Zod
  const parseResult = ContentQueueQuerySchema.safeParse({
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
  });

  if (!parseResult.success) {
    return successResponse(
      {
        error: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      },
      400
    );
  }

  const { type: contentType, status, limit, offset } = parseResult.data;

  logger.info(
    'Content queue requested',
    { contentType, status, limit, offset },
    'GET /api/admin/content-queue'
  );

  const { reportedPosts, reportedComments, postStats, commentStats } =
    await asSystem(
      (tx) =>
        fetchAdminContentQueueBundle(tx, {
          contentType,
          status,
          limit,
          offset,
        }),
      'admin-content-queue'
    );

  return successResponse({
    posts: reportedPosts.map((p) => {
      const sanitizedImage = sanitizeImageUrl(p.imageUrl);
      return {
        ...p,
        type: 'post' as const,
        isHidden: p.deletedAt !== null,
        reactionCount: 0,
        commentCount: 0,
        mediaUrls: sanitizedImage ? [sanitizedImage] : [],
      };
    }),
    comments: reportedComments.map((c) => ({
      ...c,
      type: 'comment' as const,
      isHidden: c.deletedAt !== null,
      reactionCount: 0,
    })),
    stats: {
      posts: {
        pending: postStats?.pending ?? 0,
        hidden: postStats?.deleted ?? 0,
      },
      comments: {
        pending: commentStats?.pending ?? 0,
        hidden: commentStats?.deleted ?? 0,
      },
      totalPending: (postStats?.pending ?? 0) + (commentStats?.pending ?? 0),
    },
  });
});
